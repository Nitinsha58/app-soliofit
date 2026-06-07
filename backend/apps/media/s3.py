"""Best-effort S3 (or local-stub) object deletion.

Centralises the cleanup used when a single photo/voice note is deleted and when
an order is soft-deleted (VS-21), which removes all of its media blobs at once.
Deletion is always best-effort: a missing object or a transient S3 error must
never block the database mutation that triggered it. S3's DeleteObjects is itself
idempotent — deleting a key that doesn't exist is not an error.
"""
import re
from pathlib import Path

from django.conf import settings

# The only shapes a stored key may take — exactly what PresignView mints:
# "<folder>/<uuid4>.<ext>". Keys reaching delete_objects() are owner-controlled
# input (saved on the media row at create time), so they MUST be validated against
# this contract before they are ever trusted to address an S3 object or a stub
# path — otherwise a forged key could delete an arbitrary bucket object or, in
# stub mode, traverse out of MEDIA_ROOT/stub. Ext sets mirror views.CONTENT_TYPE_EXT.
_UUID = r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
PHOTO_KEY_RE = re.compile(rf'^photos/{_UUID}\.(jpg|png|webp|heic|heif)$')
VOICE_KEY_RE = re.compile(rf'^voice-notes/{_UUID}\.(webm|m4a|mp3|ogg)$')


def is_valid_photo_key(key: str) -> bool:
    return bool(key) and PHOTO_KEY_RE.fullmatch(key) is not None


def is_valid_voice_key(key: str) -> bool:
    return bool(key) and VOICE_KEY_RE.fullmatch(key) is not None


def use_stub() -> bool:
    """True when no real bucket is configured — uploads/deletes hit local disk."""
    return not getattr(settings, 'S3_BUCKET_NAME', '')


def public_url_for(request, s3_key: str) -> str:
    """Derive the canonical public URL for a (validated) key — never trust the
    client-sent value. Mirrors PresignView so the two can't drift."""
    if use_stub():
        return request.build_absolute_uri(f'{settings.MEDIA_URL}stub/{s3_key}')
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"


def delete_objects(s3_keys) -> None:
    """Delete the given object keys, tolerating missing objects and S3 errors."""
    keys = [k for k in s3_keys if k]
    if not keys:
        return

    if use_stub():
        stub_root = Path(settings.MEDIA_ROOT) / 'stub'
        for key in keys:
            (stub_root / key).unlink(missing_ok=True)
        return

    try:
        import boto3  # noqa: PLC0415 — lazy import, only when S3 is configured
        s3 = boto3.client(
            's3',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        # DeleteObjects takes up to 1000 keys per call.
        for i in range(0, len(keys), 1000):
            batch = keys[i:i + 1000]
            s3.delete_objects(
                Bucket=settings.S3_BUCKET_NAME,
                Delete={'Objects': [{'Key': k} for k in batch], 'Quiet': True},
            )
    except Exception:
        pass  # best-effort; never block the DB mutation

"""Best-effort S3 (or local-stub) object deletion.

Centralises the cleanup used when a single photo/voice note is deleted and when
an order is soft-deleted (VS-21), which removes all of its media blobs at once.
Deletion is always best-effort: a missing object or a transient S3 error must
never block the database mutation that triggered it. S3's DeleteObjects is itself
idempotent — deleting a key that doesn't exist is not an error.
"""
from pathlib import Path

from django.conf import settings


def use_stub() -> bool:
    """True when no real bucket is configured — uploads/deletes hit local disk."""
    return not getattr(settings, 'S3_BUCKET_NAME', '')


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

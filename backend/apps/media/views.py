import uuid
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from .models import OrderPhoto, VoiceNote
from .s3 import delete_objects, public_url_for
from .serializers import OrderPhotoSerializer, VoiceNoteSerializer


def _use_stub():
    return not getattr(settings, 'S3_BUCKET_NAME', '')


# Only the folders the app actually uploads to. Anything else (incl. path-like
# input such as '../') is rejected — the s3_key prefix is never client-trusted.
ALLOWED_FOLDERS = {'photos', 'voice-notes'}

# Allowed upload MIME types → file extension. Extension is derived from the
# validated content type, never from the client-supplied filename suffix.
CONTENT_TYPE_EXT = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'audio/webm': '.webm',
    'audio/mp4':  '.m4a',
    'audio/mpeg': '.mp3',
    'audio/ogg':  '.ogg',
}

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


class PresignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        folder   = request.data.get('folder', 'photos')
        if folder not in ALLOWED_FOLDERS:
            return Response({'detail': 'Invalid folder.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize off codec suffixes, e.g. 'audio/webm;codecs=opus' → 'audio/webm'.
        raw_ct       = request.data.get('content_type') or 'image/jpeg'
        content_type = raw_ct.split(';', 1)[0].strip().lower()
        if content_type not in CONTENT_TYPE_EXT:
            return Response(
                {'detail': f'Unsupported content type: {content_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Advisory size guard (client-declared). Hard enforcement would require a
        # presigned POST with content-length-range — deferred to a storage pass.
        size = request.data.get('size')
        if size is not None:
            try:
                size_int = int(size)
            except (TypeError, ValueError):
                return Response({'detail': 'Invalid size.'}, status=status.HTTP_400_BAD_REQUEST)
            if size_int > MAX_UPLOAD_BYTES:
                return Response(
                    {'detail': f'File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        ext     = CONTENT_TYPE_EXT[content_type]
        s3_key  = f"{folder}/{uuid.uuid4()}{ext}"

        if _use_stub():
            upload_url = request.build_absolute_uri(f'/api/upload/stub/{s3_key}')
        else:
            import boto3  # noqa: PLC0415 — lazy import, only loaded when S3 is configured
            s3 = boto3.client(
                's3',
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
            upload_url = s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': settings.S3_BUCKET_NAME,
                    'Key': s3_key,
                    'ContentType': content_type,
                },
                ExpiresIn=300,
            )

        public_url = public_url_for(request, s3_key)

        return Response({
            'upload_url': upload_url,
            'public_url': public_url,
            's3_key': s3_key,
            'content_type': content_type,
        })


class StubUploadView(APIView):
    """Dev-only: accepts PUT and stores the body as a file under MEDIA_ROOT/stub/."""
    permission_classes = [AllowAny]

    def put(self, request, s3_key):
        dest = Path(settings.MEDIA_ROOT) / 'stub' / s3_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(request.body)
        return HttpResponse(status=200)


class OrderPhotoListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_order(self, request, order_id):
        try:
            return Order.objects.get(id=order_id, boutique=request.user.boutique, deleted_at__isnull=True)
        except Order.DoesNotExist:
            return None

    def get(self, request, order_id):
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        photos = OrderPhoto.objects.filter(order=order)
        return Response(OrderPhotoSerializer(photos, many=True).data)

    def post(self, request, order_id):
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrderPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = OrderPhoto.objects.filter(order=order).count()
        serializer.save(
            order=order,
            display_order=count,
            public_url=public_url_for(request, serializer.validated_data['s3_key']),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OrderPhotoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_photo(self, request, order_id, photo_id):
        try:
            return OrderPhoto.objects.get(
                id=photo_id,
                order__id=order_id,
                order__boutique=request.user.boutique,
                order__deleted_at__isnull=True,
            )
        except OrderPhoto.DoesNotExist:
            return None

    def delete(self, request, order_id, photo_id):
        photo = self._get_photo(request, order_id, photo_id)
        if not photo:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        delete_objects([photo.s3_key])
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VoiceNoteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_order(self, request, order_id):
        try:
            return Order.objects.get(id=order_id, boutique=request.user.boutique, deleted_at__isnull=True)
        except Order.DoesNotExist:
            return None

    def get(self, request, order_id):
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        notes = VoiceNote.objects.filter(order=order)
        return Response(VoiceNoteSerializer(notes, many=True).data)

    def post(self, request, order_id):
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VoiceNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            order=order,
            public_url=public_url_for(request, serializer.validated_data['s3_key']),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VoiceNoteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_note(self, request, order_id, note_id):
        try:
            return VoiceNote.objects.get(
                id=note_id,
                order__id=order_id,
                order__boutique=request.user.boutique,
                order__deleted_at__isnull=True,
            )
        except VoiceNote.DoesNotExist:
            return None

    def delete(self, request, order_id, note_id):
        note = self._get_note(request, order_id, note_id)
        if not note:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        delete_objects([note.s3_key])
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

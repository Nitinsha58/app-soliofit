import uuid
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from .models import OrderPhoto
from .serializers import OrderPhotoSerializer


def _use_stub():
    return not getattr(settings, 'S3_BUCKET_NAME', '')


class PresignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        folder       = request.data.get('folder', 'photos')
        filename     = request.data.get('filename', 'upload')
        content_type = request.data.get('content_type', 'image/jpeg')

        ext     = Path(filename).suffix or '.jpg'
        s3_key  = f"{folder}/{uuid.uuid4()}{ext}"

        if _use_stub():
            upload_url = request.build_absolute_uri(f'/api/upload/stub/{s3_key}')
            public_url = request.build_absolute_uri(f'{settings.MEDIA_URL}stub/{s3_key}')
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
            public_url = (
                f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
            )

        return Response({'upload_url': upload_url, 'public_url': public_url, 's3_key': s3_key})


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
            return Order.objects.get(id=order_id, user=request.user, deleted_at__isnull=True)
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
        serializer.save(order=order, display_order=count)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OrderPhotoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_photo(self, request, order_id, photo_id):
        try:
            return OrderPhoto.objects.get(
                id=photo_id,
                order__id=order_id,
                order__user=request.user,
                order__deleted_at__isnull=True,
            )
        except OrderPhoto.DoesNotExist:
            return None

    def delete(self, request, order_id, photo_id):
        photo = self._get_photo(request, order_id, photo_id)
        if not photo:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if _use_stub():
            stub_file = Path(settings.MEDIA_ROOT) / 'stub' / photo.s3_key
            stub_file.unlink(missing_ok=True)
        else:
            try:
                import boto3  # noqa: PLC0415
                s3 = boto3.client(
                    's3',
                    region_name=settings.AWS_REGION,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                )
                s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=photo.s3_key)
            except Exception:
                pass  # don't block deletion if S3 call fails

        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

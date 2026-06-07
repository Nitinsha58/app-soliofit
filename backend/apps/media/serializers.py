from rest_framework import serializers

from .models import OrderPhoto, VoiceNote
from .s3 import is_valid_photo_key, is_valid_voice_key


# public_url is read-only: the view derives it server-side from the validated
# s3_key (see s3.public_url_for), so a client can't point a media row at an
# arbitrary URL. s3_key is validated against the presign contract — it is later
# trusted by the S3/stub cleanup path, so an arbitrary key must be rejected here.
class OrderPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPhoto
        fields = ['id', 's3_key', 'public_url', 'photo_type', 'display_order', 'created_at']
        read_only_fields = ['id', 'public_url', 'display_order', 'created_at']

    def validate_s3_key(self, value):
        if not is_valid_photo_key(value):
            raise serializers.ValidationError('Invalid s3_key — must be a presigned photo key.')
        return value


class VoiceNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceNote
        fields = ['id', 's3_key', 'public_url', 'duration_seconds', 'created_at']
        read_only_fields = ['id', 'public_url', 'created_at']

    def validate_s3_key(self, value):
        if not is_valid_voice_key(value):
            raise serializers.ValidationError('Invalid s3_key — must be a presigned voice-note key.')
        return value

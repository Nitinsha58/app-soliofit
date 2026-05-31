from rest_framework import serializers
from .models import OrderPhoto, VoiceNote


class OrderPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPhoto
        fields = ['id', 's3_key', 'public_url', 'photo_type', 'display_order', 'created_at']
        read_only_fields = ['id', 'display_order', 'created_at']


class VoiceNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoiceNote
        fields = ['id', 's3_key', 'public_url', 'duration_seconds', 'created_at']
        read_only_fields = ['id', 'created_at']

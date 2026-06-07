from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, UserSettings, NotificationPreference


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'business_name', 'owner_name', 'phone', 'created_at']
        read_only_fields = ['id', 'email', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context['request'].user)
        return value


class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ['delivery_buffer_days', 'daily_capacity']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ['delivery_reminders', 'payment_reminders', 'daily_summary', 'new_order_confirmations']

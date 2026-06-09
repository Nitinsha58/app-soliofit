from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from .models import User, Boutique, NotificationPreference


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


class BoutiqueSettingsSerializer(serializers.ModelSerializer):
    # Operational settings now live on the boutique (ADR-0007). daily_capacity
    # must be >= 1: a capacity of 0 makes `load < daily_capacity` unsatisfiable,
    # which would silently hide the Add-Order suggestion. Bounds mirror the form.
    delivery_buffer_days = serializers.IntegerField(min_value=0, max_value=60, required=False)
    daily_capacity = serializers.IntegerField(min_value=1, max_value=100, required=False)

    class Meta:
        model = Boutique
        fields = ['delivery_buffer_days', 'daily_capacity']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ['delivery_reminders', 'payment_reminders', 'daily_summary', 'new_order_confirmations']


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    default_error_messages = {
        'invalid_link': 'This reset link is invalid or has expired. Request a new one.',
    }

    def validate(self, attrs):
        # Decode the uid → user, then verify the signed token. Any failure is
        # reported as one generic "invalid link" error (no detail leakage), and
        # the user is stashed for the view to set the new password.
        try:
            pk = force_str(urlsafe_base64_decode(attrs['uid']))
            user = User.objects.get(pk=pk, is_active=True)
        except (TypeError, ValueError, OverflowError, DjangoValidationError, User.DoesNotExist):
            self.fail('invalid_link')

        if not default_token_generator.check_token(user, attrs['token']):
            self.fail('invalid_link')

        # Token is valid — now enforce password strength against this user.
        validate_password(attrs['new_password'], user)
        attrs['user'] = user
        return attrs

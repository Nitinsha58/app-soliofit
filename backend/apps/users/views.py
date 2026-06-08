import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from .models import User, UserSettings, NotificationPreference
from .serializers import (
    UserSerializer,
    ChangePasswordSerializer,
    UserSettingsSerializer,
    NotificationPreferenceSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)

logger = logging.getLogger(__name__)


class CookieTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.user
        access = serializer.validated_data['access']
        refresh = serializer.validated_data['refresh']

        jwt = settings.SIMPLE_JWT
        response = Response({'user': UserSerializer(user).data})
        response.set_cookie(
            key=jwt['AUTH_COOKIE'],
            value=access,
            httponly=jwt['AUTH_COOKIE_HTTP_ONLY'],
            secure=jwt['AUTH_COOKIE_SECURE'],
            samesite=jwt['AUTH_COOKIE_SAMESITE'],
            path='/',
            max_age=int(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        )
        response.set_cookie(
            key=jwt['AUTH_COOKIE_REFRESH'],
            value=refresh,
            httponly=jwt['AUTH_COOKIE_HTTP_ONLY'],
            secure=jwt['AUTH_COOKIE_SECURE'],
            samesite=jwt['AUTH_COOKIE_SAMESITE'],
            path='/',
            max_age=int(jwt['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        )
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        jwt = settings.SIMPLE_JWT
        response = Response({'detail': 'Logged out.'})
        for key in [jwt['AUTH_COOKIE'], jwt['AUTH_COOKIE_REFRESH']]:
            response.delete_cookie(key, path='/', samesite=jwt['AUTH_COOKIE_SAMESITE'])
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password', 'updated_at'])
        # Keep the active session valid after the password hash changes.
        update_session_auth_hash(request, user)
        return Response({'detail': 'Password changed.'})


class OrderSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        obj, _ = UserSettings.objects.get_or_create(user=request.user)
        return Response(UserSettingsSerializer(obj).data)

    def patch(self, request):
        obj, _ = UserSettings.objects.get_or_create(user=request.user)
        serializer = UserSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        obj, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response(NotificationPreferenceSerializer(obj).data)

    def patch(self, request):
        obj, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _expiry_phrase():
    """Human-readable token lifetime derived from PASSWORD_RESET_TIMEOUT so the
    email copy can never drift from the configured value."""
    seconds = settings.PASSWORD_RESET_TIMEOUT
    if seconds % 86400 == 0:
        n, unit = seconds // 86400, 'day'
    elif seconds % 3600 == 0:
        n, unit = seconds // 3600, 'hour'
    else:
        n, unit = max(1, seconds // 60), 'minute'
    return f"{n} {unit}" if n == 1 else f"{n} {unit}s"


def _send_password_reset_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
    send_mail(
        subject='Reset your Soliofit password',
        message=(
            "We received a request to reset your Soliofit password.\n\n"
            f"Reset it here: {link}\n\n"
            f"This link expires in {_expiry_phrase()}. If you didn't request this, "
            "you can safely ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class PasswordResetThrottle(SimpleRateThrottle):
    """Throttle reset requests per email when present, falling back to IP."""
    scope = 'password_reset'

    def get_cache_key(self, request, view):
        email = (request.data.get('email') or '').strip().lower()
        ident = email or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            try:
                _send_password_reset_email(user)
            except Exception:
                # Never surface send failures: the response is identical whether
                # or not the address matched, to avoid account enumeration.
                logger.exception('Password-reset email failed to send')

        # Always 200 with neutral copy — no account enumeration.
        return Response({'detail': "If that email exists, we've sent a reset link."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password', 'updated_at'])
        # The token is now stale: default_token_generator keys on the password
        # hash, so it can't be replayed after this change.
        return Response({'detail': 'Your password has been reset. You can now log in.'})

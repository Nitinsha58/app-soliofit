from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from .models import UserSettings, NotificationPreference
from .serializers import (
    UserSerializer,
    ChangePasswordSerializer,
    UserSettingsSerializer,
    NotificationPreferenceSerializer,
)


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

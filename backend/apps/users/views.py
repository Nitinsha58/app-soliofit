from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.conf import settings
from .serializers import UserSerializer


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

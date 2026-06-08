from django.urls import path
from .views import (
    CookieTokenObtainPairView,
    LogoutView,
    MeView,
    ChangePasswordView,
    OrderSettingsView,
    NotificationPreferenceView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('order-settings/', OrderSettingsView.as_view(), name='auth-order-settings'),
    path('notification-preferences/', NotificationPreferenceView.as_view(), name='auth-notification-preferences'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
]

from django.urls import path
from .views import CookieTokenObtainPairView, LogoutView, MeView

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
]

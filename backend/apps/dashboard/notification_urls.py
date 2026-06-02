from django.urls import path
from . import views

urlpatterns = [
    path('', views.notifications),
    path('count/', views.notification_count),
]

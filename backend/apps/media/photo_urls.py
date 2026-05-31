from django.urls import path
from . import views

urlpatterns = [
    path('', views.OrderPhotoListCreateView.as_view()),
    path('<uuid:photo_id>/', views.OrderPhotoDetailView.as_view()),
]

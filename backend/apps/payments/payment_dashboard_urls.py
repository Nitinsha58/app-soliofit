from django.urls import path
from . import views

urlpatterns = [
    path('summary/', views.payment_summary),
    path('orders/', views.payment_orders),
]

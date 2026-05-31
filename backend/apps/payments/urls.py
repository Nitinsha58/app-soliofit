from django.urls import path
from . import views

urlpatterns = [
    path('', views.InstallmentListCreateView.as_view()),
    path('<uuid:installment_id>/', views.InstallmentDetailView.as_view()),
    path('<uuid:installment_id>/mark-paid/', views.InstallmentMarkPaidView.as_view()),
]

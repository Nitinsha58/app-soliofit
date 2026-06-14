from django.urls import path
from . import views

urlpatterns = [
    # VS-27.5 cutover — list (GET) + mark-(un)paid. The single-row write route
    # (<uuid>/ PATCH/DELETE) and POST were removed; the schedule is edited atomically
    # via PUT /orders/{id}/billing/. VS-29 — mark-unpaid reverts a paid row.
    path('', views.InstallmentListView.as_view()),
    path('<uuid:installment_id>/mark-paid/', views.InstallmentMarkPaidView.as_view()),
    path('<uuid:installment_id>/mark-unpaid/', views.InstallmentMarkUnpaidView.as_view()),
]

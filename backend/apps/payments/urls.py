from django.urls import path
from . import views

urlpatterns = [
    # VS-27.5 cutover — list (GET) + mark-paid only. The single-row write route
    # (<uuid>/ PATCH/DELETE) and POST were removed; the schedule is edited atomically
    # via PUT /orders/{id}/billing/.
    path('', views.InstallmentListView.as_view()),
    path('<uuid:installment_id>/mark-paid/', views.InstallmentMarkPaidView.as_view()),
]

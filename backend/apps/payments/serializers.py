from rest_framework import serializers
from .models import Installment


class InstallmentSerializer(serializers.ModelSerializer):
    status       = serializers.CharField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Installment
        fields = ['id', 'amount', 'due_date', 'paid_date', 'remarks', 'status', 'days_overdue', 'created_at']
        read_only_fields = ['id', 'paid_date', 'status', 'days_overdue', 'created_at']

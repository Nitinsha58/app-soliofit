from rest_framework import serializers
from apps.customers.models import Customer
from .models import Order


class OrderSerializer(serializers.ModelSerializer):
    customer_name    = serializers.CharField(source='customer.name', read_only=True)
    customer_phone   = serializers.CharField(source='customer.phone', read_only=True)
    customer_address = serializers.CharField(source='customer.address', read_only=True, default='')
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            self.fields['customer'].queryset = Customer.objects.filter(
                user=request.user,
                deleted_at__isnull=True,
            )

    has_delayed_installment = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model  = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'customer_address', 'status', 'delivery_date', 'total_amount',
            'priority', 'remarks', 'created_at', 'updated_at',
            'has_delayed_installment',
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

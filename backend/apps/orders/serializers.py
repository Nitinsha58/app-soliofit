from decimal import Decimal

from rest_framework import serializers
from apps.customers.models import Customer
from .models import Order


class NewInstallmentSerializer(serializers.Serializer):
    """Write-only installment item accepted by order-create and the billing edit
    (VS-27.1). Deliberately not the payments `InstallmentSerializer` — that one
    carries read-only derived fields (status / days_overdue) we don't want on input."""
    amount   = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    due_date = serializers.DateField()
    remarks  = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class OrderBillingSerializer(serializers.Serializer):
    """Payload for PUT /orders/{id}/billing/ (VS-27.1). `total_amount` mirrors the model's
    DecimalField constraints (max_digits=10, decimal_places=2) so out-of-range / over-precise
    values fail as a clean 400 instead of a DB error on save."""
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))
    installments = NewInstallmentSerializer(many=True, required=False, default=list)


class OrderSerializer(serializers.ModelSerializer):
    customer_name    = serializers.CharField(source='customer.name', read_only=True)
    customer_phone   = serializers.CharField(source='customer.phone', read_only=True)
    customer_address = serializers.CharField(source='customer.address', read_only=True, default='')
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Scoping the selectable customers to the caller's boutique enforces
            # same-boutique integrity (ADR-0007): an order can't reference another
            # boutique's customer — it simply isn't in this queryset.
            self.fields['customer'].queryset = Customer.objects.filter(
                boutique=request.user.boutique,
                deleted_at__isnull=True,
            )

    has_delayed_installment = serializers.BooleanField(read_only=True, default=False)

    # VS-27.1 — write-only initial schedule. When present on create, the view validates
    # `Σ amount == total_amount` and creates these atomically with the order. Never
    # appears in output (write_only); popped before the model is saved.
    installments = NewInstallmentSerializer(many=True, write_only=True, required=False)

    # VS-19 payment summary — derived from the queryset's `amount_paid` /
    # `has_delayed_installment` annotations (defaults keep freshly-created,
    # un-annotated orders correct). State vocabulary mirrors payments.views.
    amount_paid   = serializers.SerializerMethodField()
    remaining     = serializers.SerializerMethodField()
    payment_state = serializers.SerializerMethodField()

    def _paid(self, obj) -> Decimal:
        return getattr(obj, 'amount_paid', None) or Decimal('0')

    def get_amount_paid(self, obj) -> str:
        return str(self._paid(obj))

    def get_remaining(self, obj) -> str:
        remaining = obj.total_amount - self._paid(obj)
        return str(remaining if remaining > 0 else Decimal('0'))

    def get_payment_state(self, obj) -> str:
        total, paid = obj.total_amount, self._paid(obj)
        if total <= 0:
            return 'unbilled'
        if paid >= total:
            return 'completed'
        if getattr(obj, 'has_delayed_installment', False):
            return 'overdue'
        if paid > 0:
            return 'partial'
        return 'pending'

    class Meta:
        model  = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'customer_address', 'status', 'delivery_date', 'total_amount',
            'priority', 'remarks', 'created_at', 'updated_at', 'delivered_at',
            'has_delayed_installment', 'amount_paid', 'remaining', 'payment_state',
            'installments',
        ]
        # `status` is read-only here: status is a domain event changed only via
        # the /status/ action (sets/clears delivered_at + writes activity).
        read_only_fields = ['id', 'order_number', 'status', 'created_at', 'updated_at', 'delivered_at']

import uuid
from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        BOOKED           = 'Booked',           'Booked'
        STARTED          = 'Started',          'Started'
        READY            = 'Ready',            'Ready'
        PARTIAL_DELIVERY = 'Partial Delivery', 'Partial Delivery'
        DELIVERED        = 'Delivered',        'Delivered'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number  = models.PositiveIntegerField(unique=True, editable=False)
    user          = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='orders')
    customer      = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='orders')
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.BOOKED)
    delivery_date = models.DateField()
    total_amount  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    priority      = models.BooleanField(default=False)
    remarks       = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    deleted_at    = models.DateTimeField(null=True, blank=True)
    # Set when the order transitions into Delivered, cleared if it moves back out.
    # Drives the VS-20 "recent Delivered" board deferral (delivered_at >= today-30d).
    delivered_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'delivery_date']),
            models.Index(fields=['customer']),
            models.Index(fields=['user', 'status', 'delivered_at']),
        ]

    def __str__(self):
        return f'#{self.order_number} — {self.customer.name}'


class OrderActivity(models.Model):
    class Type(models.TextChoices):
        ORDER_CREATED       = 'order_created',       'Order Created'
        STATUS_CHANGED      = 'status_changed',      'Status Changed'
        DELIVERY_MARKED     = 'delivery_marked',     'Delivery Marked'
        PARTIAL_DELIVERY    = 'partial_delivery',    'Partial Delivery'
        INSTALLMENT_CREATED = 'installment_created', 'Installment Created'
        INSTALLMENT_PAID    = 'installment_paid',    'Installment Paid'
        PAYMENT_UPDATED     = 'payment_updated',     'Payment Updated'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order         = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=30, choices=Type.choices)
    metadata      = models.JSONField(default=dict)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'order_activities'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.activity_type} on {self.order}'

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

    class Meta:
        db_table = 'orders'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'delivery_date']),
            models.Index(fields=['customer']),
        ]

    def __str__(self):
        return f'#{self.order_number} — {self.customer.name}'

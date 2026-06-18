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
    # order_number is unique per boutique (ADR-0007), not globally.
    order_number  = models.PositiveIntegerField(editable=False)
    # Ownership is the boutique; created_by is attribution only (SET_NULL so
    # removing a staff member never deletes the boutique's orders).
    boutique      = models.ForeignKey('users.Boutique', on_delete=models.PROTECT, related_name='orders')
    created_by    = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='created_orders')
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
        constraints = [
            models.UniqueConstraint(fields=['boutique', 'order_number'],
                                    name='uniq_order_number_per_boutique'),
        ]
        indexes = [
            models.Index(fields=['boutique', 'status'], name='ord_bq_status_idx'),
            models.Index(fields=['boutique', 'delivery_date'], name='ord_bq_delivdate_idx'),
            models.Index(fields=['customer']),  # unchanged — keeps its existing name
            models.Index(fields=['boutique', 'status', 'delivered_at'], name='ord_bq_st_delv_idx'),
            models.Index(fields=['boutique', 'order_number'], name='ord_bq_ordnum_idx'),
        ]

    def save(self, *args, **kwargs):
        # Default boutique to the creator's so callers that set only created_by
        # don't have to repeat it. Ownership stays explicit.
        if self.boutique_id is None and self.created_by_id is not None:
            self.boutique_id = self.created_by.boutique_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f'#{self.order_number} — {self.customer.name}'


class OrderActivity(models.Model):
    class Type(models.TextChoices):
        ORDER_CREATED       = 'order_created',       'Order Created'
        ORDER_DELETED       = 'order_deleted',       'Order Deleted'
        STATUS_CHANGED      = 'status_changed',      'Status Changed'
        DELIVERY_MARKED     = 'delivery_marked',     'Delivery Marked'
        PARTIAL_DELIVERY    = 'partial_delivery',    'Partial Delivery'
        INSTALLMENT_CREATED = 'installment_created', 'Installment Created'
        INSTALLMENT_PAID    = 'installment_paid',    'Installment Paid'
        INSTALLMENT_UNPAID  = 'installment_unpaid',  'Installment Marked Unpaid'
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


class OrderMessageLog(models.Model):
    """Append-only send log — one row per send-initiated WhatsApp (or future channel)
    message. Tenancy follows the order (boutique-scoped via order FK, like OrderActivity)."""

    class Channel(models.TextChoices):
        WHATSAPP = 'whatsapp', 'WhatsApp'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order        = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='message_logs')
    order_status = models.CharField(max_length=20, choices=Order.Status.choices)
    channel      = models.CharField(max_length=20, choices=Channel.choices, default=Channel.WHATSAPP)
    template_key = models.CharField(max_length=100)
    # Attribution only — SET_NULL so removing a staff account never drops send history.
    sent_by      = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='sent_messages')
    sent_at      = models.DateTimeField(auto_now_add=True)
    metadata     = models.JSONField(default=dict)

    class Meta:
        db_table = 'order_message_logs'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['order', 'order_status'], name='msg_order_status_idx'),
        ]

    def __str__(self):
        return f'{self.channel} {self.order_status} for {self.order}'

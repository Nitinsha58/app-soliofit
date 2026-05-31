import uuid
from datetime import date

from django.db import models


class Installment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='installments')
    amount     = models.DecimalField(max_digits=10, decimal_places=2)
    due_date   = models.DateField()
    paid_date  = models.DateField(null=True, blank=True)
    remarks    = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'installments'
        ordering = ['due_date']

    def __str__(self):
        return f'Installment ₹{self.amount} for order {self.order_id}'

    @property
    def status(self) -> str:
        if self.paid_date:
            return 'Paid'
        if self.due_date < date.today():
            return 'Delayed'
        return 'Pending'

    @property
    def days_overdue(self) -> int:
        if self.status == 'Delayed':
            return (date.today() - self.due_date).days
        return 0

import uuid
from django.db import models


class Customer(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Ownership is the boutique (ADR-0007); created_by is attribution only, and
    # SET_NULL so removing a staff member never deletes the boutique's customers.
    boutique   = models.ForeignKey('users.Boutique', on_delete=models.PROTECT, related_name='customers')
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='created_customers')
    name       = models.CharField(max_length=200)
    phone      = models.CharField(max_length=20)
    address    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'customers'
        indexes = [
            models.Index(fields=['boutique', 'deleted_at'], name='cust_bq_deleted_idx'),
        ]

    def save(self, *args, **kwargs):
        # Convenience: default boutique to the creator's so callers that set only
        # created_by (e.g. tests) don't have to repeat it. Ownership stays explicit.
        if self.boutique_id is None and self.created_by_id is not None:
            self.boutique_id = self.created_by.boutique_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.phone})'

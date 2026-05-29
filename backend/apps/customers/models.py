import uuid
from django.db import models


class Customer(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='customers')
    name       = models.CharField(max_length=200)
    phone      = models.CharField(max_length=20)
    address    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'customers'
        indexes = [
            models.Index(fields=['user', 'deleted_at']),
        ]

    def __str__(self):
        return f'{self.name} ({self.phone})'

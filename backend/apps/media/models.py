import uuid
from django.db import models


class OrderPhoto(models.Model):
    class PhotoType(models.TextChoices):
        GARMENT = 'garment', 'Garment'
        NOTES   = 'notes',   'Notes'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order         = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='photos')
    s3_key        = models.CharField(max_length=500, unique=True)
    public_url    = models.URLField(max_length=1000)
    photo_type    = models.CharField(max_length=10, choices=PhotoType.choices)
    display_order = models.PositiveIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'order_photos'
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f'{self.photo_type} photo for order {self.order_id}'

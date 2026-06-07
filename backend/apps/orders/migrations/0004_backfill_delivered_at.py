from django.db import migrations


def backfill_delivered_at(apps, schema_editor):
    """Set delivered_at on existing Delivered orders from the latest
    DELIVERY_MARKED activity timestamp, falling back to updated_at."""
    Order = apps.get_model('orders', 'Order')
    OrderActivity = apps.get_model('orders', 'OrderActivity')
    for order in Order.objects.filter(status='Delivered', delivered_at__isnull=True).iterator():
        marked = (
            OrderActivity.objects
            .filter(order=order, activity_type='delivery_marked')
            .order_by('-created_at')
            .first()
        )
        order.delivered_at = marked.created_at if marked else order.updated_at
        order.save(update_fields=['delivered_at'])  # update_fields keeps updated_at untouched


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_order_delivered_at_order_orders_user_id_6bc867_idx'),
    ]

    operations = [
        migrations.RunPython(backfill_delivered_at, noop_reverse),
    ]

from django.db import migrations


def seed_and_backfill(apps, schema_editor):
    """Create the single MVP boutique and attach every existing User, Order, and
    Customer to it. No-op on a fresh DB (no users → nothing to seed). The owner
    is the earliest user; operational settings come from that user's UserSettings."""
    User = apps.get_model('users', 'User')
    Boutique = apps.get_model('users', 'Boutique')
    UserSettings = apps.get_model('users', 'UserSettings')
    Order = apps.get_model('orders', 'Order')
    Customer = apps.get_model('customers', 'Customer')

    first = User.objects.order_by('created_at').first()
    if first is None:
        return

    us = UserSettings.objects.filter(user=first).first()
    boutique = Boutique.objects.create(
        name=(first.business_name or 'My Boutique'),
        owner=first,
        delivery_buffer_days=us.delivery_buffer_days if us else 0,
        daily_capacity=us.daily_capacity if us else 6,
    )
    # Single-boutique MVP: every existing row belongs to the one boutique.
    User.objects.update(boutique=boutique)
    Order.objects.update(boutique=boutique)
    Customer.objects.update(boutique=boutique)


def unseed(apps, schema_editor):
    User = apps.get_model('users', 'User')
    Boutique = apps.get_model('users', 'Boutique')
    Order = apps.get_model('orders', 'Order')
    Customer = apps.get_model('customers', 'Customer')
    Order.objects.update(boutique=None)
    Customer.objects.update(boutique=None)
    User.objects.update(boutique=None)
    Boutique.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0003_boutique'),
        ('customers', '0003_tenancy'),
        ('orders', '0006_tenancy'),
    ]

    operations = [
        migrations.RunPython(seed_and_backfill, unseed),
    ]

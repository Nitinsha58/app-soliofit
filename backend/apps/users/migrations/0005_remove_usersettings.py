from django.db import migrations


class Migration(migrations.Migration):
    """Operational settings (delivery_buffer_days, daily_capacity) moved onto
    Boutique in users.0004; the per-user UserSettings table is now removed."""

    dependencies = [
        ('users', '0004_seed_boutique_backfill'),
    ]

    operations = [
        migrations.DeleteModel(name='UserSettings'),
    ]

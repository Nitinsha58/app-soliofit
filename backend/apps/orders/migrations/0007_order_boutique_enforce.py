import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Enforce: boutique non-null (rows backfilled in users.0004), per-boutique
    order_number uniqueness, and the boutique-scoped indexes."""

    dependencies = [
        ('orders', '0006_tenancy'),
        ('users', '0004_seed_boutique_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='boutique',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                    related_name='orders', to='users.boutique'),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(fields=('boutique', 'order_number'),
                                               name='uniq_order_number_per_boutique'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['boutique', 'status'], name='ord_bq_status_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['boutique', 'delivery_date'], name='ord_bq_delivdate_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['boutique', 'status', 'delivered_at'], name='ord_bq_st_delv_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['boutique', 'order_number'], name='ord_bq_ordnum_idx'),
        ),
    ]

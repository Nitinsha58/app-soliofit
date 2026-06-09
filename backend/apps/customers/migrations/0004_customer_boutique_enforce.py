import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Enforce: boutique non-null (rows backfilled in users.0004) + the
    boutique-scoped index."""

    dependencies = [
        ('customers', '0003_tenancy'),
        ('users', '0004_seed_boutique_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='boutique',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                    related_name='customers', to='users.boutique'),
        ),
        migrations.AddIndex(
            model_name='customer',
            index=models.Index(fields=['boutique', 'deleted_at'], name='cust_bq_deleted_idx'),
        ),
    ]

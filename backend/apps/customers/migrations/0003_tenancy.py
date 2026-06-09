import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Schema (nullable): Customer.user -> created_by (attribution, SET_NULL) +
    nullable boutique FK (ownership). Enforced non-null after the backfill."""

    dependencies = [
        ('customers', '0002_pg_trgm'),
        ('users', '0003_boutique'),
    ]

    operations = [
        migrations.RemoveIndex(model_name='customer', name='customers_user_id_13fa80_idx'),
        migrations.RenameField(model_name='customer', old_name='user', new_name='created_by'),
        migrations.AlterField(
            model_name='customer',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='created_customers', to='users.user'),
        ),
        migrations.AddField(
            model_name='customer',
            name='boutique',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='customers', to='users.boutique'),
        ),
    ]

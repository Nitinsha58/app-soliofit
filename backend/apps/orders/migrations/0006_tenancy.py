import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Schema (nullable): Order.user -> created_by (attribution, SET_NULL) +
    nullable boutique FK (ownership); drop the global unique on order_number.
    Per-boutique constraint + non-null + indexes land in 0007 after backfill."""

    dependencies = [
        ('orders', '0005_alter_orderactivity_activity_type'),
        ('users', '0003_boutique'),
    ]

    operations = [
        migrations.RemoveIndex(model_name='order', name='orders_user_id_17dbdf_idx'),
        migrations.RemoveIndex(model_name='order', name='orders_user_id_0931ad_idx'),
        migrations.RemoveIndex(model_name='order', name='orders_user_id_6bc867_idx'),
        migrations.RenameField(model_name='order', old_name='user', new_name='created_by'),
        migrations.AlterField(
            model_name='order',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='created_orders', to='users.user'),
        ),
        migrations.AddField(
            model_name='order',
            name='boutique',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='orders', to='users.boutique'),
        ),
        migrations.AlterField(
            model_name='order',
            name='order_number',
            field=models.PositiveIntegerField(editable=False),
        ),
    ]

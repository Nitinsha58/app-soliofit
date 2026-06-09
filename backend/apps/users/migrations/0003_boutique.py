import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Schema (nullable): add the Boutique tenant + a nullable User.boutique FK.
    Nullable so the first user can exist before any boutique (circular
    Boutique.owner <-> User.boutique); create_user keeps it populated."""

    dependencies = [
        ('users', '0002_notificationpreference_usersettings'),
    ]

    operations = [
        migrations.CreateModel(
            name='Boutique',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('delivery_buffer_days', models.PositiveSmallIntegerField(default=0)),
                ('daily_capacity', models.PositiveSmallIntegerField(default=6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                            related_name='owned_boutiques', to='users.user')),
            ],
            options={'db_table': 'boutiques'},
        ),
        migrations.AddField(
            model_name='user',
            name='boutique',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='users', to='users.boutique'),
        ),
    ]

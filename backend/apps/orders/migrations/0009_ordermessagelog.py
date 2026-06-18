import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0008_alter_orderactivity_activity_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderMessageLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order_status', models.CharField(
                    choices=[
                        ('Booked', 'Booked'), ('Started', 'Started'), ('Ready', 'Ready'),
                        ('Partial Delivery', 'Partial Delivery'), ('Delivered', 'Delivered'),
                    ],
                    max_length=20,
                )),
                ('channel', models.CharField(
                    choices=[('whatsapp', 'WhatsApp')],
                    default='whatsapp',
                    max_length=20,
                )),
                ('template_key', models.CharField(max_length=100)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('metadata', models.JSONField(default=dict)),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='message_logs',
                    to='orders.order',
                )),
                ('sent_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sent_messages',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'order_message_logs',
                'ordering': ['-sent_at'],
            },
        ),
        migrations.AddIndex(
            model_name='ordermessagelog',
            index=models.Index(fields=['order', 'order_status'], name='msg_order_status_idx'),
        ),
    ]

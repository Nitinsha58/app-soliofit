from datetime import time

from django.db import migrations, models


def backfill_working_hours(apps, schema_editor):
    # One-time backfill: every existing boutique with unset hours gets the new
    # 11:00–20:00 default. Only NULL sides are touched, so any boutique that has
    # already set its own hours is left exactly as-is.
    Boutique = apps.get_model('users', 'Boutique')
    Boutique.objects.filter(opening_time__isnull=True).update(opening_time=time(11, 0))
    Boutique.objects.filter(closing_time__isnull=True).update(closing_time=time(20, 0))


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_boutique_working_hours'),
    ]

    operations = [
        migrations.AlterField(
            model_name='boutique',
            name='opening_time',
            field=models.TimeField(blank=True, null=True, default=time(11, 0)),
        ),
        migrations.AlterField(
            model_name='boutique',
            name='closing_time',
            field=models.TimeField(blank=True, null=True, default=time(20, 0)),
        ),
        migrations.RunPython(backfill_working_hours, migrations.RunPython.noop),
    ]

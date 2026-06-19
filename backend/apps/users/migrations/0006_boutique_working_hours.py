from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_remove_usersettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='boutique',
            name='opening_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='boutique',
            name='closing_time',
            field=models.TimeField(blank=True, null=True),
        ),
    ]

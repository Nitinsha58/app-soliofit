from django.db import migrations


class Migration(migrations.Migration):

    atomic = False  # required for CREATE INDEX CONCURRENTLY

    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pg_trgm;",
            reverse_sql="DROP EXTENSION IF EXISTS pg_trgm;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS customers_name_trgm_idx ON customers USING GIN (name gin_trgm_ops);",
            reverse_sql="DROP INDEX CONCURRENTLY IF EXISTS customers_name_trgm_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS customers_phone_trgm_idx ON customers USING GIN (phone gin_trgm_ops);",
            reverse_sql="DROP INDEX CONCURRENTLY IF EXISTS customers_phone_trgm_idx;",
        ),
    ]

from .base import *  # noqa: F401, F403
from decouple import config, Csv

# ── Core ──────────────────────────────────────────────────────────────────────
DEBUG = False
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', cast=Csv())
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', cast=Csv())

# ── Behind host Nginx terminating TLS (ADR-0008) ──────────────────────────────
# Nginx sets X-Forwarded-Proto; trust it so Django treats requests as HTTPS.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Belt-and-suspenders HTTPS: Django redirects any non-HTTPS request. No loop —
# SECURE_PROXY_SSL_HEADER is trusted and Nginx forwards X-Forwarded-Proto, and
# Nginx's port-80 block 301s to 443 (never proxies plain HTTP to Django).
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'
# (SIMPLE_JWT['AUTH_COOKIE_SECURE'] is already True in base — correct for HTTPS.)

# ── Shared cache across Gunicorn workers (ADR-0008) ───────────────────────────
# Makes the password-reset throttle correct (DRF throttling uses caches['default']).
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://redis:6379/0'),
    }
}

# ── Static: serve Django/admin assets from Gunicorn via WhiteNoise ────────────
# Nginx /static/ proxies to Django; WhiteNoise serves the collected files.
MIDDLEWARE.insert(
    MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,
    'whitenoise.middleware.WhiteNoiseMiddleware',
)
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

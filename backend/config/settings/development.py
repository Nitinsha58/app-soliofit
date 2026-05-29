from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ['*']
CORS_ALLOW_ALL_ORIGINS = True

SIMPLE_JWT = {
    **SIMPLE_JWT,  # noqa: F405
    'AUTH_COOKIE_SECURE': False,  # HTTP is fine in development
}

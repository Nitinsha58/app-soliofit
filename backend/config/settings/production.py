from .base import *  # noqa: F401, F403

# Production overrides are added in VS-18 (deployment slice).
# At that point: DEBUG=False, SECURE_* headers, HSTS, etc.

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
import uuid


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        boutique = extra_fields.pop('boutique', None)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        # Solo-boutique MVP: every operator belongs to one boutique. Attach to the
        # existing one, or bootstrap it for the very first user (who then owns it).
        # User.boutique is null=True at the DB so this first save can land before
        # the boutique exists (resolves the circular Boutique.owner <-> User.boutique).
        if boutique is None:
            boutique = Boutique.objects.first()
        user.boutique = boutique
        user.save(using=self._db)
        if user.boutique is None:
            boutique = Boutique.objects.create(
                name=(user.business_name or 'My Boutique'), owner=user,
            )
            user.boutique = boutique
            user.save(using=self._db, update_fields=['boutique'])
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email         = models.EmailField(unique=True)
    business_name = models.CharField(max_length=200, blank=True)
    owner_name    = models.CharField(max_length=200, blank=True)
    phone         = models.CharField(max_length=20, blank=True)
    is_active     = models.BooleanField(default=True)
    is_staff      = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    # Tenancy: the boutique this operator belongs to (VS-23 / ADR-0007).
    # null=True at the DB, but application-guaranteed populated (see create_user).
    boutique      = models.ForeignKey('Boutique', on_delete=models.PROTECT,
                                       null=True, blank=True, related_name='users')

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'


class Boutique(models.Model):
    """The tenant. Owns all boutique data (orders, customers, …) in MVP's
    single-boutique model (VS-23 / ADR-0007). Operational settings live here
    (re-homed from the old UserSettings) — they are boutique-level, not personal."""
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                 = models.CharField(max_length=200)
    # Primary / billing owner — NOT a permissions model. Staff roles arrive later
    # via a BoutiqueMembership table (see ADR-0007 Future shape).
    owner                = models.ForeignKey(User, on_delete=models.PROTECT, related_name='owned_boutiques')
    delivery_buffer_days = models.PositiveSmallIntegerField(default=0)
    daily_capacity       = models.PositiveSmallIntegerField(default=6)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'boutiques'

    def __str__(self):
        return self.name


class NotificationPreference(models.Model):
    """Per-user notification toggles. Preference-only — not yet wired to any
    delivery channel; these flags are stored for a future notification pipeline."""
    user                    = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    delivery_reminders      = models.BooleanField(default=True)
    payment_reminders       = models.BooleanField(default=True)
    daily_summary           = models.BooleanField(default=True)
    new_order_confirmations = models.BooleanField(default=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_preferences'

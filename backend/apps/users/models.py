from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from datetime import time
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

    def save(self, *args, **kwargs):
        # Tenancy safety net for creation paths that bypass create_user
        # (Django admin's UserCreationForm, User.objects.create, shell). The first
        # operator is always bootstrapped via create_superuser/create_user, so by
        # the time any bypass path runs, a boutique already exists to attach to.
        if self._state.adding and self.boutique_id is None:
            using = kwargs.get('using') or self._state.db
            boutique = Boutique.objects.using(using).first()
            if boutique is not None:
                self.boutique = boutique
        super().save(*args, **kwargs)


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
    # Working hours — drive the WhatsApp Ready message's pickup window (VS-29.6/29.8).
    # Default to 11:00–20:00 (11 AM–8 PM) so every boutique ships with a real pickup
    # window. Still nullable: a deliberate clear in Settings (both-or-neither) falls back
    # to "during our working hours".
    opening_time         = models.TimeField(null=True, blank=True, default=time(11, 0))
    closing_time         = models.TimeField(null=True, blank=True, default=time(20, 0))
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

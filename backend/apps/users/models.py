from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
import uuid


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
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

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'


class UserSettings(models.Model):
    """Per-user operational settings. 1:1 with User, auto-created on first access."""
    user                 = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    delivery_buffer_days = models.PositiveSmallIntegerField(default=0)
    daily_capacity       = models.PositiveSmallIntegerField(default=6)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_settings'


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

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase, override_settings

from .models import UserSettings, NotificationPreference

User = get_user_model()


def _reset_creds(user):
    """Build the (uid, token) pair the reset link carries."""
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


class _Fixture(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='tailor@test.com', password='oldpass123',
            business_name='Old Boutique', owner_name='Asha', phone='111',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class ProfilePatchTests(_Fixture):
    def test_patch_updates_profile_fields(self):
        resp = self.client.patch('/api/auth/me/', {
            'business_name': 'New Boutique', 'owner_name': 'Asha Rao', 'phone': '999',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.business_name, 'New Boutique')
        self.assertEqual(self.user.owner_name, 'Asha Rao')
        self.assertEqual(self.user.phone, '999')

    def test_email_is_read_only(self):
        self.client.patch('/api/auth/me/', {'email': 'hacker@test.com'}, format='json')
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'tailor@test.com')

    def test_requires_auth(self):
        resp = APIClient().patch('/api/auth/me/', {'phone': '5'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class ChangePasswordTests(_Fixture):
    url = '/api/auth/change-password/'

    def test_happy_path(self):
        resp = self.client.post(self.url, {
            'old_password': 'oldpass123', 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('brandNew456'))

    def test_wrong_old_password_rejected(self):
        resp = self.client.post(self.url, {
            'old_password': 'wrong', 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('oldpass123'))

    def test_weak_new_password_rejected(self):
        resp = self.client.post(self.url, {
            'old_password': 'oldpass123', 'new_password': '123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('oldpass123'))


class OrderSettingsTests(_Fixture):
    url = '/api/auth/order-settings/'

    def test_get_auto_creates_with_defaults(self):
        self.assertFalse(UserSettings.objects.filter(user=self.user).exists())
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {'delivery_buffer_days': 0, 'daily_capacity': 6})
        self.assertTrue(UserSettings.objects.filter(user=self.user).exists())

    def test_patch_persists(self):
        resp = self.client.patch(self.url, {
            'delivery_buffer_days': 2, 'daily_capacity': 10,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        obj = UserSettings.objects.get(user=self.user)
        self.assertEqual(obj.delivery_buffer_days, 2)
        self.assertEqual(obj.daily_capacity, 10)

    def test_negative_value_rejected(self):
        resp = self.client.patch(self.url, {'daily_capacity': -1}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_zero_capacity_rejected(self):
        resp = self.client.patch(self.url, {'daily_capacity': 0}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationPreferenceTests(_Fixture):
    url = '/api/auth/notification-preferences/'

    def test_get_auto_creates_all_true(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {
            'delivery_reminders': True, 'payment_reminders': True,
            'daily_summary': True, 'new_order_confirmations': True,
        })

    def test_patch_toggles_persist(self):
        resp = self.client.patch(self.url, {
            'delivery_reminders': False, 'daily_summary': False,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        obj = NotificationPreference.objects.get(user=self.user)
        self.assertFalse(obj.delivery_reminders)
        self.assertFalse(obj.daily_summary)
        self.assertTrue(obj.payment_reminders)

    def test_isolation_between_users(self):
        other = User.objects.create_user(email='other@test.com', password='x')
        NotificationPreference.objects.create(user=other, delivery_reminders=False)
        resp = self.client.get(self.url)
        self.assertTrue(resp.data['delivery_reminders'])


class PasswordResetRequestTests(TestCase):
    url = '/api/auth/password-reset/'

    def setUp(self):
        cache.clear()  # reset throttle history between tests
        self.user = User.objects.create_user(email='tailor@test.com', password='oldpass123')
        self.client = APIClient()

    def test_known_email_sends_link(self):
        resp = self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/reset-password?uid=', mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, ['tailor@test.com'])

    def test_case_insensitive_email(self):
        resp = self.client.post(self.url, {'email': 'TAILOR@test.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_expiry_copy_matches_configured_timeout(self):
        # Default 3 days renders "3 days"...
        self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
        self.assertIn('expires in 3 days', mail.outbox[0].body)

    @override_settings(PASSWORD_RESET_TIMEOUT=3600)
    def test_expiry_copy_tracks_non_day_timeout(self):
        # ...and a 1-hour timeout renders "1 hour" (no hardcoded "3 days").
        self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
        self.assertIn('expires in 1 hour', mail.outbox[0].body)

    def test_unknown_email_no_enumeration(self):
        resp = self.client.post(self.url, {'email': 'nobody@test.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['detail'], "If that email exists, we've sent a reset link.")
        self.assertEqual(len(mail.outbox), 0)

    def test_inactive_user_no_email(self):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        resp = self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_malformed_email_rejected(self):
        resp = self.client.post(self.url, {'email': 'not-an-email'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_throttled_after_limit(self):
        # Configured rate is 5/hour, keyed per email — the 6th request is blocked.
        for _ in range(5):
            resp = self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
        blocked = self.client.post(self.url, {'email': 'tailor@test.com'}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        # A different email still has its own budget.
        other = self.client.post(self.url, {'email': 'someone@test.com'}, format='json')
        self.assertEqual(other.status_code, status.HTTP_200_OK)


class PasswordResetConfirmTests(TestCase):
    url = '/api/auth/password-reset/confirm/'

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='tailor@test.com', password='oldpass123')
        self.client = APIClient()

    def test_happy_path_sets_new_password(self):
        uid, token = _reset_creds(self.user)
        resp = self.client.post(self.url, {
            'uid': uid, 'token': token, 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('brandNew456'))

    def test_bad_token_rejected(self):
        uid, _ = _reset_creds(self.user)
        resp = self.client.post(self.url, {
            'uid': uid, 'token': 'garbage-token', 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('oldpass123'))

    def test_bad_uid_rejected(self):
        _, token = _reset_creds(self.user)
        resp = self.client.post(self.url, {
            'uid': 'not-a-uid', 'token': token, 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('oldpass123'))

    def test_token_is_single_use(self):
        uid, token = _reset_creds(self.user)
        first = self.client.post(self.url, {
            'uid': uid, 'token': token, 'new_password': 'brandNew456',
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        # Same token replayed after the password changed → no longer valid.
        replay = self.client.post(self.url, {
            'uid': uid, 'token': token, 'new_password': 'anotherPass789',
        }, format='json')
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('brandNew456'))

    def test_weak_password_rejected(self):
        uid, token = _reset_creds(self.user)
        resp = self.client.post(self.url, {
            'uid': uid, 'token': token, 'new_password': '123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('oldpass123'))

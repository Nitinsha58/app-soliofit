from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from .models import UserSettings, NotificationPreference

User = get_user_model()


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

import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.orders.models import Order

User = get_user_model()


def make_user(email):
    return User.objects.create_user(email=email, password='pass')


def make_customer(user, name='Alice', phone='9876543210'):
    return Customer.objects.create(user=user, name=name, phone=phone)


def make_order(user, customer, order_number=1, status='Booked'):
    from datetime import date
    return Order.objects.create(
        user=user,
        customer=customer,
        order_number=order_number,
        status=status,
        delivery_date=date.today(),
        total_amount='500.00',
    )


class SearchViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user('owner@test.com')
        self.other = make_user('other@test.com')
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_returns_401(self):
        c = APIClient()
        resp = c.get('/api/search/?q=alice')
        self.assertEqual(resp.status_code, 401)

    def test_customer_name_partial_match(self):
        make_customer(self.user, name='Alice Smith')
        resp = self.client.get('/api/search/?q=alice')
        self.assertEqual(resp.status_code, 200)
        names = [c['name'] for c in resp.data['customers']]
        self.assertIn('Alice Smith', names)

    def test_customer_phone_match(self):
        make_customer(self.user, name='Bob', phone='9876543210')
        resp = self.client.get('/api/search/?q=98765')
        self.assertEqual(resp.status_code, 200)
        names = [c['name'] for c in resp.data['customers']]
        self.assertIn('Bob', names)

    def test_order_number_exact_match(self):
        c = make_customer(self.user)
        make_order(self.user, c, order_number=42)
        resp = self.client.get('/api/search/?q=42')
        self.assertEqual(resp.status_code, 200)
        nums = [o['order_number'] for o in resp.data['orders']]
        self.assertIn(42, nums)

    def test_order_number_with_hash_prefix(self):
        c = make_customer(self.user)
        make_order(self.user, c, order_number=7)
        resp = self.client.get('/api/search/?q=%230007')
        self.assertEqual(resp.status_code, 200)
        nums = [o['order_number'] for o in resp.data['orders']]
        self.assertIn(7, nums)

    def test_soft_deleted_customer_excluded(self):
        from django.utils import timezone
        cust = make_customer(self.user, name='DeletedAlice')
        cust.deleted_at = timezone.now()
        cust.save()
        resp = self.client.get('/api/search/?q=DeletedAlice')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['customers'], [])

    def test_other_users_customer_excluded(self):
        make_customer(self.other, name='AliceOther')
        resp = self.client.get('/api/search/?q=AliceOther')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['customers'], [])

    def test_other_users_order_excluded(self):
        c = make_customer(self.other)
        make_order(self.other, c, order_number=99)
        resp = self.client.get('/api/search/?q=99')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['orders'], [])

    def test_short_query_returns_empty(self):
        make_customer(self.user, name='Alice')
        resp = self.client.get('/api/search/?q=a')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['customers'], [])
        self.assertEqual(resp.data['orders'], [])

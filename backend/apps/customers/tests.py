from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.orders.models import Order
from apps.payments.models import Installment
from apps.users.models import User


class _Fixture(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        self.customer = Customer.objects.create(
            user=self.user, name='Alice', phone='9999999999',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.detail_url = f'/api/customers/{self.customer.id}/'

    def _order(self, st=Order.Status.BOOKED, delivered=False):
        s = Order.Status.DELIVERED if delivered else st
        return Order.objects.create(
            user=self.user, customer=self.customer,
            order_number=Order.objects.count() + 1,
            delivery_date=date.today() + timedelta(days=30),
            total_amount=Decimal('5000.00'),
            status=s,
        )


class CustomerDetailStatsTests(_Fixture):
    def test_retrieve_includes_stats(self):
        order = self._order()
        Installment.objects.create(
            order=order, amount=Decimal('2000.00'),
            due_date=date.today(), paid_date=date.today(),
        )
        resp = self.client.get(self.detail_url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total_orders'], 1)
        self.assertEqual(Decimal(resp.data['total_spent']), Decimal('2000.00'))
        self.assertEqual(Decimal(resp.data['outstanding_balance']), Decimal('3000.00'))


class CustomerDeleteBlockTests(_Fixture):
    def test_delete_blocked_with_active_orders(self):
        self._order(st=Order.Status.STARTED)
        resp = self.client.delete(self.detail_url)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('active orders', resp.data['detail'])

    def test_delete_allowed_after_all_delivered(self):
        self._order(delivered=True)
        resp = self.client.delete(self.detail_url)
        self.assertEqual(resp.status_code, 204)

    def test_delete_allowed_with_no_orders(self):
        resp = self.client.delete(self.detail_url)
        self.assertEqual(resp.status_code, 204)


class CustomerPaymentsEndpointTests(_Fixture):
    def test_returns_installments_grouped_by_order(self):
        order = self._order()
        Installment.objects.create(
            order=order, amount=Decimal('1000.00'),
            due_date=date.today() + timedelta(days=10),
        )
        resp = self.client.get(f'/api/customers/{self.customer.id}/payments/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['order_number'], order.order_number)
        self.assertEqual(len(resp.data[0]['installments']), 1)


class CustomerOrdersFilterTests(_Fixture):
    def test_orders_filter_by_customer(self):
        other_customer = Customer.objects.create(
            user=self.user, name='Bob', phone='8888888888',
        )
        self._order()
        Order.objects.create(
            user=self.user, customer=other_customer,
            order_number=99,
            delivery_date=date.today() + timedelta(days=10),
            total_amount=Decimal('1000.00'),
        )
        resp = self.client.get(f'/api/orders/?customer={self.customer.id}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(str(resp.data[0]['customer']), str(self.customer.id))

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.orders.models import Order, OrderActivity
from apps.payments.models import Installment
from apps.users.models import User


def _future():
    return str(date.today() + timedelta(days=30))


class _Fixture(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        self.customer = Customer.objects.create(user=self.user, name='Alice', phone='9999999999')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_order(self):
        return Order.objects.create(
            user=self.user,
            customer=self.customer,
            order_number=1,
            delivery_date=date.today() + timedelta(days=30),
            total_amount=Decimal('10000.00'),
        )


class ActivityOnOrderCreateTests(_Fixture):
    def test_creates_order_created_activity(self):
        resp = self.client.post('/api/orders/', {
            'customer': str(self.customer.id),
            'delivery_date': _future(),
            'total_amount': '5000.00',
        })
        self.assertEqual(resp.status_code, 201)
        order_id = resp.data['id']
        self.assertTrue(
            OrderActivity.objects.filter(order_id=order_id, activity_type='order_created').exists()
        )


class ActivityOnStatusChangeTests(_Fixture):
    def setUp(self):
        super().setUp()
        self.order = self._create_order()
        self.url = f'/api/orders/{self.order.id}/status/'

    def test_status_changed_activity(self):
        self.client.patch(self.url, {'status': 'Started'})
        act = OrderActivity.objects.get(order=self.order, activity_type='status_changed')
        self.assertEqual(act.metadata['from'], 'Booked')
        self.assertEqual(act.metadata['to'], 'Started')

    def test_delivery_marked_activity(self):
        self.client.patch(self.url, {'status': 'Delivered'})
        self.assertTrue(
            OrderActivity.objects.filter(order=self.order, activity_type='delivery_marked').exists()
        )

    def test_partial_delivery_activity(self):
        self.client.patch(self.url, {'status': 'Partial Delivery'})
        self.assertTrue(
            OrderActivity.objects.filter(order=self.order, activity_type='partial_delivery').exists()
        )


class ActivityOnInstallmentTests(_Fixture):
    def setUp(self):
        super().setUp()
        self.order = self._create_order()
        self.list_url = f'/api/orders/{self.order.id}/installments/'

    def test_installment_created_activity(self):
        self.client.post(self.list_url, {'amount': '1000.00', 'due_date': _future()})
        self.assertTrue(
            OrderActivity.objects.filter(order=self.order, activity_type='installment_created').exists()
        )

    def test_installment_paid_activity(self):
        inst = Installment.objects.create(
            order=self.order, amount=Decimal('1000.00'),
            due_date=date.today() + timedelta(days=10),
        )
        self.client.post(f'/api/orders/{self.order.id}/installments/{inst.id}/mark-paid/')
        self.assertTrue(
            OrderActivity.objects.filter(order=self.order, activity_type='installment_paid').exists()
        )

    def test_payment_updated_activity(self):
        inst = Installment.objects.create(
            order=self.order, amount=Decimal('1000.00'),
            due_date=date.today() + timedelta(days=10),
        )
        self.client.patch(
            f'/api/orders/{self.order.id}/installments/{inst.id}/',
            {'amount': '2000.00'},
        )
        act = OrderActivity.objects.get(order=self.order, activity_type='payment_updated')
        self.assertEqual(Decimal(act.metadata['amount']), Decimal('2000.00'))


class ActivitiesEndpointTests(_Fixture):
    def setUp(self):
        super().setUp()
        self.order = self._create_order()

    def test_returns_activities_newest_first(self):
        OrderActivity.objects.create(order=self.order, activity_type='order_created')
        OrderActivity.objects.create(order=self.order, activity_type='status_changed',
                                     metadata={'from': 'Booked', 'to': 'Started'})
        resp = self.client.get(f'/api/orders/{self.order.id}/activities/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[0]['activity_type'], 'status_changed')
        self.assertEqual(resp.data[1]['activity_type'], 'order_created')

    def test_unauthenticated_returns_401(self):
        anon = APIClient()
        resp = anon.get(f'/api/orders/{self.order.id}/activities/')
        self.assertEqual(resp.status_code, 401)

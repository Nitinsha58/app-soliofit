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


class OrderDateFilterTests(_Fixture):
    def setUp(self):
        super().setUp()
        self.today = date.today()
        # Create orders on 3 different dates
        self.o1 = Order.objects.create(
            user=self.user, customer=self.customer, order_number=10,
            delivery_date=self.today - timedelta(days=1), total_amount='100',
        )
        self.o2 = Order.objects.create(
            user=self.user, customer=self.customer, order_number=11,
            delivery_date=self.today, total_amount='200',
        )
        self.o3 = Order.objects.create(
            user=self.user, customer=self.customer, order_number=12,
            delivery_date=self.today + timedelta(days=1), total_amount='300',
        )

    def test_date_range_returns_only_matching_orders(self):
        from_d = str(self.today)
        to_d = str(self.today + timedelta(days=1))
        resp = self.client.get(f'/api/orders/?delivery_date_from={from_d}&delivery_date_to={to_d}')
        self.assertEqual(resp.status_code, 200)
        nums = {o['order_number'] for o in resp.data}
        self.assertIn(11, nums)
        self.assertIn(12, nums)
        self.assertNotIn(10, nums)

    def test_invalid_date_from_returns_400(self):
        resp = self.client.get('/api/orders/?delivery_date_from=not-a-date')
        self.assertEqual(resp.status_code, 400)

    def test_invalid_date_to_returns_400(self):
        resp = self.client.get('/api/orders/?delivery_date_to=2026-99-99')
        self.assertEqual(resp.status_code, 400)

    def test_from_after_to_returns_400(self):
        resp = self.client.get(
            f'/api/orders/?delivery_date_from={self.today + timedelta(days=5)}'
            f'&delivery_date_to={self.today}'
        )
        self.assertEqual(resp.status_code, 400)

    def test_list_includes_has_delayed_installment_false(self):
        resp = self.client.get('/api/orders/')
        self.assertEqual(resp.status_code, 200)
        for o in resp.data:
            self.assertIn('has_delayed_installment', o)
            self.assertFalse(o['has_delayed_installment'])

    def test_list_has_delayed_installment_true_when_overdue(self):
        Installment.objects.create(
            order=self.o2, amount='50',
            due_date=self.today - timedelta(days=1),  # overdue
        )
        resp = self.client.get('/api/orders/')
        self.assertEqual(resp.status_code, 200)
        order_map = {o['order_number']: o for o in resp.data}
        self.assertTrue(order_map[11]['has_delayed_installment'])
        self.assertFalse(order_map[10]['has_delayed_installment'])

    def test_paid_installment_does_not_set_delayed_true(self):
        Installment.objects.create(
            order=self.o2, amount='50',
            due_date=self.today - timedelta(days=1),
            paid_date=self.today,  # paid
        )
        resp = self.client.get('/api/orders/')
        order_map = {o['order_number']: o for o in resp.data}
        self.assertFalse(order_map[11]['has_delayed_installment'])

    def test_retrieve_includes_has_delayed_installment(self):
        resp = self.client.get(f'/api/orders/{self.o2.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('has_delayed_installment', resp.data)

    def test_update_status_response_has_accurate_delayed_flag(self):
        Installment.objects.create(
            order=self.o2, amount='50',
            due_date=self.today - timedelta(days=1),
        )
        resp = self.client.patch(f'/api/orders/{self.o2.id}/status/', {'status': 'Started'})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['has_delayed_installment'])

    def test_other_user_orders_excluded(self):
        other = User.objects.create_user(email='other@test.com', password='pass')
        c2 = Customer.objects.create(user=other, name='Bob', phone='1111111111')
        Order.objects.create(
            user=other, customer=c2, order_number=99,
            delivery_date=self.today, total_amount='999',
        )
        resp = self.client.get(f'/api/orders/?delivery_date_from={self.today}&delivery_date_to={self.today}')
        nums = {o['order_number'] for o in resp.data}
        self.assertNotIn(99, nums)


class OrderNumberRaceTests(_Fixture):
    def test_retry_recovers_from_unique_collision(self):
        # Seed an existing order at number 1.
        self._create_order()
        # Simulate a race: first aggregate read is stale (0 → tries 1 → collides),
        # second read is correct (1 → tries 2 → succeeds). No threading needed.
        from unittest import mock
        with mock.patch(
            'apps.orders.views.Order.objects.aggregate',
            side_effect=[{'order_number__max': 0}, {'order_number__max': 1}],
        ):
            resp = self.client.post('/api/orders/', {
                'customer': str(self.customer.id),
                'delivery_date': _future(),
                'total_amount': '5000.00',
            })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['order_number'], 2)
        self.assertEqual(Order.objects.filter(order_number=2).count(), 1)

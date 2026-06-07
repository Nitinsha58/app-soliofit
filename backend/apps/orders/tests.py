import base64
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.media.models import OrderPhoto, VoiceNote
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


class CalendarViewTests(_Fixture):
    def setUp(self):
        super().setUp()
        self.today = date.today()
        self._n = 0

    def _order(self, delivery, status='Booked', user=None):
        self._n += 1
        return Order.objects.create(
            user=user or self.user,
            customer=self.customer,
            order_number=self._n,
            delivery_date=delivery,
            total_amount=Decimal('1000.00'),
            status=status,
        )

    def _get(self, year, month):
        return self.client.get(f'/api/calendar/?year={year}&month={month}')

    def _installment(self, order, due, amount='500.00', paid=None):
        return Installment.objects.create(
            order=order, amount=Decimal(amount), due_date=due, paid_date=paid,
        )

    def test_deliveries_per_date(self):
        d1 = self.today.replace(day=10)
        d2 = self.today.replace(day=20)
        self._order(d1)
        self._order(d1)
        self._order(d2)
        resp = self._get(self.today.year, self.today.month)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data[str(d1)]['deliveries'], 2)
        self.assertEqual(resp.data[str(d2)]['deliveries'], 1)

    def test_payments_and_workload(self):
        d = self.today.replace(day=12)
        order = self._order(d)
        self._installment(order, d, amount='700.00')
        resp = self._get(self.today.year, self.today.month)
        cell = resp.data[str(d)]
        self.assertEqual(cell['deliveries'], 1)
        self.assertEqual(cell['payments'], 1)
        self.assertEqual(cell['payment_amount'], '700.00')
        self.assertEqual(cell['workload'], 2)   # 1 delivery + 1 payment

    def test_paid_installment_not_counted(self):
        d = self.today.replace(day=14)
        order = self._order(d)
        self._installment(order, d, amount='700.00', paid=d)
        resp = self._get(self.today.year, self.today.month)
        self.assertEqual(resp.data[str(d)]['payments'], 0)
        self.assertEqual(resp.data[str(d)]['workload'], 1)  # delivery only

    def test_late_true_for_past_undelivered(self):
        past = self.today - timedelta(days=40)  # prior month
        self._order(past, status='Booked')
        resp = self._get(past.year, past.month)
        self.assertEqual(resp.data[str(past)]['late'], 1)

    def test_delivered_past_not_late(self):
        past = self.today - timedelta(days=40)
        self._order(past, status='Delivered')
        resp = self._get(past.year, past.month)
        self.assertEqual(resp.data[str(past)]['late'], 0)

    def test_future_not_late(self):
        future = self.today + timedelta(days=40)
        self._order(future, status='Booked')
        resp = self._get(future.year, future.month)
        self.assertEqual(resp.data[str(future)]['late'], 0)

    def test_missing_params_400(self):
        self.assertEqual(self.client.get('/api/calendar/').status_code, 400)

    def test_invalid_month_400(self):
        self.assertEqual(self._get(self.today.year, 13).status_code, 400)

    def test_non_integer_param_400(self):
        self.assertEqual(self.client.get('/api/calendar/?year=abc&month=6').status_code, 400)

    def test_empty_month_returns_empty(self):
        resp = self._get(self.today.year, self.today.month)
        self.assertEqual(resp.data, {})

    def test_user_isolation(self):
        other = User.objects.create_user(email='other@test.com', password='pass')
        other_customer = Customer.objects.create(user=other, name='Bob', phone='8888888888')
        Order.objects.create(
            user=other, customer=other_customer, order_number=999,
            delivery_date=self.today.replace(day=15), total_amount=Decimal('1000.00'),
        )
        resp = self._get(self.today.year, self.today.month)
        self.assertEqual(resp.data, {})


class PaymentSummaryTests(_Fixture):
    """VS-19 — order cards surface amount_paid / remaining / payment_state."""

    def _order(self, num, total='10000.00'):
        return Order.objects.create(
            user=self.user, customer=self.customer, order_number=num,
            delivery_date=date.today() + timedelta(days=10),
            total_amount=Decimal(total),
        )

    def _inst(self, order, amount, *, paid=False, overdue=False):
        due = date.today() - timedelta(days=5) if overdue else date.today() + timedelta(days=10)
        return Installment.objects.create(
            order=order, amount=Decimal(amount), due_date=due,
            paid_date=(date.today() if paid else None),
        )

    def _card(self, order_id):
        resp = self.client.get('/api/orders/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return next(o for o in resp.data if o['id'] == str(order_id))

    def test_pending_when_nothing_paid(self):
        o = self._order(1)
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'pending')
        self.assertEqual(Decimal(card['amount_paid']), Decimal('0'))
        self.assertEqual(Decimal(card['remaining']), Decimal('10000.00'))

    def test_partial_when_some_paid(self):
        o = self._order(1)
        self._inst(o, '4000.00', paid=True)
        self._inst(o, '6000.00')
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'partial')
        self.assertEqual(Decimal(card['amount_paid']), Decimal('4000.00'))
        self.assertEqual(Decimal(card['remaining']), Decimal('6000.00'))

    def test_completed_when_fully_paid(self):
        o = self._order(1)
        self._inst(o, '10000.00', paid=True)
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'completed')
        self.assertEqual(Decimal(card['remaining']), Decimal('0'))

    def test_overdue_takes_precedence_over_partial(self):
        o = self._order(1)
        self._inst(o, '3000.00', paid=True)
        self._inst(o, '7000.00', overdue=True)
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'overdue')
        self.assertEqual(Decimal(card['remaining']), Decimal('7000.00'))

    def test_unbilled_when_zero_total(self):
        o = self._order(1, total='0.00')
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'unbilled')
        self.assertEqual(Decimal(card['remaining']), Decimal('0'))

    def test_remaining_not_negative_when_overpaid(self):
        o = self._order(1, total='5000.00')
        self._inst(o, '6000.00', paid=True)
        card = self._card(o.id)
        self.assertEqual(card['payment_state'], 'completed')
        self.assertEqual(Decimal(card['remaining']), Decimal('0'))

    def test_created_order_has_safe_payment_defaults(self):
        resp = self.client.post('/api/orders/', {
            'customer': str(self.customer.id), 'delivery_date': _future(),
            'total_amount': 5000, 'priority': False, 'remarks': '',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['payment_state'], 'pending')
        self.assertEqual(Decimal(resp.data['amount_paid']), Decimal('0'))
        self.assertEqual(Decimal(resp.data['remaining']), Decimal('5000'))

    def test_list_query_count_is_flat(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        o1 = self._order(1)
        self._inst(o1, '4000.00', paid=True)
        self._inst(o1, '6000.00')
        with CaptureQueriesContext(connection) as one:
            self.client.get('/api/orders/')

        for n in range(2, 7):
            ox = self._order(n)
            self._inst(ox, '4000.00', paid=True)
            self._inst(ox, '6000.00', overdue=True)
        with CaptureQueriesContext(connection) as many:
            self.client.get('/api/orders/')

        # No N+1: query count is independent of how many orders/installments exist.
        self.assertEqual(len(one.captured_queries), len(many.captured_queries))

    def test_delivery_load_count_unaffected_by_payment_annotation(self):
        d = date.today() + timedelta(days=10)
        o1 = Order.objects.create(user=self.user, customer=self.customer, order_number=1,
                                  delivery_date=d, total_amount=Decimal('10000.00'))
        Order.objects.create(user=self.user, customer=self.customer, order_number=2,
                             delivery_date=d, total_amount=Decimal('8000.00'))
        # Differing paid amounts must NOT split the per-date count via GROUP BY.
        self._inst(o1, '5000.00', paid=True)
        resp = self.client.get(f'/api/orders/delivery-load/?from={d}&to={d}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data[str(d)], 2)


class StatusFunnelDeliveredAtTests(_Fixture):
    """VS-20 Unit 1 — status changes funnel through /status/, maintaining
    delivered_at and the activity log."""

    def setUp(self):
        super().setUp()
        self.order = self._create_order()  # status defaults to Booked
        self.url = f'/api/orders/{self.order.id}/'
        self.status_url = f'/api/orders/{self.order.id}/status/'

    def test_generic_patch_status_rejected(self):
        resp = self.client.patch(self.url, {'status': 'Delivered'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('/status/', resp.data['detail'])
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'Booked')
        self.assertIsNone(self.order.delivered_at)

    def test_generic_patch_non_status_fields_still_work(self):
        resp = self.client.patch(self.url, {'remarks': 'rush'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.remarks, 'rush')

    def test_into_delivered_sets_delivered_at_and_logs_activity(self):
        resp = self.client.patch(self.status_url, {'status': 'Delivered'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.data['delivered_at'])
        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.delivered_at)
        # Regression: the old QuickActions PATCH path logged no activity.
        self.assertTrue(OrderActivity.objects.filter(
            order=self.order, activity_type=OrderActivity.Type.DELIVERY_MARKED).exists())

    def test_out_of_delivered_clears_delivered_at(self):
        self.client.patch(self.status_url, {'status': 'Delivered'}, format='json')
        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.delivered_at)
        self.client.patch(self.status_url, {'status': 'Ready'}, format='json')
        self.order.refresh_from_db()
        self.assertIsNone(self.order.delivered_at)

    def test_redeliver_is_idempotent_noop(self):
        self.client.patch(self.status_url, {'status': 'Delivered'}, format='json')
        self.order.refresh_from_db()
        first = self.order.delivered_at
        marks_before = OrderActivity.objects.filter(order=self.order).count()
        # Re-PATCH the same status → no-op: delivered_at and activity unchanged.
        resp = self.client.patch(self.status_url, {'status': 'Delivered'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivered_at, first)
        self.assertEqual(OrderActivity.objects.filter(order=self.order).count(), marks_before)


class BoardActionTests(_Fixture):
    """VS-20 Unit 2 — per-column keyset board action."""

    url = '/api/orders/board/'

    def _order(self, num, status_='Booked', dd_offset=0, delivered_days_ago=None):
        o = Order.objects.create(
            user=self.user, customer=self.customer, order_number=num, status=status_,
            delivery_date=date.today() + timedelta(days=dd_offset), total_amount=Decimal('1000.00'),
        )
        if delivered_days_ago is not None:
            o.delivered_at = timezone.now() - timedelta(days=delivered_days_ago)
            o.save(update_fields=['delivered_at'])
        return o

    def test_requires_valid_status(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(self.url, {'status': 'Nope'}).status_code,
                         status.HTTP_400_BAD_REQUEST)

    def test_active_column_keyset_pages_all_rows_once_in_order(self):
        for i in range(5):
            self._order(i + 1, 'Booked', dd_offset=i)
        seen, cursor = [], None
        for _ in range(10):  # safety bound
            params = {'status': 'Booked', 'limit': 2}
            if cursor:
                params['cursor'] = cursor
            resp = self.client.get(self.url, params)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            seen.extend(o['order_number'] for o in resp.data['results'])
            cursor = resp.data['next_cursor']
            if not cursor:
                break
        self.assertEqual(seen, [1, 2, 3, 4, 5])  # delivery_date ascending, no dup/skip

    def test_counts_are_totals_regardless_of_page(self):
        for i in range(3):
            self._order(i + 1, 'Booked', dd_offset=i)
        self._order(10, 'Started')
        resp = self.client.get(self.url, {'status': 'Booked', 'limit': 1})
        self.assertEqual(len(resp.data['results']), 1)  # page is small
        self.assertEqual(resp.data['counts']['Booked'], 3)  # count is the total
        self.assertEqual(resp.data['counts']['Started'], 1)
        self.assertEqual(resp.data['counts']['Delivered'], 0)

    def test_value_is_summed_bill_per_column(self):
        # Each _order bills ₹1000; column value is the summed total_amount, full total.
        for i in range(3):
            self._order(i + 1, 'Booked', dd_offset=i)
        self._order(10, 'Started')
        resp = self.client.get(self.url, {'status': 'Booked', 'limit': 1})
        self.assertEqual(Decimal(resp.data['value']['Booked']), Decimal('3000.00'))
        self.assertEqual(Decimal(resp.data['value']['Started']), Decimal('1000.00'))
        self.assertEqual(Decimal(resp.data['value']['Delivered']), Decimal('0.00'))

    def test_delivered_default_window_excludes_old(self):
        self._order(1, 'Delivered', delivered_days_ago=5)
        self._order(2, 'Delivered', delivered_days_ago=40)
        resp = self.client.get(self.url, {'status': 'Delivered'})
        self.assertEqual([o['order_number'] for o in resp.data['results']], [1])

    def test_delivered_older_mode_returns_old_only(self):
        self._order(1, 'Delivered', delivered_days_ago=5)
        self._order(2, 'Delivered', delivered_days_ago=40)
        resp = self.client.get(self.url, {'status': 'Delivered', 'older': 'true'})
        self.assertEqual([o['order_number'] for o in resp.data['results']], [2])

    def test_delivered_sorted_newest_completed_first(self):
        self._order(1, 'Delivered', delivered_days_ago=2)
        self._order(2, 'Delivered', delivered_days_ago=10)
        self._order(3, 'Delivered', delivered_days_ago=1)
        resp = self.client.get(self.url, {'status': 'Delivered'})
        self.assertEqual([o['order_number'] for o in resp.data['results']], [3, 1, 2])

    def test_results_carry_payment_annotations(self):
        self._order(1, 'Booked')
        resp = self.client.get(self.url, {'status': 'Booked'})
        self.assertIn('payment_state', resp.data['results'][0])
        self.assertIn('amount_paid', resp.data['results'][0])

    def test_invalid_cursor_returns_400(self):
        self._order(1, 'Booked')
        resp = self.client.get(self.url, {'status': 'Booked', 'cursor': '!!!not-valid!!!'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @staticmethod
    def _b64(payload):
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

    def test_decodable_but_invalid_active_cursor_returns_400(self):
        # Valid base64/JSON, but the date fields and id are junk — parse_* return
        # None and the id is not a UUID, which used to 500 at the queryset filter.
        self._order(1, 'Booked')
        cursor = self._b64({'dd': 'not-a-date', 'ca': 'also-bad', 'id': 'x'})
        resp = self.client.get(self.url, {'status': 'Booked', 'cursor': cursor})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_decodable_but_invalid_delivered_cursor_returns_400(self):
        self._order(1, 'Delivered', delivered_days_ago=1)
        cursor = self._b64({'da': 'not-a-datetime', 'id': 'x'})
        resp = self.client.get(self.url, {'status': 'Delivered', 'cursor': cursor})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_board_excludes_other_users(self):
        self._order(1, 'Booked')
        other = User.objects.create_user(email='x@test.com', password='p')
        oc = Customer.objects.create(user=other, name='Z', phone='7')
        Order.objects.create(user=other, customer=oc, order_number=99, status='Booked',
                             delivery_date=date.today(), total_amount=Decimal('1.00'))
        resp = self.client.get(self.url, {'status': 'Booked'})
        self.assertEqual(len(resp.data['results']), 1)
        self.assertEqual(resp.data['counts']['Booked'], 1)


class DeleteOrderTests(_Fixture):
    """VS-21 — soft-delete an order, cascade-hide children, clean S3, log it."""

    PHOTO_KEY = 'photos/11111111-1111-4111-8111-111111111111.jpg'
    VOICE_KEY = 'voice-notes/22222222-2222-4222-8222-222222222222.webm'

    def _seed_media(self, order):
        OrderPhoto.objects.create(
            order=order, s3_key=self.PHOTO_KEY,
            public_url='http://x/p1.jpg', photo_type='garment',
        )
        VoiceNote.objects.create(
            order=order, s3_key=self.VOICE_KEY,
            public_url='http://x/v1.webm', duration_seconds=4,
        )

    def _delete(self, order):
        # delete_objects is patched everywhere so no real S3/disk work runs in tests.
        with patch('apps.orders.views.delete_objects') as mock_del:
            resp = self.client.delete(f'/api/orders/{order.id}/')
        return resp, mock_del

    def test_soft_deletes_and_returns_204(self):
        order = self._create_order()
        resp, _ = self._delete(order)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        order.refresh_from_db()
        self.assertIsNotNone(order.deleted_at)  # row kept, flagged

    def test_logs_order_deleted_activity(self):
        order = self._create_order()
        self._delete(order)
        act = OrderActivity.objects.filter(order=order, activity_type=OrderActivity.Type.ORDER_DELETED)
        self.assertEqual(act.count(), 1)
        self.assertEqual(act.first().metadata['order_number'], order.order_number)

    def test_excluded_from_list_and_board(self):
        order = self._create_order()
        self._delete(order)
        self.assertEqual(self.client.get('/api/orders/').data, [])
        board = self.client.get('/api/orders/board/', {'status': order.status})
        self.assertEqual(board.data['results'], [])
        self.assertEqual(board.data['counts'][order.status], 0)

    def test_excluded_from_customer_orders(self):
        order = self._create_order()
        self._delete(order)
        resp = self.client.get('/api/orders/', {'customer': str(self.customer.id)})
        self.assertEqual(resp.data, [])

    def test_installments_excluded_from_payments(self):
        order = self._create_order()
        Installment.objects.create(order=order, amount=Decimal('5000.00'), due_date=date.today())
        before = self.client.get('/api/payments/orders/')
        self.assertIn(str(order.id), str(before.data))
        self._delete(order)
        after = self.client.get('/api/payments/orders/')
        self.assertNotIn(str(order.id), str(after.data))

    def test_media_cleaned_best_effort_and_excluded(self):
        order = self._create_order()
        self._seed_media(order)
        _, mock_del = self._delete(order)
        self.assertEqual(mock_del.call_count, 1)
        self.assertCountEqual(mock_del.call_args.args[0], [self.PHOTO_KEY, self.VOICE_KEY])
        media = self.client.get(f'/api/customers/{self.customer.id}/media/')
        self.assertEqual(media.data['photos'], [])
        self.assertEqual(media.data['voice_notes'], [])

    def test_excluded_from_search(self):
        order = self._create_order()
        query = f'#{order.order_number}'  # search needs >= 2 chars; '#1' parses to order 1
        before = self.client.get('/api/search/', {'q': query})
        self.assertIn(str(order.id), str(before.data))
        self._delete(order)
        after = self.client.get('/api/search/', {'q': query})
        self.assertNotIn(str(order.id), str(after.data))

    def test_other_users_order_cannot_be_deleted(self):
        order = self._create_order()
        other = User.objects.create_user(email='intruder@test.com', password='p')
        intruder = APIClient(); intruder.force_authenticate(user=other)
        with patch('apps.orders.views.delete_objects') as mock_del:
            resp = intruder.delete(f'/api/orders/{order.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        mock_del.assert_not_called()
        order.refresh_from_db()
        self.assertIsNone(order.deleted_at)

    def test_deleting_twice_is_404_second_time(self):
        order = self._create_order()
        self._delete(order)
        resp, mock_del = self._delete(order)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        mock_del.assert_not_called()  # no second cleanup
        self.assertEqual(
            OrderActivity.objects.filter(
                order=order, activity_type=OrderActivity.Type.ORDER_DELETED).count(),
            1,
        )

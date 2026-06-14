from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.orders.models import Order
from apps.payments.models import Installment
from apps.users.models import User, Boutique


def _future():
    return str(date.today() + timedelta(days=30))


class _OrderFixture(TestCase):
    """Shared setup: one authenticated user with a ₹10 000 order."""

    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        customer = Customer.objects.create(created_by=self.user, name='Alice', phone='9999999999')
        self.order = Order.objects.create(
            created_by=self.user,
            customer=customer,
            order_number=1,
            delivery_date=date.today() + timedelta(days=30),
            total_amount=Decimal('10000.00'),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.list_url = f'/api/orders/{self.order.id}/installments/'

    def _mark_paid(self, iid):
        return f'/api/orders/{self.order.id}/installments/{iid}/mark-paid/'


# ── Single-row write endpoints removed (VS-27.5 cutover) ──────────────────────
# The old POST /installments/ and PATCH/DELETE /installments/{id}/ endpoints — and their
# sum-≤-bill / paid-lock validation — were removed. The schedule is now writable only via
# the atomic create-with-installments payload and PUT /orders/{id}/billing/, whose strict
# invariant + paid-row preservation are covered in apps.orders.tests (BillingEndpointTests,
# RemovedInstallmentEndpointsTests). GET (list) + mark-paid remain (covered below).


# ── Mark-paid endpoint ────────────────────────────────────────────────────────

class MarkPaidTests(_OrderFixture):
    """POST /installments/{id}/mark-paid/ behavior."""

    def setUp(self):
        super().setUp()
        self.inst = Installment.objects.create(
            order=self.order,
            amount=Decimal('5000.00'),
            due_date=date.today() + timedelta(days=30),
        )

    def test_sets_paid_date_to_today(self):
        res = self.client.post(self._mark_paid(self.inst.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'Paid')
        self.assertEqual(res.data['paid_date'], str(date.today()))

    def test_already_paid_returns_400(self):
        self.client.post(self._mark_paid(self.inst.id))          # first call: OK
        res = self.client.post(self._mark_paid(self.inst.id))    # second: 400
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_db_state_after_mark_paid(self):
        self.client.post(self._mark_paid(self.inst.id))
        self.inst.refresh_from_db()
        self.assertEqual(self.inst.paid_date, date.today())


# ── Cross-user isolation ──────────────────────────────────────────────────────

class IsolationTests(_OrderFixture):
    """Another user cannot read or modify another user's installments."""

    def setUp(self):
        super().setUp()
        self.inst = Installment.objects.create(
            order=self.order,
            amount=Decimal('5000.00'),
            due_date=date.today() + timedelta(days=30),
        )
        # `other` belongs to a different boutique → must not see this order.
        other = User.objects.create_user(email='other@test.com', password='pass')
        other.boutique = Boutique.objects.create(name='Other', owner=other)
        other.save(update_fields=['boutique'])
        self.other = APIClient()
        self.other.force_authenticate(user=other)

    def test_list_returns_404_for_other_user(self):
        res = self.other.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_paid_returns_404_for_other_user(self):
        res = self.other.post(self._mark_paid(self.inst.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


# ── Payment Dashboard endpoints ───────────────────────────────────────────────

class PaymentSummaryTests(_OrderFixture):
    """GET /api/payments/summary/"""

    def setUp(self):
        super().setUp()
        past = str(date.today() - timedelta(days=1))
        self.inst1 = Installment.objects.create(order=self.order, amount=Decimal('4000'), due_date=_future())
        self.inst2 = Installment.objects.create(order=self.order, amount=Decimal('6000'), due_date=past)

    def test_returns_correct_keys(self):
        res = self.client.get('/api/payments/summary/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in ('total_receivable', 'received_today', 'pending_count', 'overdue_count'):
            self.assertIn(key, res.data)

    def test_overdue_count_correct(self):
        # inst2 is past due and unpaid → 1 overdue order
        res = self.client.get('/api/payments/summary/')
        self.assertEqual(res.data['overdue_count'], 1)

    def test_total_receivable_equals_total_amount_when_nothing_paid(self):
        res = self.client.get('/api/payments/summary/')
        self.assertEqual(Decimal(res.data['total_receivable']), Decimal('10000.00'))

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        res = self.client.get('/api/payments/summary/')
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class PaymentOrdersTests(_OrderFixture):
    """GET /api/payments/orders/"""

    def setUp(self):
        super().setUp()
        past = str(date.today() - timedelta(days=1))
        Installment.objects.create(order=self.order, amount=Decimal('5000'), due_date=past)
        Installment.objects.create(order=self.order, amount=Decimal('5000'), due_date=_future())

    def test_returns_all_states_in_response(self):
        res = self.client.get('/api/payments/orders/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in ('pending', 'partial', 'overdue', 'completed'):
            self.assertIn(key, res.data)

    def test_order_classified_as_overdue(self):
        res = self.client.get('/api/payments/orders/')
        ids = [o['id'] for o in res.data['overdue']]
        self.assertIn(str(self.order.id), ids)

    def test_today_range_excludes_future_order(self):
        res = self.client.get('/api/payments/orders/?range=today')
        total = sum(len(res.data[s]) for s in ('pending', 'partial', 'overdue', 'completed'))
        self.assertEqual(total, 0)

    def test_all_time_includes_order(self):
        res = self.client.get('/api/payments/orders/?range=all_time')
        total = sum(len(res.data[s]) for s in ('pending', 'partial', 'overdue', 'completed'))
        self.assertGreaterEqual(total, 1)


# ── VS-27.2 legacy backfill command ───────────────────────────────────────────

class BackfillCommandTests(TestCase):
    """VS-27.2 — idempotent reconciliation of legacy orders to bill == Σ(installments)."""

    REMARK = 'Auto-balanced during VS-27 migration'

    def setUp(self):
        self.user = User.objects.create_user(email='bf@test.com', password='pass')
        self.customer = Customer.objects.create(created_by=self.user, name='C', phone='1')

    def _order(self, n, total):
        return Order.objects.create(
            created_by=self.user, customer=self.customer, order_number=n,
            delivery_date=date.today() + timedelta(days=10), total_amount=Decimal(total),
        )

    def _inst(self, order, amount, paid=False):
        return Installment.objects.create(
            order=order, amount=Decimal(amount),
            due_date=date.today() + timedelta(days=5),
            paid_date=date.today() if paid else None,
        )

    def _run(self, **kwargs):
        out = StringIO()
        call_command('backfill_installments', stdout=out, **kwargs)
        return out.getvalue()

    def test_unscheduled_creates_default(self):
        o = self._order(1, '5000.00')
        self._run(apply=True)
        rows = Installment.objects.filter(order=o)
        self.assertEqual(rows.count(), 1)
        r = rows.first()
        self.assertEqual(r.amount, Decimal('5000.00'))
        self.assertEqual(r.due_date, o.delivery_date)  # = delivery date, verbatim
        self.assertEqual(r.remarks, self.REMARK)
        self.assertIsNone(r.paid_date)

    def test_partial_adds_balancing_and_keeps_paid(self):
        o = self._order(1, '10000.00')
        paid = self._inst(o, '4000.00', paid=True)
        self._run(apply=True)
        self.assertTrue(Installment.objects.filter(id=paid.id).exists())  # paid untouched
        total = sum((i.amount for i in o.installments.all()), Decimal('0'))
        self.assertEqual(total, Decimal('10000.00'))
        balancing = o.installments.exclude(id=paid.id).get()
        self.assertEqual(balancing.amount, Decimal('6000.00'))
        self.assertEqual(balancing.remarks, self.REMARK)
        self.assertIsNone(balancing.paid_date)

    def test_balanced_unchanged(self):
        o = self._order(1, '5000.00')
        self._inst(o, '5000.00')
        self._run(apply=True)
        self.assertEqual(o.installments.count(), 1)

    def test_unbilled_unchanged(self):
        o = self._order(1, '0.00')
        self._run(apply=True)
        self.assertEqual(o.installments.count(), 0)

    def test_over_scheduled_reported_not_modified(self):
        o = self._order(1, '5000.00')
        self._inst(o, '3000.00')
        self._inst(o, '4000.00')  # Σ 7000 > 5000, paid 0
        out = self._run(apply=True)
        self.assertEqual(o.installments.count(), 2)  # untouched
        self.assertIn('over-scheduled', out)
        self.assertIn(str(o.id), out)            # order_id present
        self.assertIn(str(o.boutique_id), out)   # boutique_id present

    def test_paid_exceeds_bill_reported_not_modified(self):
        o = self._order(1, '5000.00')
        self._inst(o, '6000.00', paid=True)  # paid 6000 > bill 5000
        out = self._run(apply=True)
        self.assertEqual(o.installments.count(), 1)  # untouched
        self.assertIn('paid exceeds bill', out)
        self.assertIn('₹6000.00 vs bill ₹5000.00', out)

    def test_paid_exceeds_takes_precedence_over_over_scheduled(self):
        # Σ(all) is also over the bill, but paid alone exceeds → must classify as paid-exceeds.
        o = self._order(1, '5000.00')
        self._inst(o, '6000.00', paid=True)
        self._inst(o, '1000.00')  # Σ all 7000 > 5000 too
        out = self._run(apply=True)
        self.assertIn('paid_exceeds: 1', out)
        self.assertIn('over_scheduled: 0', out)
        self.assertEqual(o.installments.count(), 2)  # untouched

    def test_dry_run_writes_nothing(self):
        o = self._order(1, '5000.00')
        out = self._run()  # no --apply
        self.assertEqual(o.installments.count(), 0)
        self.assertIn('DRY RUN', out)
        self.assertIn('Orders to change: 1', out)

    def test_idempotent_second_apply_no_change(self):
        o = self._order(1, '5000.00')
        self._run(apply=True)
        self.assertEqual(o.installments.count(), 1)
        out2 = self._run(apply=True)
        self.assertEqual(o.installments.count(), 1)
        self.assertIn('Orders to change: 0', out2)

    def test_boutique_filter_limits_scope(self):
        mine = self._order(1, '5000.00')
        # An order in a different boutique must be untouched when --boutique targets ours.
        other = _user_in_other_boutique()
        oc = Customer.objects.create(created_by=other, name='O', phone='2')
        theirs = Order.objects.create(
            created_by=other, customer=oc, order_number=1,
            delivery_date=date.today() + timedelta(days=10), total_amount=Decimal('5000.00'),
        )
        self._run(apply=True, boutique=str(mine.boutique_id))
        self.assertEqual(mine.installments.count(), 1)     # fixed
        self.assertEqual(theirs.installments.count(), 0)   # out of scope, untouched


def _user_in_other_boutique():
    u = User.objects.create_user(email='other-bf@test.com', password='pass')
    u.boutique = Boutique.objects.create(name='OtherBF', owner=u)
    u.save(update_fields=['boutique'])
    return u

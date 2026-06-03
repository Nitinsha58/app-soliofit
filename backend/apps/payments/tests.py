from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.orders.models import Order
from apps.payments.models import Installment
from apps.users.models import User


def _future():
    return str(date.today() + timedelta(days=30))


class _OrderFixture(TestCase):
    """Shared setup: one authenticated user with a ₹10 000 order."""

    def setUp(self):
        self.user = User.objects.create_user(email='tailor@test.com', password='pass')
        customer = Customer.objects.create(user=self.user, name='Alice', phone='9999999999')
        self.order = Order.objects.create(
            user=self.user,
            customer=customer,
            order_number=1,
            delivery_date=date.today() + timedelta(days=30),
            total_amount=Decimal('10000.00'),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.list_url = f'/api/orders/{self.order.id}/installments/'

    def _detail(self, iid):
        return f'/api/orders/{self.order.id}/installments/{iid}/'

    def _mark_paid(self, iid):
        return f'/api/orders/{self.order.id}/installments/{iid}/mark-paid/'

    def _create(self, amount, due_date=None):
        return self.client.post(
            self.list_url,
            {'amount': str(amount), 'due_date': due_date or _future()},
        )


# ── Bill-limit validation ─────────────────────────────────────────────────────

class BillLimitCreateTests(_OrderFixture):
    """POST /installments/ enforces sum ≤ bill."""

    def test_within_bill_succeeds(self):
        self.assertEqual(self._create(5000).status_code, status.HTTP_201_CREATED)

    def test_exactly_at_bill_succeeds(self):
        self.assertEqual(self._create(10000).status_code, status.HTTP_201_CREATED)

    def test_over_bill_returns_400(self):
        res = self._create(10001)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceed', res.data['detail'].lower())

    def test_cumulative_over_bill_returns_400(self):
        self._create(8000)                             # ₹8 000 — OK
        res = self._create(3000)                       # ₹8 000 + ₹3 000 > ₹10 000
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cumulative_at_limit_succeeds(self):
        self._create(6000)
        res = self._create(4000)                       # exactly ₹10 000
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)


class BillLimitUpdateTests(_OrderFixture):
    """PATCH /installments/{id}/ enforces sum ≤ bill, excluding the edited row."""

    def setUp(self):
        super().setUp()
        # Two installments: ₹5 000 + ₹4 000 = ₹9 000 on a ₹10 000 bill
        r1 = self._create(5000)
        r2 = self._create(4000)
        self.i1_id = r1.data['id']
        self.i2_id = r2.data['id']

    def test_update_would_exceed_returns_400(self):
        # ₹7 000 + ₹4 000 = ₹11 000 > ₹10 000
        res = self.client.patch(self._detail(self.i1_id), {'amount': '7000'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceed', res.data['detail'].lower())

    def test_update_within_limit_succeeds(self):
        # ₹6 000 + ₹4 000 = ₹10 000 — exactly at limit
        res = self.client.patch(self._detail(self.i1_id), {'amount': '6000'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['amount'], '6000.00')

    def test_self_exclusion_same_amount_succeeds(self):
        # Editing an installment to the same value should always pass,
        # even if total is already at the bill limit.
        self._create(1000)                             # push to ₹10 000 total
        res = self.client.patch(self._detail(self.i1_id), {'amount': '5000'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_non_amount_patch_skips_validation(self):
        # Changing only the due date should never trigger bill validation.
        res = self.client.patch(self._detail(self.i1_id), {'due_date': _future()})
        self.assertEqual(res.status_code, status.HTTP_200_OK)


# ── Paid-row lock ─────────────────────────────────────────────────────────────

class PaidLockTests(_OrderFixture):
    """Paid installments must be immutable."""

    def setUp(self):
        super().setUp()
        self.inst = Installment.objects.create(
            order=self.order,
            amount=Decimal('5000.00'),
            due_date=date.today() + timedelta(days=30),
            paid_date=date.today(),
        )

    def test_edit_paid_returns_400(self):
        res = self.client.patch(self._detail(self.inst.id), {'amount': '6000'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_paid_returns_400(self):
        res = self.client.delete(self._detail(self.inst.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpaid_can_be_edited(self):
        unpaid = Installment.objects.create(
            order=self.order,
            amount=Decimal('2000.00'),
            due_date=date.today() + timedelta(days=30),
        )
        res = self.client.patch(self._detail(unpaid.id), {'due_date': _future()})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_unpaid_can_be_deleted(self):
        unpaid = Installment.objects.create(
            order=self.order,
            amount=Decimal('2000.00'),
            due_date=date.today() + timedelta(days=30),
        )
        res = self.client.delete(self._detail(unpaid.id))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)


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
        other = User.objects.create_user(email='other@test.com', password='pass')
        self.other = APIClient()
        self.other.force_authenticate(user=other)

    def test_list_returns_404_for_other_user(self):
        res = self.other.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_returns_404_for_other_user(self):
        res = self.other.post(self.list_url, {'amount': '1000', 'due_date': _future()})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_returns_404_for_other_user(self):
        res = self.other.patch(self._detail(self.inst.id), {'amount': '1000'})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_returns_404_for_other_user(self):
        res = self.other.delete(self._detail(self.inst.id))
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

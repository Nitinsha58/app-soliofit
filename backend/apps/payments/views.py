from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderActivity
from apps.orders.services import create_order_activity
from .models import Installment
from .serializers import InstallmentSerializer


# ── Payment Dashboard views ───────────────────────────────────────────────────

def _classify_order(order, insts, today):
    """Return payment state and summary fields for a single order."""
    paid_total = sum((i.amount for i in insts if i.paid_date), Decimal('0'))
    unpaid = [i for i in insts if not i.paid_date]
    overdue_unpaid = [i for i in unpaid if i.due_date < today]
    next_inst = min(unpaid, key=lambda i: i.due_date) if unpaid else None

    if paid_total >= order.total_amount:
        state = 'completed'
    elif overdue_unpaid:
        state = 'overdue'
    elif paid_total > 0:
        state = 'partial'
    else:
        state = 'pending'

    return {
        'state': state,
        'id': str(order.id),
        'order_number': order.order_number,
        'customer_name': order.customer.name,
        'customer_phone': order.customer.phone,
        'delivery_date': str(order.delivery_date),
        'total_amount': str(order.total_amount),
        'paid_total': str(paid_total),
        'remaining': str(order.total_amount - paid_total),
        'overdue_count': len(overdue_unpaid),
        'overdue_amount': str(sum((i.amount for i in overdue_unpaid), Decimal('0'))),
        'next_installment': {
            'id': str(next_inst.id),
            'amount': str(next_inst.amount),
            'due_date': str(next_inst.due_date),
        } if next_inst else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_summary(request):
    today = date.today()
    user = request.user

    orders = Order.objects.filter(boutique=user.boutique, deleted_at__isnull=True, total_amount__gt=0)
    order_ids = orders.values_list('id', flat=True)
    installments = Installment.objects.filter(order_id__in=order_ids)

    total_billed = orders.aggregate(s=Sum('total_amount'))['s'] or Decimal('0')
    total_paid_agg = installments.filter(paid_date__isnull=False).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    received_today = installments.filter(paid_date=today).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    total_receivable = total_billed - total_paid_agg

    all_orders = list(orders.prefetch_related('installments').select_related('customer'))
    pending_count = 0
    overdue_count = 0
    for order in all_orders:
        insts = list(order.installments.all())
        paid = sum((i.amount for i in insts if i.paid_date), Decimal('0'))
        if paid >= order.total_amount:
            continue
        unpaid = [i for i in insts if not i.paid_date]
        if any(i.due_date < today for i in unpaid):
            overdue_count += 1
        elif paid == 0:
            pending_count += 1

    return Response({
        'total_receivable': str(total_receivable),
        'received_today': str(received_today),
        'pending_count': pending_count,
        'overdue_count': overdue_count,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_orders(request):
    today = date.today()
    user = request.user
    range_param = request.query_params.get('range', 'all_time')

    qs = Order.objects.filter(
        boutique=user.boutique,
        deleted_at__isnull=True,
        total_amount__gt=0,
    ).select_related('customer').prefetch_related('installments').order_by('delivery_date')

    if range_param == 'today':
        qs = qs.filter(delivery_date=today)
    elif range_param == 'this_week':
        week_start = today - timedelta(days=today.weekday())
        qs = qs.filter(delivery_date__gte=week_start, delivery_date__lte=week_start + timedelta(days=6))
    elif range_param == 'this_month':
        qs = qs.filter(delivery_date__year=today.year, delivery_date__month=today.month)

    result: dict = {'pending': [], 'partial': [], 'overdue': [], 'completed': []}
    for order in qs:
        row = _classify_order(order, list(order.installments.all()), today)
        result[row['state']].append(row)

    return Response(result)


def _get_order(request, order_id):
    try:
        return Order.objects.get(id=order_id, boutique=request.user.boutique, deleted_at__isnull=True)
    except Order.DoesNotExist:
        return None


def _bill_exceeded(order, new_amount, exclude_id=None):
    """Return excess amount if adding/updating would push scheduled total above bill, else None."""
    qs = order.installments.all()
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    existing = qs.aggregate(total=Sum('amount'))['total'] or 0
    if existing + new_amount > order.total_amount:
        return existing + new_amount - order.total_amount
    return None


class InstallmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = _get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        installments = Installment.objects.filter(order=order)
        return Response(InstallmentSerializer(installments, many=True).data)

    def post(self, request, order_id):
        order = _get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = InstallmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        excess = _bill_exceeded(order, serializer.validated_data['amount'])
        if excess is not None:
            return Response(
                {'detail': f'Total installments exceed bill amount by ₹{excess:.2f}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            serializer.save(order=order)
            create_order_activity(order, OrderActivity.Type.INSTALLMENT_CREATED, {
                'amount': str(serializer.data['amount']),
                'due_date': str(serializer.data['due_date']),
            })
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class InstallmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_installment(self, request, order_id, installment_id):
        try:
            return Installment.objects.select_related('order').get(
                id=installment_id,
                order__id=order_id,
                order__boutique=request.user.boutique,
                order__deleted_at__isnull=True,
            )
        except Installment.DoesNotExist:
            return None

    def patch(self, request, order_id, installment_id):
        installment = self._get_installment(request, order_id, installment_id)
        if not installment:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Cannot edit a paid installment'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = InstallmentSerializer(installment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if 'amount' in serializer.validated_data:
            excess = _bill_exceeded(
                installment.order,
                serializer.validated_data['amount'],
                exclude_id=installment.id,
            )
            if excess is not None:
                return Response(
                    {'detail': f'Total installments exceed bill amount by ₹{excess:.2f}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        with transaction.atomic():
            serializer.save()
            create_order_activity(installment.order, OrderActivity.Type.PAYMENT_UPDATED, {
                'amount': str(serializer.data['amount']),
                'due_date': str(serializer.data['due_date']),
            })
        return Response(serializer.data)

    def delete(self, request, order_id, installment_id):
        installment = self._get_installment(request, order_id, installment_id)
        if not installment:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Cannot delete a paid installment'}, status=status.HTTP_400_BAD_REQUEST)
        installment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstallmentMarkPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id, installment_id):
        try:
            installment = Installment.objects.get(
                id=installment_id,
                order__id=order_id,
                order__boutique=request.user.boutique,
                order__deleted_at__isnull=True,
            )
        except Installment.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Already marked as paid'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            installment.paid_date = date.today()
            installment.save(update_fields=['paid_date'])
            create_order_activity(installment.order, OrderActivity.Type.INSTALLMENT_PAID, {
                'amount': str(installment.amount),
            })
        return Response(InstallmentSerializer(installment).data)

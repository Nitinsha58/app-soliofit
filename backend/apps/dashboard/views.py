from datetime import date, timedelta

from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.orders.models import Order
from apps.payments.models import Installment


def _unpaid_for_user(user):
    order_ids = Order.objects.filter(user=user, deleted_at__isnull=True).values_list('id', flat=True)
    return Installment.objects.filter(order_id__in=order_ids, paid_date__isnull=True)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def summary(request):
    today = date.today()
    user = request.user

    active = Order.objects.filter(user=user, deleted_at__isnull=True).exclude(status=Order.Status.DELIVERED)
    unpaid = _unpaid_for_user(user)

    pending_total = unpaid.aggregate(s=Sum('amount'))['s'] or 0

    return Response({
        'orders_due_today': active.filter(delivery_date=today).count(),
        'upcoming_orders': active.filter(
            delivery_date__gt=today, delivery_date__lte=today + timedelta(days=7)
        ).count(),
        'delayed_orders': active.filter(delivery_date__lt=today).count(),
        'pending_payments_total': str(pending_total),
        'overdue_installments': unpaid.filter(due_date__lt=today).count(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_count(request):
    today = date.today()
    user = request.user

    active = Order.objects.filter(user=user, deleted_at__isnull=True).exclude(status=Order.Status.DELIVERED)
    unpaid = _unpaid_for_user(user)

    delivery_due = active.filter(delivery_date=today).count()
    delayed = active.filter(delivery_date__lt=today).count()
    inst_due = unpaid.filter(due_date=today).count()
    inst_overdue = unpaid.filter(due_date__lt=today).count()

    return Response({
        'delivery_due_today': delivery_due,
        'delayed_delivery': delayed,
        'installment_due_today': inst_due,
        'overdue_installment': inst_overdue,
        'total': delivery_due + delayed + inst_due + inst_overdue,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications(request):
    today = date.today()
    user = request.user

    active = Order.objects.filter(user=user, deleted_at__isnull=True).exclude(status=Order.Status.DELIVERED)
    unpaid = _unpaid_for_user(user)

    def order_rows(qs):
        return list(
            qs.select_related('customer')
              .values('id', 'order_number', 'customer__name', 'delivery_date', 'status')
              .order_by('delivery_date')[:20]
        )

    def inst_rows(qs):
        return list(
            qs.select_related('order__customer')
              .values('id', 'amount', 'due_date', 'order__id', 'order__order_number', 'order__customer__name')
              .order_by('due_date')[:20]
        )

    def fmt_order(o):
        return {
            'id': str(o['id']),
            'order_number': o['order_number'],
            'customer_name': o['customer__name'],
            'delivery_date': str(o['delivery_date']),
            'status': o['status'],
        }

    def fmt_inst(i):
        return {
            'id': str(i['id']),
            'amount': str(i['amount']),
            'due_date': str(i['due_date']),
            'order_id': str(i['order__id']),
            'order_number': i['order__order_number'],
            'customer_name': i['order__customer__name'],
        }

    return Response({
        'delivery_due_today': [fmt_order(o) for o in order_rows(active.filter(delivery_date=today))],
        'delayed_delivery': [fmt_order(o) for o in order_rows(active.filter(delivery_date__lt=today))],
        'installment_due_today': [fmt_inst(i) for i in inst_rows(unpaid.filter(due_date=today))],
        'overdue_installment': [fmt_inst(i) for i in inst_rows(unpaid.filter(due_date__lt=today))],
    })

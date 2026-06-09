import calendar as _calendar
from datetime import date

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import Installment
from .models import Order


class CalendarView(APIView):
    """Per-date workload summary for one month.

    GET /api/calendar/?year=2026&month=6
    → {"2026-06-04": {"deliveries": 3, "payments": 1, "payment_amount": "700.00",
                       "late": 2, "workload": 4}, ...}

    - deliveries  = orders whose delivery_date is that day
    - payments    = unpaid installments whose due_date is that day
    - payment_amount = summed amount of those unpaid installments
    - late        = deliveries that are past-due and not yet Delivered
    - workload    = deliveries + payments (interim count metric; VS-16's
                    daily_capacity upgrades the dot thresholds)

    Scoped to the requesting user; soft-deleted orders excluded. Only dates
    that carry work appear in the response (empty days recede in the grid).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            year = int(request.query_params.get('year'))
            month = int(request.query_params.get('month'))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'year and month are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= month <= 12):
            return Response(
                {'detail': 'month must be between 1 and 12.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            first = date(year, month, 1)
        except ValueError:
            return Response({'detail': 'Invalid year.'}, status=status.HTTP_400_BAD_REQUEST)

        last  = date(year, month, _calendar.monthrange(year, month)[1])
        today = timezone.localdate()

        orders = Order.objects.filter(
            boutique=request.user.boutique,
            deleted_at__isnull=True,
            delivery_date__gte=first,
            delivery_date__lte=last,
        )
        deliveries = {
            row['delivery_date']: row['c']
            for row in orders.values('delivery_date').annotate(c=Count('id'))
        }
        late = {
            row['delivery_date']: row['c']
            for row in orders.filter(delivery_date__lt=today)
                             .exclude(status=Order.Status.DELIVERED)
                             .values('delivery_date').annotate(c=Count('id'))
        }

        installments = Installment.objects.filter(
            order__boutique=request.user.boutique,
            order__deleted_at__isnull=True,
            paid_date__isnull=True,
            due_date__gte=first,
            due_date__lte=last,
        )
        pay_count, pay_amount = {}, {}
        for row in installments.values('due_date').annotate(c=Count('id'), s=Sum('amount')):
            pay_count[row['due_date']]  = row['c']
            pay_amount[row['due_date']] = row['s']

        result = {}
        for d in set(deliveries) | set(pay_count) | set(late):
            dl = deliveries.get(d, 0)
            pc = pay_count.get(d, 0)
            result[str(d)] = {
                'deliveries': dl,
                'payments': pc,
                'payment_amount': str(pay_amount.get(d) or '0'),
                'late': late.get(d, 0),
                'workload': dl + pc,
            }
        return Response(result)

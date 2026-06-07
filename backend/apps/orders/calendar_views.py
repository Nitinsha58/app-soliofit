import calendar as _calendar
from datetime import date

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order


class CalendarView(APIView):
    """Per-date order counts + overdue flags for one month.

    GET /api/calendar/?year=2026&month=6
    → {"2026-06-04": {"count": 5, "has_overdue": true}, ...}

    A date is `has_overdue` when it is in the past (< today) and still holds at
    least one order that is not yet Delivered. Scoped to the requesting user;
    soft-deleted orders are excluded.
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

        base = Order.objects.filter(
            user=request.user,
            deleted_at__isnull=True,
            delivery_date__gte=first,
            delivery_date__lte=last,
        )
        counts = base.values('delivery_date').annotate(count=Count('id'))
        overdue_dates = set(
            base.filter(delivery_date__lt=today)
                .exclude(status=Order.Status.DELIVERED)
                .values_list('delivery_date', flat=True)
        )
        return Response({
            str(row['delivery_date']): {
                'count': row['count'],
                'has_overdue': row['delivery_date'] in overdue_dates,
            }
            for row in counts
        })

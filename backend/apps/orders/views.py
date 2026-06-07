from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Count, DecimalField, Exists, Max, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.payments.models import Installment
from .models import Order, OrderActivity
from .serializers import OrderSerializer
from .services import create_order_activity


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            Order.objects.filter(user=self.request.user, deleted_at__isnull=True)
            .select_related('customer')
            .order_by('delivery_date', 'created_at')
        )
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        date_from_str = self.request.query_params.get('delivery_date_from')
        date_to_str   = self.request.query_params.get('delivery_date_to')

        date_from = None
        date_to   = None

        if date_from_str:
            try:
                date_from = parse_date(date_from_str)
            except ValueError:
                date_from = None
            if date_from is None:
                raise ValidationError({'delivery_date_from': 'Invalid date. Use YYYY-MM-DD.'})
        if date_to_str:
            try:
                date_to = parse_date(date_to_str)
            except ValueError:
                date_to = None
            if date_to is None:
                raise ValidationError({'delivery_date_to': 'Invalid date. Use YYYY-MM-DD.'})
        if date_from and date_to and date_from > date_to:
            raise ValidationError({'delivery_date_from': 'delivery_date_from must not be after delivery_date_to.'})

        if date_from:
            qs = qs.filter(delivery_date__gte=date_from)
        if date_to:
            qs = qs.filter(delivery_date__lte=date_to)

        today = timezone.localdate()
        delayed = Installment.objects.filter(
            order=OuterRef('pk'),
            paid_date__isnull=True,
            due_date__lt=today,
        )
        # Collected-to-date per order via a correlated subquery (no join → no N+1,
        # no row multiplication). VS-19 derives remaining + payment_state from this.
        money = DecimalField(max_digits=12, decimal_places=2)
        paid = (
            Installment.objects.filter(order=OuterRef('pk'), paid_date__isnull=False)
            .order_by()
            .values('order')
            .annotate(total=Sum('amount'))
            .values('total')
        )
        qs = qs.annotate(
            has_delayed_installment=Exists(delayed),
            amount_paid=Coalesce(Subquery(paid, output_field=money), Value(0, output_field=money)),
        )
        return qs

    def perform_create(self, serializer):
        # order_number is a global counter (Max + 1). Two concurrent creates can read
        # the same max and collide on the unique constraint, so retry on IntegrityError
        # with a fresh read inside a fresh transaction. Per-boutique numbering: VS-23.
        for attempt in range(5):
            max_num = Order.objects.aggregate(Max('order_number'))['order_number__max'] or 0
            try:
                with transaction.atomic():
                    order = serializer.save(user=self.request.user, order_number=max_num + 1)
                    create_order_activity(order, OrderActivity.Type.ORDER_CREATED)
                return
            except IntegrityError:
                if attempt == 4:
                    raise

    def partial_update(self, request, *args, **kwargs):
        # Status is a domain event, not a field edit — it must go through the
        # /status/ action (which maintains delivered_at + the activity log).
        if 'status' in request.data:
            return Response(
                {'detail': 'Use /status/ to change order status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if 'total_amount' in request.data:
            order = self.get_object()
            try:
                new_total = Decimal(str(request.data['total_amount']))
            except (ValueError, InvalidOperation):
                pass  # serializer validation will reject non-numeric values
            else:
                scheduled = order.installments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                if new_total < scheduled:
                    excess = scheduled - new_total
                    return Response(
                        {'detail': f'Bill cannot be less than scheduled installments (exceeds by ₹{excess:,.2f}).'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at'])

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        if new_status not in Order.Status.values:
            return Response(
                {'detail': f'Invalid status. Choices: {", ".join(Order.Status.values)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_status = order.status
        if new_status == old_status:
            # Idempotent no-op: don't write an activity or touch delivered_at.
            order = self.get_queryset().get(pk=order.pk)
            return Response(OrderSerializer(order, context={'request': request}).data)

        update_fields = ['status', 'updated_at']
        with transaction.atomic():
            order.status = new_status
            # delivered_at tracks "currently delivered, since when".
            if new_status == Order.Status.DELIVERED and old_status != Order.Status.DELIVERED:
                order.delivered_at = timezone.now()
                update_fields.append('delivered_at')
            elif old_status == Order.Status.DELIVERED and new_status != Order.Status.DELIVERED:
                order.delivered_at = None
                update_fields.append('delivered_at')
            order.save(update_fields=update_fields)
            if new_status == Order.Status.DELIVERED:
                activity_type = OrderActivity.Type.DELIVERY_MARKED
            elif new_status == Order.Status.PARTIAL_DELIVERY:
                activity_type = OrderActivity.Type.PARTIAL_DELIVERY
            else:
                activity_type = OrderActivity.Type.STATUS_CHANGED
            create_order_activity(order, activity_type, {'from': old_status, 'to': new_status})
        # Re-fetch through annotated queryset so has_delayed_installment is accurate
        order = self.get_queryset().get(pk=order.pk)
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='activities')
    def activities(self, request, pk=None):
        order = self.get_object()
        acts = order.activities.order_by('-created_at')
        return Response([{
            'id': str(a.id),
            'activity_type': a.activity_type,
            'metadata': a.metadata,
            'created_at': a.created_at.isoformat(),
        } for a in acts])

    @action(detail=False, methods=['get'], url_path='delivery-load')
    def delivery_load(self, request):
        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')
        if not from_date or not to_date:
            return Response(
                {'detail': 'from and to query params are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = (
            self.get_queryset()
            .filter(delivery_date__gte=from_date, delivery_date__lte=to_date)
            .order_by()
            .values('delivery_date')
            .annotate(count=Count('id'))
        )
        return Response({str(row['delivery_date']): row['count'] for row in qs})

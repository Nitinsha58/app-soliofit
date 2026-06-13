import base64
import json
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Count, DecimalField, Exists, Max, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.media.s3 import delete_objects
from apps.payments.models import Installment
from .models import Order, OrderActivity
from .serializers import OrderBillingSerializer, OrderSerializer
from .services import create_order_activity

TWO_PLACES = Decimal('0.01')


def _schedule_sum(items):
    """Σ of installment-item amounts, quantized to 2dp (money — exact, no tolerance)."""
    return sum((i['amount'] for i in items), Decimal('0')).quantize(TWO_PLACES)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            Order.objects.filter(boutique=self.request.user.boutique, deleted_at__isnull=True)
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
        # order_number is a per-boutique counter (Max + 1, scoped to the boutique).
        # Two concurrent creates can read the same max and collide on the
        # UniqueConstraint(boutique, order_number), so retry on IntegrityError with a
        # fresh read inside a fresh transaction.
        boutique = self.request.user.boutique
        # VS-27.1 — optional initial schedule. Popped before the model save (it is not an
        # Order field), validated to sum exactly to the bill, then created atomically with
        # the order so a bad installment can never leave an orphaned order behind.
        # (Additive: when omitted, behavior is unchanged — no auto-default until cutover.)
        installments_data = serializer.validated_data.pop('installments', None)
        if installments_data is not None:
            # Supplied (even as []) → strict-validate. An explicit empty schedule on a billed
            # order must be rejected (Σ 0 != bill); only omission leaves the order unscheduled.
            total = Decimal(serializer.validated_data.get('total_amount') or 0).quantize(TWO_PLACES)
            scheduled = _schedule_sum(installments_data)
            if scheduled != total:
                off = (total - scheduled).copy_abs()
                raise ValidationError(
                    {'installments': f'Installments must sum to the bill (off by ₹{off}).'})

        for attempt in range(5):
            max_num = (Order.objects.filter(boutique=boutique)
                       .aggregate(Max('order_number'))['order_number__max'] or 0)
            try:
                with transaction.atomic():
                    order = serializer.save(created_by=self.request.user, boutique=boutique,
                                            order_number=max_num + 1)
                    create_order_activity(order, OrderActivity.Type.ORDER_CREATED)
                    if installments_data:
                        Installment.objects.bulk_create([
                            Installment(order=order, amount=i['amount'],
                                        due_date=i['due_date'], remarks=i.get('remarks', ''))
                            for i in installments_data
                        ])
                        create_order_activity(order, OrderActivity.Type.PAYMENT_UPDATED, {
                            'total_amount': str(order.total_amount),
                            'installment_count': len(installments_data),
                        })
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
        # Soft-delete (VS-21): set deleted_at + log the deletion atomically. The order's
        # installments and media rows are kept but vanish from every active query because
        # those are all scoped through order__deleted_at__isnull=True. S3 blobs are then
        # cleaned up best-effort (tolerates already-missing objects). No hard delete.
        keys = list(instance.photos.values_list('s3_key', flat=True))
        keys += list(instance.voice_notes.values_list('s3_key', flat=True))
        with transaction.atomic():
            instance.deleted_at = timezone.now()
            instance.save(update_fields=['deleted_at'])
            create_order_activity(
                instance,
                OrderActivity.Type.ORDER_DELETED,
                {'order_number': instance.order_number},
            )
        delete_objects(keys)

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

    @action(detail=True, methods=['put'], url_path='billing')
    def billing(self, request, pk=None):
        """VS-27.1 — atomically edit the bill and the *unpaid* schedule together
        (ADR-0009). Payload: { total_amount, installments: [unpaid set] }. Enforces
        `total_amount >= Σ(paid)` and `Σ(paid) + Σ(new) == total_amount`. Paid rows are
        never touched. This lives on OrderViewSet (not under apps.payments.urls, which is
        mounted at .../installments/) so it resolves to /api/orders/{id}/billing/."""
        payload = OrderBillingSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        # DecimalField already enforced max_digits/decimal_places and >= 0, so no DB-level
        # surprise on save; quantize only normalises for the exact-equality money checks.
        total = payload.validated_data['total_amount'].quantize(TWO_PLACES)
        items = payload.validated_data['installments']

        with transaction.atomic():
            # Lock the order row: it is the shared serialization point between this billing
            # replace and a concurrent mark-paid (which now also locks the parent order).
            order = (Order.objects.select_for_update()
                     .filter(id=pk, boutique=request.user.boutique, deleted_at__isnull=True)
                     .first())
            if order is None:
                return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

            paid_total = (order.installments.filter(paid_date__isnull=False)
                          .aggregate(s=Sum('amount'))['s'] or Decimal('0')).quantize(TWO_PLACES)
            if total < paid_total:
                return Response(
                    {'detail': f'Bill cannot be less than the amount already paid (₹{paid_total}).'},
                    status=status.HTTP_400_BAD_REQUEST)
            scheduled = (paid_total + _schedule_sum(items)).quantize(TWO_PLACES)
            if scheduled != total:
                off = (total - scheduled).copy_abs()
                return Response({'detail': f'Installments must sum to the bill (off by ₹{off}).'},
                                status=status.HTTP_400_BAD_REQUEST)

            order.total_amount = total
            order.save(update_fields=['total_amount', 'updated_at'])
            order.installments.filter(paid_date__isnull=True).delete()
            Installment.objects.bulk_create([
                Installment(order=order, amount=i['amount'], due_date=i['due_date'],
                            remarks=i.get('remarks', ''))
                for i in items
            ])
            create_order_activity(order, OrderActivity.Type.PAYMENT_UPDATED, {
                'total_amount': str(total),
                'installment_count': order.installments.count(),
            })

        # Re-fetch through the annotated queryset so payment fields are accurate.
        order = self.get_queryset().get(pk=order.pk)
        return Response(OrderSerializer(order, context={'request': request}).data)

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

    # ── VS-20: per-column keyset board (see ADR-0006) ──────────────────────────
    DELIVERED_WINDOW_DAYS = 30

    @staticmethod
    def _encode_cursor(order, is_delivered):
        if is_delivered:
            payload = {'da': order.delivered_at.isoformat() if order.delivered_at else None,
                       'id': str(order.id)}
        else:
            payload = {'dd': order.delivery_date.isoformat(),
                       'ca': order.created_at.isoformat(), 'id': str(order.id)}
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

    @staticmethod
    def _decode_cursor(cursor, is_delivered):
        # Two failure modes to guard: (1) malformed base64/JSON raises in decode;
        # (2) decodable-but-invalid payloads — parse_date/parse_datetime return
        # None (not raise) for junk, and a non-UUID id only blows up later at the
        # queryset filter. Validate every field here so both collapse to a 400.
        try:
            payload = json.loads(base64.urlsafe_b64decode(cursor.encode()))
            cid = payload['id']
            uuid.UUID(str(cid))  # rejects non-UUID ids before they reach the filter
            if is_delivered:
                da = parse_datetime(payload['da'])
                if da is None:
                    raise ValueError('da')
                return da, cid
            dd = parse_date(payload['dd'])
            ca = parse_datetime(payload['ca'])
            if dd is None or ca is None:
                raise ValueError('dd/ca')
            return dd, ca, cid
        except (ValueError, TypeError, KeyError, AttributeError, json.JSONDecodeError):
            raise ValidationError({'cursor': 'Invalid cursor.'})

    @action(detail=False, methods=['get'], url_path='board')
    def board(self, request):
        """One status column, keyset-paged. Active columns sort by
        (delivery_date, created_at, id) asc; Delivered by (delivered_at, id) desc
        with a recent-window default and an `older=true` mode."""
        status_param = request.query_params.get('status')
        if status_param not in Order.Status.values:
            return Response(
                {'detail': f'A valid status is required. Choices: {", ".join(Order.Status.values)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 50))
        cursor = request.query_params.get('cursor')
        is_delivered = status_param == Order.Status.DELIVERED

        qs = self.get_queryset().filter(status=status_param)

        if is_delivered:
            cutoff = timezone.now() - timedelta(days=self.DELIVERED_WINDOW_DAYS)
            older = request.query_params.get('older') in ('1', 'true', 'True')
            if older:
                qs = qs.filter(delivered_at__lt=cutoff)
            else:
                qs = qs.filter(Q(delivered_at__gte=cutoff) | Q(delivered_at__isnull=True))
            qs = qs.order_by('-delivered_at', '-id')
            if cursor:
                da, cid = self._decode_cursor(cursor, is_delivered=True)
                qs = qs.filter(Q(delivered_at__lt=da) | Q(delivered_at=da, id__lt=cid))
        else:
            qs = qs.order_by('delivery_date', 'created_at', 'id')
            if cursor:
                dd, ca, cid = self._decode_cursor(cursor, is_delivered=False)
                qs = qs.filter(
                    Q(delivery_date__gt=dd)
                    | Q(delivery_date=dd, created_at__gt=ca)
                    | Q(delivery_date=dd, created_at=ca, id__gt=cid)
                )

        rows = list(qs[:limit + 1])
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = self._encode_cursor(rows[-1], is_delivered) if (has_more and rows) else None

        # Per-status totals (clean base — no per-row annotations to keep GROUP BY simple).
        # `counts` = order count; `value` = summed bill (total_amount) per column.
        base = Order.objects.filter(boutique=request.user.boutique, deleted_at__isnull=True)
        counts = {s: 0 for s in Order.Status.values}
        value = {s: '0.00' for s in Order.Status.values}
        for row in base.order_by().values('status').annotate(c=Count('id'), v=Sum('total_amount')):
            counts[row['status']] = row['c']
            value[row['status']] = str(row['v'] or Decimal('0.00'))

        return Response({
            'results': OrderSerializer(rows, many=True, context={'request': request}).data,
            'next_cursor': next_cursor,
            'counts': counts,
            'value': value,
        })

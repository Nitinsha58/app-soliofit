from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Max, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

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
        return qs

    def perform_create(self, serializer):
        max_num = Order.objects.aggregate(Max('order_number'))['order_number__max'] or 0
        with transaction.atomic():
            order = serializer.save(user=self.request.user, order_number=max_num + 1)
            create_order_activity(order, OrderActivity.Type.ORDER_CREATED)

    def partial_update(self, request, *args, **kwargs):
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
        with transaction.atomic():
            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])
            if new_status == Order.Status.DELIVERED:
                activity_type = OrderActivity.Type.DELIVERY_MARKED
            elif new_status == Order.Status.PARTIAL_DELIVERY:
                activity_type = OrderActivity.Type.PARTIAL_DELIVERY
            else:
                activity_type = OrderActivity.Type.STATUS_CHANGED
            create_order_activity(order, activity_type, {'from': old_status, 'to': new_status})
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

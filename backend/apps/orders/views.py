from django.db.models import Count, Max
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user, deleted_at__isnull=True)
            .select_related('customer')
            .order_by('delivery_date', 'created_at')
        )

    def perform_create(self, serializer):
        max_num = Order.objects.aggregate(Max('order_number'))['order_number__max'] or 0
        serializer.save(user=self.request.user, order_number=max_num + 1)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at'])

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

from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.orders.models import Order
from apps.payments.models import Installment
from apps.media.models import OrderPhoto, VoiceNote
from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = Customer.objects.filter(
            user=self.request.user,
            deleted_at__isnull=True,
        ).order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        customers = page if page is not None else list(qs)

        data = [dict(item) for item in CustomerSerializer(customers, many=True).data]

        if data:
            cids = [c.id for c in customers]
            # One query: order count + total billed per customer
            order_agg = {
                str(row['customer_id']): (row['n'], row['total'] or Decimal('0'))
                for row in Order.objects.filter(
                    user=request.user, customer_id__in=cids, deleted_at__isnull=True,
                ).values('customer_id').annotate(n=Count('id'), total=Sum('total_amount'))
            }
            # One query: total paid per customer
            paid_agg = {
                str(row['order__customer_id']): row['total']
                for row in Installment.objects.filter(
                    order__user=request.user,
                    order__customer_id__in=cids,
                    order__deleted_at__isnull=True,
                    paid_date__isnull=False,
                ).values('order__customer_id').annotate(total=Sum('amount'))
            }
            for item, customer in zip(data, customers):
                cid = str(customer.id)
                n, billed = order_agg.get(cid, (0, Decimal('0')))
                paid = paid_agg.get(cid) or Decimal('0')
                item['total_orders'] = n
                item['outstanding_balance'] = str(billed - paid)

        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)

    def retrieve(self, request, *args, **kwargs):
        customer = self.get_object()
        data = CustomerSerializer(customer).data
        orders = Order.objects.filter(
            user=request.user, customer=customer, deleted_at__isnull=True,
        )
        order_ids = orders.values_list('id', flat=True)
        paid_total = (
            Installment.objects.filter(order_id__in=order_ids, paid_date__isnull=False)
            .aggregate(s=Sum('amount'))['s'] or Decimal('0')
        )
        total_billed = orders.aggregate(s=Sum('total_amount'))['s'] or Decimal('0')
        data['total_orders'] = orders.count()
        data['total_spent'] = str(paid_total)
        data['outstanding_balance'] = str(total_billed - paid_total)
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        active = Order.objects.filter(
            user=request.user,
            customer=customer,
            deleted_at__isnull=True,
        ).exclude(status=Order.Status.DELIVERED)
        if active.exists():
            return Response(
                {'detail': 'Cannot delete a customer with active orders.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        customer.deleted_at = timezone.now()
        customer.save(update_fields=['deleted_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='payments')
    def payments(self, request, pk=None):
        customer = self.get_object()
        orders = (
            Order.objects.filter(user=request.user, customer=customer, deleted_at__isnull=True)
            .prefetch_related('installments')
            .order_by('-delivery_date')
        )
        result = []
        for order in orders:
            result.append({
                'order_id': str(order.id),
                'order_number': order.order_number,
                'delivery_date': str(order.delivery_date),
                'total_amount': str(order.total_amount),
                'installments': [
                    {
                        'id': str(i.id),
                        'amount': str(i.amount),
                        'due_date': str(i.due_date),
                        'paid_date': str(i.paid_date) if i.paid_date else None,
                        'status': i.status,
                        'remarks': i.remarks,
                        'days_overdue': i.days_overdue,
                    }
                    for i in order.installments.all()
                ],
            })
        return Response(result)

    @action(detail=True, methods=['get'], url_path='media')
    def media(self, request, pk=None):
        customer = self.get_object()
        order_qs = Order.objects.filter(
            user=request.user, customer=customer, deleted_at__isnull=True,
        ).only('id', 'order_number')
        order_map = {str(o.id): o.order_number for o in order_qs}
        order_ids = list(order_map.keys())

        photos = (
            OrderPhoto.objects.filter(order_id__in=order_ids)
            .select_related('order')
            .order_by('order__delivery_date', 'display_order')
        )
        voice_notes = VoiceNote.objects.filter(order_id__in=order_ids).order_by('created_at')

        return Response({
            'photos': [
                {
                    'id': str(p.id),
                    'public_url': p.public_url,
                    'photo_type': p.photo_type,
                    'order_id': str(p.order_id),
                    'order_number': order_map.get(str(p.order_id)),
                }
                for p in photos
            ],
            'voice_notes': [
                {
                    'id': str(v.id),
                    'public_url': v.public_url,
                    'duration_seconds': v.duration_seconds,
                    'created_at': v.created_at.isoformat(),
                    'order_id': str(v.order_id),
                    'order_number': order_map.get(str(v.order_id)),
                }
                for v in voice_notes
            ],
        })

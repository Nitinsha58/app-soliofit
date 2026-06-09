import re

from django.db.models import Count

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer
from apps.orders.models import Order


def _parse_order_number(q: str):
    """Parse '#0042', '0042', '42' → int. Returns None for anything that isn't purely digits (with optional # prefix)."""
    m = re.fullmatch(r'#?(\d+)', q.strip())
    if m:
        return int(m.group(1))
    return None


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'customers': [], 'orders': []})

        name_qs = list(
            Customer.objects.filter(
                boutique=request.user.boutique,
                deleted_at__isnull=True,
                name__icontains=q,
            )
            .values('id', 'name', 'phone')[:5]
        )
        remaining = 5 - len(name_qs)
        if remaining > 0:
            phone_qs = list(
                Customer.objects.filter(
                    boutique=request.user.boutique,
                    deleted_at__isnull=True,
                    phone__icontains=q,
                )
                .exclude(id__in=[c['id'] for c in name_qs])
                .values('id', 'name', 'phone')[:remaining]
            )
            customers = name_qs + phone_qs
        else:
            customers = name_qs

        # Attach order_count via a single aggregate query
        if customers:
            cids = [c['id'] for c in customers]
            counts = {
                str(row['customer_id']): row['n']
                for row in Order.objects.filter(
                    boutique=request.user.boutique,
                    customer_id__in=cids,
                    deleted_at__isnull=True,
                ).values('customer_id').annotate(n=Count('id'))
            }
        else:
            counts = {}

        order_num = _parse_order_number(q)
        if order_num is not None:
            orders = list(
                Order.objects.filter(
                    boutique=request.user.boutique,
                    deleted_at__isnull=True,
                    order_number=order_num,
                )
                .select_related('customer')
                .values('id', 'order_number', 'customer__name', 'status', 'delivery_date')[:5]
            )
        else:
            orders = []

        return Response({
            'customers': [
                {
                    'id': str(c['id']),
                    'name': c['name'],
                    'phone': c['phone'],
                    'order_count': counts.get(str(c['id']), 0),
                }
                for c in customers
            ],
            'orders': [
                {
                    'id': str(o['id']),
                    'order_number': o['order_number'],
                    'customer_name': o['customer__name'],
                    'status': o['status'],
                    'delivery_date': str(o['delivery_date']) if o['delivery_date'] else None,
                }
                for o in orders
            ],
        })

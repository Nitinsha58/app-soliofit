import re

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer
from apps.orders.models import Order


def _parse_order_number(q: str):
    """Extract an integer from strings like '#0042', '0042', '42'. Returns None if not parseable."""
    cleaned = re.sub(r'[^0-9]', '', q)
    if cleaned:
        return int(cleaned)
    return None


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'customers': [], 'orders': []})

        customers = (
            Customer.objects.filter(
                user=request.user,
                deleted_at__isnull=True,
            )
            .filter(
                name__icontains=q
            )
            .values('id', 'name', 'phone')[:5]
        )
        # Also search phone if name produced fewer than 5 results
        if customers.count() < 5:
            phone_qs = (
                Customer.objects.filter(
                    user=request.user,
                    deleted_at__isnull=True,
                    phone__icontains=q,
                )
                .exclude(id__in=[c['id'] for c in customers])
                .values('id', 'name', 'phone')[: 5 - len(list(customers))]
            )
            customers = list(customers) + list(phone_qs)
        else:
            customers = list(customers)

        order_num = _parse_order_number(q)
        if order_num is not None:
            orders = (
                Order.objects.filter(
                    user=request.user,
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
                {'id': str(c['id']), 'name': c['name'], 'phone': c['phone']}
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

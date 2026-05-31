from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from .models import Installment
from .serializers import InstallmentSerializer


def _get_order(request, order_id):
    try:
        return Order.objects.get(id=order_id, user=request.user, deleted_at__isnull=True)
    except Order.DoesNotExist:
        return None


class InstallmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = _get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        installments = Installment.objects.filter(order=order)
        return Response(InstallmentSerializer(installments, many=True).data)

    def post(self, request, order_id):
        order = _get_order(request, order_id)
        if not order:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = InstallmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(order=order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class InstallmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_installment(self, request, order_id, installment_id):
        try:
            return Installment.objects.get(
                id=installment_id,
                order__id=order_id,
                order__user=request.user,
                order__deleted_at__isnull=True,
            )
        except Installment.DoesNotExist:
            return None

    def patch(self, request, order_id, installment_id):
        installment = self._get_installment(request, order_id, installment_id)
        if not installment:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Cannot edit a paid installment'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = InstallmentSerializer(installment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, order_id, installment_id):
        installment = self._get_installment(request, order_id, installment_id)
        if not installment:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Cannot delete a paid installment'}, status=status.HTTP_400_BAD_REQUEST)
        installment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstallmentMarkPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id, installment_id):
        try:
            installment = Installment.objects.get(
                id=installment_id,
                order__id=order_id,
                order__user=request.user,
                order__deleted_at__isnull=True,
            )
        except Installment.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if installment.paid_date:
            return Response({'detail': 'Already marked as paid'}, status=status.HTTP_400_BAD_REQUEST)
        installment.paid_date = date.today()
        installment.save(update_fields=['paid_date'])
        return Response(InstallmentSerializer(installment).data)

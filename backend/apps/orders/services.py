from .models import OrderActivity


def create_order_activity(order, activity_type, metadata=None):
    OrderActivity.objects.create(
        order=order,
        activity_type=activity_type,
        metadata=metadata or {},
    )

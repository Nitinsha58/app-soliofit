from django.contrib import admin
from .models import Order, OrderMessageLog


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = ['order_number', 'customer', 'status', 'delivery_date', 'total_amount', 'priority', 'created_at']
    list_filter   = ['status', 'priority']
    search_fields = ['customer__name', 'order_number']
    readonly_fields = ['id', 'order_number', 'created_at', 'updated_at']


@admin.register(OrderMessageLog)
class OrderMessageLogAdmin(admin.ModelAdmin):
    list_display  = ['order', 'order_status', 'channel', 'template_key', 'sent_by', 'sent_at']
    list_filter   = ['channel', 'order_status']
    readonly_fields = ['id', 'sent_at']

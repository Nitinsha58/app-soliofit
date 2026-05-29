from django.contrib import admin
from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = ['order_number', 'customer', 'status', 'delivery_date', 'total_amount', 'priority', 'created_at']
    list_filter   = ['status', 'priority']
    search_fields = ['customer__name', 'order_number']
    readonly_fields = ['id', 'order_number', 'created_at', 'updated_at']

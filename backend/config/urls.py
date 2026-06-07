import datetime
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path, include


def health_check(request):
    try:
        connection.ensure_connection()
        return JsonResponse({
            'status': 'ok',
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
    except Exception:
        return JsonResponse({'status': 'error'}, status=503)


urlpatterns = [
    path('api/health/', health_check),
    path('api/auth/', include('apps.users.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/calendar/', include('apps.orders.calendar_urls')),
    path('api/orders/<uuid:order_id>/photos/', include('apps.media.photo_urls')),
    path('api/orders/<uuid:order_id>/voice-notes/', include('apps.media.voice_note_urls')),
    path('api/orders/<uuid:order_id>/installments/', include('apps.payments.urls')),
    path('api/upload/', include('apps.media.upload_urls')),
    path('api/payments/', include('apps.payments.payment_dashboard_urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/notifications/', include('apps.dashboard.notification_urls')),
    path('api/search/', include('apps.search.urls')),
    path('admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

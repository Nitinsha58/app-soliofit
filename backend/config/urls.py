import datetime
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path


def health_check(request):
    try:
        connection.ensure_connection()
        return JsonResponse({
            'status': 'ok',
            'timestamp': datetime.datetime.utcnow().isoformat(),
        })
    except Exception:
        return JsonResponse({'status': 'error'}, status=503)


urlpatterns = [
    path('api/health/', health_check),
    path('admin/', admin.site.urls),
]

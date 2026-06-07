from django.urls import path

from .calendar_views import CalendarView

urlpatterns = [
    path('', CalendarView.as_view()),
]

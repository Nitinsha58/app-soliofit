from django.urls import path
from . import views

urlpatterns = [
    path('', views.VoiceNoteListCreateView.as_view()),
    path('<uuid:note_id>/', views.VoiceNoteDetailView.as_view()),
]

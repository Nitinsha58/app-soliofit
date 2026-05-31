from django.urls import re_path, path
from . import views

urlpatterns = [
    path('presign/', views.PresignView.as_view()),
    re_path(r'^stub/(?P<s3_key>.+)$', views.StubUploadView.as_view()),
]

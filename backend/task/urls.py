
# task/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BoardViewSet, ListViewSet, TaskViewSet, TaskBulkCreateView
from .certificate_views import CertificateViewSet, CertificateTemplateViewSet, CertificateVerificationViewSet

router = DefaultRouter()
router.register(r'boards', BoardViewSet)
router.register(r'lists', ListViewSet)
router.register(r'tasks', TaskViewSet)
router.register(r'certificates', CertificateViewSet, basename='certificates')
router.register(r'certificate-templates', CertificateTemplateViewSet, basename='certificate-templates')
router.register(r'certificate-verifications', CertificateVerificationViewSet, basename='certificate-verifications')

urlpatterns = [
    # Bu manzil /api/task/tasks-create/ bo'ladi
    path('tasks-create/', TaskBulkCreateView.as_view(), name='task-bulk-create'),
    path('', include(router.urls)),
]
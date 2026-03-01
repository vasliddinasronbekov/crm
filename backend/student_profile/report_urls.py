"""
URL Configuration for Reports and Reminders
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .report_views import (
    ScheduledReportViewSet,
    ReportGenerationViewSet,
    PaymentReminderSettingsViewSet,
    PaymentReminderViewSet,
    BulkPaymentReminderView,
    PendingPaymentsForRemindersView
)

# Create router for viewsets
router = DefaultRouter()
router.register('scheduled-reports', ScheduledReportViewSet, basename='scheduled-report')
router.register('report-generations', ReportGenerationViewSet, basename='report-generation')
router.register('reminder-settings', PaymentReminderSettingsViewSet, basename='reminder-settings')
router.register('payment-reminders', PaymentReminderViewSet, basename='payment-reminder')

# URL patterns
urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),

    # Custom endpoints
    path('bulk-reminders/', BulkPaymentReminderView.as_view(), name='bulk-reminders'),
    path('pending-payments/', PendingPaymentsForRemindersView.as_view(), name='pending-payments'),
]

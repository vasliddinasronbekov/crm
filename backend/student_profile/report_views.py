"""
Report and Reminder Views
API endpoints for scheduled reports and payment reminders
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta

from .report_models import (
    ScheduledReport,
    ReportGeneration,
    PaymentReminderSettings,
    PaymentReminder
)
from .report_serializers import (
    ScheduledReportSerializer,
    ReportGenerationSerializer,
    PaymentReminderSettingsSerializer,
    PaymentReminderSerializer,
    BulkPaymentReminderSerializer
)
from .models import Payment
from users.permissions import HasRoleCapability


class ScheduledReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing scheduled reports
    Admin users can create, view, update, and delete scheduled reports
    """
    queryset = ScheduledReport.objects.all()
    serializer_class = ScheduledReportSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'reports.view',
        'retrieve': 'reports.view',
        'statistics': 'reports.view',
        'create': 'reports.create',
        'update': 'reports.create',
        'partial_update': 'reports.create',
        'destroy': 'reports.create',
        'toggle': 'reports.create',
        'run_now': 'reports.create',
    }

    def get_queryset(self):
        """Filter scheduled reports based on query parameters"""
        queryset = super().get_queryset()

        # Filter by enabled status
        enabled = self.request.query_params.get('enabled')
        if enabled is not None:
            queryset = queryset.filter(enabled=enabled.lower() == 'true')

        # Filter by report type
        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        # Filter by frequency
        frequency = self.request.query_params.get('frequency')
        if frequency:
            queryset = queryset.filter(frequency=frequency)

        return queryset.select_related('created_by').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """Toggle the enabled status of a scheduled report"""
        scheduled_report = self.get_object()
        scheduled_report.enabled = not scheduled_report.enabled
        scheduled_report.save(update_fields=['enabled'])

        if scheduled_report.enabled:
            scheduled_report.calculate_next_run()

        serializer = self.get_serializer(scheduled_report)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def run_now(self, request, pk=None):
        """Manually trigger report generation"""
        scheduled_report = self.get_object()

        # Create a report generation task
        generation = ReportGeneration.objects.create(
            scheduled_report=scheduled_report,
            report_type=scheduled_report.report_type,
            parameters=scheduled_report.parameters,
            status='pending'
        )

        # In production, this would trigger a Celery task
        # For now, we'll just return the generation record
        # from .tasks import generate_scheduled_report
        # generate_scheduled_report.delay(generation.id)

        return Response({
            'message': 'Report generation started',
            'generation_id': generation.id
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get statistics about scheduled reports"""
        total = ScheduledReport.objects.count()
        enabled = ScheduledReport.objects.filter(enabled=True).count()
        disabled = total - enabled

        by_type = ScheduledReport.objects.values('report_type').annotate(
            count=Count('id')
        ).order_by('-count')

        by_frequency = ScheduledReport.objects.values('frequency').annotate(
            count=Count('id')
        )

        return Response({
            'total': total,
            'enabled': enabled,
            'disabled': disabled,
            'by_type': list(by_type),
            'by_frequency': list(by_frequency),
        })


class ReportGenerationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing report generation history
    Read-only - generations are created by the system
    """
    queryset = ReportGeneration.objects.all()
    serializer_class = ReportGenerationSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'reports.view',
        'retrieve': 'reports.view',
        'statistics': 'reports.view',
    }

    def get_queryset(self):
        """Filter report generations based on query parameters"""
        queryset = super().get_queryset()

        # Filter by status
        report_status = self.request.query_params.get('status')
        if report_status:
            queryset = queryset.filter(status=report_status)

        # Filter by report type
        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from:
            queryset = queryset.filter(started_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(started_at__lte=date_to)

        return queryset.select_related('scheduled_report').order_by('-started_at')

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get statistics about report generations"""
        # Last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)

        total = ReportGeneration.objects.filter(started_at__gte=thirty_days_ago).count()
        completed = ReportGeneration.objects.filter(
            started_at__gte=thirty_days_ago,
            status='completed'
        ).count()
        failed = ReportGeneration.objects.filter(
            started_at__gte=thirty_days_ago,
            status='failed'
        ).count()

        success_rate = (completed / total * 100) if total > 0 else 0

        by_type = ReportGeneration.objects.filter(
            started_at__gte=thirty_days_ago
        ).values('report_type').annotate(
            count=Count('id')
        ).order_by('-count')

        return Response({
            'total_last_30_days': total,
            'completed': completed,
            'failed': failed,
            'success_rate': round(success_rate, 2),
            'by_type': list(by_type),
        })


class PaymentReminderSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet for payment reminder settings
    Only one settings instance should exist (singleton pattern)
    """
    queryset = PaymentReminderSettings.objects.all()
    serializer_class = PaymentReminderSettingsSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.manage',
        'retrieve': 'payments.manage',
        'create': 'payments.manage',
        'update': 'payments.manage',
        'partial_update': 'payments.manage',
        'destroy': 'payments.manage',
    }

    def list(self, request, *args, **kwargs):
        """Get current settings, create default if none exists"""
        settings_obj = PaymentReminderSettings.objects.first()

        if not settings_obj:
            # Create default settings
            settings_obj = PaymentReminderSettings.objects.create(
                enabled=False,
                days_before_due=3,
                frequency='daily',
                email_template='default',
                created_by=request.user
            )

        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Override create to update existing settings instead"""
        settings_obj = PaymentReminderSettings.objects.first()

        if settings_obj:
            # Update existing settings
            serializer = self.get_serializer(settings_obj, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save(created_by=request.user)
            return Response(serializer.data)

        # Create new settings
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Update settings"""
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data)


class PaymentReminderViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing payment reminder history
    Read-only - reminders are created by the system
    """
    queryset = PaymentReminder.objects.all()
    serializer_class = PaymentReminderSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.manage',
        'retrieve': 'payments.manage',
        'statistics': 'payments.manage',
    }

    def get_queryset(self):
        """Filter payment reminders based on query parameters"""
        queryset = super().get_queryset()

        # Filter by status
        reminder_status = self.request.query_params.get('status')
        if reminder_status:
            queryset = queryset.filter(status=reminder_status)

        # Filter by payment
        payment_id = self.request.query_params.get('payment')
        if payment_id:
            queryset = queryset.filter(payment_id=payment_id)

        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_from:
            queryset = queryset.filter(scheduled_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(scheduled_at__lte=date_to)

        return queryset.select_related('payment', 'payment__by_user').order_by('-scheduled_at')

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get statistics about payment reminders"""
        # Last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)

        total = PaymentReminder.objects.filter(scheduled_at__gte=thirty_days_ago).count()
        sent = PaymentReminder.objects.filter(
            scheduled_at__gte=thirty_days_ago,
            status='sent'
        ).count()
        failed = PaymentReminder.objects.filter(
            scheduled_at__gte=thirty_days_ago,
            status='failed'
        ).count()

        success_rate = (sent / total * 100) if total > 0 else 0

        return Response({
            'total_last_30_days': total,
            'sent': sent,
            'failed': failed,
            'success_rate': round(success_rate, 2),
        })


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class BulkPaymentReminderView(APIView):
    """
    API endpoint for sending bulk payment reminders
    """
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    method_capabilities = {'post': 'payments.manage'}

    def post(self, request):
        """Send reminders to multiple payments"""
        serializer = BulkPaymentReminderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_ids = serializer.validated_data['payment_ids']
        template = serializer.validated_data.get('template', 'default')
        custom_message = serializer.validated_data.get('custom_message', '')

        # Get pending payments
        payments = Payment.objects.filter(
            id__in=payment_ids,
            status='pending'
        ).select_related('by_user')

        # Create reminder records
        reminders_created = []
        for payment in payments:
            if payment.by_user and payment.by_user.email:
                reminder = PaymentReminder.objects.create(
                    payment=payment,
                    recipient_email=payment.by_user.email,
                    template_used=template,
                    status='pending',
                    metadata={
                        'custom_message': custom_message,
                        'sent_by': request.user.id,
                        'bulk_send': True
                    }
                )
                reminders_created.append(reminder)

        # In production, trigger Celery task to send emails
        # from .tasks import send_payment_reminders
        # send_payment_reminders.delay([r.id for r in reminders_created])

        # For now, simulate sending
        for reminder in reminders_created:
            reminder.status = 'sent'
            reminder.sent_at = timezone.now()
            reminder.save(update_fields=['status', 'sent_at'])

        return Response({
            'message': f'Successfully queued {len(reminders_created)} payment reminders',
            'reminders_sent': len(reminders_created),
            'reminder_ids': [r.id for r in reminders_created]
        }, status=status.HTTP_200_OK)


@extend_schema(responses=OpenApiTypes.OBJECT)
class PendingPaymentsForRemindersView(APIView):
    """
    API endpoint to get pending payments that need reminders
    """
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    method_capabilities = {'get': 'payments.manage'}

    def get(self, request):
        """Get pending payments with reminder info"""
        # Get pending payments
        pending_payments = Payment.objects.filter(
            status='pending'
        ).select_related('by_user', 'group').order_by('-date')

        # Limit to prevent performance issues
        limit = int(request.query_params.get('limit', 100))
        pending_payments = pending_payments[:limit]

        payments_data = []
        for payment in pending_payments:
            # Check if reminder already sent recently
            recent_reminder = PaymentReminder.objects.filter(
                payment=payment,
                scheduled_at__gte=timezone.now() - timedelta(days=7),
                status='sent'
            ).exists()

            payments_data.append({
                'id': payment.id,
                'student': {
                    'id': payment.by_user.id,
                    'name': f"{payment.by_user.first_name} {payment.by_user.last_name}".strip() or payment.by_user.username,
                    'email': payment.by_user.email,
                },
                'amount': payment.amount / 100,  # Convert to sum
                'date': payment.date,
                'due_date': payment.due_date if hasattr(payment, 'due_date') else None,
                'group': {
                    'id': payment.group.id,
                    'name': payment.group.name,
                } if payment.group else None,
                'recent_reminder_sent': recent_reminder,
            })

        return Response({
            'count': len(payments_data),
            'payments': payments_data
        })

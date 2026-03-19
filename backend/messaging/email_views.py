"""
Email Marketing System API Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils import timezone
from django.db.models import Count, Q

from .email_models import EmailTemplate, EmailCampaign, EmailLog, AutomatedEmail
from .email_serializers import (
    EmailTemplateSerializer,
    EmailCampaignSerializer,
    EmailCampaignCreateSerializer,
    EmailLogSerializer,
    AutomatedEmailSerializer
)
from users.models import User
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    ensure_user_can_access_branch,
    get_effective_branch_id,
    is_global_branch_user,
    user_belongs_to_branch,
)
from student_profile.models import Group


def _scope_users_to_active_branch(queryset, request):
    user = request.user
    active_branch_id = get_effective_branch_id(request, user)
    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    return queryset.filter(build_direct_user_branch_q(active_branch_id)).distinct()


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """Email template management API"""

    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """Filter templates"""
        queryset = EmailTemplate.objects.all()
        if not is_global_branch_user(self.request.user):
            active_branch_id = get_effective_branch_id(self.request, self.request.user)
            if active_branch_id is None:
                return queryset.none()
            queryset = queryset.filter(
                Q(created_by=self.request.user)
                | build_user_branch_q(active_branch_id, 'created_by')
            ).distinct()

        # Filter by template type
        template_type = self.request.query_params.get('template_type')
        if template_type:
            queryset = queryset.filter(template_type=template_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        """Set created_by to current user"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a template"""
        template = self.get_object()

        # Create copy
        new_template = EmailTemplate.objects.create(
            name=f"{template.name} (Copy)",
            template_type=template.template_type,
            subject=template.subject,
            html_content=template.html_content,
            text_content=template.text_content,
            variables=template.variables,
            from_email=template.from_email,
            from_name=template.from_name,
            created_by=request.user,
            is_active=False  # Deactivate copy by default
        )

        serializer = EmailTemplateSerializer(new_template, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def variables(self, request):
        """Get available template variables"""
        return Response({
            'student': [
                '{{student_name}}',
                '{{student_email}}',
                '{{student_phone}}',
                '{{student_id}}'
            ],
            'course': [
                '{{course_name}}',
                '{{course_price}}',
                '{{course_duration}}'
            ],
            'payment': [
                '{{payment_amount}}',
                '{{payment_date}}',
                '{{balance}}',
                '{{due_amount}}'
            ],
            'system': [
                '{{current_date}}',
                '{{current_year}}',
                '{{company_name}}',
                '{{support_email}}'
            ]
        })


class EmailCampaignViewSet(viewsets.ModelViewSet):
    """Email campaign management API"""

    queryset = EmailCampaign.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        """Use different serializers for create/update vs read"""
        if self.action in ['create', 'update', 'partial_update']:
            return EmailCampaignCreateSerializer
        return EmailCampaignSerializer

    def get_queryset(self):
        """Filter campaigns"""
        queryset = EmailCampaign.objects.select_related(
            'template', 'created_by'
        ).all()
        if not is_global_branch_user(self.request.user):
            active_branch_id = get_effective_branch_id(self.request, self.request.user)
            if active_branch_id is None:
                return queryset.none()
            queryset = queryset.filter(
                Q(created_by=self.request.user)
                | build_user_branch_q(active_branch_id, 'created_by')
                | Q(specific_group__branch_id=active_branch_id)
                | Q(custom_recipients__branch_id=active_branch_id)
                | Q(
                    custom_recipients__branch_memberships__branch_id=active_branch_id,
                    custom_recipients__branch_memberships__is_active=True,
                )
            ).distinct()

        # Filter by status
        campaign_status = self.request.query_params.get('status')
        if campaign_status:
            queryset = queryset.filter(status=campaign_status)

        # Filter by recipient type
        recipient_type = self.request.query_params.get('recipient_type')
        if recipient_type:
            queryset = queryset.filter(recipient_type=recipient_type)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        """Set created_by to current user"""
        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if active_branch_id is None and not is_global_branch_user(self.request.user):
            raise PermissionDenied('No active branch scope available for this user.')

        specific_course = serializer.validated_data.get('specific_course')
        if (
            specific_course is not None
            and active_branch_id is not None
            and not Group.objects.filter(course=specific_course, branch_id=active_branch_id).exists()
        ):
            raise PermissionDenied('Selected course is outside your active branch scope.')

        specific_group = serializer.validated_data.get('specific_group')
        if specific_group is not None:
            ensure_user_can_access_branch(self.request.user, specific_group.branch_id)

        custom_recipients = list(serializer.validated_data.get('custom_recipients', []))
        if active_branch_id is not None:
            invalid_recipient_ids = [
                recipient.id
                for recipient in custom_recipients
                if not user_belongs_to_branch(recipient, active_branch_id)
            ]
            if invalid_recipient_ids:
                raise PermissionDenied(
                    f'Users {invalid_recipient_ids} are outside your active branch scope.'
                )
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        """Schedule campaign for sending"""
        campaign = self.get_object()

        if campaign.status != 'draft':
            return Response(
                {'error': 'Only draft campaigns can be scheduled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        scheduled_for = request.data.get('scheduled_for')
        if not scheduled_for:
            return Response(
                {'error': 'scheduled_for is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.scheduled_for = scheduled_for
        campaign.status = 'scheduled'
        campaign.save()

        serializer = EmailCampaignSerializer(campaign, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_now(self, request, pk=None):
        """Send campaign immediately"""
        campaign = self.get_object()

        if campaign.status not in ['draft', 'scheduled']:
            return Response(
                {'error': 'Campaign already sent or in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get recipients based on recipient_type
        recipients = self._get_recipients(campaign)

        if not recipients:
            return Response(
                {'error': 'No recipients found for this campaign'},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.total_recipients = len(recipients)
        campaign.status = 'sending'
        campaign.save()

        # Queue sending task (would be done with Celery in production)
        # For now, we'll create EmailLog entries
        for recipient in recipients:
            EmailLog.objects.create(
                campaign=campaign,
                template=campaign.template,
                recipient=recipient,
                recipient_email=recipient.email,
                subject=campaign.subject,
                status='queued'
            )

        return Response({
            'message': f'Campaign queued for {len(recipients)} recipients',
            'total_recipients': len(recipients)
        })

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Preview campaign with sample data"""
        campaign = self.get_object()

        # Sample data for preview
        sample_data = {
            'student_name': 'John Doe',
            'student_email': 'john@example.com',
            'course_name': 'Web Development Bootcamp',
            'course_price': '5,000,000',
            'current_date': timezone.now().strftime('%B %d, %Y'),
            'company_name': 'EduVoice'
        }

        # Replace variables in content
        preview_html = campaign.html_content
        preview_text = campaign.text_content
        preview_subject = campaign.subject

        for key, value in sample_data.items():
            preview_html = preview_html.replace(f'{{{{{key}}}}}', str(value))
            preview_text = preview_text.replace(f'{{{{{key}}}}}', str(value))
            preview_subject = preview_subject.replace(f'{{{{{key}}}}}', str(value))

        return Response({
            'subject': preview_subject,
            'html_content': preview_html,
            'text_content': preview_text,
            'sample_data': sample_data
        })

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get campaign statistics"""
        campaign = self.get_object()

        logs = EmailLog.objects.filter(campaign=campaign)

        stats = {
            'total_recipients': campaign.total_recipients,
            'emails_sent': campaign.emails_sent,
            'emails_failed': campaign.emails_failed,
            'emails_delivered': logs.filter(status='delivered').count(),
            'emails_opened': campaign.emails_opened,
            'emails_clicked': campaign.emails_clicked,
            'emails_bounced': logs.filter(status='bounced').count(),
            'emails_complained': logs.filter(status='complained').count(),
            'open_rate': round((campaign.emails_opened / campaign.emails_sent * 100), 2) if campaign.emails_sent > 0 else 0,
            'click_rate': round((campaign.emails_clicked / campaign.emails_sent * 100), 2) if campaign.emails_sent > 0 else 0,
            'delivery_rate': round((logs.filter(status='delivered').count() / campaign.emails_sent * 100), 2) if campaign.emails_sent > 0 else 0,
        }

        return Response(stats)

    def _get_recipients(self, campaign):
        """Get recipient list based on campaign settings"""
        recipients = []

        if campaign.recipient_type == 'all_students':
            recipients = User.objects.filter(is_active=True, is_staff=False)

        elif campaign.recipient_type == 'specific_course':
            if campaign.specific_course:
                # Get students enrolled in this course
                recipients = User.objects.filter(
                    student_groups__course=campaign.specific_course,
                    is_active=True
                ).distinct()

        elif campaign.recipient_type == 'specific_group':
            if campaign.specific_group:
                recipients = campaign.specific_group.students.filter(is_active=True)

        elif campaign.recipient_type == 'custom':
            recipients = campaign.custom_recipients.filter(is_active=True)

        if not hasattr(recipients, 'filter'):
            recipient_ids = [recipient.id for recipient in recipients]
            recipients = User.objects.filter(id__in=recipient_ids)

        scoped_recipients = _scope_users_to_active_branch(recipients, self.request)
        return list(scoped_recipients)


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Email delivery logs (read-only)"""

    queryset = EmailLog.objects.all()
    serializer_class = EmailLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """Filter email logs"""
        queryset = EmailLog.objects.select_related(
            'campaign', 'template', 'recipient'
        ).all()
        if not is_global_branch_user(self.request.user):
            active_branch_id = get_effective_branch_id(self.request, self.request.user)
            if active_branch_id is None:
                return queryset.none()
            queryset = queryset.filter(
                build_user_branch_q(active_branch_id, 'recipient')
                | Q(campaign__specific_group__branch_id=active_branch_id)
                | build_user_branch_q(active_branch_id, 'campaign__created_by')
            ).distinct()

        # Filter by campaign
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)

        # Filter by status
        log_status = self.request.query_params.get('status')
        if log_status:
            queryset = queryset.filter(status=log_status)

        # Filter by recipient
        recipient_id = self.request.query_params.get('recipient_id')
        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)

        return queryset.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get overall email statistics"""
        queryset = self.get_queryset()
        total_sent = queryset.count()

        stats = {
            'total_emails': total_sent,
            'delivered': queryset.filter(status='delivered').count(),
            'opened': queryset.filter(opened_at__isnull=False).count(),
            'clicked': queryset.filter(clicked_at__isnull=False).count(),
            'bounced': queryset.filter(status='bounced').count(),
            'failed': queryset.filter(status='failed').count(),
            'by_status': queryset.values('status').annotate(count=Count('id'))
        }

        return Response(stats)


class AutomatedEmailViewSet(viewsets.ModelViewSet):
    """Automated email management API"""

    queryset = AutomatedEmail.objects.all()
    serializer_class = AutomatedEmailSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """Filter automated emails"""
        queryset = AutomatedEmail.objects.select_related('template').all()
        if not is_global_branch_user(self.request.user):
            active_branch_id = get_effective_branch_id(self.request, self.request.user)
            if active_branch_id is None:
                return queryset.none()
            queryset = queryset.filter(
                build_user_branch_q(active_branch_id, 'template__created_by')
            ).distinct()

        # Filter by trigger type
        trigger_type = self.request.query_params.get('trigger_type')
        if trigger_type:
            queryset = queryset.filter(trigger_type=trigger_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.order_by('name')

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle automation on/off"""
        automation = self.get_object()
        automation.is_active = not automation.is_active
        automation.save()

        serializer = AutomatedEmailSerializer(automation, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def test_trigger(self, request, pk=None):
        """Send test email with this automation"""
        automation = self.get_object()
        test_email = request.data.get('test_email')

        if not test_email:
            return Response(
                {'error': 'test_email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # In production, this would send actual test email
        return Response({
            'message': f'Test email would be sent to {test_email}',
            'automation': automation.name,
            'trigger_type': automation.trigger_type,
            'template': automation.template.name
        })

    @action(detail=False, methods=['get'])
    def trigger_types(self, request):
        """Get available trigger types"""
        triggers = [
            {
                'value': 'student_enrolled',
                'label': 'Student Enrolled in Course',
                'description': 'Triggered when a student enrolls in any course'
            },
            {
                'value': 'payment_received',
                'label': 'Payment Received',
                'description': 'Triggered when a payment is received'
            },
            {
                'value': 'payment_reminder',
                'label': 'Payment Reminder',
                'description': 'Triggered X days before payment due date'
            },
            {
                'value': 'course_completed',
                'label': 'Course Completed',
                'description': 'Triggered when a student completes a course'
            },
            {
                'value': 'birthday',
                'label': 'Student Birthday',
                'description': 'Triggered on student\'s birthday'
            },
            {
                'value': 'low_attendance',
                'label': 'Low Attendance Alert',
                'description': 'Triggered when student attendance drops below threshold'
            },
            {
                'value': 'certificate_issued',
                'label': 'Certificate Issued',
                'description': 'Triggered when a certificate is generated'
            },
            {
                'value': 'group_started',
                'label': 'Group Started',
                'description': 'Triggered when a new group begins classes'
            }
        ]

        return Response(triggers)

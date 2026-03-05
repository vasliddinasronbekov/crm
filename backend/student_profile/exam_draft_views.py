"""
Views for Exam Draft and Notification System
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Count
from django.utils import timezone

from .exam_draft_models import (
    IELTSExamDraft, IELTSQuestionDraft,
    AIExamGenerationRequest, ExamDraftStatus
)
from .notification_models import Notification, InboxSettings
from .exam_draft_serializers import (
    IELTSExamDraftListSerializer, IELTSExamDraftDetailSerializer,
    IELTSExamDraftCreateSerializer, IELTSQuestionDraftSerializer,
    ExamApprovalSerializer, AIExamGenerationRequestSerializer,
    NotificationSerializer, InboxSettingsSerializer
)
from .exam_quality import build_ielts_draft_quality_report
from .permissions import IsStaffOrAdmin, IsLMSHead


class IELTSExamDraftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing IELTS exam drafts
    """
    permission_classes = [IsAuthenticated, IsStaffOrAdmin]
    queryset = IELTSExamDraft.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return IELTSExamDraftCreateSerializer
        elif self.action in ['list', 'my_drafts', 'pending_approval']:
            return IELTSExamDraftListSerializer
        return IELTSExamDraftDetailSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = IELTSExamDraft.objects.all()

        # Regular staff can only see their own drafts
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(created_by=user)

        return queryset.select_related('created_by', 'reviewed_by', 'published_exam')

    @action(detail=False, methods=['get'])
    def my_drafts(self, request):
        """Get current user's exam drafts"""
        drafts = self.get_queryset().filter(created_by=request.user)
        serializer = self.get_serializer(drafts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsLMSHead])
    def pending_approval(self, request):
        """Get all exams pending approval (LMS Head only)"""
        pending = self.get_queryset().filter(status=ExamDraftStatus.PENDING_APPROVAL)
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_for_review(self, request, pk=None):
        """Submit exam draft for AI review"""
        exam_draft = self.get_object()

        # Check permissions
        if exam_draft.created_by != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'You can only submit your own drafts for review'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if has questions
        if exam_draft.draft_questions.count() == 0:
            return Response(
                {'detail': 'Cannot submit exam with no questions'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check current status
        if exam_draft.status != ExamDraftStatus.DRAFT:
            return Response(
                {'detail': f'Cannot submit exam in {exam_draft.get_status_display()} status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Submit for AI review
        exam_draft.submit_for_ai_review()

        return Response({
            'detail': 'Exam submitted for AI review',
            'status': exam_draft.status
        })

    @action(detail=True, methods=['post'])
    def submit_for_approval(self, request, pk=None):
        """Submit AI-reviewed exam for LMS head approval"""
        exam_draft = self.get_object()

        # Check permissions
        if exam_draft.created_by != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'You can only submit your own drafts'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            exam_draft.submit_for_approval()
            return Response({
                'detail': 'Exam submitted for approval',
                'status': exam_draft.status
            })
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsLMSHead])
    def approve_or_reject(self, request, pk=None):
        """Approve or reject an exam (LMS Head only)"""
        exam_draft = self.get_object()
        serializer = ExamApprovalSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_type = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

        if exam_draft.status != ExamDraftStatus.PENDING_APPROVAL:
            return Response(
                {'detail': f'Cannot {action_type} exam in {exam_draft.get_status_display()} status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if action_type == 'approve':
                exam_draft.approve(reviewed_by=request.user, comments=comments)
                message = f'Exam approved and published as exam ID {exam_draft.published_exam.id}'
            else:
                exam_draft.reject(reviewed_by=request.user, comments=comments)
                message = 'Exam rejected. Creator has been notified.'

            return Response({
                'detail': message,
                'status': exam_draft.status
            })
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get exam draft statistics"""
        queryset = self.get_queryset()

        if not (request.user.is_staff or request.user.is_superuser):
            queryset = queryset.filter(created_by=request.user)

        stats = {
            'total': queryset.count(),
            'by_status': {},
            'by_section': {},
            'avg_quality_score': 0,
        }

        # Count by status
        for choice in ExamDraftStatus.choices:
            count = queryset.filter(status=choice[0]).count()
            stats['by_status'][choice[1]] = count

        # Count by section
        for section in ['reading', 'listening', 'writing', 'speaking']:
            count = queryset.filter(section=section).count()
            stats['by_section'][section] = count

        # Average AI quality score
        reviewed = queryset.filter(ai_quality_score__isnull=False)
        if reviewed.exists():
            from django.db.models import Avg
            stats['avg_quality_score'] = reviewed.aggregate(Avg('ai_quality_score'))['ai_quality_score__avg']

        return Response(stats)

    @action(detail=True, methods=['get'])
    def quality_report(self, request, pk=None):
        """Get authoring readiness, AI review quality, and live draft analytics."""
        exam_draft = self.get_object()
        return Response(build_ielts_draft_quality_report(exam_draft))


class IELTSQuestionDraftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing question drafts
    """
    serializer_class = IELTSQuestionDraftSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdmin]
    queryset = IELTSQuestionDraft.objects.all()

    def get_queryset(self):
        user = self.request.user
        queryset = IELTSQuestionDraft.objects.all()

        # Regular staff can only see questions from their own exam drafts
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(exam_draft__created_by=user)

        return queryset.select_related('exam_draft')

    def perform_create(self, serializer):
        # Verify user owns the exam draft
        exam_draft = serializer.validated_data['exam_draft']
        if exam_draft.created_by != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only add questions to your own exam drafts')

        serializer.save()


class AIExamGenerationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AI exam generation
    """
    serializer_class = AIExamGenerationRequestSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAdmin]
    http_method_names = ['get', 'post']  # Read-only after creation
    queryset = AIExamGenerationRequest.objects.all()

    def get_queryset(self):
        user = self.request.user
        queryset = AIExamGenerationRequest.objects.all()

        # Regular staff can only see their own requests
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(requested_by=user)

        return queryset.select_related('requested_by', 'generated_draft')

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's AI generation requests"""
        requests_list = self.get_queryset().filter(requested_by=request.user)
        serializer = self.get_serializer(requests_list, many=True)
        return Response(serializer.data)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for user notifications
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notification.objects.all()

    def get_queryset(self):
        return Notification.objects.filter(
            recipient=self.request.user
        ).select_related('exam_draft')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'detail': 'Notification marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'detail': 'All notifications marked as read'})


class InboxSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet for inbox settings
    """
    serializer_class = InboxSettingsSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'put', 'patch']
    queryset = InboxSettings.objects.all()

    def get_queryset(self):
        return InboxSettings.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create settings for current user"""
        settings, created = InboxSettings.objects.get_or_create(
            user=self.request.user
        )
        return settings

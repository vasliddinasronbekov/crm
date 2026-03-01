"""
Certificate API Views
"""

from django.db.models import Count, Max
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse
from django.shortcuts import get_object_or_404

from .certificate_models import Certificate, CertificateTemplate, CertificateVerification
from .certificate_serializers import (
    CertificateSerializer,
    CertificateCreateSerializer,
    CertificateTemplateSerializer,
    CertificateVerificationSerializer
)
from .services.certificate_generator import issue_certificate_for_student
from student_profile.models import Course, Attendance, ExamScore
from student_profile.content_models import StudentProgress, Lesson
from users.models import User


def _is_certificate_manager(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser or user.is_teacher))


class CertificateViewSet(viewsets.ModelViewSet):
    """Certificate management API"""

    queryset = Certificate.objects.all()
    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Return appropriate serializer class"""
        if self.action == 'create':
            return CertificateCreateSerializer
        return CertificateSerializer

    def get_queryset(self):
        """Filter certificates based on user role"""
        user = self.request.user
        queryset = (
            Certificate.objects.select_related('student', 'course', 'template', 'issued_by')
            .annotate(
                verification_count=Count('verifications', distinct=True),
                last_verified_at=Max('verifications__verified_at'),
            )
            .order_by('-issued_date')
        )

        # Students see only their certificates
        if not _is_certificate_manager(user):
            return queryset.filter(student=user)

        # Staff/admin see all
        return queryset

    def _ensure_management_access(self, request):
        if _is_certificate_manager(request.user):
            return None
        return Response(
            {'error': 'You do not have permission to manage certificates.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def create(self, request, *args, **kwargs):
        """Generate a new certificate"""
        denied = self._ensure_management_access(request)
        if denied:
            return denied

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        student = get_object_or_404(User, id=serializer.validated_data['student_id'])
        course = get_object_or_404(Course, id=serializer.validated_data['course_id'])
        template_id = serializer.validated_data.get('template_id')
        grade = serializer.validated_data.get('grade', '')
        hours = serializer.validated_data.get('hours_completed', 0)
        completion_date = serializer.validated_data.get('completion_date')
        notes = serializer.validated_data.get('notes', '')
        force_regenerate = serializer.validated_data.get('force_regenerate', False)

        try:
            certificate, created = issue_certificate_for_student(
                student=student,
                course=course,
                issued_by=request.user,
                template_id=template_id,
                grade=grade,
                hours=hours,
                completion_date=completion_date,
                notes=notes,
                force_regenerate=force_regenerate,
            )

            response_serializer = CertificateSerializer(certificate, context={'request': request})
            headers = self.get_success_headers(response_serializer.data)
            response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(response_serializer.data, status=response_status, headers=headers)

        except Exception as e:
            return Response(
                {'error': f'Failed to generate certificate: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download certificate PDF"""
        certificate = self.get_object()

        if not certificate.certificate_file:
            return Response(
                {'error': 'Certificate file not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            return FileResponse(
                certificate.certificate_file.open('rb'),
                content_type='application/pdf',
                as_attachment=True,
                filename=f'certificate_{certificate.verification_code}.pdf'
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate certificate (if template changed or data updated)"""
        denied = self._ensure_management_access(request)
        if denied:
            return denied

        certificate = self.get_object()

        certificate, _ = issue_certificate_for_student(
            student=certificate.student,
            course=certificate.course,
            issued_by=request.user,
            template_id=certificate.template_id,
            grade=certificate.grade,
            hours=certificate.hours_completed,
            completion_date=certificate.completion_date,
            notes=certificate.notes,
            force_regenerate=True,
        )
        serializer = CertificateSerializer(certificate, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def eligibility(self, request):
        """Provide certificate eligibility context for the selected student and course."""
        denied = self._ensure_management_access(request)
        if denied:
            return denied

        student_id = request.query_params.get('student_id')
        course_id = request.query_params.get('course_id')

        if not student_id or not course_id:
            return Response(
                {'error': 'student_id and course_id are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student = get_object_or_404(User, id=student_id)
        course = get_object_or_404(Course, id=course_id)

        enrolled_groups = student.student_groups.filter(course=course).select_related('branch')
        progress_qs = StudentProgress.objects.filter(student=student, course=course)
        lesson_count = Lesson.objects.filter(module__course=course).count()
        completed_lessons = progress_qs.filter(lesson__isnull=False, is_completed=True).count()
        attendance_qs = Attendance.objects.filter(student=student, group__course=course)
        total_sessions = attendance_qs.count()
        present_sessions = attendance_qs.filter(attendance_status=Attendance.STATUS_PRESENT).count()
        exam_qs = ExamScore.objects.filter(student=student, group__course=course)
        exam_count = exam_qs.count()
        average_score = round(
            sum(exam_qs.values_list('score', flat=True)) / exam_count,
            2,
        ) if exam_count else 0
        existing_certificate = Certificate.objects.filter(student=student, course=course).select_related(
            'template', 'issued_by'
        ).first()

        completion_rate = round((completed_lessons / lesson_count) * 100, 1) if lesson_count else 0
        attendance_rate = round((present_sessions / total_sessions) * 100, 1) if total_sessions else 0
        has_learning_signal = any([
            enrolled_groups.exists(),
            progress_qs.exists(),
            attendance_qs.exists(),
            exam_qs.exists(),
        ])
        ready_for_issue = (
            completion_rate >= 80
            or average_score >= 70
            or (lesson_count > 0 and completed_lessons == lesson_count)
        )

        response = {
            'eligible': has_learning_signal,
            'ready_for_issue': ready_for_issue,
            'student': {
                'id': student.id,
                'name': student.get_full_name().strip() or student.username,
                'username': student.username,
                'email': student.email,
            },
            'course': {
                'id': course.id,
                'name': course.name,
            },
            'enrollment': {
                'is_enrolled': enrolled_groups.exists(),
                'group_names': list(enrolled_groups.values_list('name', flat=True)),
                'group_count': enrolled_groups.count(),
            },
            'progress': {
                'completed_lessons': completed_lessons,
                'total_lessons': lesson_count,
                'completion_rate': completion_rate,
            },
            'attendance': {
                'present_sessions': present_sessions,
                'total_sessions': total_sessions,
                'attendance_rate': attendance_rate,
            },
            'exams': {
                'attempt_count': exam_count,
                'average_score': average_score,
            },
            'existing_certificate': (
                CertificateSerializer(existing_certificate, context={'request': request}).data
                if existing_certificate else None
            ),
        }
        return Response(response)

    def partial_update(self, request, *args, **kwargs):
        denied = self._ensure_management_access(request)
        if denied:
            return denied
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = self._ensure_management_access(request)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._ensure_management_access(request)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def verify(self, request):
        """Verify certificate by ID or code"""
        cert_id = request.query_params.get('id')
        code = request.query_params.get('code')

        if not cert_id and not code:
            return Response(
                {'error': 'Please provide certificate ID or code'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if cert_id:
                certificate = Certificate.objects.get(certificate_id=cert_id)
            else:
                # Search by verification code (first part of UUID)
                certificates = Certificate.objects.filter(
                    certificate_id__startswith=code.lower()
                )
                if certificates.count() == 0:
                    raise Certificate.DoesNotExist
                certificate = certificates.first()

            # Log verification attempt
            CertificateVerification.objects.create(
                certificate=certificate,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )

            serializer = CertificateSerializer(certificate, context={'request': request})
            return Response({
                'verified': True,
                'certificate': serializer.data
            })

        except Certificate.DoesNotExist:
            return Response(
                {'verified': False, 'error': 'Certificate not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def my_certificates(self, request):
        """Get current user's certificates"""
        certificates = Certificate.objects.filter(
            student=request.user
        ).order_by('-issued_date')

        serializer = CertificateSerializer(certificates, many=True, context={'request': request})
        return Response(serializer.data)


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    """Certificate template management"""

    queryset = CertificateTemplate.objects.all()
    serializer_class = CertificateTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = CertificateTemplate.objects.annotate(
            certificate_count=Count('certificates', distinct=True)
        ).order_by('-is_default', 'name')
        if not _is_certificate_manager(self.request.user):
            return queryset.none()
        return queryset

    def list(self, request, *args, **kwargs):
        denied = None if _is_certificate_manager(request.user) else Response(
            {'error': 'You do not have permission to view certificate templates.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = None if _is_certificate_manager(request.user) else Response(
            {'error': 'You do not have permission to manage certificate templates.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = None if _is_certificate_manager(request.user) else Response(
            {'error': 'You do not have permission to manage certificate templates.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denied = None if _is_certificate_manager(request.user) else Response(
            {'error': 'You do not have permission to manage certificate templates.'},
            status=status.HTTP_403_FORBIDDEN,
        )
        if denied:
            return denied
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_certificate_manager(request.user):
            return Response(
                {'error': 'You do not have permission to manage certificate templates.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()

        # Prevent deleting the default template
        if instance.is_default:
            return Response(
                {'error': 'Cannot delete the default template. Please set another template as default first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent deleting a template that is in use
        if instance.certificates.exists():
            return Response(
                {'error': 'This template is in use by one or more certificates and cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        print(f"Attempting to delete CertificateTemplate with id: {instance.id}")
        try:
            response = super().destroy(request, *args, **kwargs)
            print(f"Successfully deleted CertificateTemplate with id: {instance.id}")
            return response
        except Exception as e:
            print(f"Error deleting CertificateTemplate with id: {instance.id}, error: {e}")
            return Response(
                {'error': f'Failed to delete certificate template: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set template as default"""
        if not _is_certificate_manager(request.user):
            return Response(
                {'error': 'You do not have permission to manage certificate templates.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        template = self.get_object()

        # Remove default from others
        CertificateTemplate.objects.update(is_default=False)

        # Set this as default
        template.is_default = True
        template.save()

        return Response({'message': 'Template set as default'})


class CertificateVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Certificate verification logs"""
    
    queryset = CertificateVerification.objects.all()
    serializer_class = CertificateVerificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter verifications"""
        return CertificateVerification.objects.select_related("certificate").all()

"""
Content Delivery System API Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Avg, Count, Sum, Q

from .content_models import (
    CourseModule, Lesson, StudentProgress,
    VideoWatchLog, LessonNote, CourseAnnouncement
)
from .content_serializers import (
    CourseModuleSerializer,
    LessonSerializer,
    LessonCreateSerializer,
    StudentProgressSerializer,
    StudentProgressUpdateSerializer,
    VideoWatchLogSerializer,
    LessonNoteSerializer,
    LessonNoteCreateSerializer,
    CourseAnnouncementSerializer,
    CourseAnnouncementCreateSerializer
)
from .content_access import (
    build_content_access_state,
    get_continue_learning_lesson,
    get_lesson_lock_state,
)
from .models import Course
from users.permissions import HasRoleCapability
from users.roles import has_capability


class CourseModuleViewSet(viewsets.ModelViewSet):
    """Course module management API"""

    queryset = CourseModule.objects.all()
    serializer_class = CourseModuleSerializer
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'modules.view',
        'retrieve': 'modules.view',
        'lessons': 'modules.view',
        'roadmap': 'modules.view',
        'progress': 'modules.view',
        'create': 'modules.create',
        'update': 'modules.edit',
        'partial_update': 'modules.edit',
        'reorder': 'modules.edit',
        'destroy': 'modules.delete',
    }

    def get_queryset(self):
        """Filter modules"""
        queryset = CourseModule.objects.select_related('course').prefetch_related(
            'prerequisite_modules', 'lessons'
        )

        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        # Students only see published modules
        if not has_capability(self.request.user, 'modules.edit'):
            queryset = queryset.filter(Q(is_published=True) | Q(is_free_preview=True))

        return queryset.order_by('order')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        course_id = self.request.query_params.get('course_id')
        context['include_lessons'] = self.request.query_params.get('include_lessons') in {'1', 'true', 'True'}
        if course_id and self.request.user.is_authenticated:
            course = Course.objects.filter(id=course_id).first()
            if course:
                context['content_access_state'] = build_content_access_state(self.request.user, course=course)
        return context

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder modules"""
        module_orders = request.data.get('module_orders', [])
        # module_orders: [{'id': 1, 'order': 0}, {'id': 2, 'order': 1}]

        for item in module_orders:
            module = CourseModule.objects.get(id=item['id'])
            module.order = item['order']
            module.save(update_fields=['order'])

        return Response({'message': 'Modules reordered successfully'})

    @action(detail=True, methods=['get'])
    def lessons(self, request, pk=None):
        """Get all lessons in this module"""
        module = self.get_object()
        lessons = module.lessons.all()

        # Students only see published lessons
        if not has_capability(request.user, 'modules.edit'):
            lessons = lessons.filter(Q(is_published=True) | Q(is_free_preview=True))

        lessons = lessons.order_by('order')
        serializer = LessonSerializer(
            lessons,
            many=True,
            context={
                'request': request,
                'content_access_state': build_content_access_state(request.user, course=module.course),
            }
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def roadmap(self, request):
        """Course roadmap with unlock state and continue-learning target."""
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response({'detail': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        course = get_object_or_404(Course, id=course_id)
        modules = self.get_queryset().filter(course=course).prefetch_related('lessons', 'prerequisite_modules')
        access_state = build_content_access_state(request.user, course=course)
        serializer = self.get_serializer(
            modules,
            many=True,
            context={
                **self.get_serializer_context(),
                'request': request,
                'include_lessons': True,
                'content_access_state': access_state,
            }
        )
        continue_lesson = get_continue_learning_lesson(request.user, course=course, state=access_state)
        return Response({
            'course_id': course.id,
            'course_name': course.name,
            'modules': serializer.data,
            'continue_lesson_id': continue_lesson.id if continue_lesson else None,
            'continue_module_id': continue_lesson.module_id if continue_lesson else None,
        })

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get student's progress in this module"""
        module = self.get_object()
        student = request.user

        lessons = module.lessons.filter(is_published=True)
        total_lessons = lessons.count()

        if total_lessons == 0:
            return Response({'completion_percentage': 0, 'completed_lessons': 0, 'total_lessons': 0})

        completed_lessons = StudentProgress.objects.filter(
            student=student,
            lesson__module=module,
            completion_percentage=100
        ).count()

        completion_percentage = round((completed_lessons / total_lessons) * 100, 2)

        return Response({
            'module_id': module.id,
            'module_title': module.title,
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'completion_percentage': completion_percentage
        })


class LessonViewSet(viewsets.ModelViewSet):
    """Lesson management API"""

    queryset = Lesson.objects.all()
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'lessons.view',
        'retrieve': 'lessons.view',
        'start': 'lessons.view',
        'mark_complete': 'lessons.view',
        'next_lesson': 'lessons.view',
        'create': 'lessons.create',
        'update': 'lessons.edit',
        'partial_update': 'lessons.edit',
        'reorder': 'lessons.edit',
        'destroy': 'lessons.delete',
    }

    def get_serializer_class(self):
        """Use different serializers for create/update"""
        if self.action in ['create', 'update', 'partial_update']:
            return LessonCreateSerializer
        return LessonSerializer

    def get_queryset(self):
        """Filter lessons"""
        queryset = Lesson.objects.select_related('module', 'module__course')

        # Filter by module
        module_id = self.request.query_params.get('module_id')
        if module_id:
            queryset = queryset.filter(module_id=module_id)

        course_id = self.request.query_params.get('course_id') or self.request.query_params.get('course')
        if course_id:
            queryset = queryset.filter(module__course_id=course_id)

        # Filter by lesson type
        lesson_type = self.request.query_params.get('lesson_type')
        if lesson_type:
            queryset = queryset.filter(lesson_type=lesson_type)

        # Students only see published lessons (or free preview lessons)
        if not has_capability(self.request.user, 'lessons.edit'):
            queryset = queryset.filter(
                Q(is_published=True) | Q(is_free_preview=True)
            )

        return queryset.order_by('module__order', 'order')

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        course_id = self.request.query_params.get('course_id') or self.request.query_params.get('course')
        if course_id and self.request.user.is_authenticated:
            course = Course.objects.filter(id=course_id).first()
            if course:
                context['content_access_state'] = build_content_access_state(self.request.user, course=course)
        return context

    def _ensure_lesson_access(self, request, lesson):
        if has_capability(request.user, 'lessons.edit'):
            return
        access_state = build_content_access_state(request.user, course=lesson.module.course)
        is_locked, reason = get_lesson_lock_state(request.user, lesson, access_state)
        if is_locked:
            raise PermissionDenied(detail=reason or 'This lesson is locked.')

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        self._ensure_lesson_access(request, lesson)
        serializer = self.get_serializer(lesson)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder lessons within a module"""
        lesson_orders = request.data.get('lesson_orders', [])

        for item in lesson_orders:
            lesson = Lesson.objects.get(id=item['id'])
            lesson.order = item['order']
            lesson.save(update_fields=['order'])

        return Response({'message': 'Lessons reordered successfully'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start a lesson (create progress record)"""
        lesson = self.get_object()
        student = request.user
        self._ensure_lesson_access(request, lesson)

        # Get or create progress
        progress, created = StudentProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={
                'course': lesson.module.course,
                'module': lesson.module,
                'started_at': timezone.now(),
                'is_started': True,
            }
        )
        if created is False and progress.course_id != lesson.module.course_id:
            progress.course = lesson.module.course
            progress.module = lesson.module
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.is_started = True
            progress.save(update_fields=['course', 'module', 'started_at', 'is_started', 'last_accessed'])

        serializer = StudentProgressSerializer(progress)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark lesson as completed"""
        lesson = self.get_object()
        student = request.user
        self._ensure_lesson_access(request, lesson)

        progress, created = StudentProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={
                'course': lesson.module.course,
                'module': lesson.module,
            }
        )

        if progress.course_id != lesson.module.course_id:
            progress.course = lesson.module.course
            progress.module = lesson.module
        progress.completion_percentage = 100
        progress.is_started = True
        progress.is_completed = True
        progress.completed_at = timezone.now()
        progress.save()

        serializer = StudentProgressSerializer(progress)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def next_lesson(self, request, pk=None):
        """Get next lesson in the course"""
        current_lesson = self.get_object()
        access_state = build_content_access_state(request.user, course=current_lesson.module.course)
        ordered_lessons = Lesson.objects.filter(
            module__course=current_lesson.module.course,
        ).filter(Q(is_published=True) | Q(is_free_preview=True)).select_related(
            'module', 'module__course'
        ).order_by('module__order', 'order', 'id')

        next_lesson = None
        current_seen = False
        for lesson in ordered_lessons:
            if lesson.id == current_lesson.id:
                current_seen = True
                continue
            if not current_seen:
                continue
            is_locked, _ = get_lesson_lock_state(request.user, lesson, access_state)
            if not is_locked:
                next_lesson = lesson
                break

        if next_lesson:
            serializer = LessonSerializer(
                next_lesson,
                context={'request': request, 'content_access_state': access_state}
            )
            return Response(serializer.data)

        return Response({'message': 'This is the last lesson'}, status=status.HTTP_404_NOT_FOUND)


class StudentProgressViewSet(viewsets.ModelViewSet):
    """Student progress tracking API"""

    queryset = StudentProgress.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use different serializers for update"""
        if self.action in ['update', 'partial_update']:
            return StudentProgressUpdateSerializer
        return StudentProgressSerializer

    def get_queryset(self):
        """Filter progress records"""
        queryset = StudentProgress.objects.select_related(
            'student', 'lesson', 'lesson__module'
        )

        user = self.request.user

        # Students see only their own progress
        if not has_capability(user, 'lms.edit'):
            queryset = queryset.filter(student=user)
        else:
            # Staff can filter by student
            student_id = self.request.query_params.get('student_id')
            if student_id:
                queryset = queryset.filter(student_id=student_id)

        # Filter by lesson
        lesson_id = self.request.query_params.get('lesson_id')
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)

        # Filter by module
        module_id = self.request.query_params.get('module_id')
        if module_id:
            queryset = queryset.filter(lesson__module_id=module_id)

        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(lesson__module__course_id=course_id)

        # Filter by completion
        is_completed = self.request.query_params.get('is_completed')
        if is_completed is not None:
            queryset = queryset.filter(is_completed=is_completed.lower() == 'true')

        return queryset.order_by('-last_accessed')

    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Get current user's overall progress"""
        student = request.user
        course_id = request.query_params.get('course_id')

        if not course_id:
            return Response(
                {'error': 'course_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get all lessons in course
        total_lessons = Lesson.objects.filter(
            module__course_id=course_id,
            is_published=True
        ).count()

        # Get completed lessons
        completed_lessons = StudentProgress.objects.filter(
            student=student,
            lesson__module__course_id=course_id,
            completion_percentage=100
        ).count()

        # Get in-progress lessons
        in_progress = StudentProgress.objects.filter(
            student=student,
            lesson__module__course_id=course_id,
            completion_percentage__gt=0,
            completion_percentage__lt=100
        ).count()

        # Calculate average completion
        avg_completion = StudentProgress.objects.filter(
            student=student,
            lesson__module__course_id=course_id
        ).aggregate(avg=Avg('completion_percentage'))['avg'] or 0

        # Total time spent
        total_time = StudentProgress.objects.filter(
            student=student,
            lesson__module__course_id=course_id
        ).aggregate(total=Sum('total_watch_time_seconds'))['total'] or 0

        return Response({
            'course_id': int(course_id),
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'in_progress_lessons': in_progress,
            'not_started_lessons': total_lessons - completed_lessons - in_progress,
            'overall_completion_percentage': round(avg_completion, 2),
            'total_time_spent_seconds': total_time,
            'total_time_spent_hours': round(total_time / 3600, 2)
        })

    @action(detail=False, methods=['get'])
    def continue_learning(self, request):
        """Get the next lesson the student should resume."""
        course_id = request.query_params.get('course_id')
        course = get_object_or_404(Course, id=course_id) if course_id else None
        access_state = build_content_access_state(request.user, course=course)
        lesson = get_continue_learning_lesson(request.user, course=course, state=access_state)
        if not lesson:
            return Response({'detail': 'No lesson available to continue.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = LessonSerializer(
            lesson,
            context={'request': request, 'content_access_state': access_state}
        )
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def track_video(self, request):
        """Track video watching progress"""
        lesson_id = request.data.get('lesson_id')
        position_seconds = request.data.get('position_seconds', 0)
        completion_percentage = request.data.get('completion_percentage', 0)
        session_id = request.data.get('session_id')

        if not lesson_id:
            return Response(
                {'error': 'lesson_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        lesson = get_object_or_404(Lesson, id=lesson_id)
        student = request.user

        # Update or create progress
        progress, created = StudentProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={
                'course': lesson.module.course,
                'module': lesson.module,
            }
        )

        if progress.course_id != lesson.module.course_id:
            progress.course = lesson.module.course
            progress.module = lesson.module
        previous_position = progress.last_watched_position_seconds
        progress.last_watched_position_seconds = position_seconds
        progress.completion_percentage = max(progress.completion_percentage, completion_percentage)
        progress.is_started = True
        if not progress.started_at:
            progress.started_at = timezone.now()
        progress.total_watch_time_seconds += max(0, position_seconds - previous_position)

        # Auto-complete if reached 95%
        if completion_percentage >= 95 and not progress.is_completed:
            progress.is_completed = True
            progress.completion_percentage = 100
            progress.completed_at = timezone.now()

        progress.save()

        # Log/update watch session
        if session_id:
            watch_log = VideoWatchLog.objects.filter(
                session_id=session_id,
                student=student,
                lesson=lesson,
            ).order_by('-started_at').first()

            if watch_log is None:
                watch_log = VideoWatchLog.objects.create(
                    student=student,
                    lesson=lesson,
                    session_id=session_id,
                    start_position_seconds=position_seconds,
                    end_position_seconds=position_seconds,
                    watch_duration_seconds=0,
                    completed=completion_percentage >= 95,
                    ended_at=timezone.now() if completion_percentage >= 95 else None,
                )
            else:
                watch_log.end_position_seconds = position_seconds
                watch_log.watch_duration_seconds = max(
                    watch_log.watch_duration_seconds,
                    max(0, position_seconds - watch_log.start_position_seconds),
                )
                watch_log.completed = completion_percentage >= 95
                if watch_log.completed and watch_log.ended_at is None:
                    watch_log.ended_at = timezone.now()
                watch_log.save(
                    update_fields=[
                        'end_position_seconds',
                        'watch_duration_seconds',
                        'completed',
                        'ended_at',
                    ]
                )

        return Response({
            'message': 'Progress updated',
            'progress': StudentProgressSerializer(progress).data
        })


class VideoWatchLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Video watch logs (read-only for analytics)"""

    queryset = VideoWatchLog.objects.all()
    serializer_class = VideoWatchLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """Filter watch logs"""
        queryset = VideoWatchLog.objects.select_related('student', 'lesson')

        # Filter by student
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        # Filter by lesson
        lesson_id = self.request.query_params.get('lesson_id')
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)

        return queryset.order_by('-started_at')

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get video watching analytics"""
        lesson_id = request.query_params.get('lesson_id')

        if not lesson_id:
            return Response(
                {'error': 'lesson_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = VideoWatchLog.objects.filter(lesson_id=lesson_id)

        total_views = logs.count()
        unique_viewers = logs.values('student').distinct().count()
        completed_views = logs.filter(completed=True).count()
        avg_duration = logs.aggregate(avg=Avg('watch_duration_seconds'))['avg'] or 0

        return Response({
            'lesson_id': int(lesson_id),
            'total_views': total_views,
            'unique_viewers': unique_viewers,
            'completed_views': completed_views,
            'completion_rate': round((completed_views / total_views * 100), 2) if total_views > 0 else 0,
            'average_watch_duration_seconds': round(avg_duration, 2)
        })


class LessonNoteViewSet(viewsets.ModelViewSet):
    """Lesson notes management API"""

    queryset = LessonNote.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use different serializers for create/update"""
        if self.action in ['create', 'update', 'partial_update']:
            return LessonNoteCreateSerializer
        return LessonNoteSerializer

    def get_queryset(self):
        """Filter notes - students see only their own"""
        queryset = LessonNote.objects.select_related('student', 'lesson')

        user = self.request.user

        # Students see only their own notes
        if not has_capability(user, 'lms.edit'):
            queryset = queryset.filter(student=user)

        # Filter by lesson
        lesson_id = self.request.query_params.get('lesson_id')
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)

        return queryset.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def my_notes(self, request):
        """Get current user's notes for a lesson"""
        lesson_id = request.query_params.get('lesson_id')

        if not lesson_id:
            return Response(
                {'error': 'lesson_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        notes = LessonNote.objects.filter(
            student=request.user,
            lesson_id=lesson_id
        ).order_by('timestamp_seconds')

        serializer = LessonNoteSerializer(notes, many=True, context={'request': request})
        return Response(serializer.data)


class CourseAnnouncementViewSet(viewsets.ModelViewSet):
    """Course announcements API"""

    queryset = CourseAnnouncement.objects.all()
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'lms.view',
        'retrieve': 'lms.view',
        'create': 'lms.create',
        'update': 'lms.edit',
        'partial_update': 'lms.edit',
        'toggle_pin': 'lms.edit',
        'destroy': 'lms.delete',
    }

    def get_serializer_class(self):
        """Use different serializers for create/update"""
        if self.action in ['create', 'update', 'partial_update']:
            return CourseAnnouncementCreateSerializer
        return CourseAnnouncementSerializer

    def get_queryset(self):
        """Filter announcements"""
        queryset = CourseAnnouncement.objects.select_related('course', 'author')

        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset.order_by('-created_at')

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

    @action(detail=True, methods=['post'])
    def toggle_pin(self, request, pk=None):
        """Pinning is not available in current schema."""
        return Response(
            {'detail': 'Announcement pinning is not enabled in this deployment.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

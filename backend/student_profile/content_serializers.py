"""
Content Delivery System Serializers
"""
from typing import Any
from django.db.models import Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers
from .content_models import (
    CourseModule, Lesson, StudentProgress,
    VideoWatchLog, LessonNote, CourseAnnouncement
)
from .content_access import (
    build_content_access_state,
    get_continue_learning_lesson,
    get_lesson_lock_state,
    get_module_completion_snapshot,
    get_module_lock_state,
    get_next_lesson_in_module,
)
from .models import Course
from users.serializers import UserSerializer


class CourseModuleSerializer(serializers.ModelSerializer):
    """Course module serializer"""
    course_name = serializers.CharField(source='course.name', read_only=True)
    lesson_count = serializers.SerializerMethodField()
    total_duration_minutes = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    unlock_reason = serializers.SerializerMethodField()
    completed_lessons = serializers.SerializerMethodField()
    completion_percentage = serializers.SerializerMethodField()
    next_lesson_id = serializers.SerializerMethodField()
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = CourseModule
        fields = [
            'id', 'course', 'course_name', 'title', 'description',
            'order', 'estimated_duration_minutes', 'is_published', 'is_free_preview',
            'prerequisite_modules', 'lesson_count', 'total_duration_minutes',
            'is_locked', 'unlock_reason', 'completed_lessons', 'completion_percentage',
            'next_lesson_id', 'lessons', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_lesson_count(self, obj) -> Any:
        return obj.lessons.count()

    def get_total_duration_minutes(self, obj) -> Any:
        total_seconds = obj.lessons.aggregate(
            total_video=Coalesce(Sum('video_duration_seconds'), Value(0)),
            total_audio=Coalesce(Sum('audio_duration_seconds'), Value(0))
        )
        total = total_seconds.get('total_video', 0) + total_seconds.get('total_audio', 0)
        return total // 60

    def get_is_locked(self, obj) -> Any:
        """Check if module is locked based on prerequisites"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return True

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.course,
        )
        is_locked, _ = get_module_lock_state(request.user, obj, access_state)
        return is_locked

    def get_unlock_reason(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 'Login required'

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.course,
        )
        is_locked, reason = get_module_lock_state(request.user, obj, access_state)
        return reason if is_locked else ''

    def get_completed_lessons(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.course,
        )
        completed_lessons, _, _ = get_module_completion_snapshot(obj, access_state)
        return completed_lessons

    def get_completion_percentage(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.course,
        )
        _, _, completion_percentage = get_module_completion_snapshot(obj, access_state)
        return completion_percentage

    def get_next_lesson_id(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.course,
        )
        next_lesson = get_next_lesson_in_module(obj, request.user, access_state)
        return next_lesson.id if next_lesson else None

    def get_lessons(self, obj) -> Any:
        if not self.context.get('include_lessons'):
            return []

        request = self.context.get('request')
        lessons = obj.lessons.filter(Q(is_published=True) | Q(is_free_preview=True)).order_by('order', 'id')
        serializer = LessonSerializer(
            lessons,
            many=True,
            context={
                **self.context,
                'request': request,
                'content_access_state': self.context.get('content_access_state'),
            }
        )
        return serializer.data


class LessonSerializer(serializers.ModelSerializer):
    """Lesson serializer"""
    module_title = serializers.CharField(source='module.title', read_only=True)
    course_id = serializers.IntegerField(source='module.course_id', read_only=True)
    course_name = serializers.CharField(source='module.course.name', read_only=True)
    lesson_type_display = serializers.CharField(source='get_lesson_type_display', read_only=True)
    student_progress = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    file_url = serializers.FileField(source='file', read_only=True)
    is_locked = serializers.SerializerMethodField()
    unlock_reason = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'module', 'module_title', 'course_id', 'course_name', 'title', 'description',
            'lesson_type', 'lesson_type_display', 'order',
            'video_url', 'video_duration_seconds', 'audio_url', 'audio_duration_seconds',
            'book_url', 'total_pages', 'content',
            'file', 'file_url', 'is_free_preview', 'is_published',
            'is_downloadable', 'requires_completion', 'minimum_watch_percentage',
            'student_progress', 'is_completed', 'is_locked', 'unlock_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_student_progress(self, obj) -> Any:
        """Get current user's progress on this lesson"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        try:
            progress = StudentProgress.objects.get(
                student=request.user,
                lesson=obj
            )
            return {
                'completion_percentage': progress.completion_percentage,
                'last_watched_position': progress.last_watched_position_seconds,
                'last_watched_position_seconds': progress.last_watched_position_seconds,
                'completed_at': progress.completed_at
            }
        except StudentProgress.DoesNotExist:
            return None

    def get_is_completed(self, obj) -> Any:
        """Check if lesson is completed by current user"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False

        return StudentProgress.objects.filter(
            student=request.user,
            lesson=obj,
            completion_percentage=100
        ).exists()

    def get_is_locked(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return True

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.module.course,
        )
        is_locked, _ = get_lesson_lock_state(request.user, obj, access_state)
        return is_locked

    def get_unlock_reason(self, obj) -> Any:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 'Login required'

        access_state = self.context.get('content_access_state') or build_content_access_state(
            request.user,
            course=obj.module.course,
        )
        is_locked, reason = get_lesson_lock_state(request.user, obj, access_state)
        return reason if is_locked else ''


class LessonCreateSerializer(serializers.ModelSerializer):
    """Create/update lesson"""

    class Meta:
        model = Lesson
        fields = [
            'module', 'title', 'description', 'lesson_type', 'order',
            'video_url', 'video_duration_seconds', 'content', 'file',
            'is_free_preview', 'is_published', 'is_downloadable',
            'requires_completion', 'minimum_watch_percentage'
        ]

    def validate(self, data):
        """Validate lesson data based on type"""
        lesson_type = data.get('lesson_type')

        if lesson_type == 'video' and not data.get('video_url'):
            raise serializers.ValidationError({
                'video_url': 'Video URL is required for video lessons'
            })

        if lesson_type == 'article' and not data.get('content'):
            raise serializers.ValidationError({
                'content': 'Content is required for article lessons'
            })

        if lesson_type == 'file' and not data.get('file'):
            raise serializers.ValidationError({
                'file': 'File is required for file lessons'
            })

        return data


class StudentProgressSerializer(serializers.ModelSerializer):
    """Student progress serializer"""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    lesson_type = serializers.CharField(source='lesson.lesson_type', read_only=True)
    module_title = serializers.CharField(source='lesson.module.title', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)

    class Meta:
        model = StudentProgress
        fields = [
            'id', 'student', 'student_name', 'course', 'module', 'lesson',
            'lesson_title', 'lesson_type', 'module_title', 'is_started',
            'completion_percentage', 'last_watched_position_seconds',
            'total_watch_time_seconds', 'is_completed', 'completed_at',
            'started_at', 'last_accessed', 'created_at'
        ]
        read_only_fields = ['created_at', 'last_accessed', 'is_completed', 'completed_at']


class StudentProgressUpdateSerializer(serializers.ModelSerializer):
    """Update student progress"""

    class Meta:
        model = StudentProgress
        fields = ['completion_percentage', 'last_watched_position_seconds', 'total_watch_time_seconds']

    def update(self, instance, validated_data):
        """Auto-mark as completed if 100%"""
        instance.completion_percentage = validated_data.get(
            'completion_percentage',
            instance.completion_percentage
        )
        instance.last_watched_position_seconds = validated_data.get(
            'last_watched_position_seconds',
            instance.last_watched_position_seconds
        )
        instance.total_watch_time_seconds = validated_data.get(
            'total_watch_time_seconds',
            instance.total_watch_time_seconds
        )

        # Auto-complete
        if instance.completion_percentage >= 100 and not instance.is_completed:
            instance.is_completed = True
            instance.completed_at = timezone.now()

        instance.save()
        return instance


class VideoWatchLogSerializer(serializers.ModelSerializer):
    """Video watch log serializer"""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)

    class Meta:
        model = VideoWatchLog
        fields = [
            'id', 'student', 'student_name', 'lesson', 'lesson_title',
            'session_id', 'started_at', 'ended_at', 'start_position_seconds',
            'end_position_seconds', 'watch_duration_seconds', 'completed'
        ]
        read_only_fields = ['started_at']


class LessonNoteSerializer(serializers.ModelSerializer):
    """Lesson note serializer"""
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)

    class Meta:
        model = LessonNote
        fields = [
            'id', 'student', 'student_name', 'lesson', 'lesson_title',
            'content', 'timestamp_seconds',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class LessonNoteCreateSerializer(serializers.ModelSerializer):
    """Create/update lesson note"""

    class Meta:
        model = LessonNote
        fields = ['lesson', 'content', 'timestamp_seconds']

    def create(self, validated_data):
        validated_data['student'] = self.context['request'].user
        return super().create(validated_data)


class CourseAnnouncementSerializer(serializers.ModelSerializer):
    """Course announcement serializer"""
    course_name = serializers.CharField(source='course.name', read_only=True)
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)

    class Meta:
        model = CourseAnnouncement
        fields = [
            'id', 'course', 'course_name', 'title', 'content',
            'author', 'author_name', 'send_email', 'send_push',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class CourseAnnouncementCreateSerializer(serializers.ModelSerializer):
    """Create/update course announcement"""

    class Meta:
        model = CourseAnnouncement
        fields = ['course', 'title', 'content', 'send_email', 'send_push']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)

"""
Content Delivery System Models
Course modules, lessons, and progress tracking
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class CourseModule(models.Model):
    """Course modules (chapters/sections)"""

    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    # Duration
    estimated_duration_minutes = models.PositiveIntegerField(default=0)

    # Prerequisites
    prerequisite_modules = models.ManyToManyField('self', blank=True, symmetrical=False, related_name='unlocks')

    # Settings
    is_published = models.BooleanField(default=False)
    is_free_preview = models.BooleanField(default=False, help_text="Free for non-enrolled students")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course', 'order']
        unique_together = ['course', 'order']

    def __str__(self):
        return f"{self.course.name} - Module {self.order}: {self.title}"


class Lesson(models.Model):
    """Individual lessons within modules"""

    LESSON_TYPES = [
        ('video', 'Video'),
        ('audio', 'Audio'),  # NEW
        ('article', 'Article/Text'),
        ('book', 'eBook/PDF'),  # NEW
        ('quiz', 'Quiz'),
        ('assignment', 'Assignment'),
        ('interactive', 'Interactive Exercise'),  # NEW
        ('flashcards', 'Flashcards'),  # NEW
        ('live_session', 'Live Session'),
        ('file', 'Downloadable File'),
        ('code_exercise', 'Coding Exercise'),  # NEW
    ]

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    lesson_type = models.CharField(max_length=50, choices=LESSON_TYPES)
    order = models.PositiveIntegerField(default=0)

    # Content
    content = models.TextField(blank=True, help_text="HTML content for articles")

    # Video
    video_url = models.URLField(blank=True, help_text="YouTube/Vimeo URL or video file")
    video_duration_seconds = models.PositiveIntegerField(default=0)

    # Audio (NEW)
    audio_url = models.URLField(blank=True, help_text="Audio file URL")
    audio_file = models.FileField(upload_to='lessons/audio/%Y/%m/', blank=True, null=True)
    audio_duration_seconds = models.PositiveIntegerField(default=0)
    transcript = models.TextField(blank=True, help_text="Audio/Video transcript")

    # Book/PDF (NEW)
    book_file = models.FileField(upload_to='lessons/books/%Y/%m/', blank=True, null=True)
    book_url = models.URLField(blank=True, help_text="External book/PDF URL")
    total_pages = models.PositiveIntegerField(default=0)

    # Interactive exercise data (NEW)
    exercise_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structure: {type: 'fill_blank'|'matching'|'drag_drop', questions: [...], answers: [...]}"
    )

    # Code exercise (NEW)
    code_template = models.TextField(blank=True, help_text="Starting code template")
    code_solution = models.TextField(blank=True, help_text="Solution code")
    programming_language = models.CharField(max_length=50, blank=True, help_text="python, javascript, etc.")
    test_cases = models.JSONField(default=list, blank=True, help_text="Test cases for auto-grading")

    # Files
    file = models.FileField(upload_to='lessons/%Y/%m/', blank=True, null=True)

    # Settings
    is_published = models.BooleanField(default=False)
    is_free_preview = models.BooleanField(default=False)
    is_downloadable = models.BooleanField(default=False)

    # Completion requirements
    requires_completion = models.BooleanField(default=True)
    minimum_watch_percentage = models.PositiveIntegerField(default=80, help_text="Percentage of video/audio to watch")
    minimum_read_time_seconds = models.PositiveIntegerField(default=0, help_text="Minimum time to spend on article/book")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['module', 'order']
        unique_together = ['module', 'order']

    def __str__(self):
        return f"{self.module.title} - Lesson {self.order}: {self.title}"


class StudentProgress(models.Model):
    """Track student progress through courses"""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='course_progress')
    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE)
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, null=True, blank=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, null=True, blank=True)

    # Progress tracking
    is_started = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    completion_percentage = models.PositiveIntegerField(default=0)

    # Video-specific tracking
    last_watched_position_seconds = models.PositiveIntegerField(default=0)
    total_watch_time_seconds = models.PositiveIntegerField(default=0)

    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_accessed = models.DateTimeField(auto_now=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_accessed']
        unique_together = ['student', 'lesson']
        indexes = [
            models.Index(fields=['student', 'course', 'is_completed']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.lesson.title if self.lesson else self.course.name} ({self.completion_percentage}%)"

    def mark_complete(self):
        """Mark lesson as completed"""
        self.is_completed = True
        self.completion_percentage = 100
        self.completed_at = timezone.now()
        self.save()


class VideoWatchLog(models.Model):
    """Detailed video watch analytics"""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)

    # Session tracking
    session_id = models.UUIDField()
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    # Watch details
    start_position_seconds = models.PositiveIntegerField(default=0)
    end_position_seconds = models.PositiveIntegerField(default=0)
    watch_duration_seconds = models.PositiveIntegerField(default=0)

    # Completion
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['student', 'lesson', 'started_at']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.lesson.title} - {self.watch_duration_seconds}s"


class LessonNote(models.Model):
    """Student notes on lessons"""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lesson_notes')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='notes')

    # Note content
    content = models.TextField()
    timestamp_seconds = models.PositiveIntegerField(null=True, blank=True, help_text="Video timestamp if applicable")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['lesson', 'timestamp_seconds', '-created_at']

    def __str__(self):
        return f"{self.student.username} - Note on {self.lesson.title}"


class CourseAnnouncement(models.Model):
    """Course announcements from instructors"""

    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE, related_name='announcements')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    title = models.CharField(max_length=255)
    content = models.TextField()

    # Send notification
    send_email = models.BooleanField(default=False)
    send_push = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.course.name} - {self.title}"

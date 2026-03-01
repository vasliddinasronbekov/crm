"""
Quiz and Assignment System Models
Assessments, submissions, and grading
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class Assignment(models.Model):
    """Course assignments"""

    ASSIGNMENT_TYPES = [
        ('essay', 'Essay/Written'),
        ('file_upload', 'File Upload'),
        ('code', 'Code Submission'),
        ('presentation', 'Presentation'),
        ('project', 'Project'),
    ]

    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE, related_name='assignments')
    module = models.ForeignKey('student_profile.CourseModule', on_delete=models.CASCADE, null=True, blank=True, related_name='assignments')

    title = models.CharField(max_length=255)
    description = models.TextField()
    instructions = models.TextField(blank=True)
    assignment_type = models.CharField(max_length=50, choices=ASSIGNMENT_TYPES, default='file_upload')

    # Attached files
    attachment = models.FileField(upload_to='assignments/%Y/%m/', blank=True, null=True)

    # Grading
    max_points = models.PositiveIntegerField(default=100)
    passing_points = models.PositiveIntegerField(default=60)

    # Deadlines
    available_from = models.DateTimeField(default=timezone.now)
    due_date = models.DateTimeField()
    late_submission_allowed = models.BooleanField(default=True)
    late_penalty_percentage = models.PositiveIntegerField(default=10, validators=[MaxValueValidator(100)])

    # Settings
    is_published = models.BooleanField(default=False)
    allow_resubmission = models.BooleanField(default=False)
    max_attempts = models.PositiveIntegerField(default=1)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-due_date']

    def __str__(self):
        return f"{self.course.name} - {self.title}"

    def is_overdue(self):
        return timezone.now() > self.due_date


class AssignmentSubmission(models.Model):
    """Student assignment submissions"""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('returned', 'Returned'),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignment_submissions')

    # Submission content
    text_content = models.TextField(blank=True)
    file = models.FileField(upload_to='submissions/%Y/%m/', blank=True, null=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    attempt_number = models.PositiveIntegerField(default=1)

    # Grading
    points_earned = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='graded_assignments')

    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    is_late = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ['assignment', 'student', 'attempt_number']

    def __str__(self):
        return f"{self.student.username} - {self.assignment.title} (Attempt {self.attempt_number})"

    def submit(self):
        """Submit the assignment"""
        self.status = 'submitted'
        self.submitted_at = timezone.now()
        self.is_late = timezone.now() > self.assignment.due_date
        self.save()

    @property
    def percentage_score(self):
        if self.points_earned and self.assignment.max_points:
            return (float(self.points_earned) / float(self.assignment.max_points)) * 100
        return None


class Quiz(models.Model):
    """Quizzes and tests"""

    QUIZ_TYPES = [
        ('practice', 'Practice Quiz'),
        ('graded', 'Graded Quiz'),
        ('exam', 'Exam'),
        ('survey', 'Survey'),
    ]

    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE, related_name='quizzes')
    module = models.ForeignKey('student_profile.CourseModule', on_delete=models.CASCADE, null=True, blank=True, related_name='quizzes')
    lesson = models.ForeignKey('student_profile.Lesson', on_delete=models.CASCADE, null=True, blank=True, related_name='quizzes')

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    quiz_type = models.CharField(max_length=50, choices=QUIZ_TYPES, default='practice')

    # Settings
    time_limit_minutes = models.PositiveIntegerField(default=0, help_text="0 = no time limit")
    passing_score = models.PositiveIntegerField(default=70, validators=[MaxValueValidator(100)])
    show_correct_answers = models.BooleanField(default=True)
    shuffle_questions = models.BooleanField(default=False)
    shuffle_answers = models.BooleanField(default=False)

    # Attempts
    max_attempts = models.PositiveIntegerField(default=1, help_text="0 = unlimited")
    allow_review = models.BooleanField(default=True, help_text="Allow reviewing after submission")

    # Availability
    available_from = models.DateTimeField(default=timezone.now)
    available_until = models.DateTimeField(null=True, blank=True)

    # Publishing
    is_published = models.BooleanField(default=False)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Quizzes'

    def __str__(self):
        return f"{self.course.name} - {self.title}"

    @property
    def total_points(self):
        return sum(q.points for q in self.questions.all())


class Question(models.Model):
    """Quiz questions"""

    QUESTION_TYPES = [
        ('multiple_choice', 'Multiple Choice'),
        ('true_false', 'True/False'),
        ('short_answer', 'Short Answer'),
        ('essay', 'Essay'),
        ('fill_blank', 'Fill in the Blank'),
    ]

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')

    question_type = models.CharField(max_length=50, choices=QUESTION_TYPES)
    question_text = models.TextField()
    explanation = models.TextField(blank=True, help_text="Shown after answering")

    # Points
    points = models.PositiveIntegerField(default=1)

    # Order
    order = models.PositiveIntegerField(default=0)

    # Settings
    is_required = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['quiz', 'order']

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}"


class QuestionOption(models.Model):
    """Answer options for multiple choice questions"""

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')

    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['question', 'order']

    def __str__(self):
        return f"{self.option_text[:50]} {'✓' if self.is_correct else ''}"


class QuizAttempt(models.Model):
    """Student quiz attempts"""

    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
    ]

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quiz_attempts')

    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')

    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.PositiveIntegerField(default=0)

    # Scoring
    total_points = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    points_earned = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    percentage_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MaxValueValidator(100)])

    # Pass/Fail
    passed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']
        unique_together = ['quiz', 'student', 'attempt_number']

    def __str__(self):
        return f"{self.student.username} - {self.quiz.title} - Attempt {self.attempt_number}"

    def calculate_score(self):
        """Calculate the final score"""
        answers = self.answers.all()
        self.total_points = self.quiz.total_points
        self.points_earned = sum(a.points_earned for a in answers)

        if self.total_points > 0:
            self.percentage_score = (float(self.points_earned) / float(self.total_points)) * 100
            self.passed = self.percentage_score >= self.quiz.passing_score
        else:
            self.percentage_score = 0
            self.passed = False

        self.status = 'graded'
        self.save()


class QuizAnswer(models.Model):
    """Student answers to quiz questions"""

    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(QuestionOption, on_delete=models.CASCADE, null=True, blank=True)

    # For text-based answers
    text_answer = models.TextField(blank=True)

    # Scoring
    is_correct = models.BooleanField(default=False)
    points_earned = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Manual grading (for essays)
    feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='graded_answers')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['attempt', 'question']

    def __str__(self):
        return f"{self.attempt.student.username} - Q{self.question.order}"

    def check_answer(self):
        """Auto-grade the answer"""
        if self.question.question_type in ['multiple_choice', 'true_false']:
            if self.selected_option and self.selected_option.is_correct:
                self.is_correct = True
                self.points_earned = self.question.points
            else:
                self.is_correct = False
                self.points_earned = 0
        # Essay and short answer require manual grading
        self.save()

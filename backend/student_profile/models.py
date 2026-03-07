# /mnt/usb/edu-api-project/student_profile/models.py

from django.db import models
from django.utils import timezone
from users.models import User

# --- Enums (API spetsifikatsiyasiga ko'ra) ---
class GenderEnum(models.IntegerChoices):
    MALE = 1, 'Male'
    FEMALE = 2, 'Female'

class TicketStatusEnum(models.IntegerChoices):
    ACTIVE = 1, 'active'
    SOLVED = 2, 'solved'
    TO_ADMIN = 3, 'to_admin'

# --- Asosiy Modellar ---

class Branch(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.CharField(max_length=100, blank=True, null=True)
    longitude = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name

class Course(models.Model):
    # Basic info
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.BigIntegerField(help_text="Kurs narxi tiyinlarda")
    duration_months = models.PositiveIntegerField(default=1)

    # LMS Enhancements
    # Category and classification
    category = models.ForeignKey(
        'CourseCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses'
    )
    subcategory = models.ForeignKey(
        'CourseCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='course_subcategories'
    )

    # Language courses
    language = models.CharField(max_length=50, blank=True, help_text="e.g., English, Uzbek, Russian")
    cefr_level = models.ForeignKey(
        'CEFRLevel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses'
    )

    # Difficulty
    DIFFICULTY_LEVELS = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
        ('expert', 'Expert'),
    ]
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_LEVELS,
        default='beginner',
        blank=True
    )

    # Tags and skills
    skills = models.ManyToManyField('SkillTag', blank=True, related_name='courses')

    # Content statistics
    total_duration_minutes = models.PositiveIntegerField(default=0)
    total_lessons = models.PositiveIntegerField(default=0)
    total_quizzes = models.PositiveIntegerField(default=0)

    # Prerequisites
    prerequisites = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        related_name='unlocks'
    )

    # Instructor
    instructor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='taught_courses'
    )

    # Publishing
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    # Enrollment
    is_active = models.BooleanField(default=True)
    max_students = models.PositiveIntegerField(default=0, help_text="0 means unlimited")

    # Metadata
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True)
    video_preview_url = models.URLField(blank=True, help_text="Course preview video")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Room(models.Model):
    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField(default=0)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='rooms')

    def __str__(self):
        return f"{self.name} ({self.branch.name})"

class Group(models.Model):
    name = models.CharField(max_length=255)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey('Course', on_delete=models.PROTECT, related_name='groups', null=False)
    room = models.ForeignKey('Room', on_delete=models.SET_NULL, null=True, blank=True, related_name='groups')
    main_teacher = models.ForeignKey(User, related_name='main_teacher_groups', on_delete=models.SET_NULL, null=True, limit_choices_to={'is_teacher': True})
    assistant_teacher = models.ForeignKey(User, related_name='assistant_teacher_groups', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'is_teacher': True})
    start_day = models.DateField()
    end_day = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    days = models.CharField(max_length=100)
    students = models.ManyToManyField(User, related_name='student_groups', blank=True)

    def __str__(self):
        return self.name

class Attendance(models.Model):
    STATUS_PRESENT = 'present'
    STATUS_ABSENT_UNEXCUSED = 'absent_unexcused'
    STATUS_ABSENCE_EXCUSED = 'absence_excused'
    STATUS_CHOICES = [
        (STATUS_PRESENT, 'Present'),
        (STATUS_ABSENT_UNEXCUSED, 'Absent (Unexcused)'),
        (STATUS_ABSENCE_EXCUSED, 'Absence (Excused)'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    attendance_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PRESENT,
        help_text="Detailed attendance state used by automation."
    )
    is_present = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['student', 'group', '-date'], name='att_stu_grp_date_idx'),
            models.Index(fields=['attendance_status', '-date'], name='att_status_date_idx'),
        ]

    def save(self, *args, **kwargs):
        # Backward compatibility for old clients still sending only is_present.
        if not self.attendance_status:
            self.attendance_status = (
                self.STATUS_PRESENT if self.is_present else self.STATUS_ABSENT_UNEXCUSED
            )
        self.is_present = self.attendance_status == self.STATUS_PRESENT
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.username} - {self.date} - {self.attendance_status}"

class Event(models.Model):
    EVENT_TYPES = [
        ('assignment', 'Assignment'),
        ('exam', 'Exam'),
        ('quiz', 'Quiz'),
        ('meeting', 'Meeting'),
        ('holiday', 'Holiday'),
        ('class', 'Class Session'),
        ('announcement', 'Announcement'),
        ('other', 'Other'),
    ]

    # Basic info
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, help_text="Detailed event description")
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='other')

    # Time and location
    start_time = models.DateTimeField(db_column='time')  # Renamed from 'time' for clarity
    end_time = models.DateTimeField(null=True, blank=True)
    is_all_day = models.BooleanField(default=False)
    location = models.CharField(max_length=255, blank=True)

    # Relations
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    students = models.ManyToManyField(User, related_name='events', blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_events')

    # Media
    photo = models.ImageField(upload_to='events/', blank=True, null=True)

    # Display
    color = models.CharField(max_length=7, default='#3b82f6', help_text="Hex color for calendar display")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['start_time', 'event_type']),
            models.Index(fields=['group', 'start_time']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_event_type_display()}) - {self.start_time.strftime('%Y-%m-%d')}"

    @property
    def time(self):
        """Backward compatibility property"""
        return self.start_time

class ExamScore(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_scores')
    score = models.BigIntegerField()
    date = models.DateField()
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True)
    examiner = models.ForeignKey(User, related_name='examined_scores', on_delete=models.SET_NULL, null=True, limit_choices_to={'is_teacher': True})
    main_teacher = models.ForeignKey(User, related_name='teacher_scores', on_delete=models.SET_NULL, null=True, limit_choices_to={'is_teacher': True})

    def __str__(self):
        return f"{self.student.username} - {self.score}"

class ShopProduct(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.BigIntegerField()
    quantity = models.BigIntegerField()
    photo = models.ImageField(upload_to='products/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

class ShopOrder(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    product = models.ForeignKey(ShopProduct, on_delete=models.PROTECT)
    price = models.BigIntegerField()
    quantity = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PaymentType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Payment(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', "Kutilmoqda"
        PAID = 'paid', "To'langan"
        FAILED = 'failed', "Xatolik"

    date = models.DateField(default=timezone.now)
    by_user = models.ForeignKey(User, related_name='made_payments', on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(User, related_name='received_payments', on_delete=models.SET_NULL, null=True, limit_choices_to={'is_teacher': True})
    amount = models.BigIntegerField(help_text="Summa tiyinlarda")
    payment_type = models.ForeignKey(PaymentType, on_delete=models.SET_NULL, null=True, blank=True)
    detail = models.TextField(blank=True, null=True)
    course_price = models.BigIntegerField(help_text="Kurs narxi tiyinlarda")
    transaction_id = models.CharField(max_length=255, null=True, blank=True, unique=True, help_text="Payme'dan keladigan unikal ID")
    
    def __str__(self):
        user_info = self.by_user.username if self.by_user else "Noma'lum"
        return f"Payment of {self.amount / 100} UZS by {user_info}"


class CashPaymentReceipt(models.Model):
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name='cash_receipt')
    receipt_number = models.CharField(max_length=64, unique=True, db_index=True)
    receipt_token = models.CharField(max_length=64, unique=True, db_index=True)
    issued_at = models.DateTimeField(auto_now_add=True)

    education_center_name = models.CharField(max_length=255)
    branch_name = models.CharField(max_length=255, blank=True)
    cashier_full_name = models.CharField(max_length=255, blank=True)
    student_full_name = models.CharField(max_length=255)
    group_name = models.CharField(max_length=255, blank=True)
    course_service_name = models.CharField(max_length=255, blank=True)

    payment_method = models.CharField(max_length=32, default='cash')
    paid_amount = models.BigIntegerField(help_text="To'langan summa tiyinlarda")
    remaining_balance = models.BigIntegerField(help_text="Qolgan balans tiyinlarda", default=0)
    note = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"{self.receipt_number} - payment#{self.payment_id}"

class Story(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    caption = models.CharField(max_length=255, blank=True, null=True)
    media = models.FileField(upload_to='stories/')
    created_at = models.DateTimeField(auto_now_add=True)

class StudentCoins(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coins')
    coin = models.BigIntegerField()
    reason = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Ticket(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tickets')
    reason = models.CharField(max_length=255)
    text = models.TextField()
    status = models.IntegerField(choices=TicketStatusEnum.choices, default=TicketStatusEnum.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

class TicketChat(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='chats')
    from_user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    file = models.FileField(upload_to='ticket_files/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class LeaveReason(models.Model):
    reason_text = models.CharField(max_length=255, unique=True, help_text="Ketish sababi matni")

    class Meta:
        verbose_name = "Leave Reason"
        verbose_name_plural = "Leave Reasons"

    def __str__(self):
        return self.reason_text

class Information(models.Model):
    title = models.CharField(max_length=255)
    text = models.TextField()
    for_teachers = models.BooleanField(default=False, help_text="Bu e'lon o'qituvchilar uchunmi?")
    for_students = models.BooleanField(default=False, help_text="Bu e'lon talabalar uchunmi?")
    created_at = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='authored_info')

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Information"
        verbose_name_plural = "Information"

    def __str__(self):
        return self.title

class AutomaticFine(models.Model):
    name = models.CharField(max_length=255)
    amount = models.BigIntegerField(help_text="Jarima summasi tiyinlarda")

    def __str__(self):
        return self.name

class ExpenseType(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

class Expense(models.Model):
    type = models.ForeignKey(ExpenseType, on_delete=models.PROTECT, related_name='expenses')
    amount = models.BigIntegerField(help_text="Xarajat summasi tiyinlarda")
    comment = models.TextField(blank=True, null=True)
    date = models.DateField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.type.name} - {self.amount / 100}"

class AssistantSlot(models.Model):
    assistant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='slots', limit_choices_to={'is_teacher': True})
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_booked = models.BooleanField(default=False)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"{self.assistant.username} | {self.start_time.strftime('%Y-%m-%d %H:%M')} | {'Band' if self.is_booked else 'Bo`sh'}"

class Booking(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    slot = models.OneToOneField(AssistantSlot, on_delete=models.CASCADE, related_name='booking')
    booked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Student: {self.student.username} -> Slot: {self.slot.id}"

# Import content delivery models
from .content_models import CourseModule, Lesson, StudentProgress, VideoWatchLog, LessonNote, CourseAnnouncement

# Import quiz and assignment models
from .quiz_models import Assignment, AssignmentSubmission, Quiz, Question, QuestionOption, QuizAttempt, QuizAnswer

# Import accounting models
from .accounting_models import (
    StudentAccount,
    MonthlySubscriptionCharge,
    AccountingActivityLog,
    StudentBalance,
    TeacherEarnings,
    StudentFine,
    AccountTransaction,
    FinancialSummary,
)

# Import IELTS models
from .ielts_models import IELTSExam, IELTSQuestion, IELTSAttempt, IELTSAnswer, IELTSSection

# Import exam draft and notification models
from .exam_draft_models import IELTSExamDraft, IELTSQuestionDraft, AIExamGenerationRequest, ExamDraftStatus
from .notification_models import Notification, InboxSettings, NotificationType

# Import SAT 2025 models
from .sat_models import SATExam, SATModule, SATQuestion, SATAttempt, SATAnswer, SATSection

# Import LMS enhancement models
from .lms_models import (
    CourseCategory, CEFRLevel, SkillTag,
    VocabularyWord, StudentVocabularyProgress,
    Flashcard, FlashcardProgress
)

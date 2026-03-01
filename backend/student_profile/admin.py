# /mnt/usb/edu-api-project/student_profile/admin.py

from django.contrib import admin
from .models import (
    Branch, Group, Attendance, Event, ExamScore, ShopProduct,
    ShopOrder, Payment, Story, StudentCoins, Ticket, TicketChat,
    Course, Room, ExpenseType, Expense, LeaveReason, Information,
    PaymentType, AutomaticFine, AssistantSlot, Booking,
    StudentAccount, MonthlySubscriptionCharge, AccountingActivityLog,
    StudentBalance, TeacherEarnings, StudentFine, AccountTransaction, FinancialSummary,
    IELTSExam, IELTSQuestion, IELTSAttempt, IELTSAnswer,
    IELTSExamDraft, IELTSQuestionDraft, AIExamGenerationRequest,
    Notification, InboxSettings,
    SATExam, SATModule, SATQuestion, SATAttempt, SATAnswer
)

# Har bir modelni FAQAT BIR MARTA ro'yxatdan o'tkazamiz
admin.site.register(Branch)
admin.site.register(Course)
admin.site.register(Room)
admin.site.register(Group)
admin.site.register(Attendance)
admin.site.register(Event)
admin.site.register(ExamScore)
admin.site.register(ShopProduct)
admin.site.register(ShopOrder)
admin.site.register(PaymentType)
admin.site.register(Payment)
admin.site.register(Story)
admin.site.register(StudentCoins)
admin.site.register(Ticket)
admin.site.register(TicketChat)
admin.site.register(LeaveReason)
admin.site.register(Information)
admin.site.register(AutomaticFine)
admin.site.register(ExpenseType)
admin.site.register(Expense)
admin.site.register(AssistantSlot)
admin.site.register(Booking)
admin.site.register(StudentAccount)
admin.site.register(MonthlySubscriptionCharge)
admin.site.register(AccountingActivityLog)
admin.site.register(StudentBalance)
admin.site.register(TeacherEarnings)
admin.site.register(StudentFine)
admin.site.register(AccountTransaction)
admin.site.register(FinancialSummary)

# IELTS models
admin.site.register(IELTSExam)
admin.site.register(IELTSQuestion)
admin.site.register(IELTSAttempt)
admin.site.register(IELTSAnswer)

# IELTS Exam Draft and Approval System
@admin.register(IELTSExamDraft)
class IELTSExamDraftAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'section', 'status', 'created_by', 'ai_quality_score', 'created_at']
    list_filter = ['status', 'section', 'is_ai_generated']
    search_fields = ['title', 'description', 'created_by__username']
    readonly_fields = ['ai_suggestions', 'ai_quality_score', 'ai_reviewed_at', 'published_exam', 'published_at']
    ordering = ['-created_at']

@admin.register(IELTSQuestionDraft)
class IELTSQuestionDraftAdmin(admin.ModelAdmin):
    list_display = ['id', 'exam_draft', 'question_type', 'order', 'points']
    list_filter = ['question_type']
    search_fields = ['exam_draft__title', 'question_text']
    ordering = ['exam_draft', 'order']

@admin.register(AIExamGenerationRequest)
class AIExamGenerationRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'section', 'difficulty_level', 'requested_by', 'status', 'created_at']
    list_filter = ['status', 'section', 'difficulty_level']
    search_fields = ['requested_by__username', 'topic']
    readonly_fields = ['generated_draft', 'error_message', 'completed_at']
    ordering = ['-created_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'recipient', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['recipient__username', 'title', 'message']
    readonly_fields = ['read_at']
    ordering = ['-created_at']

@admin.register(InboxSettings)
class InboxSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'email_on_approval_request', 'email_on_exam_approved', 'push_enabled']
    search_fields = ['user__username']

# SAT 2025 models
@admin.register(SATExam)
class SATExamAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'test_number', 'coin_cost', 'passing_score', 'is_official', 'is_published', 'created_at']
    list_filter = ['is_official', 'is_published']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

@admin.register(SATModule)
class SATModuleAdmin(admin.ModelAdmin):
    list_display = ['id', 'exam', 'section', 'module_number', 'difficulty', 'time_minutes', 'order']
    list_filter = ['section', 'difficulty']
    search_fields = ['exam__title']
    ordering = ['exam', 'section', 'module_number']

@admin.register(SATQuestion)
class SATQuestionAdmin(admin.ModelAdmin):
    list_display = ['id', 'module', 'question_number', 'rw_type', 'math_type', 'difficulty_level', 'answer_type', 'points']
    list_filter = ['rw_type', 'math_type', 'difficulty_level', 'answer_type']
    search_fields = ['question_text', 'passage_text']
    ordering = ['module', 'question_number']

@admin.register(SATAttempt)
class SATAttemptAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'exam', 'status', 'total_score', 'reading_writing_score', 'math_score', 'coins_paid', 'coins_refunded', 'created_at']
    list_filter = ['status']
    search_fields = ['student__username', 'exam__title']
    readonly_fields = ['created_at', 'updated_at', 'started_at', 'completed_at', 'ai_feedback']
    ordering = ['-created_at']

@admin.register(SATAnswer)
class SATAnswerAdmin(admin.ModelAdmin):
    list_display = ['id', 'attempt', 'question', 'is_correct', 'points_earned', 'time_spent_seconds', 'answered_at']
    list_filter = ['is_correct']
    search_fields = ['attempt__student__username', 'question__question_text']
    readonly_fields = ['answered_at']
    ordering = ['attempt', 'question__question_number']

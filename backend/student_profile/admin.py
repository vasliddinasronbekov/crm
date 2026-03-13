# /mnt/usb/edu-api-project/student_profile/admin.py

from django.contrib import admin
from django.contrib import messages
from .models import (
    Branch, Group, Attendance, Event, ExamScore, ShopProduct,
    ShopOrder, Payment, PaymentAuditLog, Story, StudentCoins, Ticket, TicketChat,
    Course, Room, ExpenseType, Expense, LeaveReason, Information,
    PaymentType, AutomaticFine, AssistantSlot, Booking,
    StudentAccount, MonthlySubscriptionCharge, AccountingActivityLog,
    StudentBalance, TeacherEarnings, StudentFine, AccountTransaction, FinancialSummary,
    IELTSExam, IELTSQuestion, IELTSAttempt, IELTSAnswer,
    IELTSExamDraft, IELTSQuestionDraft, AIExamGenerationRequest,
    Notification, InboxSettings,
    SATExam, SATModule, SATQuestion, SATAttempt, SATAnswer
)
from .services.financial_automation import set_student_account_status
from .payment_audit import build_payment_snapshot, create_payment_audit_log

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
admin.site.register(MonthlySubscriptionCharge)
admin.site.register(AccountingActivityLog)
admin.site.register(StudentBalance)
admin.site.register(TeacherEarnings)
admin.site.register(StudentFine)
admin.site.register(AccountTransaction)
admin.site.register(FinancialSummary)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'date', 'by_user', 'group', 'status', 'amount', 'course_price', 'payment_type']
    list_filter = ['status', 'payment_type', 'date']
    search_fields = ['by_user__username', 'by_user__first_name', 'by_user__last_name', 'transaction_id']

    def save_model(self, request, obj, form, change):
        previous_snapshot = {}
        event_type = PaymentAuditLog.EVENT_CREATED
        if change and obj.pk:
            previous = Payment.objects.filter(pk=obj.pk).first()
            previous_snapshot = build_payment_snapshot(previous)
            event_type = PaymentAuditLog.EVENT_UPDATED

        super().save_model(request, obj, form, change)

        create_payment_audit_log(
            payment=obj,
            event_type=event_type,
            actor=request.user,
            previous_snapshot=previous_snapshot,
            new_snapshot=build_payment_snapshot(obj),
            metadata={'source': 'django_admin'},
        )

    def delete_model(self, request, obj):
        previous_snapshot = build_payment_snapshot(obj)
        create_payment_audit_log(
            payment=obj,
            event_type=PaymentAuditLog.EVENT_DELETED,
            actor=request.user,
            previous_snapshot=previous_snapshot,
            new_snapshot={},
            metadata={'source': 'django_admin'},
        )
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for payment in queryset:
            previous_snapshot = build_payment_snapshot(payment)
            create_payment_audit_log(
                payment=payment,
                event_type=PaymentAuditLog.EVENT_DELETED,
                actor=request.user,
                previous_snapshot=previous_snapshot,
                new_snapshot={},
                metadata={'source': 'django_admin_bulk_delete'},
            )
        super().delete_queryset(request, queryset)


@admin.register(PaymentAuditLog)
class PaymentAuditLogAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'payment_id_snapshot',
        'event_type',
        'changed_by_display',
        'status_before',
        'status_after',
        'amount_before',
        'amount_after',
        'created_at',
    ]
    list_filter = ['event_type', 'source', 'created_at']
    search_fields = [
        'payment_id_snapshot',
        'transaction_id_snapshot',
        'changed_by_display',
        'status_before',
        'status_after',
    ]
    readonly_fields = [
        'payment',
        'payment_id_snapshot',
        'transaction_id_snapshot',
        'event_type',
        'changed_by_user',
        'changed_by_display',
        'amount_before',
        'amount_after',
        'course_price_before',
        'course_price_after',
        'status_before',
        'status_after',
        'changed_fields',
        'previous_snapshot',
        'new_snapshot',
        'metadata',
        'source',
        'request_method',
        'request_path',
        'ip_address',
        'user_agent',
        'created_at',
    ]
    ordering = ['-created_at', '-id']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StudentAccount)
class StudentAccountAdmin(admin.ModelAdmin):
    list_display = [
        'student',
        'status',
        'student_is_active',
        'balance_tiyin',
        'status_changed_at',
        'updated_at',
    ]
    list_filter = ['status', 'student__is_active', 'updated_at']
    search_fields = ['student__username', 'student__first_name', 'student__last_name']
    readonly_fields = ['created_at', 'updated_at', 'status_changed_at']
    actions = ['activate_accounts', 'freeze_accounts', 'deactivate_accounts']

    @admin.display(boolean=True, description='Student Active')
    def student_is_active(self, obj):
        return bool(obj.student and obj.student.is_active)

    @admin.action(description='Activate selected student accounts')
    def activate_accounts(self, request, queryset):
        self._bulk_update_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_ACTIVE,
            action_name='activated',
        )

    @admin.action(description='Freeze selected student accounts')
    def freeze_accounts(self, request, queryset):
        self._bulk_update_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_FROZEN,
            action_name='frozen',
        )

    @admin.action(description='Deactivate selected student accounts')
    def deactivate_accounts(self, request, queryset):
        self._bulk_update_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_DEACTIVATED,
            action_name='deactivated',
        )

    def _bulk_update_status(self, request, queryset, *, target_status: str, action_name: str):
        changed = 0
        for account in queryset.select_related('student'):
            before = account.status
            updated = set_student_account_status(
                student=account.student,
                target_status=target_status,
                actor=request.user,
                reason='django_admin_bulk_action',
            )
            if updated.status != before:
                changed += 1

        if changed == 0:
            self.message_user(
                request,
                f'No accounts changed. Selected students are already {target_status}.',
                level=messages.INFO,
            )
            return

        self.message_user(
            request,
            f'{changed} student account(s) {action_name} successfully.',
            level=messages.SUCCESS,
        )

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

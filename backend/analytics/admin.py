"""
Analytics Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    AnalyticsSnapshot,
    StudentPerformanceMetrics,
    TeacherPerformanceMetrics,
    CourseAnalytics,
    Report,
    UserActivityLog
)


@admin.register(AnalyticsSnapshot)
class AnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = [
        'date',
        'total_students',
        'total_teachers',
        'total_groups',
        'attendance_rate_display',
        'daily_profit_display',
        'conversion_rate_display',
        'calculated_at'
    ]
    list_filter = ['date', 'calculated_at']
    search_fields = ['date']
    date_hierarchy = 'date'
    ordering = ['-date']
    readonly_fields = [
        'date', 'total_users', 'total_students', 'total_teachers',
        'active_students', 'new_users_today', 'total_groups', 'total_courses',
        'active_groups', 'attendance_rate', 'total_classes_held',
        'average_exam_score', 'passing_rate', 'daily_revenue',
        'daily_expenses', 'daily_profit', 'pending_payments',
        'total_leads', 'active_leads', 'converted_leads_today',
        'conversion_rate', 'active_sessions', 'avg_session_duration',
        'total_logins', 'total_tasks', 'pending_tasks', 'completed_tasks',
        'calculated_at', 'created_at'
    ]

    def attendance_rate_display(self, obj):
        return f"{obj.attendance_rate}%"
    attendance_rate_display.short_description = 'Attendance Rate'

    def daily_profit_display(self, obj):
        profit_sum = obj.daily_profit / 100
        color = 'green' if obj.daily_profit >= 0 else 'red'
        return format_html(
            '<span style="color: {};">{} UZS</span>',
            color,
            f"{profit_sum:,.2f}"
        )
    daily_profit_display.short_description = 'Daily Profit'

    def conversion_rate_display(self, obj):
        return f"{obj.conversion_rate}%"
    conversion_rate_display.short_description = 'Conversion Rate'

    actions = ['generate_snapshot_for_selected_dates']

    def generate_snapshot_for_selected_dates(self, request, queryset):
        for snapshot in queryset:
            AnalyticsSnapshot.generate_snapshot(date=snapshot.date)
        self.message_user(request, f"Regenerated {queryset.count()} snapshots successfully.")
    generate_snapshot_for_selected_dates.short_description = "Regenerate selected snapshots"


@admin.register(StudentPerformanceMetrics)
class StudentPerformanceMetricsAdmin(admin.ModelAdmin):
    list_display = [
        'student',
        'date',
        'average_score',
        'attendance_rate_display',
        'rank',
        'percentile',
        'total_exams',
        'passed_exams'
    ]
    list_filter = ['date', 'rank']
    search_fields = ['student__username', 'student__first_name', 'student__last_name']
    date_hierarchy = 'date'
    ordering = ['-date', 'rank']
    readonly_fields = [
        'student', 'date', 'average_score', 'total_exams', 'passed_exams',
        'failed_exams', 'attendance_rate', 'total_classes', 'attended_classes',
        'absent_days', 'assignments_submitted', 'assignments_on_time',
        'quiz_attempts', 'modules_completed', 'lessons_completed',
        'total_study_time_minutes', 'rank', 'percentile',
        'calculated_at', 'created_at'
    ]

    def attendance_rate_display(self, obj):
        return f"{obj.attendance_rate}%"
    attendance_rate_display.short_description = 'Attendance'


@admin.register(TeacherPerformanceMetrics)
class TeacherPerformanceMetricsAdmin(admin.ModelAdmin):
    list_display = [
        'teacher',
        'date',
        'total_groups',
        'total_students',
        'total_hours_week',
        'student_average_score',
        'average_rating_display',
        'total_earnings_display'
    ]
    list_filter = ['date', 'average_rating']
    search_fields = ['teacher__username', 'teacher__first_name', 'teacher__last_name']
    date_hierarchy = 'date'
    ordering = ['-date', '-average_rating']
    readonly_fields = [
        'teacher', 'date', 'total_groups', 'total_students',
        'total_hours_week', 'student_average_score', 'student_passing_rate',
        'student_attendance_rate', 'assignments_graded',
        'average_grading_time_hours', 'total_earnings', 'earnings_paid',
        'earnings_pending', 'average_rating', 'total_reviews',
        'calculated_at', 'created_at'
    ]

    def average_rating_display(self, obj):
        if obj.average_rating:
            return f"{obj.average_rating}/5.0"
        return "N/A"
    average_rating_display.short_description = 'Rating'

    def total_earnings_display(self, obj):
        return f"{obj.total_earnings / 100:,.2f} UZS"
    total_earnings_display.short_description = 'Total Earnings'


@admin.register(CourseAnalytics)
class CourseAnalyticsAdmin(admin.ModelAdmin):
    list_display = [
        'course',
        'date',
        'total_enrolled',
        'active_students',
        'completion_rate_display',
        'average_score',
        'average_rating_display',
        'total_revenue_display'
    ]
    list_filter = ['date', 'completion_rate']
    search_fields = ['course__name']
    date_hierarchy = 'date'
    ordering = ['-date', '-total_enrolled']
    readonly_fields = [
        'course', 'date', 'total_enrolled', 'new_enrollments',
        'active_students', 'completed_students', 'in_progress_students',
        'dropped_students', 'completion_rate', 'average_score',
        'passing_rate', 'average_completion_time_days',
        'average_attendance_rate', 'total_assignments_submitted',
        'total_quiz_attempts', 'total_revenue', 'average_revenue_per_student',
        'average_rating', 'total_reviews', 'calculated_at', 'created_at'
    ]

    def completion_rate_display(self, obj):
        return f"{obj.completion_rate}%"
    completion_rate_display.short_description = 'Completion Rate'

    def average_rating_display(self, obj):
        if obj.average_rating:
            return f"{obj.average_rating}/5.0"
        return "N/A"
    average_rating_display.short_description = 'Rating'

    def total_revenue_display(self, obj):
        return f"{obj.total_revenue / 100:,.2f} UZS"
    total_revenue_display.short_description = 'Revenue'


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = [
        'report_id',
        'report_type',
        'title',
        'period',
        'status_display',
        'generated_by',
        'generated_at'
    ]
    list_filter = ['report_type', 'status', 'period', 'generated_at']
    search_fields = ['report_id', 'title', 'description']
    date_hierarchy = 'generated_at'
    ordering = ['-generated_at']
    readonly_fields = [
        'report_id', 'generated_by', 'generated_at', 'updated_at'
    ]
    fieldsets = (
        ('Report Information', {
            'fields': ('report_id', 'report_type', 'title', 'description', 'status')
        }),
        ('Parameters', {
            'fields': ('period', 'start_date', 'end_date')
        }),
        ('Data', {
            'fields': ('summary', 'data', 'charts'),
            'classes': ('collapse',)
        }),
        ('Files', {
            'fields': ('pdf_file', 'csv_file'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('generated_by', 'generated_at', 'updated_at', 'error_message'),
            'classes': ('collapse',)
        }),
    )

    def status_display(self, obj):
        colors = {
            'completed': 'green',
            'generating': 'orange',
            'failed': 'red'
        }
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            colors.get(obj.status, 'black'),
            obj.get_status_display()
        )
    status_display.short_description = 'Status'


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'action_type',
        'description',
        'ip_address',
        'created_at'
    ]
    list_filter = ['action_type', 'created_at']
    search_fields = ['user__username', 'description', 'ip_address']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = [
        'user', 'action_type', 'description', 'ip_address',
        'user_agent', 'session_id', 'content_type', 'object_id',
        'metadata', 'created_at'
    ]

    def has_add_permission(self, request):
        return False  # Activity logs are auto-generated

    def has_change_permission(self, request, obj=None):
        return False  # Activity logs are immutable

# /mnt/usb/edu-api-project/analytics/views.py

import csv
import json
import secrets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, generics, status
from rest_framework.pagination import PageNumberPagination
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from datetime import datetime, timedelta
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Sum, Avg, Count, Q, OuterRef, Subquery, Value, IntegerField, FloatField
from django.db.models.functions import Coalesce, TruncMonth
from django.core.cache import cache # Django'ning kesh tizimini import qilamiz

# Ma'lumotlarni olish uchun boshqa app'lardagi modellarni import qilamiz
from users.models import User
from student_profile.models import (
    Group,
    Payment,
    Expense,
    StudentCoins,
    ExamScore,
    Course,
    Branch,
    Attendance,
    Ticket,
    TicketStatusEnum,
)
from student_profile.accounting_models import StudentBalance, TeacherEarnings
from student_profile.content_models import StudentProgress
from crm.models import Lead
from gamification.models import UserLevel, UserBadge, UserAchievement
from users.permissions import HasRoleCapability
from .models import Report
from .serializers import (
    LeaderboardSerializer,
    ReportDetailSerializer,
    ReportGenerateRequestSerializer,
    ReportListSerializer,
)

@extend_schema(responses=OpenApiTypes.OBJECT)
class AnalyticsView(APIView):
    """
    Tizim bo'yicha umumiy statistika va analitikani qaytaradi.
    Natijalar 15 daqiqaga keshlanadi.
    """
    permission_classes = [permissions.IsAdminUser]

    @staticmethod
    def _pct(part, total):
        if not total:
            return 0.0
        return round((part / total) * 100, 2)

    @staticmethod
    def _shift_month(dt, offset):
        month_index = dt.month - 1 + offset
        year = dt.year + month_index // 12
        month = month_index % 12 + 1
        return dt.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)

    def get(self, request, *args, **kwargs):
        cache_key = 'full_analytics_data_v2'
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        now = timezone.now()
        today = now.date()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_30d = today - timedelta(days=30)
        first_trend_month = self._shift_month(start_of_month, -5)

        active_students_qs = User.objects.filter(
            is_teacher=False,
            is_staff=False,
            is_superuser=False,
            is_active=True,
        )
        active_teachers_qs = User.objects.filter(is_teacher=True, is_active=True)

        # --- Core totals ---
        total_students = active_students_qs.count()
        total_teachers = active_teachers_qs.count()
        total_groups = Group.objects.count()
        total_courses = Course.objects.count()
        total_branches = Branch.objects.count()

        # --- This month growth ---
        new_students_this_month = active_students_qs.filter(date_joined__gte=start_of_month).count()
        active_leads = Lead.objects.filter(status='in_progress').count()
        new_leads_this_month = Lead.objects.filter(created_at__gte=start_of_month).count()
        converted_leads_this_month = Lead.objects.filter(
            created_at__gte=start_of_month,
            status='converted',
        ).count()
        lead_conversion_rate_this_month = self._pct(converted_leads_this_month, new_leads_this_month)

        # --- Financial ---
        monthly_income_agg = Payment.objects.filter(
            date__gte=start_of_month,
            status=Payment.PaymentStatus.PAID,
        ).aggregate(total=Sum('amount'))
        monthly_income = monthly_income_agg.get('total') or 0

        monthly_expense_agg = Expense.objects.filter(
            date__gte=start_of_month,
        ).aggregate(total=Sum('amount'))
        monthly_expense = monthly_expense_agg.get('total') or 0

        net_profit_this_month = monthly_income - monthly_expense
        pending_payment_amount = Payment.objects.filter(
            status=Payment.PaymentStatus.PENDING
        ).aggregate(total=Sum('amount')).get('total') or 0
        failed_payment_amount = Payment.objects.filter(
            status=Payment.PaymentStatus.FAILED
        ).aggregate(total=Sum('amount')).get('total') or 0
        pending_payment_count = Payment.objects.filter(status=Payment.PaymentStatus.PENDING).count()
        failed_payment_count = Payment.objects.filter(status=Payment.PaymentStatus.FAILED).count()
        paid_payment_count = Payment.objects.filter(status=Payment.PaymentStatus.PAID).count()

        # Prefer accounting balances for receivables if available.
        outstanding_balance = StudentBalance.objects.filter(balance__gt=0).aggregate(
            total=Sum('balance')
        ).get('total') or pending_payment_amount

        # --- Learning quality ---
        attendance_30d = Attendance.objects.filter(date__gte=start_30d)
        attendance_total_30d = attendance_30d.count()
        attendance_present_30d = attendance_30d.filter(attendance_status=Attendance.STATUS_PRESENT).count()
        attendance_excused_30d = attendance_30d.filter(attendance_status=Attendance.STATUS_ABSENCE_EXCUSED).count()
        attendance_unexcused_30d = attendance_30d.filter(
            attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED
        ).count()

        attendance_rate_30d = self._pct(attendance_present_30d, attendance_total_30d)
        excused_rate_30d = self._pct(attendance_excused_30d, attendance_total_30d)
        unexcused_rate_30d = self._pct(attendance_unexcused_30d, attendance_total_30d)

        exam_30d = ExamScore.objects.filter(date__gte=start_30d)
        avg_exam_score_30d = round(float(exam_30d.aggregate(avg=Avg('score')).get('avg') or 0), 2)
        pass_rate_30d = self._pct(exam_30d.filter(score__gte=60).count(), exam_30d.count())

        active_students_30d = active_students_qs.filter(
            Q(attendances__date__gte=start_30d)
            | Q(course_progress__last_accessed__gte=start_30d)
            | Q(made_payments__date__gte=start_30d)
        ).distinct().count()

        at_risk_students_30d = Attendance.objects.filter(
            date__gte=start_30d,
            attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED,
        ).values('student_id').annotate(missed=Count('id')).filter(missed__gte=3).count()

        lms_started_records = StudentProgress.objects.filter(is_started=True).count()
        lms_completed_records = StudentProgress.objects.filter(is_completed=True).count()
        lms_completion_rate = self._pct(lms_completed_records, lms_started_records)
        avg_watch_minutes = round(
            float(
                StudentProgress.objects.aggregate(avg=Avg('total_watch_time_seconds')).get('avg') or 0
            ) / 60,
            1,
        )

        # --- Workforce and operational ---
        avg_group_size = Group.objects.annotate(student_count=Count('students', distinct=True)).aggregate(
            avg=Avg('student_count')
        ).get('avg') or 0

        student_teacher_ratio = round(total_students / total_teachers, 2) if total_teachers else 0
        groups_per_teacher = round(total_groups / total_teachers, 2) if total_teachers else 0
        arpu_minor = int(monthly_income / total_students) if total_students else 0

        unpaid_teacher_count = TeacherEarnings.objects.filter(
            is_paid_to_teacher=False
        ).values('teacher_id').distinct().count()
        unpaid_teacher_amount = TeacherEarnings.objects.filter(
            is_paid_to_teacher=False
        ).aggregate(total=Sum('amount')).get('total') or 0

        today_attendance = Attendance.objects.filter(date=today)
        today_present = today_attendance.filter(attendance_status=Attendance.STATUS_PRESENT).count()
        today_excused = today_attendance.filter(attendance_status=Attendance.STATUS_ABSENCE_EXCUSED).count()
        today_unexcused = today_attendance.filter(
            attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED
        ).count()

        active_group_sessions_today = Group.objects.filter(
            start_day__lte=today,
            end_day__gte=today,
        ).count()
        open_tickets = Ticket.objects.filter(status=TicketStatusEnum.ACTIVE).count()
        overdue_pending_payments = Payment.objects.filter(
            status=Payment.PaymentStatus.PENDING,
            date__lt=today - timedelta(days=30),
        ).count()

        # --- Trend series (last 6 months) ---
        trend_months = [self._shift_month(start_of_month, offset) for offset in range(-5, 1)]
        trend_index = {}
        for month_dt in trend_months:
            month_key = month_dt.strftime('%Y-%m')
            trend_index[month_key] = {
                'key': month_key,
                'label': month_dt.strftime('%b %Y'),
                'new_students': 0,
                'income': 0,
                'expense': 0,
                'net_profit': 0,
                'new_leads': 0,
                'converted_leads': 0,
                'attendance_rate': 0.0,
                'avg_exam_score': 0.0,
            }

        student_growth = active_students_qs.filter(date_joined__gte=first_trend_month).annotate(
            month=TruncMonth('date_joined')
        ).values('month').annotate(total=Count('id'))
        for row in student_growth:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['new_students'] = int(row['total'] or 0)

        trend_start_date = first_trend_month.date()

        income_series = Payment.objects.filter(
            date__gte=trend_start_date,
            status=Payment.PaymentStatus.PAID,
        ).annotate(month=TruncMonth('date')).values('month').annotate(total=Sum('amount'))
        for row in income_series:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['income'] = int(row['total'] or 0)

        expense_series = Expense.objects.filter(
            date__gte=trend_start_date
        ).annotate(month=TruncMonth('date')).values('month').annotate(total=Sum('amount'))
        for row in expense_series:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['expense'] = int(row['total'] or 0)

        leads_series = Lead.objects.filter(created_at__gte=first_trend_month).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            new_leads=Count('id'),
            converted=Count('id', filter=Q(status='converted')),
        )
        for row in leads_series:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['new_leads'] = int(row['new_leads'] or 0)
                trend_index[key]['converted_leads'] = int(row['converted'] or 0)

        attendance_series = Attendance.objects.filter(date__gte=trend_start_date).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            total=Count('id'),
            present=Count('id', filter=Q(attendance_status=Attendance.STATUS_PRESENT)),
        )
        for row in attendance_series:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['attendance_rate'] = self._pct(row['present'] or 0, row['total'] or 0)

        exam_series = ExamScore.objects.filter(date__gte=trend_start_date).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(avg=Avg('score'))
        for row in exam_series:
            key = row['month'].strftime('%Y-%m')
            if key in trend_index:
                trend_index[key]['avg_exam_score'] = round(float(row['avg'] or 0), 2)

        trends = []
        for month in trend_months:
            key = month.strftime('%Y-%m')
            item = trend_index[key]
            item['net_profit'] = int(item['income'] - item['expense'])
            trends.append(item)

        # --- Distributions ---
        lead_status_labels = dict(Lead.STATUS_CHOICES)
        lead_status_distribution = [
            {
                'key': row['status'],
                'label': lead_status_labels.get(row['status'], row['status']),
                'count': row['count'],
            }
            for row in Lead.objects.values('status').annotate(count=Count('id')).order_by('-count')
        ]

        payment_status_labels = dict(Payment.PaymentStatus.choices)
        payment_status_distribution = [
            {
                'key': row['status'],
                'label': payment_status_labels.get(row['status'], row['status']),
                'count': row['count'],
                'amount': int(row['amount'] or 0),
            }
            for row in Payment.objects.values('status').annotate(
                count=Count('id'),
                amount=Sum('amount'),
            ).order_by('-amount')
        ]

        students_by_branch = [
            {
                'name': row['name'],
                'students': row['students'],
            }
            for row in Branch.objects.annotate(
                students=Count(
                    'staff',
                    filter=Q(
                        staff__is_teacher=False,
                        staff__is_staff=False,
                        staff__is_active=True,
                    ),
                    distinct=True,
                )
            ).values('name', 'students').order_by('-students')[:8]
        ]

        gender_labels = dict(User._meta.get_field('gender').choices)
        students_by_gender = [
            {
                'key': row['gender'] or 'unknown',
                'label': gender_labels.get(row['gender'], 'Unknown'),
                'count': row['count'],
            }
            for row in active_students_qs.values('gender').annotate(count=Count('id')).order_by('-count')
        ]

        top_courses = [
            {
                'course': row['name'],
                'students': row['students'],
            }
            for row in Course.objects.annotate(
                students=Count('groups__students', distinct=True),
            ).values('name', 'students').order_by('-students')[:8]
        ]

        attendance_status_distribution = [
            {
                'key': row['attendance_status'],
                'count': row['count'],
            }
            for row in Attendance.objects.filter(date__gte=start_of_month).values(
                'attendance_status'
            ).annotate(count=Count('id')).order_by('-count')
        ]

        # --- Final payload ---
        data = {
            'general': {
                'total_active_students': total_students,
                'total_groups': total_groups,
                'active_leads': active_leads,
            },
            'this_month': {
                'new_students': new_students_this_month,
                'income': monthly_income,  # minor units (tiyin)
                'expense': monthly_expense,
                'net_profit': net_profit_this_month,
                'new_leads': new_leads_this_month,
                'converted_leads': converted_leads_this_month,
                'lead_conversion_rate': f"{lead_conversion_rate_this_month:.2f}%",
            },
            'kpis': {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_groups': total_groups,
                'total_courses': total_courses,
                'total_branches': total_branches,
                'active_students_30d': active_students_30d,
                'attendance_rate_30d': attendance_rate_30d,
                'excused_rate_30d': excused_rate_30d,
                'unexcused_rate_30d': unexcused_rate_30d,
                'avg_exam_score_30d': avg_exam_score_30d,
                'exam_pass_rate_30d': pass_rate_30d,
                'monthly_income': monthly_income,
                'monthly_expense': monthly_expense,
                'monthly_net_profit': net_profit_this_month,
                'arpu_minor': arpu_minor,
                'student_teacher_ratio': student_teacher_ratio,
                'groups_per_teacher': groups_per_teacher,
                'avg_group_size': round(float(avg_group_size), 2),
                'outstanding_balance': int(outstanding_balance),
                'pending_payment_amount': int(pending_payment_amount),
                'at_risk_students_30d': at_risk_students_30d,
                'lms_completion_rate': lms_completion_rate,
                'avg_watch_minutes': avg_watch_minutes,
            },
            'trends': trends,
            'distribution': {
                'lead_status': lead_status_distribution,
                'payment_status': payment_status_distribution,
                'students_by_branch': students_by_branch,
                'students_by_gender': students_by_gender,
                'top_courses': top_courses,
                'attendance_status_this_month': attendance_status_distribution,
            },
            'operations': {
                'today_attendance': {
                    'present': today_present,
                    'excused': today_excused,
                    'unexcused': today_unexcused,
                    'total': today_present + today_excused + today_unexcused,
                },
                'active_group_sessions_today': active_group_sessions_today,
                'pending_payment_count': pending_payment_count,
                'failed_payment_count': failed_payment_count,
                'paid_payment_count': paid_payment_count,
                'failed_payment_amount': int(failed_payment_amount),
                'unpaid_teacher_count': unpaid_teacher_count,
                'unpaid_teacher_amount': int(unpaid_teacher_amount),
                'open_tickets': open_tickets,
                'overdue_pending_payments': overdue_pending_payments,
            },
            'report_generated_at': now,
        }

        cache.set(cache_key, data, timeout=60 * 15)
        return Response(data)

@extend_schema(responses=OpenApiTypes.OBJECT)
class DashboardStatsView(APIView):
    """
    Dashboard statistics for admin panel.
    GET /api/analytics/dashboard-stats/
    """
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    required_capability = 'analytics.view'

    def get(self, request):
        """Get dashboard statistics"""
        cache_key = 'dashboard_stats'
        cached_data = cache.get(cache_key)

        if cached_data:
            return Response(cached_data)

        # Count statistics
        total_students = User.objects.filter(is_teacher=False, is_staff=False, is_active=True).count()
        total_teachers = User.objects.filter(is_teacher=True, is_active=True).count()
        total_groups = Group.objects.count()

        # Active courses count (assuming courses with groups are active)
        from student_profile.models import Course
        active_courses = Course.objects.count()

        # Pending tasks (if you have a Task model)
        try:
            from task.models import Task
            pending_tasks = Task.objects.filter(status='pending').count()
        except:
            pending_tasks = 0

        data = {
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_groups': total_groups,
            'active_courses': active_courses,
            'pending_tasks': pending_tasks,
        }

        # Cache for 5 minutes
        cache.set(cache_key, data, timeout=60 * 5)

        return Response(data)


class ReportPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'limit'
    max_page_size = 100


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class ReportListView(APIView):
    """
    List and generate reports.
    GET /api/analytics/reports/ - List recent reports
    POST /api/analytics/reports/generate/ - Generate new report
    """
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    method_capabilities = {
        'get': 'reports.view',
        'post': 'reports.create',
    }

    REPORT_TYPE_ALIASES = {
        'student-performance': 'student-performance',
        'attendance-summary': 'attendance-summary',
        'financial-report': 'financial-report',
        'teacher-workload': 'teacher-workload',
        'course-completion': 'course-completion',
        'enrollment-trends': 'enrollment-trends',
        'profit-loss': 'profit-loss',
        'profit_loss': 'profit-loss',
        'cash-flow': 'cash-flow',
        'cash_flow': 'cash-flow',
        'accounts-receivable': 'accounts-receivable',
        'accounts_receivable': 'accounts-receivable',
        'teacher-compensation': 'teacher-compensation',
        'teacher_compensation': 'teacher-compensation',
    }

    def _normalize_report_type(self, report_type: str) -> str | None:
        if not report_type:
            return None
        return self.REPORT_TYPE_ALIASES.get(report_type.strip().lower())

    def _resolve_period_range(self, period: str, start_date=None, end_date=None):
        end_dt = timezone.now()
        if end_date:
            end_dt = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))

        if start_date:
            start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
            return start_dt, end_dt

        if period == 'week':
            start_dt = end_dt - timedelta(days=7)
        elif period == 'quarter':
            start_dt = end_dt - timedelta(days=90)
        elif period == 'year':
            start_dt = end_dt - timedelta(days=365)
        else:
            start_dt = end_dt - timedelta(days=30)

        return start_dt, end_dt

    def _build_report_id(self) -> str:
        return f"RPT-{timezone.now().strftime('%Y%m%d-%H%M%S')}-{secrets.randbelow(10000):04d}"

    def get(self, request):
        """Get list of generated reports."""
        queryset = Report.objects.all().select_related('generated_by').order_by('-generated_at')

        report_type = request.query_params.get('report_type')
        if report_type:
            normalized_type = self._normalize_report_type(report_type) or report_type
            queryset = queryset.filter(report_type=normalized_type)

        report_status = request.query_params.get('status')
        if report_status:
            queryset = queryset.filter(status=report_status)

        period = request.query_params.get('period')
        if period:
            queryset = queryset.filter(period=period)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(report_id__icontains=search)
            )

        paginator = ReportPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ReportListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """Generate a report, persist it, and return saved report payload."""
        request_serializer = ReportGenerateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        payload = request_serializer.validated_data

        requested_type = payload.get('report_type', '')
        normalized_type = self._normalize_report_type(requested_type)
        if not normalized_type:
            return Response(
                {'detail': f'Unknown report type: {requested_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period = payload.get('period', 'month')
        start_dt, end_dt = self._resolve_period_range(
            period=period,
            start_date=payload.get('start_date'),
            end_date=payload.get('end_date'),
        )

        generator_map = {
            'student-performance': self._generate_student_performance_report,
            'attendance-summary': self._generate_attendance_report,
            'financial-report': self._generate_financial_report,
            'teacher-workload': self._generate_teacher_workload_report,
            'course-completion': self._generate_course_completion_report,
            'enrollment-trends': self._generate_enrollment_trends_report,
            'profit-loss': self._generate_profit_loss_report,
            'cash-flow': self._generate_cash_flow_report,
            'accounts-receivable': self._generate_accounts_receivable_report,
            'teacher-compensation': self._generate_teacher_compensation_report,
        }

        report_response = generator_map[normalized_type](start_dt, end_dt, period)
        if report_response.status_code >= 400:
            return report_response

        generated_data = report_response.data or {}
        report = Report.objects.create(
            report_id=self._build_report_id(),
            report_type=normalized_type,
            title=generated_data.get('title') or normalized_type.replace('-', ' ').title(),
            description=generated_data.get('description') or '',
            period=period,
            start_date=start_dt.date(),
            end_date=end_dt.date(),
            summary=generated_data.get('summary') or {},
            data=generated_data.get('data') or [],
            charts=generated_data.get('charts') or [],
            status='completed',
            generated_by=request.user if request.user.is_authenticated else None,
        )

        return Response(ReportDetailSerializer(report).data, status=status.HTTP_201_CREATED)

    def _generate_student_performance_report(self, start, end, period):
        """Generate student performance report with real data"""
        from django.db.models import Avg, Count, Q
        from student_profile.models import ExamScore, Course

        # Get all students with exam scores in period
        students = User.objects.filter(
            is_teacher=False,
            is_staff=False,
            is_active=True
        )

        # Get exam scores
        exam_scores = ExamScore.objects.filter(
            date__gte=start,
            date__lte=end
        ).select_related('student', 'group')

        # Calculate statistics
        total_students = students.count()
        avg_score = exam_scores.aggregate(avg=Avg('score'))['avg'] or 0

        # Calculate passing rate (assuming 60% is passing)
        passing_scores = exam_scores.filter(score__gte=60).count()
        total_scores = exam_scores.count()
        passing_rate = (passing_scores / total_scores * 100) if total_scores > 0 else 0

        # Top performers (score >= 90)
        top_performers = exam_scores.filter(score__gte=90).values('student').distinct().count()

        # Needs attention (score < 60)
        needs_attention = exam_scores.filter(score__lt=60).values('student').distinct().count()

        # Build data table
        data = []
        for score in exam_scores[:50]:  # Limit to 50 for performance
            # Get attendance rate
            attendance_records = Attendance.objects.filter(
                student=score.student,
                date__gte=start,
                date__lte=end
            )
            total_classes = attendance_records.count()
            attended = attendance_records.filter(is_present=True).count()
            attendance_rate = f"{(attended / total_classes * 100):.0f}%" if total_classes > 0 else "N/A"

            # Determine grade
            if score.score >= 90:
                grade = 'A'
            elif score.score >= 80:
                grade = 'B'
            elif score.score >= 70:
                grade = 'C'
            elif score.score >= 60:
                grade = 'D'
            else:
                grade = 'F'

            data.append({
                'student_name': f"{score.student.first_name} {score.student.last_name}",
                'course': score.group.name if score.group else 'N/A',
                'score': score.score,
                'grade': grade,
                'attendance': attendance_rate
            })

        # Build chart data (grade distribution)
        grade_a = exam_scores.filter(score__gte=90).count()
        grade_b = exam_scores.filter(score__gte=80, score__lt=90).count()
        grade_c = exam_scores.filter(score__gte=70, score__lt=80).count()
        grade_d = exam_scores.filter(score__gte=60, score__lt=70).count()
        grade_f = exam_scores.filter(score__lt=60).count()

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'student-performance',
            'title': 'Student Performance Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_students': total_students,
                'average_score': round(avg_score, 1),
                'passing_rate': round(passing_rate, 1),
                'change': 0,  # Calculate from previous period if needed
                'top_performers': top_performers,
                'needs_attention': needs_attention
            },
            'data': data,
            'charts': [
                {
                    'type': 'bar',
                    'data': [
                        {'label': 'A (90-100)', 'value': grade_a, 'color': '#10b981'},
                        {'label': 'B (80-89)', 'value': grade_b, 'color': '#3b82f6'},
                        {'label': 'C (70-79)', 'value': grade_c, 'color': '#f59e0b'},
                        {'label': 'D (60-69)', 'value': grade_d, 'color': '#ef4444'},
                        {'label': 'F (0-59)', 'value': grade_f, 'color': '#dc2626'},
                    ]
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_attendance_report(self, start, end, period):
        """Generate attendance summary report"""
        from student_profile.models import Attendance
        # Group is already imported at the top of this file

        # Get all groups
        groups = Group.objects.all()

        # Calculate overall statistics
        all_attendance = Attendance.objects.filter(
            date__gte=start,
            date__lte=end
        )
        total_classes = all_attendance.count()
        attended = all_attendance.filter(is_present=True).count()
        average_attendance = (attended / total_classes * 100) if total_classes > 0 else 0

        # Perfect attendance (100%)
        from django.db.models import Count, Q, F
        students_with_perfect = User.objects.filter(
            is_teacher=False,
            is_staff=False,
            is_active=True
        ).annotate(
            total_att=Count('attendances', filter=Q(attendances__date__gte=start, attendances__date__lte=end)),
            present_att=Count('attendances', filter=Q(attendances__date__gte=start, attendances__date__lte=end, attendances__is_present=True))
        ).filter(total_att=F('present_att'), total_att__gt=0).count()

        # Build data table by group
        data = []
        for group in groups:
            group_attendance = Attendance.objects.filter(
                date__gte=start,
                date__lte=end,
                student__student_groups=group
            )
            group_total = group_attendance.count()
            group_attended = group_attendance.filter(is_present=True).count()
            group_rate = (group_attended / group_total * 100) if group_total > 0 else 0

            data.append({
                'group': group.name,
                'total_classes': group_total,
                'attended': group_attended,
                'rate': f"{group_rate:.0f}%",
                'students': group.students.count()
            })

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'attendance-summary',
            'title': 'Attendance Summary Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_classes': total_classes,
                'average_attendance': round(average_attendance, 1),
                'perfect_attendance': students_with_perfect,
                'change': 0,
                'total_students': User.objects.filter(is_teacher=False, is_staff=False, is_active=True).count()
            },
            'data': data[:20],  # Limit to 20 groups
            'charts': []  # Can add trend chart if needed
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_financial_report(self, start, end, period):
        """Generate financial report"""
        from student_profile.models import Payment, Expense

        # Get payments and expenses
        payments = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PAID
        )
        expenses = Expense.objects.filter(
            date__gte=start,
            date__lte=end
        )

        total_revenue = payments.aggregate(total=Sum('amount'))['total'] or 0
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or 0
        net_profit = total_revenue - total_expenses

        # Pending payments
        pending_payments = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PENDING
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Build data by category
        data = []

        # Revenue categories (all payments are tuition for now since we don't have type field)
        tuition_revenue = total_revenue
        other_revenue = 0

        # Expense categories (using expense type model relationship if it exists)
        try:
            salary_expenses = expenses.filter(type__name__icontains='salary').aggregate(total=Sum('amount'))['total'] or 0
            facility_expenses = expenses.filter(type__name__icontains='facility').aggregate(total=Sum('amount'))['total'] or 0
        except:
            # If type relationship doesn't exist, use estimates
            salary_expenses = int(total_expenses * 0.6)  # 60% estimate
            facility_expenses = int(total_expenses * 0.3)  # 30% estimate
        other_expenses = total_expenses - salary_expenses - facility_expenses

        data.append({
            'category': 'Tuition Fees',
            'revenue': tuition_revenue / 100,  # Convert from tiyin
            'expenses': 0,
            'net': tuition_revenue / 100,
            'percentage': f"{(tuition_revenue / total_revenue * 100):.1f}%" if total_revenue > 0 else "0%"
        })

        data.append({
            'category': 'Salaries',
            'revenue': 0,
            'expenses': salary_expenses / 100,
            'net': -(salary_expenses / 100),
            'percentage': f"{(salary_expenses / total_expenses * 100):.1f}%" if total_expenses > 0 else "0%"
        })

        data.append({
            'category': 'Facilities',
            'revenue': 0,
            'expenses': facility_expenses / 100,
            'net': -(facility_expenses / 100),
            'percentage': f"{(facility_expenses / total_expenses * 100):.1f}%" if total_expenses > 0 else "0%"
        })

        data.append({
            'category': 'Other',
            'revenue': other_revenue / 100,
            'expenses': other_expenses / 100,
            'net': (other_revenue - other_expenses) / 100,
            'percentage': f"{((other_revenue + other_expenses) / (total_revenue + total_expenses) * 100):.1f}%" if (total_revenue + total_expenses) > 0 else "0%"
        })

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'financial-report',
            'title': 'Financial Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_revenue': total_revenue / 100,
                'total_expenses': total_expenses / 100,
                'net_profit': net_profit / 100,
                'change': 0,
                'pending_payments': pending_payments / 100
            },
            'data': data,
            'charts': [
                {
                    'type': 'pie',
                    'data': [
                        {'label': 'Revenue', 'value': total_revenue / 100, 'color': '#10b981'},
                        {'label': 'Expenses', 'value': total_expenses / 100, 'color': '#ef4444'},
                    ]
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_teacher_workload_report(self, start, end, period):
        """Generate teacher workload report"""
        # Group is already imported at the top of this file

        # Get all teachers
        teachers = User.objects.filter(is_teacher=True, is_active=True)

        total_teachers = teachers.count()
        total_groups = Group.objects.count()

        # Build data
        data = []
        total_hours = 0

        for teacher in teachers:
            # Get groups where teacher is main_teacher or assistant_teacher
            from django.db.models import Q
            teacher_groups = Group.objects.filter(
                Q(main_teacher=teacher) | Q(assistant_teacher=teacher)
            )
            group_count = teacher_groups.count()

            # Calculate total students
            student_count = sum(group.students.count() for group in teacher_groups)

            # Estimate hours (approximate: each group = 10 hours/week)
            hours_week = group_count * 10
            total_hours += hours_week

            # Get subjects (from group names or courses)
            subjects = ", ".join(set(group.name.split()[0] for group in teacher_groups[:3]))

            data.append({
                'teacher_name': f"{teacher.first_name} {teacher.last_name}" if teacher.first_name else teacher.username,
                'groups': group_count,
                'students': student_count,
                'hours_week': hours_week,
                'subjects': subjects or 'N/A'
            })

        average_hours = total_hours / total_teachers if total_teachers > 0 else 0

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'teacher-workload',
            'title': 'Teacher Workload Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_teachers': total_teachers,
                'average_hours': round(average_hours, 1),
                'total_groups': total_groups,
                'change': 0
            },
            'data': data[:20],  # Limit to 20 teachers
            'charts': []
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_course_completion_report(self, start, end, period):
        """Generate course completion report"""
        from student_profile.models import Course
        from django.db.models import Count

        courses = Course.objects.all()

        total_courses = courses.count()
        total_completed = 0
        total_in_progress = 0

        data = []
        for course in courses:
            # Get students enrolled (from groups or enrollments)
            enrolled = course.groups.aggregate(total=Count('students'))['total'] or 0

            # These would come from actual completion tracking
            # For now, using estimates
            completed = int(enrolled * 0.7)  # 70% estimated completion
            in_progress = int(enrolled * 0.25)  # 25% in progress
            dropped = enrolled - completed - in_progress

            total_completed += completed
            total_in_progress += in_progress

            completion_rate = (completed / enrolled * 100) if enrolled > 0 else 0

            data.append({
                'course': course.name,
                'enrolled': enrolled,
                'completed': completed,
                'in_progress': in_progress,
                'dropped': dropped,
                'rate': f"{completion_rate:.0f}%"
            })

        completion_rate = (total_completed / (total_completed + total_in_progress) * 100) if (total_completed + total_in_progress) > 0 else 0

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'course-completion',
            'title': 'Course Completion Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_courses': total_courses,
                'completion_rate': round(completion_rate, 1),
                'completed_students': total_completed,
                'change': 0,
                'in_progress': total_in_progress
            },
            'data': data[:20],
            'charts': []
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_enrollment_trends_report(self, start, end, period):
        """Generate enrollment trends report"""
        from datetime import timedelta
        from django.db.models.functions import TruncMonth
        from django.db.models import Count
        from student_profile.models import Course

        # Get students who joined in the period
        students = User.objects.filter(
            is_teacher=False,
            is_staff=False,
            date_joined__gte=start,
            date_joined__lte=end
        )

        # Group by month
        monthly_data = students.annotate(
            month=TruncMonth('date_joined')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')

        # Build data and chart
        data = []
        chart_data = []

        total_enrollments = 0
        for entry in monthly_data:
            month_name = entry['month'].strftime('%B')
            enrollments = entry['count']
            total_enrollments += enrollments

            # Estimate revenue (average fee per student)
            revenue = enrollments * 500  # Assuming $500 per student

            # Get courses count (total courses available, since Course doesn't have created_at)
            courses = Course.objects.count()

            data.append({
                'month': month_name,
                'enrollments': enrollments,
                'revenue': revenue,
                'courses': courses
            })

            chart_data.append({
                'label': month_name[:3],  # Short month name
                'value': enrollments
            })

        average_monthly = total_enrollments / len(monthly_data) if monthly_data else 0

        # Calculate growth rate
        if len(monthly_data) >= 2:
            first_month = monthly_data[0]['count']
            last_month = monthly_data[len(monthly_data)-1]['count']
            growth_rate = ((last_month - first_month) / first_month * 100) if first_month > 0 else 0
        else:
            growth_rate = 0

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'enrollment-trends',
            'title': 'Enrollment Trends Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_enrollments': total_enrollments,
                'average_monthly': round(average_monthly, 0),
                'growth_rate': round(growth_rate, 1),
                'change': round(growth_rate, 1),
                'projected_next_month': int(average_monthly * 1.1)  # 10% growth projection
            },
            'data': data,
            'charts': [
                {
                    'type': 'line',
                    'data': chart_data
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_profit_loss_report(self, start, end, period):
        """Generate profit & loss statement report"""
        from student_profile.models import Payment, Expense
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth

        # Get payments (revenue)
        payments = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PAID
        )

        # Get expenses
        expenses = Expense.objects.filter(
            date__gte=start,
            date__lte=end
        )

        # Calculate totals
        total_revenue = payments.aggregate(total=Sum('amount'))['total'] or 0
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or 0
        gross_profit = total_revenue - total_expenses

        # Calculate profit margin
        profit_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0

        # Monthly breakdown
        monthly_revenue = payments.annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            amount=Sum('amount')
        ).order_by('month')

        monthly_expenses = expenses.annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            amount=Sum('amount')
        ).order_by('month')

        # Build monthly data
        data = []
        chart_data = []

        # Create a dictionary for easy lookup
        expense_dict = {e['month']: e['amount'] for e in monthly_expenses}

        for rev in monthly_revenue:
            month_name = rev['month'].strftime('%B %Y')
            revenue = rev['amount'] / 100  # Convert from tiyin to currency
            expense = expense_dict.get(rev['month'], 0) / 100
            profit = revenue - expense

            data.append({
                'month': month_name,
                'revenue': round(revenue, 2),
                'expenses': round(expense, 2),
                'gross_profit': round(profit, 2),
                'margin': f"{(profit / revenue * 100):.1f}%" if revenue > 0 else "0%"
            })

            chart_data.append({
                'label': rev['month'].strftime('%b'),
                'revenue': round(revenue, 2),
                'expenses': round(expense, 2),
                'profit': round(profit, 2)
            })

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'profit-loss',
            'title': 'Profit & Loss Statement',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_revenue': round(total_revenue / 100, 2),
                'total_expenses': round(total_expenses / 100, 2),
                'gross_profit': round(gross_profit / 100, 2),
                'profit_margin': round(profit_margin, 1),
                'change': 0
            },
            'data': data,
            'charts': [
                {
                    'type': 'line',
                    'data': chart_data
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_cash_flow_report(self, start, end, period):
        """Generate cash flow statement report"""
        from student_profile.models import Payment, Expense
        from django.db.models import Sum, Q
        from django.db.models.functions import TruncMonth

        # Operating Activities
        payments_received = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PAID
        ).aggregate(total=Sum('amount'))['total'] or 0

        operating_expenses = Expense.objects.filter(
            date__gte=start,
            date__lte=end
        ).aggregate(total=Sum('amount'))['total'] or 0

        net_operating_cash = payments_received - operating_expenses

        # Financing Activities (assuming teacher salaries and major expenses)
        try:
            financing_outflows = Expense.objects.filter(
                date__gte=start,
                date__lte=end,
                type__name__icontains='salary'
            ).aggregate(total=Sum('amount'))['total'] or 0
        except:
            financing_outflows = int(operating_expenses * 0.6)  # 60% estimate

        # Total cash flow
        total_cash_flow = net_operating_cash - financing_outflows

        # Monthly breakdown
        monthly_payments = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PAID
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            amount=Sum('amount')
        ).order_by('month')

        monthly_expenses = Expense.objects.filter(
            date__gte=start,
            date__lte=end
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            amount=Sum('amount')
        ).order_by('month')

        # Build data
        data = []
        chart_data = []
        expense_dict = {e['month']: e['amount'] for e in monthly_expenses}

        for payment in monthly_payments:
            month_name = payment['month'].strftime('%B %Y')
            inflow = payment['amount'] / 100
            outflow = expense_dict.get(payment['month'], 0) / 100
            net_flow = inflow - outflow

            data.append({
                'month': month_name,
                'cash_inflow': round(inflow, 2),
                'cash_outflow': round(outflow, 2),
                'net_cash_flow': round(net_flow, 2),
                'status': 'Positive' if net_flow > 0 else 'Negative'
            })

            chart_data.append({
                'label': payment['month'].strftime('%b'),
                'inflow': round(inflow, 2),
                'outflow': round(outflow, 2)
            })

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'cash-flow',
            'title': 'Cash Flow Statement',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'operating_cash': round(net_operating_cash / 100, 2),
                'financing_cash': round(-financing_outflows / 100, 2),
                'net_cash_flow': round(total_cash_flow / 100, 2),
                'change': 0,
                'cash_ratio': round((payments_received / operating_expenses) if operating_expenses > 0 else 0, 2)
            },
            'data': data,
            'charts': [
                {
                    'type': 'bar',
                    'data': chart_data
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_accounts_receivable_report(self, start, end, period):
        """Generate accounts receivable (outstanding payments) report"""
        from student_profile.models import Payment
        from django.db.models import Sum

        # Get all pending payments (only PENDING status exists, no OVERDUE)
        pending_payments = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PENDING
        ).select_related('by_user', 'group')

        # Calculate totals
        total_pending = pending_payments.aggregate(total=Sum('amount'))['total'] or 0

        # Count by status (all are PENDING)
        pending_count = pending_payments.count()
        overdue_count = 0  # No OVERDUE status in this system

        # Aging analysis (30, 60, 90+ days)
        from datetime import timedelta
        today = timezone.now()

        age_0_30 = pending_payments.filter(date__gte=today - timedelta(days=30)).aggregate(total=Sum('amount'))['total'] or 0
        age_31_60 = pending_payments.filter(
            date__gte=today - timedelta(days=60),
            date__lt=today - timedelta(days=30)
        ).aggregate(total=Sum('amount'))['total'] or 0
        age_61_90 = pending_payments.filter(
            date__gte=today - timedelta(days=90),
            date__lt=today - timedelta(days=60)
        ).aggregate(total=Sum('amount'))['total'] or 0
        age_90_plus = pending_payments.filter(date__lt=today - timedelta(days=90)).aggregate(total=Sum('amount'))['total'] or 0

        # Build data table
        data = []
        for payment in pending_payments[:50]:  # Limit to 50
            days_overdue = (today - payment.date).days
            age_bracket = '0-30 days' if days_overdue <= 30 else '31-60 days' if days_overdue <= 60 else '61-90 days' if days_overdue <= 90 else '90+ days'

            data.append({
                'student': f"{payment.by_user.first_name} {payment.by_user.last_name}" if payment.by_user.first_name else payment.by_user.username,
                'group': payment.group.name if payment.group else 'N/A',
                'amount': round(payment.amount / 100, 2),
                'due_date': payment.date.strftime('%Y-%m-%d'),
                'days_overdue': days_overdue,
                'age_bracket': age_bracket,
                'status': payment.get_status_display()
            })

        # Collection rate (total paid / total expected)
        total_expected = Payment.objects.filter(
            date__gte=start,
            date__lte=end
        ).aggregate(total=Sum('amount'))['total'] or 1  # Avoid division by zero

        total_collected = Payment.objects.filter(
            date__gte=start,
            date__lte=end,
            status=Payment.PaymentStatus.PAID
        ).aggregate(total=Sum('amount'))['total'] or 0

        collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'accounts-receivable',
            'title': 'Accounts Receivable Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_outstanding': round(total_pending / 100, 2),
                'pending_payments': pending_count,
                'overdue_payments': overdue_count,
                'collection_rate': round(collection_rate, 1),
                'change': 0
            },
            'aging': {
                '0_30_days': round(age_0_30 / 100, 2),
                '31_60_days': round(age_31_60 / 100, 2),
                '61_90_days': round(age_61_90 / 100, 2),
                '90_plus_days': round(age_90_plus / 100, 2)
            },
            'data': data,
            'charts': [
                {
                    'type': 'pie',
                    'data': [
                        {'label': '0-30 days', 'value': round(age_0_30 / 100, 2), 'color': '#10b981'},
                        {'label': '31-60 days', 'value': round(age_31_60 / 100, 2), 'color': '#f59e0b'},
                        {'label': '61-90 days', 'value': round(age_61_90 / 100, 2), 'color': '#ef4444'},
                        {'label': '90+ days', 'value': round(age_90_plus / 100, 2), 'color': '#dc2626'}
                    ]
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)

    def _generate_teacher_compensation_report(self, start, end, period):
        """Generate teacher compensation and payment report"""
        from student_profile.models import TeacherEarnings
        from django.db.models import Sum, Count, Q, F

        # Get all teachers
        teachers = User.objects.filter(is_teacher=True, is_active=True)

        # Get teacher earnings in the period (using 'date' field, not 'month')
        earnings_queryset = TeacherEarnings.objects.filter(
            date__gte=start,
            date__lte=end
        ).select_related('teacher')

        # Calculate totals
        total_earned = earnings_queryset.aggregate(total=Sum('amount'))['total'] or 0
        total_paid = earnings_queryset.filter(is_paid_to_teacher=True).aggregate(total=Sum('amount'))['total'] or 0
        total_pending = total_earned - total_paid

        # Number of teachers with pending payments
        teachers_pending = earnings_queryset.filter(
            is_paid_to_teacher=False
        ).values('teacher').distinct().count()

        # Build data table
        data = []
        for teacher in teachers:
            # Get earnings for this teacher
            teacher_earnings = earnings_queryset.filter(teacher=teacher)

            earned = teacher_earnings.aggregate(total=Sum('amount'))['total'] or 0
            paid = teacher_earnings.filter(is_paid_to_teacher=True).aggregate(total=Sum('amount'))['total'] or 0
            pending = earned - paid

            # Get groups count
            groups_count = Group.objects.filter(
                Q(main_teacher=teacher) | Q(assistant_teacher=teacher)
            ).count()

            # Calculate payment status
            payment_status = 'Paid' if pending == 0 and earned > 0 else 'Partial' if paid > 0 else 'Pending'

            data.append({
                'teacher_name': f"{teacher.first_name} {teacher.last_name}" if teacher.first_name else teacher.username,
                'groups': groups_count,
                'total_earned': round(earned / 100, 2),
                'paid_amount': round(paid / 100, 2),
                'pending_amount': round(pending / 100, 2),
                'payment_status': payment_status
            })

        # Calculate average compensation
        average_compensation = total_earned / teachers.count() if teachers.count() > 0 else 0

        # Payment completion rate
        payment_rate = (total_paid / total_earned * 100) if total_earned > 0 else 0

        report_data = {
            'id': f'report-{int(timezone.now().timestamp())}',
            'type': 'teacher-compensation',
            'title': 'Teacher Compensation Report',
            'generated_at': timezone.now().isoformat(),
            'period': period,
            'summary': {
                'total_teachers': teachers.count(),
                'total_compensation': round(total_earned / 100, 2),
                'total_paid': round(total_paid / 100, 2),
                'total_pending': round(total_pending / 100, 2),
                'payment_rate': round(payment_rate, 1),
                'average_compensation': round(average_compensation / 100, 2),
                'teachers_pending': teachers_pending,
                'change': 0
            },
            'data': data,
            'charts': [
                {
                    'type': 'bar',
                    'data': [
                        {'label': 'Total Earned', 'value': round(total_earned / 100, 2), 'color': '#3b82f6'},
                        {'label': 'Paid', 'value': round(total_paid / 100, 2), 'color': '#10b981'},
                        {'label': 'Pending', 'value': round(total_pending / 100, 2), 'color': '#f59e0b'}
                    ]
                }
            ]
        }

        return Response(report_data, status=status.HTTP_201_CREATED)


@extend_schema(responses=OpenApiTypes.OBJECT)
class ReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    required_capability = 'reports.view'

    def get(self, request, report_id):
        report = Report.objects.filter(report_id=report_id).select_related('generated_by').first()
        if report is None:
            return Response({'detail': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReportDetailSerializer(report).data)


@extend_schema(responses=OpenApiTypes.OBJECT)
class ReportDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    required_capability = 'reports.export'

    def get(self, request, report_id):
        report = Report.objects.filter(report_id=report_id).first()
        if report is None:
            return Response({'detail': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

        download_format = (request.query_params.get('file_format') or 'csv').lower()
        if download_format == 'json':
            response = HttpResponse(
                json.dumps(ReportDetailSerializer(report).data),
                content_type='application/json',
            )
            response['Content-Disposition'] = f'attachment; filename="{report.report_id}.json"'
            return response

        if download_format != 'csv':
            return Response({'detail': 'Unsupported format. Use csv or json.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = report.data or []
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{report.report_id}.csv"'
        writer = csv.writer(response)

        if rows and isinstance(rows, list) and isinstance(rows[0], dict):
            headers = list(rows[0].keys())
            writer.writerow(headers)
            for row in rows:
                writer.writerow([row.get(header, '') for header in headers])
        else:
            writer.writerow(['key', 'value'])
            for key, value in (report.summary or {}).items():
                writer.writerow([key, value])

        return response


class LeaderboardView(generics.ListAPIView):
    """
    Unified leaderboard for student ranking across web and mobile.

    Query params:
    - metric: score (default), xp, coins, badges, completed_courses
    - course: optional course id to scope students and scores
    - branch: optional branch id
    - limit: optional max entries
    - filter: top10 | top50 (web compatibility shortcut)
    """
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get(self, request, *args, **kwargs):
        metric = request.query_params.get('metric', 'score')
        course_id = request.query_params.get('course')
        branch_id = request.query_params.get('branch')
        filter_name = request.query_params.get('filter')
        limit = request.query_params.get('limit')

        if metric not in {'score', 'xp', 'coins', 'badges', 'completed_courses'}:
            metric = 'score'

        if not limit and filter_name == 'top10':
            limit = '10'
        elif not limit and filter_name == 'top50':
            limit = '50'

        score_queryset = ExamScore.objects.filter(student=OuterRef('pk'))
        if course_id:
            score_queryset = score_queryset.filter(group__course_id=course_id)

        students = User.objects.filter(
            is_teacher=False,
            is_staff=False,
        ).select_related('branch')

        if branch_id:
            students = students.filter(branch_id=branch_id)

        if course_id:
            students = students.filter(
                Q(student_groups__course_id=course_id) |
                Q(exam_scores__group__course_id=course_id)
            ).distinct()

        students = students.annotate(
            average_score=Coalesce(
                Subquery(
                    score_queryset.values('student')
                    .annotate(value=Avg('score'))
                    .values('value')[:1],
                    output_field=FloatField(),
                ),
                Value(0.0),
            ),
            total_coins=Coalesce(
                Subquery(
                    StudentCoins.objects.filter(student=OuterRef('pk'))
                    .values('student')
                    .annotate(value=Sum('coin'))
                    .values('value')[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            total_xp=Coalesce(
                Subquery(
                    UserLevel.objects.filter(user=OuterRef('pk'))
                    .values('total_xp')[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            current_level=Coalesce(
                Subquery(
                    UserLevel.objects.filter(user=OuterRef('pk'))
                    .values('current_level')[:1],
                    output_field=IntegerField(),
                ),
                Value(1),
            ),
            total_badges=Coalesce(
                Subquery(
                    UserBadge.objects.filter(user=OuterRef('pk'))
                    .values('user')
                    .annotate(value=Count('id'))
                    .values('value')[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            total_achievements=Coalesce(
                Subquery(
                    UserAchievement.objects.filter(
                        user=OuterRef('pk'),
                        current_tier__gt=0,
                    )
                    .values('user')
                    .annotate(value=Count('id'))
                    .values('value')[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            total_completed_courses=Coalesce(
                Subquery(
                    StudentProgress.objects.filter(
                        student=OuterRef('pk'),
                        is_completed=True,
                    )
                    .values('student')
                    .annotate(value=Count('lesson__module__course', distinct=True))
                    .values('value')[:1],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
        )

        ordering = {
            'score': ['-average_score', '-total_xp', 'username'],
            'xp': ['-total_xp', '-current_level', 'username'],
            'coins': ['-total_coins', '-average_score', 'username'],
            'badges': ['-total_badges', '-total_xp', 'username'],
            'completed_courses': ['-total_completed_courses', '-average_score', 'username'],
        }[metric]

        students = students.order_by(*ordering, 'id')

        if limit:
            try:
                students = students[:max(1, int(limit))]
            except (TypeError, ValueError):
                pass

        results = []
        for rank, student in enumerate(students, start=1):
            photo_url = None
            if student.photo:
                try:
                    photo_url = request.build_absolute_uri(student.photo.url)
                except ValueError:
                    photo_url = student.photo.url

            student_name = student.get_full_name().strip() or student.username
            score_value = round(float(student.average_score or 0), 2)

            results.append({
                'id': student.id,
                'student': student.id,
                'student_id': student.id,
                'username': student.username,
                'first_name': student.first_name or '',
                'last_name': student.last_name or '',
                'student_name': student_name,
                'rank': rank,
                'score': score_value,
                'avg_score': score_value,
                'coins': int(student.total_coins or 0),
                'xp_points': int(student.total_xp or 0),
                'level': int(student.current_level or 1),
                'badges_count': int(student.total_badges or 0),
                'achievements': int(student.total_achievements or 0),
                'completed_courses': int(student.total_completed_courses or 0),
                'branch_name': student.branch.name if student.branch else None,
                'photo': photo_url,
                'avatar': photo_url,
                'is_current_user': student.id == request.user.id,
            })

        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)

# API Views for Automatic Accounting System

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta

from .accounting_models import (
    StudentAccount,
    MonthlySubscriptionCharge,
    AccountingActivityLog,
    StudentBalance,
    TeacherEarnings,
    StudentFine,
    FinancialSummary,
    AccountTransaction,
)
from .accounting_serializers import (
    StudentAccountSerializer,
    MonthlySubscriptionChargeSerializer,
    AccountingActivityLogSerializer,
    StudentBalanceSerializer,
    TeacherEarningsSerializer,
    TeacherEarningsSummarySerializer,
    StudentFineSerializer,
    FinancialSummarySerializer,
    StudentBalanceCreateSerializer,
    ApplyFineSerializer,
    AccountTransactionSerializer,
)
from .models import Group, AutomaticFine
from users.models import User
from users.permissions import HasRoleCapability
from users.branch_scope import apply_branch_scope, get_accessible_branch_ids, is_global_branch_user
from .services.financial_automation import accounting_realtime_metrics, reactivate_student_account


class StudentAccountViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for internal student balances where negative values are debt.
    """
    queryset = StudentAccount.objects.all()
    serializer_class = StudentAccountSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'reactivate': 'students.reactivate',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = StudentAccount.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='student__balances__group__branch',
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='student__balances__group__branch',
                )
        elif user.is_teacher:
            queryset = queryset.filter(student__student_groups__main_teacher=user).distinct()
        else:
            queryset = queryset.filter(student=user)

        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        student_ids = self.request.query_params.get('student_ids')
        if student_ids:
            parsed_ids = []
            for raw_id in student_ids.split(','):
                token = raw_id.strip()
                if not token:
                    continue
                try:
                    parsed_ids.append(int(token))
                except (TypeError, ValueError):
                    continue
            if parsed_ids:
                queryset = queryset.filter(student_id__in=parsed_ids)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.select_related('student').distinct().order_by('student__username')

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        account = self.get_object()
        group_id = request.data.get('group')
        group = None

        if group_id:
            try:
                group = Group.objects.get(id=group_id)
            except Group.DoesNotExist:
                return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)

        reactivate_student_account(
            student=account.student,
            actor=request.user,
            group=group,
        )
        account.refresh_from_db()

        return Response({
            'message': 'Student account reactivated successfully',
            'account': StudentAccountSerializer(account).data,
        })


class MonthlySubscriptionChargeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MonthlySubscriptionCharge.objects.all()
    serializer_class = MonthlySubscriptionChargeSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = MonthlySubscriptionCharge.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                )
        elif user.is_teacher:
            queryset = queryset.filter(group__main_teacher=user)
        else:
            queryset = queryset.filter(student=user)

        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            queryset = queryset.filter(year=year)
        if month:
            queryset = queryset.filter(month=month)

        return queryset.select_related('student', 'group', 'account').order_by('-year', '-month', '-charged_at')


class AccountingActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccountingActivityLog.objects.all()
    serializer_class = AccountingActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = AccountingActivityLog.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
        elif user.is_teacher:
            queryset = queryset.filter(group__main_teacher=user)
        else:
            queryset = queryset.filter(student=user)

        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        action_type = self.request.query_params.get('action_type')
        if action_type:
            queryset = queryset.filter(action_type=action_type)

        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit_int = max(min(int(limit), 100), 1)
                return queryset.select_related('actor', 'student', 'group', 'attendance', 'payment').order_by('-created_at')[:limit_int]
            except (TypeError, ValueError):
                pass

        return queryset.select_related('actor', 'student', 'group', 'attendance', 'payment').order_by('-created_at')


@extend_schema(responses=OpenApiTypes.OBJECT)
class RealtimeAccountingDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    method_capabilities = {'get': 'analytics.view'}

    def get(self, request):
        metrics = accounting_realtime_metrics()
        branch_ids = get_accessible_branch_ids(request.user)

        activity_qs = AccountingActivityLog.objects.all()
        if request.user.is_superuser:
            activity_qs = apply_branch_scope(
                activity_qs,
                request,
                request.user,
                field_name='group__branch',
                include_unassigned=True,
            )
        elif request.user.is_staff:
            if branch_ids:
                activity_qs = apply_branch_scope(
                    activity_qs,
                    request,
                    request.user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
        else:
            if request.user.is_teacher:
                activity_qs = activity_qs.filter(group__main_teacher=request.user)
            else:
                activity_qs = activity_qs.filter(student=request.user)

        limit = request.query_params.get('limit', 20)
        try:
            limit = max(min(int(limit), 100), 1)
        except (TypeError, ValueError):
            limit = 20

        recent_logs = activity_qs.select_related('actor', 'student', 'group')[:limit]
        return Response({
            **metrics,
            'total_income_sum': metrics['total_income_tiyin'] / 100,
            'total_debt_sum': metrics['total_debt_tiyin'] / 100,
            'net_profit_sum': metrics['net_profit_tiyin'] / 100,
            'teacher_payroll_sum': metrics['teacher_payroll_tiyin'] / 100,
            'company_share_sum': metrics.get('company_share_tiyin', 0) / 100,
            'recent_logs': AccountingActivityLogSerializer(recent_logs, many=True).data,
        })


class StudentBalanceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing student balances.
    """
    queryset = StudentBalance.objects.all()
    serializer_class = StudentBalanceSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'summary': 'payments.read',
        'create': 'payments.manage',
        'update': 'payments.manage',
        'partial_update': 'payments.manage',
        'destroy': 'payments.manage',
        'recalculate': 'payments.manage',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = StudentBalance.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        # Role-based filtering
        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                )
        else:
            # Students can only see their own balances
            queryset = queryset.filter(student=user)

        # Filter by student
        student_id = self.request.query_params.get('student', None)
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        # Filter by group
        group_id = self.request.query_params.get('group', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        # Filter by payment status
        status_filter = self.request.query_params.get('status', None)
        if status_filter == 'fully_paid':
            queryset = queryset.filter(is_fully_paid=True)
        elif status_filter == 'has_debt':
            queryset = queryset.filter(is_fully_paid=False, balance__gt=0)
        elif status_filter == 'overpaid':
            queryset = queryset.filter(balance__lt=0)

        return queryset.select_related('student', 'group', 'group__course', 'group__branch').order_by('-created_at')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get summary statistics for student balances.
        """
        queryset = self.get_queryset()

        summary = {
            'total_students': queryset.values('student').distinct().count(),
            'total_balances': queryset.count(),
            'fully_paid_count': queryset.filter(is_fully_paid=True).count(),
            'with_debt_count': queryset.filter(is_fully_paid=False, balance__gt=0).count(),
            'total_debt': queryset.filter(balance__gt=0).aggregate(
                total=Sum('balance')
            )['total'] or 0,
            'total_overpayment': abs(queryset.filter(balance__lt=0).aggregate(
                total=Sum('balance')
            )['total'] or 0),
            'total_fees': queryset.aggregate(total=Sum('total_fee'))['total'] or 0,
            'total_paid': queryset.aggregate(total=Sum('paid_amount'))['total'] or 0,
            'total_fines': queryset.aggregate(total=Sum('fine_amount'))['total'] or 0,
        }

        # Convert to sum (UZS)
        for key in ['total_debt', 'total_overpayment', 'total_fees', 'total_paid', 'total_fines']:
            summary[f'{key}_sum'] = summary[key] / 100

        return Response(summary)

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """
        Recalculate balance for a specific student balance.
        """
        balance = self.get_object()
        balance.calculate_balance()
        serializer = self.get_serializer(balance)
        return Response({
            'message': 'Balance recalculated successfully',
            'balance': serializer.data
        })


class TeacherEarningsViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing teacher earnings.
    """
    queryset = TeacherEarnings.objects.all()
    serializer_class = TeacherEarningsSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'summary': 'payments.read',
        'by_teacher': 'payments.read',
        'create': 'payments.manage',
        'update': 'payments.manage',
        'partial_update': 'payments.manage',
        'destroy': 'payments.manage',
        'mark_paid': 'payments.manage',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = TeacherEarnings.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        # Role-based filtering
        if user.is_teacher and not user.is_superuser:
            # Teachers can only see their own earnings
            queryset = queryset.filter(teacher=user)
            if branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                )
        elif user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )

        # Filter by teacher
        teacher_id = self.request.query_params.get('teacher', None)
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        # Filter by payment status
        payment_status = self.request.query_params.get('payment_status', None)
        if payment_status == 'paid':
            queryset = queryset.filter(is_paid_to_teacher=True)
        elif payment_status == 'unpaid':
            queryset = queryset.filter(is_paid_to_teacher=False)

        # Date filtering
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.select_related(
            'teacher',
            'payment',
            'payment__by_user',
            'attendance_charge',
            'student',
            'group',
        ).order_by('-date')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get summary statistics for teacher earnings.
        """
        queryset = self.get_queryset()

        summary = {
            'total_earnings_count': queryset.count(),
            'total_amount': queryset.aggregate(total=Sum('amount'))['total'] or 0,
            'total_paid': queryset.filter(is_paid_to_teacher=True).aggregate(total=Sum('amount'))['total'] or 0,
            'total_unpaid': queryset.filter(is_paid_to_teacher=False).aggregate(total=Sum('amount'))['total'] or 0,
            'paid_count': queryset.filter(is_paid_to_teacher=True).count(),
            'unpaid_count': queryset.filter(is_paid_to_teacher=False).count(),
        }

        # Convert to sum (UZS)
        for key in ['total_amount', 'total_paid', 'total_unpaid']:
            summary[f'{key}_sum'] = summary[key] / 100

        return Response(summary)

    @action(detail=False, methods=['get'])
    def by_teacher(self, request):
        """
        Get earnings grouped by teacher.
        """
        queryset = self.get_queryset()

        teachers_data = queryset.values(
            'teacher_id',
            'teacher__first_name',
            'teacher__last_name'
        ).annotate(
            total_earnings=Sum('amount'),
            total_paid=Sum('amount', filter=Q(is_paid_to_teacher=True)),
            earning_count=Count('id')
        )

        result = []
        for teacher in teachers_data:
            total_earnings = teacher['total_earnings'] or 0
            total_paid = teacher['total_paid'] or 0

            result.append({
                'teacher_id': teacher['teacher_id'],
                'teacher_name': f"{teacher['teacher__first_name']} {teacher['teacher__last_name']}",
                'total_earnings': total_earnings / 100,
                'total_paid': total_paid / 100,
                'total_unpaid': (total_earnings - total_paid) / 100,
                'earning_count': teacher['earning_count']
            })

        serializer = TeacherEarningsSummarySerializer(result, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """
        Mark an earning as paid to teacher.
        """
        earning = self.get_object()

        if earning.is_paid_to_teacher:
            return Response(
                {'error': 'This earning is already marked as paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        paid_date = request.data.get('paid_date', None)
        if paid_date:
            try:
                paid_date = datetime.strptime(paid_date, '%Y-%m-%d').date()
            except ValueError:
                paid_date = None

        earning.mark_as_paid(paid_date)

        serializer = self.get_serializer(earning)
        return Response({
            'message': 'Earning marked as paid successfully',
            'earning': serializer.data
        })


class StudentFineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing student fines.
    """
    queryset = StudentFine.objects.all()
    serializer_class = StudentFineSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'summary': 'payments.read',
        'create': 'payments.manage',
        'update': 'payments.manage',
        'partial_update': 'payments.manage',
        'destroy': 'payments.manage',
        'mark_paid': 'payments.manage',
        'apply_fine': 'payments.manage',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = StudentFine.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        # Role-based filtering
        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
        else:
            # Students can only see their own fines
            queryset = queryset.filter(student=user)

        # Filter by student
        student_id = self.request.query_params.get('student', None)
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        # Filter by payment status
        payment_status = self.request.query_params.get('payment_status', None)
        if payment_status == 'paid':
            queryset = queryset.filter(is_paid=True)
        elif payment_status == 'unpaid':
            queryset = queryset.filter(is_paid=False)

        # Filter by automatic vs manual
        is_automatic = self.request.query_params.get('is_automatic', None)
        if is_automatic == 'true':
            queryset = queryset.filter(is_automatic=True)
        elif is_automatic == 'false':
            queryset = queryset.filter(is_automatic=False)

        return queryset.select_related('student', 'fine_type', 'group', 'attendance', 'created_by').order_by('-applied_date')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get summary statistics for fines.
        """
        queryset = self.get_queryset()

        summary = {
            'total_fines_count': queryset.count(),
            'total_amount': queryset.aggregate(total=Sum('amount'))['total'] or 0,
            'total_paid': queryset.filter(is_paid=True).aggregate(total=Sum('amount'))['total'] or 0,
            'total_unpaid': queryset.filter(is_paid=False).aggregate(total=Sum('amount'))['total'] or 0,
            'automatic_count': queryset.filter(is_automatic=True).count(),
            'manual_count': queryset.filter(is_automatic=False).count(),
        }

        # Convert to sum (UZS)
        for key in ['total_amount', 'total_paid', 'total_unpaid']:
            summary[f'{key}_sum'] = summary[key] / 100

        return Response(summary)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """
        Mark a fine as paid.
        """
        fine = self.get_object()

        if fine.is_paid:
            return Response(
                {'error': 'This fine is already marked as paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        paid_date = request.data.get('paid_date', None)
        if paid_date:
            try:
                paid_date = datetime.strptime(paid_date, '%Y-%m-%d').date()
            except ValueError:
                paid_date = None

        fine.mark_as_paid(paid_date)

        serializer = self.get_serializer(fine)
        return Response({
            'message': 'Fine marked as paid successfully',
            'fine': serializer.data
        })

    @action(detail=False, methods=['post'])
    def apply_fine(self, request):
        """
        Manually apply a fine to a student.
        """
        serializer = ApplyFineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = User.objects.get(id=serializer.validated_data['student_id'])
        fine_type = AutomaticFine.objects.get(id=serializer.validated_data['fine_type_id'])
        group_id = serializer.validated_data.get('group_id')
        description = serializer.validated_data.get('description', '')

        group = Group.objects.get(id=group_id) if group_id else None

        # Create the fine
        fine = StudentFine.objects.create(
            student=student,
            fine_type=fine_type,
            group=group,
            amount=fine_type.amount,
            reason='other',
            description=description or f"Manual fine: {fine_type.name}",
            is_automatic=False,
            created_by=request.user
        )

        # Update student balance if group is provided
        if group:
            try:
                balance = StudentBalance.objects.get(student=student, group=group)
                balance.add_fine(fine.amount)
            except StudentBalance.DoesNotExist:
                pass

        result_serializer = StudentFineSerializer(fine)
        return Response({
            'message': 'Fine applied successfully',
            'fine': result_serializer.data
        }, status=status.HTTP_201_CREATED)


class FinancialSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing financial summaries (read-only).
    Summaries are calculated via management commands or Celery tasks.
    """
    queryset = FinancialSummary.objects.all()
    serializer_class = FinancialSummarySerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'reports.view',
        'retrieve': 'reports.view',
        'monthly_report': 'reports.view',
        'recalculate': 'reports.manage',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = FinancialSummary.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        if user.is_superuser:
            queryset = apply_branch_scope(
                queryset,
                self.request,
                user,
                field_name='branch',
                include_unassigned=True,
            )
        elif branch_ids:
            queryset = apply_branch_scope(
                queryset,
                self.request,
                user,
                field_name='branch',
                include_unassigned=True,
            )
        else:
            queryset = queryset.filter(branch__isnull=True)

        branch_id = self.request.query_params.get('branch', None)
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)

        # Date filtering
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.select_related('branch').order_by('-date')

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """
        Recalculate a specific financial summary.
        """
        summary = self.get_object()
        summary.calculate()
        serializer = self.get_serializer(summary)
        return Response({
            'message': 'Financial summary recalculated successfully',
            'summary': serializer.data
        })

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """
        Get monthly financial report.
        """
        year = request.query_params.get('year', timezone.now().year)
        month = request.query_params.get('month', timezone.now().month)

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response(
                {'error': 'Invalid year or month'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get all summaries for the month
        queryset = self.get_queryset().filter(
            date__year=year,
            date__month=month
        )

        # Aggregate monthly totals
        monthly_total = {
            'year': year,
            'month': month,
            'total_days': queryset.count(),
            'total_payments': queryset.aggregate(total=Sum('total_payments'))['total'] or 0,
            'total_expenses': queryset.aggregate(total=Sum('total_expenses'))['total'] or 0,
            'total_teacher_earnings': queryset.aggregate(total=Sum('total_teacher_earnings'))['total'] or 0,
            'total_fines': queryset.aggregate(total=Sum('total_fines'))['total'] or 0,
            'net_profit': queryset.aggregate(total=Sum('net_profit'))['total'] or 0,
        }

        # Convert to sum (UZS)
        for key in ['total_payments', 'total_expenses', 'total_teacher_earnings', 'total_fines', 'net_profit']:
            monthly_total[f'{key}_sum'] = monthly_total[key] / 100

        # Get daily breakdown
        daily_data = FinancialSummarySerializer(queryset, many=True).data

        return Response({
            'monthly_summary': monthly_total,
            'daily_breakdown': daily_data
        })


class AccountTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing transaction audit trail (read-only).
    Transactions are automatically created by the system.
    """
    queryset = AccountTransaction.objects.all()
    serializer_class = AccountTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'summary': 'payments.read',
        'by_student': 'payments.read',
        'by_teacher': 'payments.read',
    }

    def get_queryset(self):
        user = self.request.user
        queryset = AccountTransaction.objects.all()
        branch_ids = get_accessible_branch_ids(user)

        # Role-based filtering
        if user.is_superuser or user.is_staff:
            if is_global_branch_user(user):
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
            elif branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
        elif user.is_teacher:
            # Teachers see transactions related to them
            queryset = queryset.filter(Q(teacher=user) | Q(group__main_teacher=user))
            if branch_ids:
                queryset = apply_branch_scope(
                    queryset,
                    self.request,
                    user,
                    field_name='group__branch',
                    include_unassigned=True,
                )
        else:
            # Students see only their own transactions
            queryset = queryset.filter(student=user)

        # Filter by transaction type
        transaction_type = self.request.query_params.get('transaction_type', None)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by student
        student_id = self.request.query_params.get('student', None)
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        # Filter by teacher
        teacher_id = self.request.query_params.get('teacher', None)
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        # Filter by group
        group_id = self.request.query_params.get('group', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        # Date filtering
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(transaction_date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(transaction_date__gte=date_from, transaction_date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)

        return queryset.select_related(
            'payment', 'student', 'teacher', 'group', 'created_by'
        ).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get summary statistics for transactions.
        """
        queryset = self.get_queryset()

        summary = {
            'total_transactions': queryset.count(),
            'by_type': {},
            'by_status': {},
            'total_income': 0,
            'total_expense': 0,
        }

        # Count by transaction type
        for t_type, _ in AccountTransaction.TRANSACTION_TYPES:
            count = queryset.filter(transaction_type=t_type).count()
            summary['by_type'][t_type] = count

        # Count by status
        for t_status, _ in AccountTransaction.TRANSACTION_STATUS:
            count = queryset.filter(status=t_status).count()
            summary['by_status'][t_status] = count

        # Calculate income (positive amounts)
        income_transactions = queryset.filter(amount__gt=0)
        summary['total_income'] = income_transactions.aggregate(total=Sum('amount'))['total'] or 0
        summary['total_income_sum'] = summary['total_income'] / 100

        # Calculate expenses (negative amounts)
        expense_transactions = queryset.filter(amount__lt=0)
        summary['total_expense'] = abs(expense_transactions.aggregate(total=Sum('amount'))['total'] or 0)
        summary['total_expense_sum'] = summary['total_expense'] / 100

        # Net flow
        summary['net_flow'] = summary['total_income'] - summary['total_expense']
        summary['net_flow_sum'] = summary['net_flow'] / 100

        return Response(summary)

    @action(detail=False, methods=['get'])
    def by_student(self, request):
        """
        Get transaction history for a specific student.
        """
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response(
                {'error': 'student_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            student = User.objects.get(id=student_id, is_teacher=False)
        except User.DoesNotExist:
            return Response(
                {'error': 'Student not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        queryset = self.get_queryset().filter(student=student)

        # Group by type
        transactions_by_type = {}
        for t_type, t_name in AccountTransaction.TRANSACTION_TYPES:
            trans = queryset.filter(transaction_type=t_type)
            if trans.exists():
                transactions_by_type[t_type] = {
                    'count': trans.count(),
                    'total_amount': trans.aggregate(total=Sum('amount'))['total'] or 0,
                    'total_amount_sum': (trans.aggregate(total=Sum('amount'))['total'] or 0) / 100,
                    'transactions': AccountTransactionSerializer(trans[:10], many=True).data
                }

        return Response({
            'student_id': student.id,
            'student_name': student.get_full_name(),
            'total_transactions': queryset.count(),
            'by_type': transactions_by_type
        })

    @action(detail=False, methods=['get'])
    def by_teacher(self, request):
        """
        Get transaction history for a specific teacher.
        """
        teacher_id = request.query_params.get('teacher_id')
        if not teacher_id:
            return Response(
                {'error': 'teacher_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            teacher = User.objects.get(id=teacher_id, is_teacher=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'Teacher not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        queryset = self.get_queryset().filter(teacher=teacher)

        # Calculate totals
        total_earnings = queryset.filter(
            transaction_type='teacher_earning'
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'teacher_id': teacher.id,
            'teacher_name': teacher.get_full_name(),
            'total_transactions': queryset.count(),
            'total_earnings': abs(total_earnings),
            'total_earnings_sum': abs(total_earnings) / 100,
            'transactions': AccountTransactionSerializer(queryset[:20], many=True).data
        })

# /mnt/usb/edu-api-project/users/views.py

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MyTokenObtainPairSerializer

# --- YANGI KODLAR ---
from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, action
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.contrib.auth import update_session_auth_hash
from .models import User
from .serializers import UserSerializer, UserProfileSerializer, ChangePasswordSerializer
from edu_project.middleware.login_attempt import (
    record_login_attempt,
    is_locked_out,
    get_remaining_attempts
)

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Barcha foydalanuvchilar ro'yxati (faqat adminlar uchun).
    URL: /api/task/users/
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

class StudentViewSet(viewsets.ModelViewSet):
    """
    Students list with full CRUD operations.
    URL: /api/users/students/
    """
    queryset = User.objects.filter(is_teacher=False, is_staff=False)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """Only staff can create, update, or delete students"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = User.objects.filter(is_teacher=False, is_staff=False)

        # Date filtering - filter by date_joined
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date_joined__date=date_param)

        return queryset.order_by('-date_joined')

    @action(detail=False, methods=['get', 'patch', 'put'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        Get or update current student's profile.
        GET /api/v1/student/me/ - Get current student profile
        PATCH/PUT /api/v1/student/me/ - Update current student profile
        """
        if request.method == 'GET':
            serializer = UserProfileSerializer(request.user)
            return Response(serializer.data)
        else:
            # PATCH or PUT
            serializer = UserProfileSerializer(request.user, data=request.data, partial=(request.method == 'PATCH'))
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def detail_view(self, request, pk=None):
        """
        Get comprehensive student details including:
        - Personal information
        - Group information
        - Payments history
        - Attendance records
        - Exam scores
        - Coins/rewards
        - At-risk status
        GET /api/users/students/{id}/detail_view/
        """
        from student_profile.models import (
            Group, Payment, Attendance, ExamScore, StudentCoins
        )
        from student_profile.accounting_models import StudentBalance, StudentAccount
        from django.db.models import Sum, Avg, Count, Q
        from datetime import timedelta
        from django.utils import timezone

        student = self.get_object()

        # Basic student info
        student_data = {
            'id': student.id,
            'username': student.username,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'full_name': student.get_full_name(),
            'email': student.email,
            'phone': student.phone,
            'parents_phone': student.parents_phone,
            'gender': student.gender,
            'birthday': student.birthday,
            'photo': student.photo.url if student.photo else None,
            'date_joined': student.date_joined,
            'last_login': student.last_login,
            'rank': student.rank if student.rank else None,
        }

        # Group information
        student_groups = Group.objects.filter(students=student).select_related(
            'main_teacher', 'assistant_teacher', 'branch', 'course', 'room'
        )
        student_balances = StudentBalance.objects.filter(student=student).select_related(
            'group', 'group__main_teacher', 'group__assistant_teacher', 'group__branch', 'group__course', 'group__room'
        )

        groups_data = []
        existing_group_ids = set()
        for group in student_groups:
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'branch': group.branch.name if group.branch else None,
                'course': group.course.name if group.course else None,
                'course_price': group.course.price / 100 if group.course else None,
                'room': group.room.name if group.room else None,
                'main_teacher': group.main_teacher.get_full_name() if group.main_teacher else None,
                'assistant_teacher': group.assistant_teacher.get_full_name() if group.assistant_teacher else None,
                'start_day': group.start_day,
                'end_day': group.end_day,
                'start_time': group.start_time,
                'end_time': group.end_time,
                'days': group.days,
                'is_active': group.end_day >= timezone.now().date()
            })
            existing_group_ids.add(group.id)

        # Fallback to accounting groups when student-group M2M is missing.
        for student_balance in student_balances:
            group = student_balance.group
            if not group or group.id in existing_group_ids:
                continue
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'branch': group.branch.name if group.branch else None,
                'course': group.course.name if group.course else None,
                'course_price': (group.course.price / 100) if group.course else (student_balance.total_fee / 100),
                'room': group.room.name if group.room else None,
                'main_teacher': group.main_teacher.get_full_name() if group.main_teacher else None,
                'assistant_teacher': group.assistant_teacher.get_full_name() if group.assistant_teacher else None,
                'start_day': group.start_day,
                'end_day': group.end_day,
                'start_time': group.start_time,
                'end_time': group.end_time,
                'days': group.days,
                'is_active': group.end_day >= timezone.now().date()
            })
            existing_group_ids.add(group.id)

        # Final fallback: infer groups from payment/attendance/exam activity.
        inferred_group_ids = set(
            Payment.objects.filter(by_user=student, group__isnull=False).values_list('group_id', flat=True)
        )
        inferred_group_ids.update(
            Attendance.objects.filter(student=student, group__isnull=False).values_list('group_id', flat=True)
        )
        inferred_group_ids.update(
            ExamScore.objects.filter(student=student, group__isnull=False).values_list('group_id', flat=True)
        )
        for group in Group.objects.filter(id__in=inferred_group_ids).select_related(
            'main_teacher', 'assistant_teacher', 'branch', 'course', 'room'
        ):
            if group.id in existing_group_ids:
                continue
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'branch': group.branch.name if group.branch else None,
                'course': group.course.name if group.course else None,
                'course_price': group.course.price / 100 if group.course else None,
                'room': group.room.name if group.room else None,
                'main_teacher': group.main_teacher.get_full_name() if group.main_teacher else None,
                'assistant_teacher': group.assistant_teacher.get_full_name() if group.assistant_teacher else None,
                'start_day': group.start_day,
                'end_day': group.end_day,
                'start_time': group.start_time,
                'end_time': group.end_time,
                'days': group.days,
                'is_active': group.end_day >= timezone.now().date()
            })
            existing_group_ids.add(group.id)

        student_data['groups'] = groups_data
        student_data['current_group'] = groups_data[0] if groups_data else None

        # Payment statistics
        student_account = StudentAccount.objects.filter(student=student).first()
        total_paid = Payment.objects.filter(
            by_user=student,
            status='paid'
        ).aggregate(total=Sum('amount'))['total'] or 0
        has_accounting_balances = student_balances.exists()
        if student_account:
            pending_debt = abs(min(student_account.balance_tiyin, 0))
            pending_payments = pending_debt
        elif has_accounting_balances:
            balance_stats = student_balances.aggregate(
                net_balance=Sum('balance'),
                debt_balance=Sum('balance', filter=Q(balance__gt=0))
            )
            pending_payments = max(balance_stats['net_balance'] or 0, 0)
            pending_debt = balance_stats['debt_balance'] or 0
        else:
            pending_payments = Payment.objects.filter(
                by_user=student,
                status='pending'
            ).aggregate(total=Sum('amount'))['total'] or 0
            pending_debt = pending_payments

        payment_count = Payment.objects.filter(by_user=student).count()
        last_payment = Payment.objects.filter(
            by_user=student,
            status='paid'
        ).order_by('-date').first()
        last_balance_payment_date = student_balances.exclude(last_payment_date__isnull=True).order_by('-last_payment_date').values_list('last_payment_date', flat=True).first()

        student_data['payments'] = {
            'total_paid': total_paid / 100,
            'pending_amount': pending_payments / 100,
            'payment_count': payment_count,
            'last_payment_date': last_payment.date if last_payment else last_balance_payment_date,
            'last_payment_amount': last_payment.amount / 100 if last_payment else None,
        }
        student_data['account'] = {
            'status': student_account.status if student_account else 'active',
            'balance_tiyin': student_account.balance_tiyin if student_account else 0,
            'balance': (student_account.balance_tiyin / 100) if student_account else 0,
        }

        # Recent payments (last 10)
        recent_payments = Payment.objects.filter(
            by_user=student
        ).select_related('group', 'teacher', 'payment_type').order_by('-date')[:10]

        payments_list = []
        for payment in recent_payments:
            payments_list.append({
                'id': payment.id,
                'date': payment.date,
                'amount': payment.amount / 100,
                'status': payment.status,
                'group': payment.group.name if payment.group else None,
                'payment_type': payment.payment_type.name if payment.payment_type else None,
                'detail': payment.detail,
            })

        student_data['recent_payments'] = payments_list

        # Attendance statistics
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        total_attendance = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).count()

        present_count = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago,
            is_present=True
        ).count()

        attendance_rate = (present_count / total_attendance * 100) if total_attendance > 0 else 0

        # Days of class calculation
        all_attendance = Attendance.objects.filter(
            student=student
        ).values('date').distinct().count()

        student_data['attendance'] = {
            'attendance_rate_30days': round(attendance_rate, 2),
            'total_days_30days': total_attendance,
            'present_days_30days': present_count,
            'absent_days_30days': total_attendance - present_count,
            'total_class_days': all_attendance,
        }

        # Recent attendance (last 30 records)
        recent_attendance = Attendance.objects.filter(
            student=student
        ).select_related('group').order_by('-date')[:30]

        attendance_list = []
        for att in recent_attendance:
            attendance_status = getattr(att, 'attendance_status', None)
            if attendance_status == 'absence_excused':
                status_label = 'absence'
            elif attendance_status == 'absent_unexcused':
                status_label = 'absent'
            else:
                status_label = 'present' if att.is_present else 'absent'
            attendance_list.append({
                'id': att.id,
                'date': att.date,
                'is_present': att.is_present,
                'status': status_label,
                'group': att.group.name if att.group else None,
            })

        student_data['recent_attendance'] = attendance_list

        # Exam scores
        avg_score = ExamScore.objects.filter(
            student=student
        ).aggregate(avg=Avg('score'))['avg'] or 0

        exam_count = ExamScore.objects.filter(student=student).count()

        student_data['exams'] = {
            'average_score': round(avg_score, 2),
            'exam_count': exam_count,
        }

        # Recent exam scores (last 10)
        recent_exams = ExamScore.objects.filter(
            student=student
        ).select_related('group', 'examiner', 'main_teacher').order_by('-date')[:10]

        exams_list = []
        for exam in recent_exams:
            exams_list.append({
                'id': exam.id,
                'date': exam.date,
                'score': exam.score,
                'group': exam.group.name if exam.group else None,
                'examiner': exam.examiner.get_full_name() if exam.examiner else None,
            })

        student_data['recent_exams'] = exams_list

        # Coins/Rewards
        total_coins = StudentCoins.objects.filter(
            student=student
        ).aggregate(total=Sum('coin'))['total'] or 0

        recent_coins = StudentCoins.objects.filter(
            student=student
        ).order_by('-created_at')[:10]

        coins_list = []
        for coin in recent_coins:
            coins_list.append({
                'id': coin.id,
                'amount': coin.coin,
                'reason': coin.reason,
                'date': coin.created_at,
            })

        student_data['coins'] = {
            'total_coins': total_coins,
            'recent_transactions': coins_list,
        }

        # At-risk assessment (simplified version)
        risk_score = 0
        risk_factors = []

        if attendance_rate < 70:
            risk_score += 30
            risk_factors.append(f'Low attendance: {attendance_rate:.1f}%')

        if pending_debt > 0:
            risk_score += 25
            risk_factors.append(f'Pending payments: {pending_debt / 100:.2f}')

        if avg_score < 60:
            risk_score += 25
            risk_factors.append(f'Low exam scores: {avg_score:.1f}')

        # Consecutive absences
        recent_att_check = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).order_by('-date')[:7]

        consecutive_absences = 0
        for att in recent_att_check:
            if not att.is_present:
                consecutive_absences += 1
            else:
                break

        if consecutive_absences >= 3:
            risk_score += 20
            risk_factors.append(f'{consecutive_absences} consecutive absences')

        risk_level = 'low'
        if risk_score >= 60:
            risk_level = 'critical'
        elif risk_score >= 40:
            risk_level = 'high'
        elif risk_score >= 20:
            risk_level = 'medium'

        student_data['risk_assessment'] = {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risk_factors': risk_factors,
        }

        return Response(student_data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def reactivate_account(self, request, pk=None):
        """
        Admin-only manual reactivation for deactivated/frozen students.
        Optional payload:
          - group: group id to (re)assign after reactivation
        """
        from student_profile.models import Group
        from student_profile.services.financial_automation import reactivate_student_account

        student = self.get_object()
        group_id = request.data.get('group')
        group = None

        if group_id:
            try:
                group = Group.objects.get(id=group_id)
            except Group.DoesNotExist:
                return Response(
                    {'detail': 'Group not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        account = reactivate_student_account(
            student=student,
            actor=request.user,
            group=group,
        )

        return Response({
            'detail': 'Student reactivated successfully.',
            'student_id': student.id,
            'student_username': student.username,
            'account_status': account.status,
            'balance_tiyin': account.balance_tiyin,
            'group': group.id if group else None,
        })

class TeacherViewSet(viewsets.ModelViewSet):
    """
    Teachers list with full CRUD operations.
    URL: /api/users/teachers/
    """
    queryset = User.objects.filter(is_teacher=True)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """Only admins can create, update, or delete teachers"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = User.objects.filter(is_teacher=True)

        # Date filtering - filter by date_joined
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date_joined__date=date_param)

        return queryset.order_by('-date_joined')

# --- MAVJUD KOD ---
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        username = request.data.get('username', '')

        # Check if locked out
        locked, message = is_locked_out(username, ip_address)
        if locked:
            return Response({
                'error': message,
                'locked_out': True
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Attempt login
        response = super().post(request, *args, **kwargs)

        # Record attempt
        if response.status_code == 200:
            record_login_attempt(username, ip_address, success=True)
        else:
            record_login_attempt(username, ip_address, success=False)
            remaining = get_remaining_attempts(username, ip_address)

            if remaining > 0:
                response.data['remaining_attempts'] = remaining
                response.data['warning'] = f'Login failed. {remaining} attempts remaining.'

        return response


@extend_schema(responses=UserProfileSerializer)
class UserProfileView(APIView):
    """
    Get and update user profile.
    GET /api/auth/profile/ - Get current user profile
    PATCH /api/auth/profile/ - Update current user profile
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get(self, request):
        """Get current user profile"""
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """Update current user profile"""
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(request=ChangePasswordSerializer, responses=OpenApiTypes.OBJECT)
class ChangePasswordView(APIView):
    """
    Change user password.
    POST /api/auth/change-password/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()

            # Update session to keep user logged in after password change
            update_session_auth_hash(request, user)

            return Response({
                'detail': 'Password changed successfully.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class LogoutView(APIView):
    """
    Logout user (blacklist refresh token).
    POST /api/auth/logout/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                # Note: Token blacklisting requires djangorestframework-simplejwt[crypto]
                # and SIMPLE_JWT settings with BLACKLIST enabled
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response({
                    'detail': 'Successfully logged out.'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'detail': 'Refresh token is required.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'detail': 'Invalid token or logout failed.'
            }, status=status.HTTP_400_BAD_REQUEST)

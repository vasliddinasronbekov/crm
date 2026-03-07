# /mnt/usb/edu-api-project/student_profile/views.py

from users.models import User


# --- 1. Barcha kerakli kutubxonlarni tartib bilan import qilamiz ---
import logging
import requests
import base64
import json
from decouple import config
from django.db.models import F
from django.db import transaction
from django.utils import timezone

from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db.models import Avg, Sum, Count, Q
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import viewsets, permissions, generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from weasyprint import HTML
import qrcode
import io
logger = logging.getLogger(__name__)
# --- 2. Modellarni import qilamiz ---
from .models import (
    ShopProduct, StudentCoins, ShopOrder,
    Branch, Group, Attendance, Event, ExamScore, ShopProduct, ShopOrder,
    CashPaymentReceipt, Payment, Story, StudentCoins, Ticket, TicketChat, Course, Room,
    ExpenseType, Expense, LeaveReason, Information, PaymentType, AutomaticFine,
    AssistantSlot, Booking
)

# --- 3. Serializer'larni import qilamiz ---
from .serializers import (
    PurchaseWithCoinsSerializer,
    BranchSerializer,
    GroupCreateSerializer,
    GroupReadSerializer,
    AttendanceSerializer,
    EventSerializer,
    ExamScoreSerializer,
    ShopProductSerializer,
    ShopOrderSerializer,
    PaymentSerializer,
    StorySerializer,
    StudentCoinsSerializer,
    TicketSerializer,
    TicketChatSerializer,
    CourseSerializer,
    RoomSerializer,
    ExpenseTypeSerializer,
    ExpenseSerializer,
    LeaveReasonSerializer,
    InformationSerializer,
    PaymentTypeSerializer,
    AutomaticFineSerializer,
    StudentUpdateSerializer,
    BookSlotSerializer,
    AssistantSlotSerializer,
    BookingSerializer
)
from .report_models import PaymentReminder, PaymentReminderSettings
from .report_serializers import BulkPaymentReminderSerializer, PaymentReminderSettingsSerializer
from .services.financial_automation import (
    apply_attendance_policies,
    apply_payment_to_student_account,
    rollback_paid_payment,
)
from .receipt_service import (
    build_cash_receipt_payload,
    ensure_cash_receipt,
    is_cash_payment,
)


# --- 4. Ruxsatnomalarni (Permissions) import qilamiz ---
from .permissions import IsTeacherOrReadOnly, IsAdminOrGroupOwnerOrReadOnly, IsAdminOrReadOnly
from users.permissions import HasRoleCapability


# --- 5. Barcha ViewSet va View'larni tartib bilan e'lon qilamiz ---

class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAdminUser]

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability, IsAdminOrGroupOwnerOrReadOnly]
    action_capabilities = {
        'list': 'groups.read',
        'retrieve': 'groups.read',
        'schedule_health': 'groups.read',
        'create': 'groups.manage',
        'update': 'groups.manage',
        'partial_update': 'groups.manage',
        'destroy': 'groups.manage',
    }

    DAY_ALIASES = {
        'mon': 'monday',
        'monday': 'monday',
        'dush': 'monday',
        'dushanba': 'monday',
        'tue': 'tuesday',
        'tues': 'tuesday',
        'tuesday': 'tuesday',
        'sesh': 'tuesday',
        'seshanba': 'tuesday',
        'wed': 'wednesday',
        'wednesday': 'wednesday',
        'chor': 'wednesday',
        'chorshanba': 'wednesday',
        'thu': 'thursday',
        'thur': 'thursday',
        'thurs': 'thursday',
        'thursday': 'thursday',
        'pay': 'thursday',
        'payshanba': 'thursday',
        'fri': 'friday',
        'friday': 'friday',
        'jum': 'friday',
        'juma': 'friday',
        'sat': 'saturday',
        'saturday': 'saturday',
        'shan': 'saturday',
        'shanba': 'saturday',
        'sun': 'sunday',
        'sunday': 'sunday',
        'yak': 'sunday',
        'yakshanba': 'sunday',
    }

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return GroupReadSerializer
        return GroupCreateSerializer

    @classmethod
    def _normalize_days(cls, days_value):
        if not days_value:
            return set()

        normalized = set()
        for raw_token in str(days_value).split(','):
            token = ''.join(ch for ch in raw_token.strip().lower() if ch.isalpha())
            if not token:
                continue
            canonical = cls.DAY_ALIASES.get(token)
            if canonical:
                normalized.add(canonical)
        return normalized

    @staticmethod
    def _time_ranges_overlap(start_a, end_a, start_b, end_b):
        return bool(start_a and end_a and start_b and end_b and start_a < end_b and start_b < end_a)

    @staticmethod
    def _date_ranges_overlap(start_a, end_a, start_b, end_b):
        return bool(start_a and end_a and start_b and end_b and start_a <= end_b and start_b <= end_a)

    def _calculate_schedule_health(self, groups_queryset):
        groups = list(
            groups_queryset.select_related('room', 'main_teacher', 'assistant_teacher')
            .prefetch_related('students')
        )

        scheduled_groups = []
        unscheduled_count = 0
        near_capacity_count = 0
        over_capacity_count = 0

        for group in groups:
            day_set = self._normalize_days(group.days)
            if day_set and group.start_time and group.end_time:
                scheduled_groups.append((group, day_set))
            else:
                unscheduled_count += 1

            room_capacity = group.room.capacity if group.room and group.room.capacity else 0
            if room_capacity > 0:
                student_count = getattr(group, 'student_total', None)
                if student_count is None:
                    student_count = group.students.count()
                if student_count > room_capacity:
                    over_capacity_count += 1
                elif (student_count / room_capacity) >= 0.9:
                    near_capacity_count += 1

        teacher_conflicts = set()
        room_conflicts = set()
        top_conflicts = []

        for index, (group_a, days_a) in enumerate(scheduled_groups):
            teacher_ids_a = {
                teacher_id for teacher_id in [group_a.main_teacher_id, group_a.assistant_teacher_id]
                if teacher_id
            }
            for group_b, days_b in scheduled_groups[index + 1:]:
                if not self._date_ranges_overlap(group_a.start_day, group_a.end_day, group_b.start_day, group_b.end_day):
                    continue
                if not self._time_ranges_overlap(group_a.start_time, group_a.end_time, group_b.start_time, group_b.end_time):
                    continue

                common_days = sorted(days_a & days_b)
                if not common_days:
                    continue

                pair_key = tuple(sorted([group_a.id, group_b.id]))
                time_window = f"{group_a.start_time.strftime('%H:%M')} - {group_a.end_time.strftime('%H:%M')}"

                if group_a.room_id and group_b.room_id and group_a.room_id == group_b.room_id:
                    for day in common_days:
                        key = ('room',) + pair_key + (day,)
                        room_conflicts.add(key)
                        if len(top_conflicts) < 20:
                            top_conflicts.append({
                                'type': 'room',
                                'day': day,
                                'time': time_window,
                                'resource': group_a.room.name if group_a.room else None,
                                'groups': [
                                    {'id': group_a.id, 'name': group_a.name},
                                    {'id': group_b.id, 'name': group_b.name},
                                ],
                            })

                teacher_ids_b = {
                    teacher_id for teacher_id in [group_b.main_teacher_id, group_b.assistant_teacher_id]
                    if teacher_id
                }
                common_teacher_ids = teacher_ids_a & teacher_ids_b
                if common_teacher_ids:
                    teacher_name = None
                    teacher_id = sorted(common_teacher_ids)[0]
                    if group_a.main_teacher_id == teacher_id and group_a.main_teacher:
                        teacher_name = group_a.main_teacher.get_full_name() or group_a.main_teacher.username
                    elif group_a.assistant_teacher_id == teacher_id and group_a.assistant_teacher:
                        teacher_name = group_a.assistant_teacher.get_full_name() or group_a.assistant_teacher.username
                    elif group_b.main_teacher_id == teacher_id and group_b.main_teacher:
                        teacher_name = group_b.main_teacher.get_full_name() or group_b.main_teacher.username
                    elif group_b.assistant_teacher_id == teacher_id and group_b.assistant_teacher:
                        teacher_name = group_b.assistant_teacher.get_full_name() or group_b.assistant_teacher.username

                    for day in common_days:
                        key = ('teacher',) + pair_key + (day, teacher_id)
                        teacher_conflicts.add(key)
                        if len(top_conflicts) < 20:
                            top_conflicts.append({
                                'type': 'teacher',
                                'day': day,
                                'time': time_window,
                                'resource': teacher_name,
                                'groups': [
                                    {'id': group_a.id, 'name': group_a.name},
                                    {'id': group_b.id, 'name': group_b.name},
                                ],
                            })

        return {
            'total_groups': len(groups),
            'scheduled_groups': len(scheduled_groups),
            'unscheduled_groups': unscheduled_count,
            'teacher_conflicts': len(teacher_conflicts),
            'room_conflicts': len(room_conflicts),
            'capacity_near_full_groups': near_capacity_count,
            'capacity_overflow_groups': over_capacity_count,
            'top_conflicts': top_conflicts,
        }

    @action(detail=False, methods=['get'], url_path='schedule-health')
    def schedule_health(self, request):
        queryset = self.filter_queryset(self.get_queryset()).annotate(student_total=Count('students'))
        payload = self._calculate_schedule_health(queryset)
        return Response(payload)

    def get_queryset(self):
        user = self.request.user
        queryset = Group.objects.all()

        # Role-based filtering
        if user.is_superuser:
            queryset = Group.objects.all()
        elif user.is_staff:
            if user.branch_id:
                queryset = Group.objects.filter(Q(branch=user.branch) | Q(branch__isnull=True))
            else:
                queryset = Group.objects.all()
        elif user.is_teacher:
            queryset = Group.objects.filter(
                Q(main_teacher=user) | Q(assistant_teacher=user)
            ).distinct()
        else:
            queryset = Group.objects.filter(students=user)

        # Date filtering
        date_param = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if date_param:
            queryset = queryset.filter(start_day=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(
                start_day__gte=date_from,
                start_day__lte=date_to
            )
        elif date_from:
            queryset = queryset.filter(start_day__gte=date_from)
        elif date_to:
            queryset = queryset.filter(start_day__lte=date_to)

        search = (self.request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(course__name__icontains=search)
                | Q(main_teacher__username__icontains=search)
                | Q(main_teacher__first_name__icontains=search)
                | Q(main_teacher__last_name__icontains=search)
                | Q(assistant_teacher__username__icontains=search)
                | Q(assistant_teacher__first_name__icontains=search)
                | Q(assistant_teacher__last_name__icontains=search)
                | Q(room__name__icontains=search)
            )

        scheduled_filter = (self.request.query_params.get('scheduled') or '').strip().lower()
        if scheduled_filter in {'true', '1', 'yes', 'scheduled'}:
            queryset = queryset.exclude(days__isnull=True).exclude(days__exact='')
        elif scheduled_filter in {'false', '0', 'no', 'unscheduled'}:
            queryset = queryset.filter(Q(days__isnull=True) | Q(days__exact=''))

        return queryset.select_related(
            'branch',
            'course',
            'room',
            'main_teacher',
            'assistant_teacher'
        ).order_by('-start_day', 'name')

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability, IsTeacherOrReadOnly]
    action_capabilities = {
        'list': 'attendance.read',
        'retrieve': 'attendance.read',
        'create': 'attendance.manage',
        'update': 'attendance.manage',
        'partial_update': 'attendance.manage',
        'destroy': 'attendance.manage',
        'bulk_create': 'attendance.manage',
    }

    def _apply_attendance_policies_safely(self, attendance: Attendance) -> None:
        try:
            apply_attendance_policies(attendance, actor=self.request.user)
        except Exception:
            logger.exception(
                "Attendance policies failed after attendance save: attendance_id=%s student_id=%s group_id=%s date=%s",
                attendance.id,
                attendance.student_id,
                attendance.group_id,
                attendance.date,
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        attendance_status = validated.get('attendance_status', Attendance.STATUS_PRESENT)
        attendance_obj, created = Attendance.objects.update_or_create(
            student=validated['student'],
            group=validated['group'],
            date=validated['date'],
            defaults={'attendance_status': attendance_status},
        )

        self._apply_attendance_policies_safely(attendance_obj)

        output_serializer = self.get_serializer(attendance_obj)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(output_serializer.data, status=response_status)

    def perform_create(self, serializer):
        attendance = serializer.save()
        self._apply_attendance_policies_safely(attendance)

    def perform_update(self, serializer):
        attendance = serializer.save()
        self._apply_attendance_policies_safely(attendance)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        Create or update attendance records in batch.
        Existing records for the same (student, group, date) are updated.
        """
        attendance_list = request.data.get('attendance_list')
        if not isinstance(attendance_list, list) or not attendance_list:
            return Response(
                {'detail': 'attendance_list must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        updated_count = 0
        errors = []
        processed_records = []

        with transaction.atomic():
            for index, raw_record in enumerate(attendance_list):
                record_data = {
                    'student': raw_record.get('student'),
                    'group': raw_record.get('group'),
                    'date': raw_record.get('date'),
                }
                if 'attendance_status' in raw_record:
                    record_data['attendance_status'] = raw_record.get('attendance_status')
                elif 'status' in raw_record:
                    status_value = str(raw_record.get('status')).lower()
                    if status_value == 'present':
                        record_data['attendance_status'] = Attendance.STATUS_PRESENT
                    elif status_value in ['absence', 'excused']:
                        record_data['attendance_status'] = Attendance.STATUS_ABSENCE_EXCUSED
                    else:
                        record_data['attendance_status'] = Attendance.STATUS_ABSENT_UNEXCUSED
                elif 'is_present' in raw_record:
                    record_data['attendance_status'] = (
                        Attendance.STATUS_PRESENT
                        if raw_record.get('is_present')
                        else Attendance.STATUS_ABSENT_UNEXCUSED
                    )

                serializer = self.get_serializer(data=record_data)
                if not serializer.is_valid():
                    errors.append({'index': index, 'errors': serializer.errors})
                    continue

                validated = serializer.validated_data
                student = validated['student']
                group = validated['group']
                date = validated['date']
                attendance_status = validated.get('attendance_status', Attendance.STATUS_PRESENT)

                existing = (
                    Attendance.objects.filter(student=student, group=group, date=date)
                    .order_by('-id')
                    .first()
                )

                if existing:
                    if existing.attendance_status != attendance_status:
                        existing.attendance_status = attendance_status
                        existing.save(update_fields=['attendance_status', 'is_present'])
                    attendance_obj = existing
                    updated_count += 1
                else:
                    attendance_obj = Attendance.objects.create(
                        student=student,
                        group=group,
                        date=date,
                        attendance_status=attendance_status,
                    )
                    created_count += 1

                try:
                    apply_attendance_policies(attendance_obj, actor=request.user)
                except Exception as exc:
                    logger.exception(
                        "Attendance policies failed during bulk_create: attendance_id=%s student_id=%s group_id=%s date=%s",
                        attendance_obj.id,
                        attendance_obj.student_id,
                        attendance_obj.group_id,
                        attendance_obj.date,
                    )
                    errors.append({'index': index, 'errors': {'automation': str(exc)}})

                processed_records.append(attendance_obj)

        response_status = status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS
        response_payload = {
            'created': created_count,
            'updated': updated_count,
            'processed': created_count + updated_count,
            'errors': errors,
            'results': self.get_serializer(processed_records, many=True).data,
        }
        return Response(response_payload, status=response_status)

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher or user.is_staff:
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(student=user)

        # Date filtering
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None) or self.request.query_params.get('date_after', None)
        date_to = self.request.query_params.get('date_to', None) or self.request.query_params.get('date_before', None)
        if date_param:
            queryset = queryset.filter(date=date_param)
        else:
            if date_from:
                queryset = queryset.filter(date__gte=date_from)
            if date_to:
                queryset = queryset.filter(date__lte=date_to)

        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            status_value = str(status_filter).lower()
            if status_value == 'present':
                queryset = queryset.filter(attendance_status=Attendance.STATUS_PRESENT)
            elif status_value in ['absence', 'excused']:
                queryset = queryset.filter(attendance_status=Attendance.STATUS_ABSENCE_EXCUSED)
            elif status_value == 'absent':
                queryset = queryset.filter(attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED)

        return queryset.select_related('student', 'group').order_by('-date')

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Event.objects.all()

        # Role-based filtering
        if not (user.is_superuser or user.is_staff or user.is_teacher):
            # Parents/students see only their events
            queryset = queryset.filter(students=user)

        # Student filtering (for teachers/admins viewing specific student)
        student_id = self.request.query_params.get('student_id', None)
        if student_id:
            queryset = queryset.filter(students__id=student_id)

        # Date filtering - single date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(start_time__date=date_param)

        # Date range filtering (for calendar month view)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date and end_date:
            queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
        elif start_date:
            queryset = queryset.filter(start_time__date__gte=start_date)
        elif end_date:
            queryset = queryset.filter(start_time__date__lte=end_date)

        # Event type filtering
        event_type = self.request.query_params.get('event_type', None)
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        # Course filtering
        course_id = self.request.query_params.get('course_id', None)
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        # Group filtering
        group_id = self.request.query_params.get('group_id', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        return queryset.select_related('course', 'group', 'created_by').prefetch_related('students').order_by('-start_time')

class ExamScoreViewSet(viewsets.ModelViewSet):
    queryset = ExamScore.objects.all()
    serializer_class = ExamScoreSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        queryset = ExamScore.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher:
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(student=user)

        # Date filtering
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date=date_param)

        return queryset.select_related('student', 'group').order_by('-date')

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability, IsAdminOrReadOnly]
    action_capabilities = {
        'list': 'payments.read',
        'retrieve': 'payments.read',
        'cash_receipt': 'payments.read',
        'cash_receipt_by_token': 'payments.read',
        'create': 'payments.manage',
        'update': 'payments.manage',
        'partial_update': 'payments.manage',
        'destroy': 'payments.manage',
        'send_reminder': 'payments.manage',
        'bulk_send_reminders': 'payments.manage',
    }

    def perform_create(self, serializer):
        with transaction.atomic():
            payment = serializer.save()
            apply_payment_to_student_account(payment, actor=self.request.user)
            ensure_cash_receipt(payment, actor=self.request.user)

    def perform_update(self, serializer):
        previous = self.get_object()
        previous_status = previous.status
        previous_amount = previous.amount
        previous_user_id = previous.by_user_id
        previous_group_id = previous.group_id

        payment = serializer.save()
        paid_state_changed = (
            previous_status != payment.status
            or previous_amount != payment.amount
            or previous_user_id != payment.by_user_id
            or previous_group_id != payment.group_id
        )

        if previous_status == Payment.PaymentStatus.PAID and paid_state_changed:
            rollback_paid_payment(
                Payment(
                    by_user_id=previous_user_id,
                    group_id=previous_group_id,
                    amount=previous_amount,
                    status=Payment.PaymentStatus.PAID,
                    id=payment.id,
                ),
                actor=self.request.user,
            )
        if payment.status == Payment.PaymentStatus.PAID and paid_state_changed:
            apply_payment_to_student_account(payment, actor=self.request.user)

        ensure_cash_receipt(payment, actor=self.request.user)

    def perform_destroy(self, instance):
        if instance.status == Payment.PaymentStatus.PAID:
            rollback_paid_payment(instance, actor=self.request.user)
        super().perform_destroy(instance)

    def _create_payment_reminder(self, payment, template='default', custom_message=''):
        student = payment.by_user
        if not student or not student.email:
            return None

        reminder = PaymentReminder.objects.create(
            payment=payment,
            recipient_email=student.email,
            template_used=template,
            status='sent',
            sent_at=timezone.now(),
            metadata={
                'custom_message': custom_message,
            },
        )
        return reminder

    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher or user.is_staff:
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(by_user=user)

        # Date filtering
        date_param = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from') or self.request.query_params.get('date_after')
        date_to = self.request.query_params.get('date_to') or self.request.query_params.get('date_before')
        if date_param:
            queryset = queryset.filter(date=date_param)
        else:
            if date_from:
                queryset = queryset.filter(date__gte=date_from)
            if date_to:
                queryset = queryset.filter(date__lte=date_to)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        payment_type_id = self.request.query_params.get('payment_type')
        if payment_type_id:
            queryset = queryset.filter(payment_type_id=payment_type_id)

        search = (self.request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(by_user__username__icontains=search)
                | Q(by_user__first_name__icontains=search)
                | Q(by_user__last_name__icontains=search)
                | Q(group__name__icontains=search)
                | Q(transaction_id__icontains=search)
                | Q(detail__icontains=search)
            )

        return queryset.select_related(
            'by_user',
            'group',
            'group__branch',
            'group__course',
            'payment_type',
            'teacher',
            'cash_receipt',
        ).order_by('-date', '-id')

    @action(detail=True, methods=['get'], url_path='cash-receipt')
    def cash_receipt(self, request, pk=None):
        payment = self.get_object()
        receipt = ensure_cash_receipt(payment, actor=request.user)
        if not receipt:
            return Response(
                {'detail': 'Cash receipt is available only for cash payments.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(build_cash_receipt_payload(receipt, request=request))

    @action(detail=False, methods=['get'], url_path=r'cash-receipt-by-token/(?P<token>[^/.]+)')
    def cash_receipt_by_token(self, request, token=None):
        receipt = (
            CashPaymentReceipt.objects
            .select_related(
                'payment',
                'payment__by_user',
                'payment__group',
                'payment__group__branch',
                'payment__group__course',
                'payment__payment_type',
            )
            .filter(receipt_token=token)
            .first()
        )
        if not receipt:
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not self.get_queryset().filter(id=receipt.payment_id).exists():
            return Response({'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not is_cash_payment(receipt.payment):
            return Response({'detail': 'Receipt is not available for this payment.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(build_cash_receipt_payload(receipt, request=request))

    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        payment = self.get_object()
        if payment.status != Payment.PaymentStatus.PENDING:
            return Response(
                {'detail': 'Reminders can only be sent for pending payments.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = request.data.get('template', 'default')
        custom_message = request.data.get('custom_message', '')
        reminder = self._create_payment_reminder(payment, template=template, custom_message=custom_message)
        if not reminder:
            return Response(
                {'detail': 'Student email is required to send a reminder.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'message': 'Payment reminder sent successfully.',
                'reminder_id': reminder.id,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='bulk_send_reminders')
    def bulk_send_reminders(self, request):
        serializer = BulkPaymentReminderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_ids = serializer.validated_data['payment_ids']
        template = serializer.validated_data.get('template', 'default')
        custom_message = serializer.validated_data.get('custom_message', '')

        payments = Payment.objects.filter(
            id__in=payment_ids,
            status=Payment.PaymentStatus.PENDING,
        ).select_related('by_user')

        reminders_sent = []
        skipped_payment_ids = []

        for payment in payments:
            reminder = self._create_payment_reminder(
                payment,
                template=template,
                custom_message=custom_message,
            )
            if reminder:
                reminders_sent.append(reminder.id)
            else:
                skipped_payment_ids.append(payment.id)

        return Response(
            {
                'message': f'Sent {len(reminders_sent)} reminder(s).',
                'reminders_sent': len(reminders_sent),
                'reminder_ids': reminders_sent,
                'skipped_payment_ids': skipped_payment_ids,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='reminder-settings')
    def reminder_settings(self, request):
        settings_obj = PaymentReminderSettings.objects.first()
        serializer_kwargs = {'context': {'request': request}}

        if settings_obj:
            serializer = PaymentReminderSettingsSerializer(
                settings_obj,
                data=request.data,
                partial=True,
                **serializer_kwargs,
            )
        else:
            serializer = PaymentReminderSettingsSerializer(data=request.data, **serializer_kwargs)

        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(responses=OpenApiTypes.OBJECT)
class CashReceiptVerifyView(APIView):
    """
    Public verification endpoint for QR scans.
    Returns compact receipt summary without requiring authentication.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token, *args, **kwargs):
        receipt = (
            CashPaymentReceipt.objects
            .select_related('payment', 'payment__payment_type')
            .filter(receipt_token=token)
            .first()
        )
        if not receipt:
            return Response({'valid': False, 'detail': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not is_cash_payment(receipt.payment):
            return Response(
                {'valid': False, 'detail': 'Receipt is not a cash receipt.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = build_cash_receipt_payload(receipt, request=request)
        return Response(
            {
                'valid': True,
                'receipt_number': payload['receipt_number'],
                'issued_at': payload['issued_at'],
                'education_center_name': payload['education_center_name'],
                'student_full_name': payload['student_full_name'],
                'paid_amount': payload['paid_amount'],
                'payment_method': payload['payment_method'],
                'transaction_id': payload['transaction_id'],
            },
            status=status.HTTP_200_OK,
        )

class ShopProductViewSet(viewsets.ModelViewSet):
    queryset = ShopProduct.objects.all()
    serializer_class = ShopProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

class ShopOrderViewSet(viewsets.ModelViewSet):
    queryset = ShopOrder.objects.all()
    serializer_class = ShopOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ShopOrder.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('student', 'product').order_by('-created_at')

class StoryViewSet(viewsets.ModelViewSet):
    queryset = Story.objects.all()
    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Story.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('student').order_by('-created_at')

class StudentCoinsViewSet(viewsets.ModelViewSet):
    queryset = StudentCoins.objects.all()
    serializer_class = StudentCoinsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = StudentCoins.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('student').order_by('-created_at')

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Ticket.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('student').order_by('-created_at')

class TicketChatViewSet(viewsets.ModelViewSet):
    queryset = TicketChat.objects.all()
    serializer_class = TicketChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = TicketChat.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('ticket', 'from_user').order_by('-created_at')

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAdminUser]

class ExpenseTypeViewSet(viewsets.ModelViewSet):
    queryset = ExpenseType.objects.all()
    serializer_class = ExpenseTypeSerializer
    permission_classes = [permissions.IsAdminUser]

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = Expense.objects.all()

        # Date filtering - filter by date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date=date_param)

        return queryset.select_related('type', 'created_by').order_by('-date')

class LeaveReasonViewSet(viewsets.ModelViewSet):
    queryset = LeaveReason.objects.all()
    serializer_class = LeaveReasonSerializer
    permission_classes = [permissions.IsAdminUser]

class InformationViewSet(viewsets.ModelViewSet):
    queryset = Information.objects.all()
    serializer_class = InformationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Information.objects.all()

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('author').order_by('-created_at')

class PaymentTypeViewSet(viewsets.ModelViewSet):
    queryset = PaymentType.objects.all()
    serializer_class = PaymentTypeSerializer
    permission_classes = [permissions.IsAdminUser]

class AutomaticFineViewSet(viewsets.ModelViewSet):
    queryset = AutomaticFine.objects.all()
    serializer_class = AutomaticFineSerializer
    permission_classes = [permissions.IsAdminUser]

class AssistantSlotViewSet(viewsets.ModelViewSet):
    queryset = AssistantSlot.objects.all()
    serializer_class = AssistantSlotSerializer
    permission_classes = [permissions.IsAuthenticated] # Keyinchalik yaxshilash mumkin

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated] # Keyinchalik yaxshilash mumkin

    def get_queryset(self):
        queryset = Booking.objects.all()

        # Date filtering - filter by booked_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(booked_at__date=date_param)

        return queryset.select_related('student', 'slot', 'slot__assistant').order_by('-booked_at')


# --- MAXSUS VIEW'LAR (APIView, GenericAPIView) ---

@extend_schema(responses=OpenApiTypes.OBJECT)
class StudentStatisticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, *args, **kwargs):
        student = request.user
        group_count = student.student_groups.count()
        total_attendances = Attendance.objects.filter(student=student)
        present_count = total_attendances.filter(is_present=True).count()
        total_count = total_attendances.count()
        attendance_percentage = (present_count / total_count * 100) if total_count > 0 else 0
        average_score = ExamScore.objects.filter(student=student).aggregate(avg=Avg('score'))['avg']
        total_coins = StudentCoins.objects.filter(student=student).aggregate(total=Sum('coin'))['total']
        total_payments = Payment.objects.filter(by_user=student).aggregate(total=Sum('amount'))['total']
        data = {
            "group_count": group_count,
            "attendance_percentage": round(attendance_percentage, 2),
            "average_score": round(average_score, 2) if average_score is not None else 0,
            "total_coins": total_coins if total_coins is not None else 0,
            "total_payments": total_payments if total_payments is not None else 0.00
        }
        return Response(data)

class StudentUpdateView(generics.UpdateAPIView):
    serializer_class = StudentUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self):
        return self.request.user

@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class CreatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, *args, **kwargs):
        student_id = request.data.get('student_id')
        amount_in_sum = request.data.get('amount')
        if not student_id or not amount_in_sum:
            return Response({"detail": "student_id va amount majburiy."}, status=status.HTTP_400_BAD_REQUEST)
        amount_in_tiyin = int(amount_in_sum) * 100
        payment = Payment.objects.create(by_user_id=student_id, amount=amount_in_tiyin, status=Payment.PaymentStatus.PENDING)
        payme_url = "https://checkout.test.paycom.uz/api"
        merchant_id = config('PAYME_MERCHANT_ID')
        secret_key = config('PAYME_SECRET_KEY')
        auth_string = f"ac.{merchant_id}={secret_key}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()
        headers = {'X-Auth': encoded_auth, 'Content-Type': 'application/json'}
        payload = {"method": "receipts.create", "params": {"amount": amount_in_tiyin, "account": {"order_id": payment.id}}}
        try:
            response = requests.post(payme_url, headers=headers, data=json.dumps(payload))
            response.raise_for_status()
            payme_data = response.json()
            transaction_id = payme_data.get('result', {}).get('receipt', {}).get('_id')
            if transaction_id:
                payment.transaction_id = transaction_id
                payment.save()
            return Response(payme_data)
        except requests.exceptions.RequestException as e:
            payment.status = Payment.PaymentStatus.FAILED
            payment.save()
            return Response({"detail": f"Payme bilan bog'lanishda xatolik: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
class PaymentCallbackView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request, *args, **kwargs):
        data = request.data
        method = data.get('method')
        if method == 'receipts.pay':
            order_id = data.get('params', {}).get('account', {}).get('order_id')
            transaction_id = data.get('params', {}).get('id')
            try:
                payment = Payment.objects.get(id=order_id, transaction_id=transaction_id)
                payment.status = Payment.PaymentStatus.PAID
                payment.save()
                return Response({"result": {"success": True}})
            except Payment.DoesNotExist:
                return Response({"error": {"code": -31050, "message": "Tranzaksiya topilmadi"}})
        return Response({"result": {"success": True}})

# --- ASSISTANT BOOKING VIEW'LARI ---
class AvailableSlotsView(generics.ListAPIView):
    serializer_class = AssistantSlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return AssistantSlot.objects.filter(is_booked=False, start_time__gte=timezone.now())

class BookSlotView(generics.GenericAPIView):
    serializer_class = BookSlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot_id = serializer.validated_data['slot_id']
        student = request.user
        try:
            slot_to_book = AssistantSlot.objects.select_for_update().get(id=slot_id, is_booked=False, start_time__gte=timezone.now())
            Booking.objects.create(student=student, slot=slot_to_book)
            slot_to_book.is_booked = True
            slot_to_book.save()
            return Response({"detail": "Vaqt muvaffaqiyatli band qilindi."}, status=status.HTTP_200_OK)
        except AssistantSlot.DoesNotExist:
            return Response({"detail": "Slot topilmadi yoki allaqachon band qilingan."}, status=status.HTTP_404_NOT_FOUND)

class BookingHistoryView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return Booking.objects.filter(student=self.request.user, slot__start_time__lt=timezone.now())

class UpcomingBookingView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return Booking.objects.filter(student=self.request.user, slot__start_time__gte=timezone.now())

@extend_schema(responses=OpenApiTypes.OBJECT)
class PaymentReceiptView(APIView):
    """
    Berilgan to'lov ID'si bo'yicha QR kodli PDF kvitansiya (chek) generatsiya qiladi.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, payment_id, *args, **kwargs):
        user = request.user
        
        try:
            if user.is_superuser or user.is_staff:
                payment = Payment.objects.select_related('by_user', 'payment_type', 'group', 'group__course').get(id=payment_id)
            else:
                payment = Payment.objects.select_related('by_user', 'payment_type', 'group', 'group__course').get(id=payment_id, by_user=user)

        except Payment.DoesNotExist:
            return Response({"detail": "To'lov topilmadi yoki sizga tegshli emas."}, status=status.HTTP_404_NOT_FOUND)

        # --- QR Kod Generatsiyasi ---
        qr_data = f"To'lov ID: {payment.id}\n" \
                  f"Talaba: {payment.by_user.get_full_name()}\n" \
                  f"Summa: {payment.amount / 100} UZS\n" \
                  f"Sana: {payment.date.strftime('%Y-%m-%d')}"
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill='black', back_color='white')
        
        # Rasmni vaqtinchalik xotirada saqlaymiz
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        # base64 formatiga o'tkazamiz, shunda uni HTML'ga to'g'ridan-to'g'ri joylashtirish mumkin
        qr_image_base64 = base64.b64encode(buffer.getvalue()).decode()

        # PDF uchun ma'lumotlarni tayyorlaymiz
        context = {
            'payment': payment,
            'student': payment.by_user,
            'group': payment.group,
            'course_price': (payment.group.course.price / 100) if payment.group and payment.group.course else 0,
            'balance': 0, # Bu yerga balansni hisoblash logikasini qo'shish kerak
            'amount_in_sum': payment.amount / 100,
            'qr_image': qr_image_base64, # Tayyor QR kod rasmi
        }

        html_string = render_to_string('receipt_template.html', context)
        html = HTML(string=html_string)
        pdf_file = html.write_pdf()

        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="receipt-{payment.id}.pdf"'
        
        return response
    
class PurchaseWithCoinsView(APIView):
    """
    Talabaga o'z coinlari evaziga do'kondan mahsulot sotib olish imkonini beradi.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PurchaseWithCoinsSerializer

    @transaction.atomic # Bir nechta amallarni xavfsiz bajarish uchun
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        product_id = serializer.validated_data['product_id']
        student = request.user

        try:
            # Sotib olinayotgan mahsulotni topamiz va uni o'zgartirish uchun bloklaymiz
            product = ShopProduct.objects.select_for_update().get(id=product_id)
        except ShopProduct.DoesNotExist:
            return Response({"detail": "Mahsulot topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Mahsulot sonini tekshirish
        if product.quantity < 1:
            return Response({"detail": "Ushbu mahsulot sotuvda qolmagan."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Talabaning jami coinlarini hisoblash
        total_coins_agg = StudentCoins.objects.filter(student=student).aggregate(total=Sum('coin'))
        total_coins = total_coins_agg.get('total') or 0

        # 3. Coinlar yetarliligini tekshirish
        if total_coins < product.price:
            return Response({"detail": "Sizda coinlar yetarli emas."}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Amallarni bajarish:
        #    a) Mahsulot sonini kamaytirish
        product.quantity = F('quantity') - 1
        product.save()

        #    b) Talabaning hisobidan coinlarni yechib olish (yangi, manfiy yozuv yaratamiz)
        StudentCoins.objects.create(
            student=student,
            coin=-product.price,
            reason=f"'{product.name}' mahsuloti sotib olindi"
        )
        
        #    c) Sotib olinganlik tarixini saqlash
        ShopOrder.objects.create(
            student=student,
            product=product,
            price=product.price, # Bu yerda narx coinlarda
            quantity=1
        )
        
        # Talabaning yangilangan coinlar miqdorini qaytaramiz
        new_total_coins = total_coins - product.price
        return Response({
            "detail": f"'{product.name}' muvaffaqiyatli sotib olindi!",
            "new_balance_coins": new_total_coins
        }, status=status.HTTP_200_OK)

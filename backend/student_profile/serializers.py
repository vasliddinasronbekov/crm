from datetime import date, time
from decimal import Decimal
import re
from typing import Any
# /mnt/usb/edu-api-project/student_profile/serializers.py
from .models import PaymentType, AutomaticFine, AssistantSlot, Booking # Importlarga qo'shing
from rest_framework import serializers
from django.db.models import Q
from .models import (
    Branch, Group, Attendance, Event, ExamScore, ShopProduct,
    ShopOrder, CashPaymentReceipt, Payment, PaymentAuditLog, Story, StudentCoins, Ticket, TicketChat,
    Course, Room, ExpenseType, Expense, User, LeaveReason, Information # Barcha modellar import qilinganiga amin bo'ling
)
from .receipt_service import is_cash_payment
from users.serializers import UserBasicSerializer, UserSerializer


WEEKDAY_ALIASES = {
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
    'daily': '*',
    'everyday': '*',
    'alldays': '*',
    'allweek': '*',
    'harkuni': '*',
    'har kuni': '*',
}

WEEKDAY_ORDER = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]


def _expand_day_range(start_day: str, end_day: str) -> list[str]:
    try:
        start_index = WEEKDAY_ORDER.index(start_day)
        end_index = WEEKDAY_ORDER.index(end_day)
    except ValueError:
        return []

    if start_index <= end_index:
        return WEEKDAY_ORDER[start_index:end_index + 1]
    # Wrap-around ranges, e.g. Fri-Mon
    return WEEKDAY_ORDER[start_index:] + WEEKDAY_ORDER[:end_index + 1]


def _normalize_days(days_value: str) -> set[str]:
    if not days_value:
        return set()

    normalized: set[str] = set()
    raw_value = str(days_value).strip().lower()
    for raw_token in re.split(r'[,\s;/|]+', raw_value):
        token = ''.join(ch for ch in raw_token.strip().lower() if ch.isalpha() or ch == '-')
        if not token:
            continue

        if '-' in token:
            start_token, end_token = token.split('-', 1)
            start_day = WEEKDAY_ALIASES.get(start_token)
            end_day = WEEKDAY_ALIASES.get(end_token)
            if start_day and end_day and start_day != '*' and end_day != '*':
                normalized.update(_expand_day_range(start_day, end_day))
                continue

        canonical = WEEKDAY_ALIASES.get(token)
        if canonical == '*':
            normalized.update(WEEKDAY_ORDER)
        elif canonical:
            normalized.add(canonical)
    return normalized


def _time_ranges_overlap(
    start_a: time,
    end_a: time,
    start_b: time,
    end_b: time,
) -> bool:
    return start_a < end_b and start_b < end_a


def _date_ranges_overlap(
    start_a: date,
    end_a: date,
    start_b: date,
    end_b: date,
) -> bool:
    return start_a <= end_b and start_b <= end_a


class PaymentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentType
        fields = '__all__'

class AutomaticFineSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomaticFine
        fields = '__all__'
# --- Mavjud serializerlaringiz ---
class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'

class GroupCreateSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all()
    )

    class Meta:
        model = Group
        fields = '__all__'

    def _merged_attr(self, attrs, field):
        if field in attrs:
            return attrs[field]
        if self.instance is not None:
            return getattr(self.instance, field)
        return None

    def _validate_schedule_conflicts(self, attrs) -> None:
        start_day = self._merged_attr(attrs, 'start_day')
        end_day = self._merged_attr(attrs, 'end_day')
        start_time = self._merged_attr(attrs, 'start_time')
        end_time = self._merged_attr(attrs, 'end_time')
        room = self._merged_attr(attrs, 'room')
        main_teacher = self._merged_attr(attrs, 'main_teacher')
        assistant_teacher = self._merged_attr(attrs, 'assistant_teacher')
        days_value = self._merged_attr(attrs, 'days')

        normalized_days = _normalize_days(days_value or '')
        if not normalized_days:
            return
        if not all([start_day, end_day, start_time, end_time]):
            return

        resource_filter = Q()
        teacher_ids = [
            teacher.id
            for teacher in [main_teacher, assistant_teacher]
            if teacher is not None
        ]

        if room is not None:
            resource_filter |= Q(room=room)
        if teacher_ids:
            resource_filter |= Q(main_teacher_id__in=teacher_ids) | Q(assistant_teacher_id__in=teacher_ids)
        if not resource_filter:
            return

        queryset = Group.objects.select_related('room', 'main_teacher', 'assistant_teacher').filter(resource_filter)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        conflicts = []
        for candidate in queryset:
            if not all([
                candidate.start_day,
                candidate.end_day,
                candidate.start_time,
                candidate.end_time,
            ]):
                continue
            candidate_days = _normalize_days(candidate.days or '')
            if not candidate_days:
                continue
            if not (normalized_days & candidate_days):
                continue
            if not _date_ranges_overlap(start_day, end_day, candidate.start_day, candidate.end_day):
                continue
            if not _time_ranges_overlap(start_time, end_time, candidate.start_time, candidate.end_time):
                continue

            common_days = sorted(normalized_days & candidate_days)
            conflict_window = (
                f"{candidate.start_time.strftime('%H:%M')} - {candidate.end_time.strftime('%H:%M')}"
            )
            if room is not None and candidate.room_id == room.id:
                conflicts.append({
                    'type': 'room',
                    'group_id': candidate.id,
                    'group_name': candidate.name,
                    'days': common_days,
                    'time': conflict_window,
                    'room': candidate.room.name if candidate.room else None,
                })

            if teacher_ids and (
                candidate.main_teacher_id in teacher_ids
                or candidate.assistant_teacher_id in teacher_ids
            ):
                conflicts.append({
                    'type': 'teacher',
                    'group_id': candidate.id,
                    'group_name': candidate.name,
                    'days': common_days,
                    'time': conflict_window,
                    'teacher': candidate.main_teacher.username if candidate.main_teacher else None,
                })

        if conflicts:
            raise serializers.ValidationError({
                'non_field_errors': [
                    'Schedule conflict detected for selected room/teacher and time window.',
                ],
                'schedule_conflicts': conflicts[:20],
            })

    def validate(self, attrs):
        start_day = self._merged_attr(attrs, 'start_day')
        end_day = self._merged_attr(attrs, 'end_day')
        start_time = self._merged_attr(attrs, 'start_time')
        end_time = self._merged_attr(attrs, 'end_time')
        branch = self._merged_attr(attrs, 'branch')
        room = self._merged_attr(attrs, 'room')
        days_value = self._merged_attr(attrs, 'days')

        if start_day and end_day and end_day < start_day:
            raise serializers.ValidationError({
                'end_day': 'End date must be on or after start date.',
            })
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({
                'end_time': 'End time must be later than start time.',
            })

        if room is not None and branch is not None and room.branch_id and room.branch_id != branch.id:
            raise serializers.ValidationError({
                'room': 'Selected room belongs to a different branch.',
            })

        if days_value:
            normalized_days = _normalize_days(days_value)
            if not normalized_days:
                raise serializers.ValidationError({
                    'days': 'Provide valid schedule days (e.g. Mon, Wed, Fri).',
                })

        self._validate_schedule_conflicts(attrs)
        return attrs


class GroupBranchSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name']


class GroupCourseSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'name', 'price', 'duration_months']


class GroupRoomSummarySerializer(serializers.ModelSerializer):
    branch = GroupBranchSummarySerializer(read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'capacity', 'branch']


class GroupReadSerializer(serializers.ModelSerializer):
    branch = GroupBranchSummarySerializer(read_only=True)
    course = GroupCourseSummarySerializer(read_only=True)
    room = GroupRoomSummarySerializer(read_only=True)
    main_teacher = UserBasicSerializer(read_only=True)
    assistant_teacher = UserBasicSerializer(read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    main_teacher_name = serializers.SerializerMethodField()
    assistant_teacher_name = serializers.SerializerMethodField()
    student_count = serializers.IntegerField(source='students.count', read_only=True)

    class Meta:
        model = Group
        fields = '__all__'

    def get_main_teacher_name(self, obj) -> Any:
        if not obj.main_teacher:
            return None
        return obj.main_teacher.get_full_name() or obj.main_teacher.username

    def get_assistant_teacher_name(self, obj) -> Any:
        if not obj.assistant_teacher:
            return None
        return obj.assistant_teacher.get_full_name() or obj.assistant_teacher.username


class AttendanceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Attendance
        fields = '__all__'

    def get_status(self, obj) -> Any:
        if obj.attendance_status == Attendance.STATUS_PRESENT:
            return 'present'
        if obj.attendance_status == Attendance.STATUS_ABSENCE_EXCUSED:
            return 'absence'
        return 'absent'

    def to_internal_value(self, data):
        mutable_data = data.copy()

        status_value = mutable_data.get('attendance_status') or mutable_data.get('status')
        if status_value:
            normalized = str(status_value).lower()
            if normalized in ['present', Attendance.STATUS_PRESENT]:
                mutable_data['attendance_status'] = Attendance.STATUS_PRESENT
            elif normalized in ['absence', 'excused', Attendance.STATUS_ABSENCE_EXCUSED]:
                mutable_data['attendance_status'] = Attendance.STATUS_ABSENCE_EXCUSED
            else:
                mutable_data['attendance_status'] = Attendance.STATUS_ABSENT_UNEXCUSED
        elif 'is_present' in mutable_data:
            mutable_data['attendance_status'] = (
                Attendance.STATUS_PRESENT if mutable_data.get('is_present') else Attendance.STATUS_ABSENT_UNEXCUSED
            )

        return super().to_internal_value(mutable_data)

class EventSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'event_type', 'event_type_display',
            'start_time', 'end_time', 'is_all_day', 'location',
            'course', 'course_name', 'group', 'group_name',
            'students', 'student_count', 'created_by', 'created_by_name',
            'photo', 'color', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_created_by_name(self, obj) -> Any:
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_student_count(self, obj) -> Any:
        return obj.students.count()

class ExamScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamScore
        fields = '__all__'

class ShopProductSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(source='photo', read_only=True)
    # Frontend sends this flag; the current schema derives active state from stock.
    is_active = serializers.BooleanField(required=False, write_only=True, default=True)

    class Meta:
        model = ShopProduct
        fields = [
            'id', 'name', 'description', 'price', 'quantity',
            'photo', 'image', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'image']

    def create(self, validated_data):
        validated_data.pop('is_active', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('is_active', None)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['is_active'] = instance.quantity > 0
        return data

class ShopOrderSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source='product.name', read_only=True)
    total_price = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = ShopOrder
        fields = [
            'id', 'student', 'student_name', 'product', 'product_name',
            'price', 'quantity', 'total_price', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'total_price', 'status']

    def get_student_name(self, obj) -> Any:
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username

    def get_total_price(self, obj) -> Any:
        return obj.price * obj.quantity

    def get_status(self, obj) -> Any:
        return 'completed'


class CashPaymentReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashPaymentReceipt
        fields = [
            'id',
            'receipt_number',
            'receipt_token',
            'issued_at',
            'education_center_name',
            'branch_name',
            'cashier_full_name',
            'student_full_name',
            'group_name',
            'course_service_name',
            'payment_method',
            'paid_amount',
            'remaining_balance',
            'note',
        ]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    cash_receipt = CashPaymentReceiptSerializer(read_only=True)
    is_cash_payment = serializers.SerializerMethodField()
    has_cash_receipt = serializers.SerializerMethodField()
    student_full_name = serializers.SerializerMethodField()
    payment_type_name = serializers.CharField(source='payment_type.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    branch_name = serializers.CharField(source='group.branch.name', read_only=True)
    course_service_name = serializers.CharField(source='group.course.name', read_only=True)
    amount_tiyin = serializers.IntegerField(source='amount', read_only=True)
    course_price_tiyin = serializers.IntegerField(source='course_price', read_only=True)
    amount_uzs = serializers.SerializerMethodField()
    course_price_uzs = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        ref_name = 'StudentProfilePayment'
        fields = '__all__'

    def get_is_cash_payment(self, obj) -> bool:
        return is_cash_payment(obj)

    def get_has_cash_receipt(self, obj) -> bool:
        return hasattr(obj, 'cash_receipt')

    def get_student_full_name(self, obj) -> str:
        if not obj.by_user:
            return ''
        full_name = obj.by_user.get_full_name().strip()
        return full_name or obj.by_user.username

    def get_amount_uzs(self, obj) -> Any:
        return Decimal(obj.amount or 0) / Decimal(100)

    def get_course_price_uzs(self, obj) -> Any:
        return Decimal(obj.course_price or 0) / Decimal(100)


class PaymentAuditLogSerializer(serializers.ModelSerializer):
    changed_by_user_name = serializers.SerializerMethodField()
    amount_before_tiyin = serializers.IntegerField(source='amount_before', read_only=True)
    amount_after_tiyin = serializers.IntegerField(source='amount_after', read_only=True)
    course_price_before_tiyin = serializers.IntegerField(source='course_price_before', read_only=True)
    course_price_after_tiyin = serializers.IntegerField(source='course_price_after', read_only=True)
    amount_before_uzs = serializers.SerializerMethodField()
    amount_after_uzs = serializers.SerializerMethodField()
    course_price_before_uzs = serializers.SerializerMethodField()
    course_price_after_uzs = serializers.SerializerMethodField()

    class Meta:
        model = PaymentAuditLog
        fields = [
            'id',
            'payment_id_snapshot',
            'transaction_id_snapshot',
            'event_type',
            'changed_by_user',
            'changed_by_user_name',
            'changed_by_display',
            'amount_before',
            'amount_before_tiyin',
            'amount_before_uzs',
            'amount_after',
            'amount_after_tiyin',
            'amount_after_uzs',
            'course_price_before',
            'course_price_before_tiyin',
            'course_price_before_uzs',
            'course_price_after',
            'course_price_after_tiyin',
            'course_price_after_uzs',
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
            'created_at',
        ]
        read_only_fields = fields

    def get_changed_by_user_name(self, obj) -> str:
        if obj.changed_by_user:
            full_name = obj.changed_by_user.get_full_name().strip()
            if full_name:
                return full_name
            return obj.changed_by_user.username
        return obj.changed_by_display or 'System'

    def get_amount_before_uzs(self, obj) -> Any:
        return Decimal(obj.amount_before) / Decimal(100) if obj.amount_before is not None else None

    def get_amount_after_uzs(self, obj) -> Any:
        return Decimal(obj.amount_after) / Decimal(100) if obj.amount_after is not None else None

    def get_course_price_before_uzs(self, obj) -> Any:
        return Decimal(obj.course_price_before) / Decimal(100) if obj.course_price_before is not None else None

    def get_course_price_after_uzs(self, obj) -> Any:
        return Decimal(obj.course_price_after) / Decimal(100) if obj.course_price_after is not None else None


class PaymentWriteSerializer(serializers.ModelSerializer):
    PRICING_MODE_COURSE = 'course'
    PRICING_MODE_MANUAL = 'manual'
    PRICING_MODE_CHOICES = (
        (PRICING_MODE_COURSE, 'Course derived'),
        (PRICING_MODE_MANUAL, 'Manual override'),
    )

    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    pricing_mode = serializers.ChoiceField(
        choices=PRICING_MODE_CHOICES,
        required=False,
        default=PRICING_MODE_COURSE,
        write_only=True,
    )
    amount_tiyin = serializers.IntegerField(required=False, write_only=True, min_value=1)
    course_price_tiyin = serializers.IntegerField(required=False, write_only=True, min_value=1)

    class Meta:
        model = Payment
        fields = [
            'id',
            'date',
            'by_user',
            'status',
            'group',
            'teacher',
            'amount',
            'amount_tiyin',
            'payment_type',
            'detail',
            'course_price',
            'course_price_tiyin',
            'transaction_id',
            'course',
            'pricing_mode',
        ]
        extra_kwargs = {
            # Create flow can derive these from course/group or tiyin aliases.
            'amount': {'required': False},
            'course_price': {'required': False},
        }

    def _resolve_course(self, attrs):
        group = attrs.get('group')
        course = attrs.get('course')
        if group and getattr(group, 'course_id', None):
            return group.course
        return course

    def _validate_manual_fields(self, attrs):
        amount = attrs.get('amount')
        course_price = attrs.get('course_price')
        if amount is None or amount <= 0:
            raise serializers.ValidationError({'amount': 'Manual payments require a positive amount.'})
        if course_price is None or course_price <= 0:
            raise serializers.ValidationError({'course_price': 'Manual payments require a positive course price.'})

    def validate(self, attrs):
        attrs = super().validate(attrs)

        amount_tiyin = attrs.pop('amount_tiyin', None)
        course_price_tiyin = attrs.pop('course_price_tiyin', None)

        if amount_tiyin is not None:
            existing_amount = attrs.get('amount')
            if existing_amount is not None and int(existing_amount) != int(amount_tiyin):
                raise serializers.ValidationError({'amount_tiyin': 'Conflicts with amount value.'})
            attrs['amount'] = int(amount_tiyin)

        if course_price_tiyin is not None:
            existing_course_price = attrs.get('course_price')
            if existing_course_price is not None and int(existing_course_price) != int(course_price_tiyin):
                raise serializers.ValidationError({'course_price_tiyin': 'Conflicts with course_price value.'})
            attrs['course_price'] = int(course_price_tiyin)

        pricing_mode = attrs.get('pricing_mode', self.PRICING_MODE_COURSE)
        is_create = self.instance is None

        if not is_create:
            return attrs

        if pricing_mode == self.PRICING_MODE_MANUAL:
            self._validate_manual_fields(attrs)
            attrs.pop('course', None)
            return attrs

        resolved_course = self._resolve_course(attrs)
        if not resolved_course:
            raise serializers.ValidationError(
                {'course': 'Select a course or a group to auto-fill pricing.'}
            )

        resolved_price = int(resolved_course.price or 0)
        if resolved_price <= 0:
            raise serializers.ValidationError(
                {'course': 'Selected course has no valid price.'}
            )

        attrs['amount'] = resolved_price
        attrs['course_price'] = resolved_price
        attrs.pop('course', None)
        return attrs

    def create(self, validated_data):
        validated_data.pop('pricing_mode', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Keep backward-compatible updates (status/detail/amount edits) untouched.
        validated_data.pop('course', None)
        validated_data.pop('pricing_mode', None)
        validated_data.pop('amount_tiyin', None)
        validated_data.pop('course_price_tiyin', None)
        return super().update(instance, validated_data)


class StorySerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    class Meta:
        model = Story
        fields = '__all__'

class StudentCoinsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentCoins
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = '__all__'

class TicketChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketChat
        fields = '__all__'


# --- MANA SHU YETISHMAYOTGAN QISM ---

class CourseSerializer(serializers.ModelSerializer):
    duration_weeks = serializers.IntegerField(required=False, write_only=True, min_value=1)
    level = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = Course
        fields = '__all__'

    def _normalize_difficulty(self, level):
        if not level:
            return None
        value = str(level).strip().lower()
        mapping = {
            'beginner': 'beginner',
            'intermediate': 'intermediate',
            'advanced': 'advanced',
            'expert': 'expert',
        }
        return mapping.get(value)

    def _apply_aliases(self, validated_data):
        duration_weeks = validated_data.pop('duration_weeks', None)
        if duration_weeks is not None:
            validated_data['duration_months'] = max(1, (duration_weeks + 3) // 4)

        normalized_level = self._normalize_difficulty(validated_data.pop('level', None))
        if normalized_level:
            validated_data['difficulty'] = normalized_level

        return validated_data

    def create(self, validated_data):
        validated_data = self._apply_aliases(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._apply_aliases(validated_data)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['duration_weeks'] = instance.duration_months * 4
        data['level'] = instance.difficulty
        return data

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'

class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

class StudentUpdateSerializer(serializers.ModelSerializer):
    # Parolni faqat yozish uchun (`write_only`), o'qishda ko'rinmaydi
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User # Biz tahrirlaydigan model - bu User
        # Spetsifikatsiyadagi maydonlar:
        fields = ['first_name', 'gender', 'birthday', 'phone', 'photo', 'region', 'password']
        extra_kwargs = {
            'first_name': {'required': False},
            # ... boshqa maydonlar ham majburiy emas ...
        }

    def update(self, instance, validated_data):
        # Agar so'rovda parol kelsa, uni alohida, to'g'ri usulda o'rnatamiz
        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
        
        # Qolgan maydonlarni standart usulda yangilaymiz
        return super().update(instance, validated_data)

class LeaveReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveReason
        fields = '__all__'

class InformationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Information
        fields = '__all__'

class AssistantSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSlot
        fields = '__all__'

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'

class BookSlotSerializer(serializers.Serializer):
    slot_id = serializers.IntegerField(required=True)
class PurchaseWithCoinsSerializer(serializers.Serializer):
    """
    Coinlar evaziga mahsulot sotib olish uchun.
    Faqat `product_id`'ni qabul qiladi.
    """
    product_id = serializers.IntegerField(required=True)
    def validate_product_id(self, value):
        try:
            product = ShopProduct.objects.get(id=value)
        except ShopProduct.DoesNotExist:
            raise serializers.ValidationError("Bunday mahsulot mavjud emas.")
        return value

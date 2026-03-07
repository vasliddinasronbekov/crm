from datetime import date, time
from typing import Any
# /mnt/usb/edu-api-project/student_profile/serializers.py
from .models import PaymentType, AutomaticFine, AssistantSlot, Booking # Importlarga qo'shing
from rest_framework import serializers
from django.db.models import Q
from .models import (
    Branch, Group, Attendance, Event, ExamScore, ShopProduct,
    ShopOrder, CashPaymentReceipt, Payment, Story, StudentCoins, Ticket, TicketChat,
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
}


def _normalize_days(days_value: str) -> set[str]:
    if not days_value:
        return set()

    normalized: set[str] = set()
    for raw_token in str(days_value).split(','):
        token = ''.join(ch for ch in raw_token.strip().lower() if ch.isalpha())
        if not token:
            continue
        canonical = WEEKDAY_ALIASES.get(token)
        if canonical:
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

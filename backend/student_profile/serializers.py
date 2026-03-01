# /mnt/usb/edu-api-project/student_profile/serializers.py
from .models import PaymentType, AutomaticFine, AssistantSlot, Booking # Importlarga qo'shing
from rest_framework import serializers
from .models import (
    Branch, Group, Attendance, Event, ExamScore, ShopProduct,
    ShopOrder, Payment, Story, StudentCoins, Ticket, TicketChat,
    Course, Room, ExpenseType, Expense, User, LeaveReason, Information # Barcha modellar import qilinganiga amin bo'ling
)
from users.serializers import UserBasicSerializer, UserSerializer
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

    def get_main_teacher_name(self, obj):
        if not obj.main_teacher:
            return None
        return obj.main_teacher.get_full_name() or obj.main_teacher.username

    def get_assistant_teacher_name(self, obj):
        if not obj.assistant_teacher:
            return None
        return obj.assistant_teacher.get_full_name() or obj.assistant_teacher.username


class AttendanceSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Attendance
        fields = '__all__'
        depth = 1

    def get_status(self, obj):
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

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_student_count(self, obj):
        return obj.students.count()

class ExamScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamScore
        fields = '__all__'
        depth = 1

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

    def get_student_name(self, obj):
        full_name = obj.student.get_full_name().strip()
        return full_name or obj.student.username

    def get_total_price(self, obj):
        return obj.price * obj.quantity

    def get_status(self, obj):
        return 'completed'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        depth = 1
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
        depth = 1 

class ExpenseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseType
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'
        depth = 1

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
        depth = 1 # Muallif (author) haqida to'liq ma'lumot ko'rish uchun

class AssistantSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSlot
        fields = '__all__'
        depth = 1 # Assistant haqida to'liq ma'lumot ko'rsatish uchun

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'
        depth = 2 # Student va Slot haqida to'liq ma'lumot ko'rsatish uchun

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

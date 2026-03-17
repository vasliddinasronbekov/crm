from typing import Any

from django.db.models import Avg, Sum
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from student_profile.models import ExamScore, Group, StudentCoins
from users.models import User, UserRoleEnum


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'phone',
            'email',
            'photo',
            'is_active',
            'is_teacher',
            'is_staff',
            'is_superuser',
            'role',
            'date_joined',
            'last_login',
        ]
        read_only_fields = [
            'id',
            'is_teacher',
            'is_staff',
            'is_superuser',
            'role',
            'date_joined',
            'last_login',
        ]


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token['role'] = user.role
        token['is_staff'] = user.is_staff
        token['is_teacher'] = user.is_teacher
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        full_name = f"{user.first_name} {user.last_name}".strip()
        data['id'] = user.id
        data['username'] = user.username
        data['first_name'] = full_name
        data['role'] = user.role

        student_branch_name = None
        student_group = Group.objects.filter(students=user).select_related('branch').first()
        if student_group and student_group.branch:
            student_branch_name = student_group.branch.name
        data['student_branch'] = student_branch_name

        data['gender'] = user.gender
        data['birthday'] = user.birthday
        data['balance'] = 0.0
        data['status'] = "In group" if student_group else "Not in group"
        data['phone'] = user.phone
        data['parents_phone'] = user.parents_phone

        coins_agg = StudentCoins.objects.filter(student=user).aggregate(total=Sum('coin'))
        data['coins'] = coins_agg.get('total') or 0

        avg_score_agg = ExamScore.objects.filter(student=user).aggregate(avg=Avg('score'))
        avg_score = avg_score_agg.get('avg')
        data['score'] = round(avg_score, 2) if avg_score is not None else 0.0

        data['photo'] = user.photo.url if user.photo else ""
        data['region'] = user.region.name if user.region else None

        ranked_student_ids = list(
            User.objects.filter(role=UserRoleEnum.STUDENT.value)
            .annotate(avg_score=Avg('exam_scores__score'))
            .filter(avg_score__isnull=False)
            .order_by('-avg_score')
            .values_list('id', flat=True)
        )
        try:
            rank = ranked_student_ids.index(user.id) + 1
        except ValueError:
            rank = "N/A"
        effective_rank = user.rank if user.rank else rank

        data['ranking'] = {
            "id": user.id,
            "first_name": full_name,
            "student_branch__name": student_branch_name,
            "photo": user.photo.url if user.photo else "",
            "avg_score": data['score'],
            "rank": effective_rank,
        }
        return data


def is_staff_portal_user(user: User) -> bool:
    return bool(getattr(user, 'is_staff_portal_user', False))


class StaffTokenObtainPairSerializer(MyTokenObtainPairSerializer):
    """
    /api/auth/login/:
    only staff-side accounts can authenticate here.
    """

    default_error_messages = {
        "staff_only": "This account does not have staff access. Use student login.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        if not is_staff_portal_user(self.user):
            raise AuthenticationFailed(self.error_messages["staff_only"], code="staff_only")
        data["portal"] = "staff"
        return data


class StudentTokenObtainPairSerializer(MyTokenObtainPairSerializer):
    """
    /api/v1/student-profile/login/:
    staff-side accounts are rejected.
    """

    default_error_messages = {
        "student_only": "This account must use staff login.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        if is_staff_portal_user(self.user):
            raise AuthenticationFailed(self.error_messages["student_only"], code="student_only")
        data["portal"] = "student"
        return data


class StudentWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'password',
            'first_name',
            'last_name',
            'phone',
            'email',
            'photo',
            'is_active',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.setdefault('is_active', True)
        user = User(**validated_data)
        user.role = UserRoleEnum.STUDENT.value
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.role = UserRoleEnum.STUDENT.value
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class TeacherWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'password',
            'first_name',
            'last_name',
            'phone',
            'email',
            'photo',
            'is_staff',
            'is_active',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.setdefault('is_active', True)
        user = User(**validated_data)
        user.role = UserRoleEnum.TEACHER.value
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.role = UserRoleEnum.TEACHER.value
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile viewing and editing."""

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'parents_phone',
            'photo',
            'gender',
            'birthday',
            'is_teacher',
            'is_staff',
            'is_superuser',
            'role',
        ]
        read_only_fields = ['id', 'username', 'is_teacher', 'is_staff', 'is_superuser', 'role']


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user serializer for nested references."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        ref_name = 'UsersUserBasic'
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'photo',
            'is_teacher',
            'is_staff',
            'role',
        ]
        read_only_fields = fields

    def get_full_name(self, obj) -> Any:
        return obj.get_full_name()


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value


class UserRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRoleEnum.choices)

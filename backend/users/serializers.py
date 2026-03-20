from typing import Any

from django.db.models import Avg, Sum
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from student_profile.models import Branch, ExamScore, Group, StudentCoins
from users.branch_scope import (
    get_accessible_branch_ids,
    get_effective_branch_id,
    is_global_branch_user,
)
from users.models import BranchMembership, User, UserRoleEnum


class UserSerializer(serializers.ModelSerializer):
    branch_ids = serializers.SerializerMethodField()
    primary_branch_id = serializers.SerializerMethodField()
    branch_names = serializers.SerializerMethodField()

    def _get_active_branch_memberships(self, obj: User):
        memberships = getattr(obj, 'branch_memberships', None)
        if memberships is None:
            return []
        return list(
            memberships.filter(is_active=True)
            .select_related('branch')
            .order_by('-is_primary', 'branch__name', 'id')
        )

    def get_branch_ids(self, obj: User) -> list[int]:
        return [membership.branch_id for membership in self._get_active_branch_memberships(obj)]

    def get_primary_branch_id(self, obj: User) -> int | None:
        memberships = self._get_active_branch_memberships(obj)
        for membership in memberships:
            if membership.is_primary:
                return membership.branch_id
        return obj.branch_id or None

    def get_branch_names(self, obj: User) -> list[str]:
        return [
            membership.branch.name
            for membership in self._get_active_branch_memberships(obj)
            if membership.branch
        ]

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
            'branch_ids',
            'primary_branch_id',
            'branch_names',
            'date_joined',
            'last_login',
        ]
        read_only_fields = [
            'id',
            'is_teacher',
            'is_staff',
            'is_superuser',
            'role',
            'branch_ids',
            'primary_branch_id',
            'branch_names',
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


class BranchMembershipWriteMixin(serializers.Serializer):
    branch_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    primary_branch_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    def _resolve_default_branch_assignment(self) -> tuple[list[int], int | None]:
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)

        if not request or not request_user or not request_user.is_authenticated:
            return [], None

        try:
            effective_branch_id = get_effective_branch_id(request, request_user)
        except Exception:
            effective_branch_id = None

        if effective_branch_id is None:
            return [], None

        return [effective_branch_id], effective_branch_id

    def validate_branch_membership_payload(self, attrs):
        branch_ids_present = 'branch_ids' in attrs
        primary_branch_present = 'primary_branch_id' in attrs

        if not branch_ids_present and not primary_branch_present:
            return attrs

        branch_ids = list(dict.fromkeys(attrs.get('branch_ids') or []))
        primary_branch_id = attrs.get('primary_branch_id')

        if primary_branch_id is not None and primary_branch_id not in branch_ids:
            branch_ids.append(primary_branch_id)

        if branch_ids:
            existing_branch_ids = set(
                Branch.objects.filter(id__in=branch_ids).values_list('id', flat=True)
            )
            missing_branch_ids = [branch_id for branch_id in branch_ids if branch_id not in existing_branch_ids]
            if missing_branch_ids:
                raise serializers.ValidationError(
                    {'branch_ids': f'Invalid branch IDs: {missing_branch_ids}'}
                )

        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        if request_user and request_user.is_authenticated and not is_global_branch_user(request_user):
            accessible_branch_ids = set(get_accessible_branch_ids(request_user))
            blocked_branch_ids = [
                branch_id for branch_id in branch_ids if branch_id not in accessible_branch_ids
            ]
            if blocked_branch_ids:
                raise serializers.ValidationError(
                    {'branch_ids': f'You do not have access to branches: {blocked_branch_ids}'}
                )

        attrs['branch_ids'] = branch_ids
        attrs['primary_branch_id'] = primary_branch_id
        return attrs

    def sync_branch_memberships(
        self,
        *,
        user: User,
        branch_ids: list[int] | None,
        primary_branch_id: int | None,
        apply_default_when_empty: bool,
    ) -> None:
        if branch_ids is None and primary_branch_id is None:
            if not apply_default_when_empty:
                return
            branch_ids, primary_branch_id = self._resolve_default_branch_assignment()
            if not branch_ids:
                return

        branch_ids = list(dict.fromkeys(branch_ids or []))

        if primary_branch_id is not None and primary_branch_id not in branch_ids:
            branch_ids.append(primary_branch_id)

        if branch_ids and primary_branch_id is None:
            primary_branch_id = branch_ids[0]

        request = self.context.get('request')
        assigned_by = getattr(request, 'user', None)
        if assigned_by and not assigned_by.is_authenticated:
            assigned_by = None

        target_branch_ids = set(branch_ids)
        memberships = {
            membership.branch_id: membership
            for membership in user.branch_memberships.all()
        }

        for branch_id, membership in memberships.items():
            if branch_id in target_branch_ids:
                update_fields = []
                if not membership.is_active:
                    membership.is_active = True
                    update_fields.append('is_active')
                if membership.is_primary:
                    membership.is_primary = False
                    update_fields.append('is_primary')
                if membership.role != user.role:
                    membership.role = user.role
                    update_fields.append('role')
                if update_fields:
                    membership.save(update_fields=update_fields + ['updated_at'])
            else:
                update_fields = []
                if membership.is_active:
                    membership.is_active = False
                    update_fields.append('is_active')
                if membership.is_primary:
                    membership.is_primary = False
                    update_fields.append('is_primary')
                if membership.role != user.role:
                    membership.role = user.role
                    update_fields.append('role')
                if update_fields:
                    membership.save(update_fields=update_fields + ['updated_at'])

        for branch_id in branch_ids:
            if branch_id in memberships:
                continue
            BranchMembership.objects.create(
                user=user,
                branch_id=branch_id,
                role=user.role,
                is_primary=False,
                is_active=True,
                assigned_by=assigned_by,
            )

        if primary_branch_id is not None and primary_branch_id in target_branch_ids:
            primary_membership = user.branch_memberships.filter(branch_id=primary_branch_id).first()
            if primary_membership:
                update_fields = []
                if not primary_membership.is_active:
                    primary_membership.is_active = True
                    update_fields.append('is_active')
                if not primary_membership.is_primary:
                    primary_membership.is_primary = True
                    update_fields.append('is_primary')
                if primary_membership.role != user.role:
                    primary_membership.role = user.role
                    update_fields.append('role')
                if update_fields:
                    primary_membership.save(update_fields=update_fields + ['updated_at'])

        next_legacy_branch_id = primary_branch_id if target_branch_ids else None
        if user.branch_id != next_legacy_branch_id:
            user.branch_id = next_legacy_branch_id
            user.save(update_fields=['branch'])


class StudentWriteSerializer(BranchMembershipWriteMixin, serializers.ModelSerializer):
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
            'branch_ids',
            'primary_branch_id',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        attrs = self.validate_branch_membership_payload(attrs)
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        branch_ids = validated_data.pop('branch_ids', None)
        primary_branch_id = validated_data.pop('primary_branch_id', None)
        validated_data.setdefault('is_active', True)
        user = User(**validated_data)
        user.role = UserRoleEnum.STUDENT.value
        user.set_password(password)
        user.save()
        self.sync_branch_memberships(
            user=user,
            branch_ids=branch_ids,
            primary_branch_id=primary_branch_id,
            apply_default_when_empty=True,
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        branch_ids = validated_data.pop('branch_ids', None)
        primary_branch_id = validated_data.pop('primary_branch_id', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.role = UserRoleEnum.STUDENT.value
        if password:
            instance.set_password(password)
        instance.save()
        self.sync_branch_memberships(
            user=instance,
            branch_ids=branch_ids,
            primary_branch_id=primary_branch_id,
            apply_default_when_empty=False,
        )
        return instance


class TeacherWriteSerializer(BranchMembershipWriteMixin, serializers.ModelSerializer):
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
            'branch_ids',
            'primary_branch_id',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        attrs = self.validate_branch_membership_payload(attrs)
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        branch_ids = validated_data.pop('branch_ids', None)
        primary_branch_id = validated_data.pop('primary_branch_id', None)
        validated_data.setdefault('is_active', True)
        user = User(**validated_data)
        user.role = UserRoleEnum.TEACHER.value
        user.set_password(password)
        user.save()
        self.sync_branch_memberships(
            user=user,
            branch_ids=branch_ids,
            primary_branch_id=primary_branch_id,
            apply_default_when_empty=True,
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        branch_ids = validated_data.pop('branch_ids', None)
        primary_branch_id = validated_data.pop('primary_branch_id', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.role = UserRoleEnum.TEACHER.value
        if password:
            instance.set_password(password)
        instance.save()
        self.sync_branch_memberships(
            user=instance,
            branch_ids=branch_ids,
            primary_branch_id=primary_branch_id,
            apply_default_when_empty=False,
        )
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

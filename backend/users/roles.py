"""Centralized role and capability matrix for backend authorization."""

from typing import Iterable

from .models import User, UserRoleEnum


DEFAULT_ROLE = UserRoleEnum.STUDENT.value
ALL_ROLES = {choice.value for choice in UserRoleEnum}

STAFF_SIDE_ROLES = {
    UserRoleEnum.TEACHER.value,
    UserRoleEnum.STAFF.value,
    UserRoleEnum.CRM_MANAGER.value,
    UserRoleEnum.LMS_MANAGER.value,
    UserRoleEnum.MANAGER.value,
    UserRoleEnum.DIRECTOR.value,
    UserRoleEnum.ADMIN.value,
    UserRoleEnum.SUPERADMIN.value,
}

GROUP_MANAGEMENT_ROLES = {
    UserRoleEnum.STAFF.value,
    UserRoleEnum.CRM_MANAGER.value,
    UserRoleEnum.LMS_MANAGER.value,
    UserRoleEnum.MANAGER.value,
    UserRoleEnum.DIRECTOR.value,
    UserRoleEnum.ADMIN.value,
    UserRoleEnum.SUPERADMIN.value,
}

ATTENDANCE_MANAGEMENT_ROLES = set(STAFF_SIDE_ROLES)

PAYMENT_MANAGEMENT_ROLES = {
    UserRoleEnum.STAFF.value,
    UserRoleEnum.CRM_MANAGER.value,
    UserRoleEnum.MANAGER.value,
    UserRoleEnum.DIRECTOR.value,
    UserRoleEnum.ADMIN.value,
    UserRoleEnum.SUPERADMIN.value,
}

ADMIN_SIDE_ROLES = {
    UserRoleEnum.ADMIN.value,
    UserRoleEnum.DIRECTOR.value,
    UserRoleEnum.SUPERADMIN.value,
}

MANAGEMENT_ROLES = {
    UserRoleEnum.MANAGER.value,
    UserRoleEnum.DIRECTOR.value,
    UserRoleEnum.ADMIN.value,
    UserRoleEnum.SUPERADMIN.value,
}

CAPABILITY_MATRIX: dict[str, set[str]] = {
    # Portal routing
    'portal.staff.access': set(STAFF_SIDE_ROLES),
    'portal.student.access': {
        UserRoleEnum.STUDENT.value,
        UserRoleEnum.PARENT.value,
    },
    # User/admin management
    'users.read_all': set(MANAGEMENT_ROLES),
    'users.manage': set(ADMIN_SIDE_ROLES),
    # Profile
    'profile.self': set(ALL_ROLES),
    # Group & schedule domain
    'groups.read': set(ALL_ROLES),
    'groups.manage': set(GROUP_MANAGEMENT_ROLES),
    'schedule.read': set(ALL_ROLES),
    'schedule.manage': set(GROUP_MANAGEMENT_ROLES),
    'attendance.read': set(ALL_ROLES),
    'attendance.manage': set(ATTENDANCE_MANAGEMENT_ROLES),
    'payments.read': set(ALL_ROLES),
    'payments.manage': set(PAYMENT_MANAGEMENT_ROLES),
    # Student domain
    'students.read': set(STAFF_SIDE_ROLES),
    'students.manage': {
        UserRoleEnum.STAFF.value,
        UserRoleEnum.CRM_MANAGER.value,
        UserRoleEnum.LMS_MANAGER.value,
        UserRoleEnum.MANAGER.value,
        UserRoleEnum.DIRECTOR.value,
        UserRoleEnum.ADMIN.value,
        UserRoleEnum.SUPERADMIN.value,
    },
    'students.reactivate': {
        UserRoleEnum.MANAGER.value,
        UserRoleEnum.DIRECTOR.value,
        UserRoleEnum.ADMIN.value,
        UserRoleEnum.SUPERADMIN.value,
    },
    'students.self': {
        UserRoleEnum.STUDENT.value,
        UserRoleEnum.PARENT.value,
    },
    # Teacher domain
    'teachers.read': set(STAFF_SIDE_ROLES),
    'teachers.manage': {
        UserRoleEnum.MANAGER.value,
        UserRoleEnum.DIRECTOR.value,
        UserRoleEnum.ADMIN.value,
        UserRoleEnum.SUPERADMIN.value,
    },
}


def _normalize_role(role: str | None) -> str:
    if role in ALL_ROLES:
        return str(role)
    return DEFAULT_ROLE


def resolve_user_role(user: User) -> str:
    role = getattr(user, 'role', None)
    if role in ALL_ROLES:
        return str(role)
    # Legacy fallback for records created before explicit role migration.
    return _normalize_role(user.infer_role_from_legacy_flags())


def has_capability(user: User, capability: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    role = _normalize_role(resolve_user_role(user))
    allowed_roles = CAPABILITY_MATRIX.get(capability)
    if allowed_roles is None:
        return False
    return role in allowed_roles


def allowed_roles_for(capability: str) -> Iterable[str]:
    return CAPABILITY_MATRIX.get(capability, set())

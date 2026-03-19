"""
Branch scoping helpers for multi-branch data isolation.

Design goals:
- Superusers can query all branches (optional explicit branch filter).
- Scoped users can operate only on their assigned branches.
- Backward compatible with legacy `User.branch` field.
"""

from __future__ import annotations

from typing import Optional

from django.db.models import Q
from rest_framework.exceptions import PermissionDenied


BRANCH_QUERY_KEYS = ('active_branch', 'branch_id', 'branch')
BRANCH_HEADER_KEYS = ('HTTP_X_ACTIVE_BRANCH', 'HTTP_X_BRANCH_ID')


def _parse_int(value) -> Optional[int]:
    if value in (None, ''):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def is_global_branch_user(user) -> bool:
    return bool(user and user.is_authenticated and user.is_superuser)


def get_accessible_branch_ids(user) -> list[int]:
    if not user or not user.is_authenticated:
        return []

    branch_ids: list[int] = []
    if getattr(user, 'pk', None):
        memberships = getattr(user, 'branch_memberships', None)
        if memberships is not None:
            branch_ids = list(
                memberships.filter(is_active=True).values_list('branch_id', flat=True)
            )

    legacy_branch_id = getattr(user, 'branch_id', None)
    if legacy_branch_id and legacy_branch_id not in branch_ids:
        branch_ids.append(legacy_branch_id)

    return branch_ids


def get_requested_branch_id(request) -> Optional[int]:
    if request is None:
        return None

    for key in BRANCH_QUERY_KEYS:
        value = request.query_params.get(key)
        parsed = _parse_int(value)
        if parsed is not None:
            return parsed

    meta = getattr(request, 'META', {})
    for key in BRANCH_HEADER_KEYS:
        parsed = _parse_int(meta.get(key))
        if parsed is not None:
            return parsed

    return None


def get_effective_branch_id(request, user) -> Optional[int]:
    """
    Resolve active branch ID for the current request/user context.
    """
    requested_branch_id = get_requested_branch_id(request)

    if is_global_branch_user(user):
        return requested_branch_id

    accessible_branch_ids = get_accessible_branch_ids(user)
    if not accessible_branch_ids:
        return None

    if requested_branch_id is not None:
        if requested_branch_id not in accessible_branch_ids:
            raise PermissionDenied('You do not have access to the selected branch.')
        return requested_branch_id

    primary_branch_id = None
    getter = getattr(user, 'get_primary_branch_id', None)
    if callable(getter):
        primary_branch_id = getter()
    if primary_branch_id and primary_branch_id in accessible_branch_ids:
        return primary_branch_id

    return accessible_branch_ids[0]


def ensure_user_can_access_branch(user, branch_id: Optional[int]) -> None:
    """
    Raise PermissionDenied when a scoped user tries to access another branch.
    """
    if branch_id is None or is_global_branch_user(user):
        return

    accessible_branch_ids = get_accessible_branch_ids(user)
    if accessible_branch_ids and branch_id not in accessible_branch_ids:
        raise PermissionDenied('You do not have access to this branch.')


def apply_branch_scope(queryset, request, user, field_name='branch', include_unassigned=False):
    """
    Scope queryset by branch relation field.

    Example:
        apply_branch_scope(Group.objects.all(), request, user, field_name='branch')
        apply_branch_scope(Payment.objects.all(), request, user, field_name='group__branch')
    """
    effective_branch_id = get_effective_branch_id(request, user)

    if is_global_branch_user(user):
        if effective_branch_id is None:
            return queryset
        return queryset.filter(**{f'{field_name}_id': effective_branch_id})

    if effective_branch_id is None:
        return queryset.none()

    branch_filter = Q(**{f'{field_name}_id': effective_branch_id})
    if include_unassigned:
        branch_filter |= Q(**{f'{field_name}__isnull': True})

    return queryset.filter(branch_filter)

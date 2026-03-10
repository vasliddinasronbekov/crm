"""
Role-aware permission classes built on top of centralized capability matrix.
"""

from rest_framework.permissions import BasePermission

from .roles import has_capability


class HasRoleCapability(BasePermission):
    """
    Resolve required capability from a view and enforce it.

    View integration options:
    - `required_capability = 'capability.key'`
    - `action_capabilities = {'list': 'capability.key', ...}` for ViewSets
    """

    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        method = request.method.lower()
        method_map = getattr(view, 'method_capabilities', {}) or {}
        capability = method_map.get(method)

        action = getattr(view, 'action', None)
        action_map = getattr(view, 'action_capabilities', {}) or {}
        if capability is None:
            capability = action_map.get(action) if action else None
        if capability is None:
            capability = getattr(view, 'required_capability', None)

        # If a view does not specify capability mapping, do not block by default.
        if capability is None:
            return True

        allowed = has_capability(user, capability)
        if not allowed:
            self.message = f'Role does not allow capability: {capability}'
        return allowed

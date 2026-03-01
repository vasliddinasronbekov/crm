from rest_framework import permissions


class IsTeacherOrReadOnly(permissions.BasePermission):
    """
    Write access for teachers/staff/admins.
    Read access for any authenticated user.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_teacher or user.is_staff or user.is_superuser)
        )

# --- YANGI KLASS ---
class IsAdminOrGroupOwnerOrReadOnly(permissions.BasePermission):
    """
    Yangi guruh yaratishga faqat o'qituvchi/adminga ruxsat.
    Guruhni o'zgartirish/o'chirishga faqat o'sha guruhning asosiy o'qituvchisi 
    yoki adminga ruxsat.
    Ko'rishga (GET) hammaga ruxsat.
    """
    def has_permission(self, request, view):
        # Ro'yxatni ko'rish (GET) yoki yangi guruh yaratish (POST) uchun ruxsatlar
        if view.action == 'list' or view.action == 'retrieve': # GET so'rovlari
            return True
        if view.action == 'create': # POST so'rovi
            return request.user.is_authenticated and (
                request.user.is_teacher or request.user.is_staff or request.user.is_superuser
            )
        # Boshqa amallar (PUT, DELETE) ob'ekt darajasida tekshiriladi
        return True

    def has_object_permission(self, request, view, obj):
        # Ob'ektni ko'rishga (GET) hammaga ruxsat
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Ob'ektni o'zgartirish/o'chirishga faqat uning asosiy o'qituvchisi yoki adminga ruxsat
        return obj.main_teacher == request.user or request.user.is_staff or request.user.is_superuser


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Write access for platform admins (staff/superuser).
    Read access for any authenticated user.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


# --- EXAM CREATION & APPROVAL PERMISSIONS ---

class IsStaffOrAdmin(permissions.BasePermission):
    """
    Permission for staff members (teachers) and admins
    Used for creating and managing exam drafts
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_teacher or request.user.is_staff or request.user.is_superuser)
        )


class IsLMSHead(permissions.BasePermission):
    """
    Permission for LMS heads (staff/admins who can approve exams)
    Used for final exam approval and rejection
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)
        )

    def has_object_permission(self, request, view, obj):
        """
        LMS heads can access all exam drafts for review
        """
        return request.user.is_staff or request.user.is_superuser

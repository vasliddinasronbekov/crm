# task/permissions.py
from rest_framework import permissions

class IsBoardMemberOrTeacher(permissions.BasePermission):
    """
    Faqat doska a'zosi yoki o'qituvchisi ob'ektni ko'ra/o'zgartira oladi
    """
    def has_object_permission(self, request, view, obj):
        # O'qish uchun ruxsatlar (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return obj.users.filter(pk=request.user.pk).exists() or obj.teachers.filter(pk=request.user.pk).exists()
        
        # Yozish/o'chirish uchun ruxsatlar (faqat o'qituvchi)
        return obj.teachers.filter(pk=request.user.pk).exists()
# /mnt/usb/edu-api-project/crm/permissions.py

from rest_framework import permissions

class IsAdminOrResponsiblePerson(permissions.BasePermission):
    """
    Ob'ektni ko'rishga hammaga ruxsat.
    Ob'ektni o'zgartirish/o'chirishga faqat unga mas'ul xodimga yoki adminga ruxsat.
    """
    def has_object_permission(self, request, view, obj):
        # O'qish uchun (GET) so'rovlarga har doim ruxsat
        if request.method in permissions.SAFE_METHODS:
            return True

        # Yozish uchun (PUT, PATCH, DELETE) so'rovlarga faqat mas'ul shaxs
        # yoki superuserga ruxsat beriladi.
        return obj.responsible_person == request.user or request.user.is_superuser
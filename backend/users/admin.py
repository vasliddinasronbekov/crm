# /mnt/usb/edu-api-project/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = UserAdmin.list_display + ('role', 'is_teacher')
    list_filter = UserAdmin.list_filter + ('role', 'is_teacher')
    fieldsets = UserAdmin.fieldsets + (
        (
            'Platform Roles',
            {
                'fields': (
                    'role',
                    'is_teacher',
                    'phone',
                    'parents_phone',
                    'gender',
                    'birthday',
                    'photo',
                    'region',
                    'salary_percentage',
                    'rank',
                    'branch',
                )
            },
        ),
    )

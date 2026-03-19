# /mnt/usb/edu-api-project/users/admin.py

from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.admin import UserAdmin
from .models import BranchMembership, User, UserRoleEnum
from student_profile.accounting_models import StudentAccount
from student_profile.services.financial_automation import set_student_account_status


class BranchMembershipInline(admin.TabularInline):
    model = BranchMembership
    fk_name = 'user'
    extra = 0
    fields = ('branch', 'role', 'is_primary', 'is_active', 'assigned_by', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = UserAdmin.list_display + ('role', 'is_teacher')
    list_filter = UserAdmin.list_filter + ('role', 'is_teacher')
    actions = ['activate_students', 'freeze_students', 'deactivate_students']
    inlines = [BranchMembershipInline]
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

    @admin.action(description='Activate selected students')
    def activate_students(self, request, queryset):
        self._bulk_update_student_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_ACTIVE,
            action_name='activated',
        )

    @admin.action(description='Freeze selected students')
    def freeze_students(self, request, queryset):
        self._bulk_update_student_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_FROZEN,
            action_name='frozen',
        )

    @admin.action(description='Deactivate selected students')
    def deactivate_students(self, request, queryset):
        self._bulk_update_student_status(
            request,
            queryset,
            target_status=StudentAccount.STATUS_DEACTIVATED,
            action_name='deactivated',
        )

    def _bulk_update_student_status(self, request, queryset, *, target_status: str, action_name: str):
        students = queryset.filter(role=UserRoleEnum.STUDENT.value)
        if not students.exists():
            self.message_user(
                request,
                'No student accounts selected. Please select users with role=student.',
                level=messages.WARNING,
            )
            return

        changed = 0
        for student in students:
            existing_account = getattr(student, 'student_account', None)
            before_status = (
                existing_account.status
                if existing_account is not None
                else StudentAccount.STATUS_ACTIVE
            )
            account = set_student_account_status(
                student=student,
                target_status=target_status,
                actor=request.user,
                reason='django_admin_user_action',
            )
            if account.status != before_status:
                changed += 1

        self.message_user(
            request,
            f'{changed} student account(s) {action_name}.',
            level=messages.SUCCESS,
        )

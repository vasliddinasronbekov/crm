# /mnt/usb/edu-api-project/users/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from core.models import Region

class GenderEnum(models.TextChoices):
    MALE = 'Male', 'Male'
    FEMALE = 'Female', 'Female'


class UserRoleEnum(models.TextChoices):
    STUDENT = 'student', 'Student'
    PARENT = 'parent', 'Parent'
    TEACHER = 'teacher', 'Teacher'
    STAFF = 'staff', 'Staff'
    CRM_MANAGER = 'crm_manager', 'CRM Manager'
    LMS_MANAGER = 'lms_manager', 'LMS Manager'
    MANAGER = 'manager', 'Manager'
    DIRECTOR = 'director', 'Director'
    ADMIN = 'admin', 'Admin'
    SUPERADMIN = 'superadmin', 'Super Admin'


class User(AbstractUser):
    # AbstractUser o'zida username, first_name, last_name, email, password 
    # kabi standart maydonlarni saqlaydi.

    # Biz qo'shgan asosiy maydonlar
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_teacher = models.BooleanField(default=False)
    role = models.CharField(
        max_length=32,
        choices=UserRoleEnum.choices,
        default=UserRoleEnum.STUDENT.value,
        db_index=True,
        help_text="Primary role used by role-based access control matrix.",
    )
    
    # Keyinchalik qo'shilgan, profil uchun maydonlar
    parents_phone = models.CharField(max_length=20, blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GenderEnum.choices, blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)
    photo = models.ImageField(upload_to='user_photos/', blank=True, null=True)
    
    # `CharField`'dan `ForeignKey`'ga o'zgartirilgan maydon
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, blank=True, null=True)
    
    # HR moduli uchun qo'shilgan maydon
    salary_percentage = models.PositiveIntegerField(default=40, help_text="O'qituvchining to'lovlardan oladigan foizi")

    # Reytingni saqlash uchun maydon
    rank = models.PositiveIntegerField(null=True, blank=True, default=0, help_text="Talabaning hisoblangan reytingdagi o'rni")

    # Ko'p filialli tizim uchun maydon
    branch = models.ForeignKey(
        'student_profile.Branch', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='staff'
    )

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

    def infer_role_from_legacy_flags(self) -> str:
        """Derive role from legacy booleans for backward compatibility."""
        if self.is_superuser:
            return UserRoleEnum.SUPERADMIN.value
        if self.is_teacher:
            return UserRoleEnum.TEACHER.value
        if self.is_staff:
            return UserRoleEnum.ADMIN.value
        return UserRoleEnum.STUDENT.value

    def sync_legacy_flags_from_role(self) -> None:
        """
        Keep legacy boolean flags in sync with explicit role.
        Legacy checks still exist across the codebase.
        """
        if self.role == UserRoleEnum.SUPERADMIN.value:
            self.is_superuser = True
            self.is_staff = True
            self.is_teacher = False
            return

        # Non-superadmin roles should not keep superuser privileges.
        self.is_superuser = False

        if self.role in {
            UserRoleEnum.ADMIN.value,
            UserRoleEnum.DIRECTOR.value,
            UserRoleEnum.MANAGER.value,
            UserRoleEnum.CRM_MANAGER.value,
            UserRoleEnum.LMS_MANAGER.value,
            UserRoleEnum.STAFF.value,
        }:
            self.is_staff = True
            self.is_teacher = False
            return

        if self.role == UserRoleEnum.TEACHER.value:
            self.is_teacher = True
            # Preserve explicit staff grant for hybrid teacher accounts.
            self.is_staff = bool(self.is_staff)
            return

        # Student/parent roles are non-staff, non-teacher by default.
        self.is_staff = False
        self.is_teacher = False

    @property
    def is_staff_portal_user(self) -> bool:
        return (
            self.role in self.STAFF_SIDE_ROLES
            or self.is_superuser
            or self.is_staff
            or self.is_teacher
        )

    @property
    def is_student_portal_user(self) -> bool:
        return (
            self.role in {UserRoleEnum.STUDENT.value, UserRoleEnum.PARENT.value}
            and not self.is_staff_portal_user
        )

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            update_fields = set(update_fields)

        # If legacy code sets booleans but not role, infer role before sync.
        if (
            not self.role
            or (
                self.role == UserRoleEnum.STUDENT.value
                and (self.is_superuser or self.is_staff or self.is_teacher)
            )
        ):
            self.role = self.infer_role_from_legacy_flags()

        self.sync_legacy_flags_from_role()

        if update_fields is not None:
            # Persist synchronized security fields even when caller updates a single field.
            update_fields.update({'role', 'is_staff', 'is_superuser', 'is_teacher'})
            kwargs['update_fields'] = update_fields

        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

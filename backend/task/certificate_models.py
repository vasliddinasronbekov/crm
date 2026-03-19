"""
Certificate Generation Models
Handles course completion certificates with QR verification
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class Certificate(models.Model):
    """Course completion certificates"""

    # Unique certificate ID for verification
    certificate_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Student and course info
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='certificates')
    course = models.ForeignKey('student_profile.Course', on_delete=models.CASCADE, related_name='certificates')
    template = models.ForeignKey('CertificateTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='certificates')

    # Certificate details
    issued_date = models.DateTimeField(default=timezone.now)
    completion_date = models.DateField()
    grade = models.CharField(max_length=10, blank=True)  # A, B, C or percentage
    hours_completed = models.PositiveIntegerField(default=0)

    # File storage
    certificate_file = models.FileField(upload_to='certificates/%Y/%m/', blank=True, null=True)

    # Verification
    is_verified = models.BooleanField(default=True)
    verification_url = models.URLField(blank=True)

    # Metadata
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='issued_certificates')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issued_date']
        unique_together = ['student', 'course']

    def __str__(self):
        return f"Certificate {self.certificate_id} - {self.student.get_full_name()} - {self.course.name}"

    @property
    def verification_code(self) -> str:
        """Short verification code"""
        return str(self.certificate_id).split('-')[0].upper()

    @property
    def student_name(self) -> str:
        """Full student name"""
        return self.student.get_full_name()

    @property
    def course_name(self) -> str:
        """Course name"""
        return self.course.name


class CertificateTemplate(models.Model):
    """Certificate design templates"""

    TEMPLATE_TYPES = [
        ('standard', 'Standard Certificate'),
        ('honors', 'Certificate with Honors'),
        ('completion', 'Certificate of Completion'),
        ('achievement', 'Certificate of Achievement'),
    ]

    name = models.CharField(max_length=255)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES, default='standard')
    branch = models.ForeignKey(
        'student_profile.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certificate_templates',
        help_text='Template ownership scope. Null means global template.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_certificate_templates',
    )

    # Design customization
    background_image = models.ImageField(upload_to='certificate_templates/', blank=True, null=True)
    background_color = models.CharField(max_length=7, default='#FFFFFF')  # Hex color
    text_color = models.CharField(max_length=7, default='#000000')
    border_color = models.CharField(max_length=7, default='#FFD700')

    # Text positioning (JSON with coordinates)
    layout_config = models.JSONField(default=dict, blank=True)

    # Template settings
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} ({'Default' if self.is_default else 'Custom'})"


class CertificateVerification(models.Model):
    """Track certificate verification attempts"""

    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name='verifications')
    verified_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ['-verified_at']

    def __str__(self):
        return f"Verification of {self.certificate.certificate_id} at {self.verified_at}"

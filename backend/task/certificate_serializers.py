"""
Certificate API Serializers
"""
from typing import Any

from rest_framework import serializers
from .certificate_models import Certificate, CertificateTemplate, CertificateVerification


class CertificateSerializer(serializers.ModelSerializer):
    """Certificate serializer"""

    student_name = serializers.ReadOnlyField()
    course_name = serializers.ReadOnlyField()
    verification_code = serializers.ReadOnlyField()
    certificate_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)
    issued_by_name = serializers.SerializerMethodField()
    verification_count = serializers.SerializerMethodField()
    last_verified_at = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            'id', 'certificate_id', 'student', 'course',
            'student_name', 'course_name',
            'template', 'template_name',
            'issued_date', 'completion_date', 'grade', 'hours_completed',
            'certificate_file', 'certificate_url',
            'download_url',
            'is_verified', 'verification_url', 'verification_code',
            'issued_by', 'issued_by_name',
            'notes', 'verification_count', 'last_verified_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'certificate_id', 'issued_date', 'verification_url',
            'created_at', 'updated_at',
        ]

    def get_certificate_url(self, obj) -> Any:
        """Get full URL to certificate file"""
        if obj.certificate_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.certificate_file.url)
            return obj.certificate_file.url
        return None

    def get_download_url(self, obj) -> Any:
        request = self.context.get('request')
        if not request:
            return None
        return request.build_absolute_uri(f'/api/task/certificates/{obj.id}/download/')

    def get_issued_by_name(self, obj) -> Any:
        if not obj.issued_by:
            return ''
        return obj.issued_by.get_full_name().strip() or obj.issued_by.username

    def get_verification_count(self, obj) -> Any:
        annotated_value = getattr(obj, 'verification_count', None)
        if annotated_value is not None:
            return annotated_value
        return obj.verifications.count()

    def get_last_verified_at(self, obj) -> Any:
        annotated_value = getattr(obj, 'last_verified_at', None)
        if annotated_value is not None:
            return annotated_value
        last_verification = obj.verifications.order_by('-verified_at').first()
        return last_verification.verified_at if last_verification else None


class CertificateCreateSerializer(serializers.Serializer):
    """Serializer for generating certificates"""

    student_id = serializers.IntegerField()
    course_id = serializers.IntegerField()
    template_id = serializers.IntegerField(required=False)
    grade = serializers.CharField(max_length=10, required=False, allow_blank=True)
    hours_completed = serializers.IntegerField(default=0)
    completion_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    force_regenerate = serializers.BooleanField(required=False, default=False)

    def validate_student_id(self, value):
        """Validate student exists and is not a teacher"""
        from users.models import User
        try:
            user = User.objects.get(id=value)
            if user.is_teacher:
                raise serializers.ValidationError("Certificates can only be issued to students, not teachers.")
        except User.DoesNotExist:
            raise serializers.ValidationError("A user with this ID does not exist.")
        return value

    def validate_course_id(self, value):
        """Validate course exists"""
        from student_profile.models import Course
        try:
            Course.objects.get(id=value)
        except Course.DoesNotExist:
            raise serializers.ValidationError("Course not found")
        return value

    def validate_template_id(self, value):
        """Validate template exists and is active."""
        if not value:
            return value
        try:
            template = CertificateTemplate.objects.get(id=value)
        except CertificateTemplate.DoesNotExist:
            raise serializers.ValidationError("Template not found")
        if not template.is_active:
            raise serializers.ValidationError("Selected template is inactive")
        return value

    def validate_completion_date(self, value):
        from django.utils import timezone

        if value > timezone.now().date():
            raise serializers.ValidationError("Completion date cannot be in the future")
        return value

    def validate_hours_completed(self, value):
        if value < 0:
            raise serializers.ValidationError("Hours completed cannot be negative")
        return value


class CertificateTemplateSerializer(serializers.ModelSerializer):
    """Certificate template serializer"""

    background_image_url = serializers.SerializerMethodField()
    certificate_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CertificateTemplate
        fields = [
            'id', 'name', 'template_type',
            'background_image', 'background_image_url',
            'background_color', 'text_color', 'border_color',
            'layout_config',
            'is_active', 'is_default',
            'certificate_count',
            'created_at', 'updated_at',
        ]

    def get_background_image_url(self, obj) -> Any:
        if not obj.background_image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.background_image.url)
        return obj.background_image.url


class CertificateVerificationSerializer(serializers.ModelSerializer):
    """Certificate verification serializer"""

    certificate_details = CertificateSerializer(source='certificate', read_only=True)

    class Meta:
        model = CertificateVerification
        fields = ['id', 'certificate', 'certificate_details', 'verified_at', 'ip_address']
        read_only_fields = ['verified_at', 'ip_address']

# /mnt/usb/edu-api-project/hr/serializers.py

from rest_framework import serializers
from .models import TeacherSalary, Salary

class SalaryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Salary
        fields = ('mentor', 'group', 'amount', 'month')

class SalarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Salary
        fields = '__all__'

    def validate_mentor(self, value):
        """Ensure mentor is not null and exists"""
        if value is None:
            raise serializers.ValidationError("Mentor is required")
        if not value.id:
            raise serializers.ValidationError("Valid mentor ID is required")
        return value

    def validate_group(self, value):
        """Ensure group is not null and exists"""
        if value is None:
            raise serializers.ValidationError("Group is required")
        if not value.id:
            raise serializers.ValidationError("Valid group ID is required")
        return value

    def validate_amount(self, value):
        """Ensure amount is positive"""
        if value is None or value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value
# Oylik hisoblash uchun kiruvchi ma'lumotlarni tekshirish uchun serializer
class CalculateSalarySerializer(serializers.Serializer):
    teacher_id = serializers.IntegerField(required=True)
    month = serializers.CharField(required=True, help_text="Format: YYYY-MM, masalan: 2025-08")


class TeacherSalaryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherSalary
        fields = ('teacher', 'amount', 'month', 'status', 'comment')


# Oylik maoshi modelini JSON'ga o'girish uchun serializer
class TeacherSalarySerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherSalary
        fields = '__all__'

    def validate_teacher(self, value):
        """Ensure teacher is not null and exists"""
        if value is None:
            raise serializers.ValidationError("Teacher is required")
        if not value.id:
            raise serializers.ValidationError("Valid teacher ID is required")
        return value

    def validate_amount(self, value):
        """Ensure amount is positive"""
        if value is None or value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value

# /mnt/usb/edu-api-project/crm/serializers.py

from rest_framework import serializers
from .models import Source, LeadDepartment, SubDepartment, Lead

class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = '__all__'

class LeadDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadDepartment
        fields = '__all__'

class SubDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubDepartment
        fields = '__all__'
        depth = 1 # Qaysi asosiy bo'limga tegishli ekanligini ham ko'rsatish uchun

class LeadSerializer(serializers.ModelSerializer):
    # Add computed fields for frontend compatibility
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    email = serializers.CharField(required=False, allow_blank=True, default='')
    # Override to return string instead of object
    source = serializers.SerializerMethodField()
    # Make full_name not required for validation (we'll build it from first/last name)
    full_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Lead
        fields = '__all__'

    def get_first_name(self, obj):
        """Split full_name into first_name for frontend compatibility"""
        if obj.full_name:
            parts = obj.full_name.split(' ', 1)
            return parts[0] if parts else ''
        return ''

    def get_last_name(self, obj):
        """Split full_name into last_name for frontend compatibility"""
        if obj.full_name:
            parts = obj.full_name.split(' ', 1)
            return parts[1] if len(parts) > 1 else ''
        return ''

    def get_source(self, obj):
        """Return source name as string instead of object"""
        if obj.source:
            return obj.source.name
        return 'Direct'

    def create(self, validated_data):
        """Handle first_name + last_name from frontend, combine into full_name"""
        first_name = self.initial_data.get('first_name', '')
        last_name = self.initial_data.get('last_name', '')

        # Combine first_name and last_name into full_name (required field)
        full_name = f"{first_name} {last_name}".strip()
        if not full_name:
            # If no names provided, use phone as fallback
            full_name = validated_data.get('phone', 'Unknown')
        validated_data['full_name'] = full_name

        # Handle source if provided as string instead of ID
        source_name = self.initial_data.get('source')
        if source_name and isinstance(source_name, str):
            source_obj, _ = Source.objects.get_or_create(name=source_name)
            validated_data['source'] = source_obj

        # Remove email if provided (not in model)
        validated_data.pop('email', None)
        validated_data.pop('first_name', None)
        validated_data.pop('last_name', None)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Handle first_name + last_name from frontend, combine into full_name"""
        first_name = self.initial_data.get('first_name', '')
        last_name = self.initial_data.get('last_name', '')

        if first_name or last_name:
            validated_data['full_name'] = f"{first_name} {last_name}".strip()

        # Handle source if provided as string instead of ID
        source_name = self.initial_data.get('source')
        if source_name and isinstance(source_name, str):
            source_obj, _ = Source.objects.get_or_create(name=source_name)
            validated_data['source'] = source_obj

        # Remove email if provided (not in model)
        validated_data.pop('email', None)
        validated_data.pop('first_name', None)
        validated_data.pop('last_name', None)

        return super().update(instance, validated_data)
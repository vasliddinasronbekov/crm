from rest_framework import serializers
from .models import Report

class LeaderboardSerializer(serializers.Serializer):
    """
    Unified leaderboard payload for web and mobile clients.
    """

    id = serializers.IntegerField()
    student = serializers.IntegerField()
    student_id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    student_name = serializers.CharField()
    rank = serializers.IntegerField()
    score = serializers.FloatField()
    avg_score = serializers.FloatField()
    coins = serializers.IntegerField()
    xp_points = serializers.IntegerField()
    level = serializers.IntegerField()
    badges_count = serializers.IntegerField()
    achievements = serializers.IntegerField()
    completed_courses = serializers.IntegerField()
    branch_name = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    photo = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    avatar = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    is_current_user = serializers.BooleanField(required=False)


class ReportSerializer(serializers.Serializer):
    """
    Serializer for report data.
    """
    report_type = serializers.CharField(max_length=100)
    period = serializers.CharField(max_length=50)
    generated_at = serializers.DateTimeField(read_only=True)
    status = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)


class ReportGenerateRequestSerializer(serializers.Serializer):
    report_type = serializers.CharField(max_length=100)
    period = serializers.ChoiceField(
        choices=['week', 'month', 'quarter', 'year', 'custom'],
        required=False,
        default='month',
    )
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'end_date must be greater than or equal to start_date'})
        return attrs


class ReportListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='report_id', read_only=True)
    type = serializers.CharField(source='report_type', read_only=True)
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id',
            'report_id',
            'type',
            'report_type',
            'title',
            'description',
            'period',
            'start_date',
            'end_date',
            'status',
            'generated_by',
            'generated_by_name',
            'generated_at',
            'updated_at',
            'summary',
        ]
        read_only_fields = fields

    def get_generated_by_name(self, obj):
        if not obj.generated_by:
            return 'System'
        full_name = f'{obj.generated_by.first_name} {obj.generated_by.last_name}'.strip()
        return full_name or obj.generated_by.username


class ReportDetailSerializer(ReportListSerializer):
    class Meta(ReportListSerializer.Meta):
        fields = ReportListSerializer.Meta.fields + [
            'data',
            'charts',
            'error_message',
            'pdf_file',
            'csv_file',
        ]

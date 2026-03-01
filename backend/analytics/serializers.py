from rest_framework import serializers

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

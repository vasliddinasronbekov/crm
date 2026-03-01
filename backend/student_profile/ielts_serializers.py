"""
IELTS Exam Serializers
"""

from rest_framework import serializers
from .ielts_models import IELTSExam, IELTSQuestion, IELTSAttempt, IELTSAnswer, IELTSSection
from .services.coin_wallet import get_student_coin_balance


def _listify_feedback(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        normalized = value.replace('\r', '\n')
        return [part.strip('- ').strip() for part in normalized.split('\n') if part.strip()]
    return []


class IELTSExamSerializer(serializers.ModelSerializer):
    """
    Serializer for IELTS Exam sections
    """
    section_display = serializers.CharField(source='get_section_display', read_only=True)
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = IELTSExam
        fields = [
            'id', 'section', 'section_display', 'title', 'description',
            'coin_cost', 'coin_refund', 'time_limit_minutes',
            'passing_band_score', 'instructions', 'is_active',
            'questions_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_questions_count(self, obj):
        return obj.questions.count()


class IELTSQuestionSerializer(serializers.ModelSerializer):
    """
    Serializer for IELTS Questions
    """
    question_type_display = serializers.CharField(source='get_question_type_display', read_only=True)

    class Meta:
        model = IELTSQuestion
        fields = [
            'id', 'exam', 'question_type', 'question_type_display',
            'order', 'passage_text', 'audio_file', 'question_text',
            'options', 'points', 'speaking_prompts', 'time_limit_seconds'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """
        Hide correct_answer from students
        """
        data = super().to_representation(instance)
        request = self.context.get('request')

        # Only show correct answers to staff
        if request and not request.user.is_staff:
            data.pop('correct_answer', None)

        return data


class IELTSAnswerSerializer(serializers.ModelSerializer):
    """
    Serializer for student answers
    """
    question_details = IELTSQuestionSerializer(source='question', read_only=True)

    class Meta:
        model = IELTSAnswer
        fields = [
            'id', 'attempt', 'question', 'question_details',
            'text_answer', 'selected_option', 'essay_content',
            'word_count', 'audio_response', 'transcription',
            'is_correct', 'points_earned', 'ai_score', 'ai_feedback',
            'time_taken_seconds', 'created_at'
        ]
        read_only_fields = [
            'id', 'is_correct', 'points_earned', 'ai_score',
            'ai_feedback', 'transcription', 'created_at'
        ]


class IELTSAttemptSerializer(serializers.ModelSerializer):
    """
    Serializer for IELTS attempts
    """
    exam_details = IELTSExamSerializer(source='exam', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    answers = IELTSAnswerSerializer(many=True, read_only=True)
    can_refund = serializers.SerializerMethodField()
    overall_feedback = serializers.SerializerMethodField()
    rubric_cards = serializers.SerializerMethodField()
    strengths_list = serializers.SerializerMethodField()
    weaknesses_list = serializers.SerializerMethodField()
    recommendations_list = serializers.SerializerMethodField()
    question_feedback = serializers.SerializerMethodField()
    response_feedback = serializers.SerializerMethodField()
    is_pending_evaluation = serializers.SerializerMethodField()

    class Meta:
        model = IELTSAttempt
        fields = [
            'id', 'student', 'student_name', 'exam', 'exam_details',
            'attempt_number', 'status', 'status_display',
            'coins_paid', 'coins_refunded',
            'started_at', 'submitted_at', 'completed_at',
            'time_taken_seconds', 'raw_score', 'band_score',
            'ai_evaluation', 'ai_evaluated_at',
            'strengths', 'weaknesses', 'recommendations',
            'answers', 'can_refund', 'overall_feedback', 'rubric_cards',
            'strengths_list', 'weaknesses_list', 'recommendations_list',
            'question_feedback', 'response_feedback', 'is_pending_evaluation', 'created_at'
        ]
        read_only_fields = [
            'id', 'student', 'attempt_number', 'coins_paid',
            'coins_refunded', 'started_at', 'submitted_at',
            'completed_at', 'raw_score', 'band_score',
            'ai_evaluation', 'ai_evaluated_at', 'created_at'
        ]

    def get_can_refund(self, obj):
        """Check if attempt is eligible for refund"""
        return (
            obj.status == 'completed' and
            obj.band_score >= obj.exam.passing_band_score and
            obj.coins_refunded == 0
        )

    def get_overall_feedback(self, obj):
        return (
            obj.ai_evaluation.get('overall_feedback')
            or obj.ai_evaluation.get('overall_assessment')
            or obj.recommendations
            or ''
        )

    def get_rubric_cards(self, obj):
        cards = obj.ai_evaluation.get('rubric_cards')
        if isinstance(cards, list):
            return cards

        if obj.exam.section in {IELTSSection.READING, IELTSSection.LISTENING}:
            return [
                {
                    'key': 'accuracy',
                    'label': 'Accuracy',
                    'score': float(obj.band_score),
                    'summary': f'Auto-graded from {obj.raw_score} points.',
                }
            ]
        return []

    def get_strengths_list(self, obj):
        source = obj.ai_evaluation.get('strengths_list') or obj.ai_evaluation.get('overall_strengths') or obj.strengths
        return _listify_feedback(source)

    def get_weaknesses_list(self, obj):
        source = obj.ai_evaluation.get('weaknesses_list') or obj.ai_evaluation.get('overall_weaknesses') or obj.weaknesses
        return _listify_feedback(source)

    def get_recommendations_list(self, obj):
        source = obj.ai_evaluation.get('recommendations_list') or obj.recommendations
        return _listify_feedback(source)

    def get_question_feedback(self, obj):
        feedback_items = []
        for answer in obj.answers.all():
            if not answer.ai_feedback and not answer.ai_score:
                continue
            feedback_items.append({
                'question_id': answer.question_id,
                'question_text': answer.question.question_text,
                'feedback': answer.ai_feedback,
                'score': answer.ai_score,
                'word_count': answer.word_count,
                'transcription': answer.transcription,
            })
        return feedback_items

    def get_response_feedback(self, obj):
        evaluations = obj.ai_evaluation.get('essays') or obj.ai_evaluation.get('responses') or []
        label_prefix = 'Task' if obj.exam.section == IELTSSection.WRITING else 'Response'
        items = []

        for index, answer in enumerate(obj.answers.all(), start=1):
            evaluation = {}
            if index - 1 < len(evaluations) and isinstance(evaluations[index - 1], dict):
                evaluation = evaluations[index - 1]
            elif isinstance(answer.ai_score, dict):
                evaluation = answer.ai_score

            if not evaluation and not answer.ai_feedback:
                continue

            items.append({
                'label': f'{label_prefix} {index}',
                'question_id': answer.question_id,
                'band_score': evaluation.get('band_score'),
                'feedback': answer.ai_feedback or evaluation.get('feedback', ''),
                'strengths': _listify_feedback(evaluation.get('strengths')),
                'weaknesses': _listify_feedback(evaluation.get('weaknesses')),
            })

        return items

    def get_is_pending_evaluation(self, obj):
        return obj.status in {'submitted', 'evaluating'}


class IELTSAttemptCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new IELTS attempts (payment)
    """
    class Meta:
        model = IELTSAttempt
        fields = ['exam']

    def create(self, validated_data):
        """
        Create new attempt and deduct coins
        """
        user = self.context['request'].user
        exam = validated_data['exam']
        current_balance = get_student_coin_balance(user)

        # Check if user has enough coins
        if current_balance < exam.coin_cost:
            raise serializers.ValidationError({
                'detail': f'Insufficient coins. You need {exam.coin_cost} coins but have {current_balance} coins.'
            })

        # Get next attempt number
        last_attempt = IELTSAttempt.objects.filter(
            student=user,
            exam=exam
        ).order_by('-attempt_number').first()

        attempt_number = 1 if not last_attempt else last_attempt.attempt_number + 1

        # Create attempt
        attempt = IELTSAttempt.objects.create(
            student=user,
            exam=exam,
            attempt_number=attempt_number,
            status='payment_pending'
        )

        # Deduct coins
        success = attempt.deduct_coins()
        if not success:
            attempt.delete()
            raise serializers.ValidationError({
                'detail': 'Failed to process payment. Please try again.'
            })

        return attempt


class IELTSAnswerSubmitSerializer(serializers.Serializer):
    """
    Serializer for submitting answers
    """
    question_id = serializers.IntegerField()
    text_answer = serializers.CharField(required=False, allow_blank=True)
    selected_option = serializers.CharField(required=False, allow_blank=True)
    essay_content = serializers.CharField(required=False, allow_blank=True)
    audio_response = serializers.FileField(required=False, allow_null=True)
    time_taken_seconds = serializers.IntegerField(default=0)


class IELTSAttemptSubmitSerializer(serializers.Serializer):
    """
    Serializer for submitting full attempt
    """
    answers = IELTSAnswerSubmitSerializer(many=True)

    def validate_answers(self, answers):
        """Validate that all required questions are answered"""
        if not answers:
            raise serializers.ValidationError("At least one answer is required")
        return answers

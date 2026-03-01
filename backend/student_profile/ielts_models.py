"""
IELTS Exam System Models
Real IELTS exam simulation with AI-powered evaluation
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class IELTSSection(models.TextChoices):
    """IELTS exam sections"""
    READING = 'reading', 'Reading'
    LISTENING = 'listening', 'Listening'
    WRITING = 'writing', 'Writing'
    SPEAKING = 'speaking', 'Speaking'


class IELTSExam(models.Model):
    """
    IELTS Exam Template
    Each section is a separate purchasable exam
    """
    section = models.CharField(
        max_length=20,
        choices=IELTSSection.choices,
        unique=True,
        verbose_name='Section'
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Pricing
    coin_cost = models.PositiveIntegerField(
        default=50,
        help_text='Cost in coins to take this section'
    )
    coin_refund = models.PositiveIntegerField(
        default=10,
        help_text='Coins refunded if band score >= 5.0'
    )

    # Exam settings
    time_limit_minutes = models.PositiveIntegerField(
        help_text='Time limit for this section'
    )
    passing_band_score = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=Decimal('5.0'),
        validators=[MinValueValidator(Decimal('0.0')), MaxValueValidator(Decimal('9.0'))],
        help_text='Minimum band score for coin refund'
    )

    # Content
    instructions = models.TextField(
        blank=True,
        help_text='Instructions shown before starting the exam'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'IELTS Exam'
        verbose_name_plural = 'IELTS Exams'
        ordering = ['section']

    def __str__(self):
        return f"IELTS {self.get_section_display()}"


class IELTSQuestion(models.Model):
    """
    Questions for IELTS sections
    """
    QUESTION_TYPES = [
        # Reading types
        ('multiple_choice', 'Multiple Choice'),
        ('true_false_notgiven', 'True/False/Not Given'),
        ('matching_headings', 'Matching Headings'),
        ('sentence_completion', 'Sentence Completion'),
        ('summary_completion', 'Summary Completion'),

        # Listening types
        ('form_completion', 'Form Completion'),
        ('note_completion', 'Note Completion'),
        ('table_completion', 'Table Completion'),
        ('flow_chart', 'Flow Chart Completion'),
        ('diagram_labeling', 'Diagram Labeling'),

        # Writing types
        ('task1_academic', 'Task 1 (Academic)'),
        ('task1_general', 'Task 1 (General)'),
        ('task2_essay', 'Task 2 (Essay)'),

        # Speaking types
        ('introduction', 'Introduction & Interview'),
        ('long_turn', 'Long Turn (Cue Card)'),
        ('discussion', 'Two-way Discussion'),
    ]

    exam = models.ForeignKey(
        IELTSExam,
        on_delete=models.CASCADE,
        related_name='questions'
    )

    question_type = models.CharField(max_length=50, choices=QUESTION_TYPES)
    order = models.PositiveIntegerField(default=0)

    # Content
    passage_text = models.TextField(
        blank=True,
        help_text='Reading passage or listening script'
    )
    audio_file = models.FileField(
        upload_to='ielts/audio/%Y/%m/',
        blank=True,
        null=True,
        help_text='Audio for listening questions'
    )
    question_text = models.TextField()

    # Options (for multiple choice)
    options = models.JSONField(
        default=list,
        blank=True,
        help_text='List of answer options for multiple choice questions'
    )

    # Correct answer(s)
    correct_answer = models.JSONField(
        default=dict,
        help_text='Correct answer(s) - format varies by question type'
    )

    # Scoring
    points = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('1.0')
    )

    # Speaking specific
    speaking_prompts = models.JSONField(
        default=list,
        blank=True,
        help_text='Prompts for speaking questions'
    )
    time_limit_seconds = models.PositiveIntegerField(
        default=0,
        help_text='Time limit for this question (0 = no limit)'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['exam', 'order']
        verbose_name = 'IELTS Question'
        verbose_name_plural = 'IELTS Questions'

    def __str__(self):
        return f"{self.exam.section} - Q{self.order}"


class IELTSAttempt(models.Model):
    """
    Student attempt at an IELTS section
    """
    STATUS_CHOICES = [
        ('payment_pending', 'Payment Pending'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('evaluating', 'AI Evaluating'),
        ('completed', 'Completed'),
        ('refunded', 'Refunded'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ielts_attempts'
    )
    exam = models.ForeignKey(
        IELTSExam,
        on_delete=models.CASCADE,
        related_name='attempts'
    )

    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='payment_pending'
    )

    # Payment tracking
    coins_paid = models.PositiveIntegerField(default=0)
    coins_refunded = models.PositiveIntegerField(default=0)
    payment_transaction = models.ForeignKey(
        'StudentCoins',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ielts_payments'
    )
    refund_transaction = models.ForeignKey(
        'StudentCoins',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ielts_refunds'
    )

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.PositiveIntegerField(default=0)

    # Scoring
    raw_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0.0'),
        help_text='Total points earned'
    )
    band_score = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=Decimal('0.0'),
        validators=[MinValueValidator(Decimal('0.0')), MaxValueValidator(Decimal('9.0'))],
        help_text='IELTS band score (0.0 - 9.0)'
    )

    # AI Evaluation
    ai_evaluation = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI evaluation results and feedback'
    )
    ai_evaluated_at = models.DateTimeField(null=True, blank=True)

    # Detailed feedback
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['student', 'exam', 'attempt_number']
        verbose_name = 'IELTS Attempt'
        verbose_name_plural = 'IELTS Attempts'
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['exam', 'status']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.exam.section} - Attempt {self.attempt_number}"

    def deduct_coins(self):
        """
        Deduct coins from student account
        Returns True if successful, False otherwise
        """
        from .services.coin_wallet import debit_student_coins, InsufficientCoinsError

        student = self.student
        coins_needed = self.exam.coin_cost

        try:
            transaction, _ = debit_student_coins(
                student,
                coins_needed,
                f'IELTS {self.exam.get_section_display()} Exam - Attempt {self.attempt_number}'
            )
        except InsufficientCoinsError:
            return False

        self.coins_paid = coins_needed
        self.payment_transaction = transaction
        self.status = 'in_progress'
        self.started_at = timezone.now()
        self.save()

        return True

    def refund_coins(self):
        """
        Refund coins if band score >= passing score
        """
        if self.band_score >= self.exam.passing_band_score:
            from .services.coin_wallet import credit_student_coins

            student = self.student
            refund_amount = self.exam.coin_refund

            transaction, _ = credit_student_coins(
                student,
                refund_amount,
                f'IELTS {self.exam.get_section_display()} Exam Refund - Band Score {self.band_score}'
            )

            self.coins_refunded = refund_amount
            self.refund_transaction = transaction
            self.status = 'refunded'
            self.save()

            return True
        return False

    def calculate_band_score(self):
        """
        Calculate IELTS band score from raw score
        Different sections have different conversion tables
        """
        # Simplified band score calculation
        # In production, use official IELTS conversion tables

        total_questions = self.exam.questions.count()
        if total_questions == 0:
            return Decimal('0.0')

        percentage = (float(self.raw_score) / float(total_questions)) * 100

        # Convert percentage to band score (0-9)
        if percentage >= 95:
            band = Decimal('9.0')
        elif percentage >= 90:
            band = Decimal('8.5')
        elif percentage >= 85:
            band = Decimal('8.0')
        elif percentage >= 80:
            band = Decimal('7.5')
        elif percentage >= 75:
            band = Decimal('7.0')
        elif percentage >= 70:
            band = Decimal('6.5')
        elif percentage >= 65:
            band = Decimal('6.0')
        elif percentage >= 60:
            band = Decimal('5.5')
        elif percentage >= 55:
            band = Decimal('5.0')
        elif percentage >= 50:
            band = Decimal('4.5')
        elif percentage >= 45:
            band = Decimal('4.0')
        elif percentage >= 40:
            band = Decimal('3.5')
        elif percentage >= 35:
            band = Decimal('3.0')
        elif percentage >= 30:
            band = Decimal('2.5')
        elif percentage >= 25:
            band = Decimal('2.0')
        elif percentage >= 20:
            band = Decimal('1.5')
        elif percentage >= 15:
            band = Decimal('1.0')
        else:
            band = Decimal('0.5')

        self.band_score = band
        self.save()
        return band


class IELTSAnswer(models.Model):
    """
    Student answers for IELTS questions
    """
    attempt = models.ForeignKey(
        IELTSAttempt,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    question = models.ForeignKey(
        IELTSQuestion,
        on_delete=models.CASCADE,
        related_name='student_answers'
    )

    # Answer content
    text_answer = models.TextField(blank=True)
    selected_option = models.CharField(max_length=255, blank=True)

    # For Writing section
    essay_content = models.TextField(blank=True)
    word_count = models.PositiveIntegerField(default=0)

    # For Speaking section
    audio_response = models.FileField(
        upload_to='ielts/speaking_responses/%Y/%m/',
        blank=True,
        null=True
    )
    transcription = models.TextField(
        blank=True,
        help_text='AI transcription of speaking response'
    )

    # Scoring
    is_correct = models.BooleanField(default=False)
    points_earned = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('0.0')
    )

    # AI Evaluation (for Writing and Speaking)
    ai_score = models.JSONField(
        default=dict,
        blank=True,
        help_text='Detailed AI scoring breakdown'
    )
    ai_feedback = models.TextField(blank=True)

    # Timing
    time_taken_seconds = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['attempt', 'question']
        ordering = ['question__order']
        verbose_name = 'IELTS Answer'
        verbose_name_plural = 'IELTS Answers'

    def __str__(self):
        return f"{self.attempt.student.username} - Q{self.question.order}"

    def auto_grade(self):
        """
        Auto-grade Reading and Listening questions
        """
        if self.question.exam.section in [IELTSSection.READING, IELTSSection.LISTENING]:
            correct_answer = self.question.correct_answer

            # Simple string comparison (can be enhanced)
            if isinstance(correct_answer, str):
                self.is_correct = self.text_answer.strip().lower() == correct_answer.lower()
            elif isinstance(correct_answer, list):
                self.is_correct = self.selected_option in correct_answer

            if self.is_correct:
                self.points_earned = self.question.points
            else:
                self.points_earned = Decimal('0.0')

            self.save()
            return True
        return False

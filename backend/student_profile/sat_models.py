"""
SAT 2025 Digital Format Models
Complete implementation of SAT exam system with adaptive testing and coin-based payment
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal


class SATSection(models.TextChoices):
    """SAT 2025 has only 2 main sections"""
    READING_WRITING = 'reading_writing', 'Reading and Writing'
    MATH = 'math', 'Math'


class SATMathQuestionType(models.TextChoices):
    """Math question types"""
    ALGEBRA = 'algebra', 'Algebra'
    ADVANCED_MATH = 'advanced_math', 'Advanced Math'
    PROBLEM_SOLVING = 'problem_solving', 'Problem-Solving & Data Analysis'
    GEOMETRY = 'geometry', 'Geometry & Trigonometry'


class SATRWQuestionType(models.TextChoices):
    """Reading & Writing question types"""
    CRAFT_STRUCTURE = 'craft_structure', 'Craft and Structure'
    INFORMATION_IDEAS = 'information_ideas', 'Information and Ideas'
    EXPRESSION_IDEAS = 'expression_ideas', 'Expression of Ideas'
    STANDARD_CONVENTIONS = 'standard_conventions', 'Standard English Conventions'


class SATModuleDifficulty(models.TextChoices):
    """Adaptive module difficulty levels"""
    EASY = 'easy', 'Easy'
    MEDIUM = 'medium', 'Medium'
    HARD = 'hard', 'Hard'


class SATExam(models.Model):
    """
    SAT Complete Exam (1600 points)
    Students pay 50 coins, get 10 coins back if total score >= 1000
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Payment & Rewards
    coin_cost = models.PositiveIntegerField(default=50)
    coin_refund = models.PositiveIntegerField(default=10)
    passing_score = models.PositiveIntegerField(default=1000, help_text="Minimum score for refund (out of 1600)")

    # Exam structure (2025 Digital SAT)
    # Reading & Writing: 54 questions, 64 minutes (2 modules)
    rw_total_questions = models.PositiveIntegerField(default=54)
    rw_time_minutes = models.PositiveIntegerField(default=64)

    # Math: 44 questions, 70 minutes (2 modules)
    math_total_questions = models.PositiveIntegerField(default=44)
    math_time_minutes = models.PositiveIntegerField(default=70)

    # Metadata
    is_official = models.BooleanField(default=False, help_text="Official College Board practice test")
    is_published = models.BooleanField(default=True)
    test_number = models.PositiveIntegerField(null=True, blank=True, help_text="For official practice tests")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_profile_sat2025_exam'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_published', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} (1600 pts)"


class SATModule(models.Model):
    """
    SAT Module (Adaptive testing - each section has 2 modules)
    Module 2 difficulty is determined by Module 1 performance
    """
    exam = models.ForeignKey(SATExam, on_delete=models.CASCADE, related_name='modules')
    section = models.CharField(max_length=20, choices=SATSection.choices)
    module_number = models.PositiveIntegerField(help_text="1 or 2")

    # Adaptive difficulty (for module 2)
    difficulty = models.CharField(
        max_length=10,
        choices=SATModuleDifficulty.choices,
        default=SATModuleDifficulty.MEDIUM,
        help_text="Module 1 is always medium. Module 2 adapts based on Module 1 performance"
    )

    # Timing
    time_minutes = models.PositiveIntegerField(
        help_text="32 min for RW modules, 35 min for Math modules"
    )

    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'student_profile_sat2025_module'
        ordering = ['exam', 'section', 'module_number']
        unique_together = ['exam', 'section', 'module_number']
        indexes = [
            models.Index(fields=['exam', 'section', 'module_number']),
        ]

    def __str__(self):
        return f"{self.exam.title} - {self.get_section_display()} Module {self.module_number}"


class SATQuestion(models.Model):
    """
    SAT Question (Math or Reading & Writing)
    """
    ANSWER_TYPES = [
        ('mcq', 'Multiple Choice'),
        ('spr', 'Student Produced Response (Grid-in)'),  # Math only
    ]

    module = models.ForeignKey(SATModule, on_delete=models.CASCADE, related_name='questions')
    question_number = models.PositiveIntegerField()

    # Question content
    passage_text = models.TextField(blank=True, help_text="Reading passage or math problem context")
    question_text = models.TextField()

    # Question type classification
    rw_type = models.CharField(
        max_length=30,
        choices=SATRWQuestionType.choices,
        blank=True,
        null=True,
        help_text="For Reading & Writing questions"
    )
    math_type = models.CharField(
        max_length=30,
        choices=SATMathQuestionType.choices,
        blank=True,
        null=True,
        help_text="For Math questions"
    )

    # Answer format
    answer_type = models.CharField(max_length=10, choices=ANSWER_TYPES, default='mcq')

    # Options (for MCQ)
    options = models.JSONField(
        default=list,
        blank=True,
        help_text="List of answer choices for MCQ: ['A', 'B', 'C', 'D']"
    )

    # Correct answer
    correct_answer = models.JSONField(
        help_text="For MCQ: {'answer': 'B'}. For SPR: {'answer': '42'}"
    )

    # Explanation
    explanation = models.TextField(blank=True, help_text="Why the answer is correct")

    # Difficulty (for adaptive testing)
    difficulty_level = models.CharField(
        max_length=10,
        choices=SATModuleDifficulty.choices,
        default=SATModuleDifficulty.MEDIUM
    )

    # Points (always 1 for SAT)
    points = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('1.0'))

    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'student_profile_sat2025_question'
        ordering = ['module', 'question_number']
        unique_together = ['module', 'question_number']
        indexes = [
            models.Index(fields=['module', 'question_number']),
        ]

    def __str__(self):
        return f"{self.module.get_section_display()} Q{self.question_number}"


class SATAttempt(models.Model):
    """
    Student SAT Attempt
    Tracks the entire SAT exam attempt with payment and scoring
    """
    STATUS_CHOICES = [
        ('payment_pending', 'Payment Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('evaluated', 'Evaluated'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sat_attempts'
    )
    exam = models.ForeignKey(SATExam, on_delete=models.CASCADE, related_name='attempts')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='payment_pending')

    # Payment tracking
    coins_paid = models.PositiveIntegerField(default=0)
    coins_refunded = models.PositiveIntegerField(default=0)
    refund_eligible = models.BooleanField(default=False)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.PositiveIntegerField(default=0)
    current_module_key = models.CharField(max_length=20, default='rw_module1')
    current_question_index = models.PositiveIntegerField(default=0)
    module_time_remaining_seconds = models.PositiveIntegerField(default=0)
    last_state_synced_at = models.DateTimeField(null=True, blank=True)

    # Scores (out of 800 each, total 1600)
    reading_writing_score = models.PositiveIntegerField(null=True, blank=True, help_text="200-800")
    math_score = models.PositiveIntegerField(null=True, blank=True, help_text="200-800")
    total_score = models.PositiveIntegerField(null=True, blank=True, help_text="400-1600")

    # Raw correct counts (for score conversion)
    rw_correct = models.PositiveIntegerField(default=0, help_text="Out of 54")
    math_correct = models.PositiveIntegerField(default=0, help_text="Out of 44")

    # Module performance (for adaptive testing)
    rw_module1_correct = models.PositiveIntegerField(default=0)
    rw_module2_difficulty = models.CharField(
        max_length=10,
        choices=SATModuleDifficulty.choices,
        null=True,
        blank=True
    )
    math_module1_correct = models.PositiveIntegerField(default=0)
    math_module2_difficulty = models.CharField(
        max_length=10,
        choices=SATModuleDifficulty.choices,
        null=True,
        blank=True
    )

    # AI feedback
    ai_feedback = models.JSONField(
        default=dict,
        blank=True,
        help_text="AI analysis of performance by section and question type"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_profile_sat2025_attempt'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.exam.title} - {self.get_status_display()}"

    def deduct_coins(self):
        """Deduct coins from student and start exam"""
        from .services.coin_wallet import debit_student_coins

        if self.status != 'payment_pending':
            raise ValueError("Payment already processed")

        debit_student_coins(
            self.student,
            self.exam.coin_cost,
            f"SAT Exam: {self.exam.title}",
        )

        self.coins_paid = self.exam.coin_cost
        self.status = 'in_progress'
        self.started_at = timezone.now()
        self.current_module_key = 'rw_module1'
        self.current_question_index = 0
        self.module_time_remaining_seconds = 32 * 60
        self.last_state_synced_at = timezone.now()
        self.save()

    def complete_attempt(self):
        """Mark attempt as completed"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.current_module_key = 'completed'
        self.current_question_index = 0
        self.module_time_remaining_seconds = 0
        self.last_state_synced_at = timezone.now()

        if self.started_at:
            self.time_taken_seconds = int((self.completed_at - self.started_at).total_seconds())

        self.save()

    def calculate_scores(self):
        """
        Calculate SAT scores from raw correct counts
        Uses official SAT scoring table (simplified version)
        """
        # Reading & Writing: 54 questions → 200-800
        # Math: 44 questions → 200-800

        # Simplified scoring (linear approximation)
        # In real SAT, this uses a complex equating table

        # RW Score: 200 + (correct/54 * 600)
        if self.rw_correct is not None:
            rw_percentage = self.rw_correct / 54
            self.reading_writing_score = min(800, max(200, int(200 + (rw_percentage * 600))))

        # Math Score: 200 + (correct/44 * 600)
        if self.math_correct is not None:
            math_percentage = self.math_correct / 44
            self.math_score = min(800, max(200, int(200 + (math_percentage * 600))))

        # Total Score
        if self.reading_writing_score and self.math_score:
            self.total_score = self.reading_writing_score + self.math_score

            # Check refund eligibility
            if self.total_score >= self.exam.passing_score:
                self.refund_eligible = True

        self.status = 'evaluated'
        self.save()

    def sync_runtime_state(self, *, module_key, question_index=0, time_remaining_seconds=0):
        """Persist resumable SAT runtime state for mobile clients."""
        self.current_module_key = module_key
        self.current_question_index = max(0, int(question_index or 0))
        self.module_time_remaining_seconds = max(0, int(time_remaining_seconds or 0))
        self.last_state_synced_at = timezone.now()
        self.save(
            update_fields=[
                'current_module_key',
                'current_question_index',
                'module_time_remaining_seconds',
                'last_state_synced_at',
                'updated_at',
            ]
        )

    def refund_coins(self):
        """Refund coins if student achieved passing score"""
        from .services.coin_wallet import credit_student_coins

        if not self.refund_eligible:
            raise ValueError("Not eligible for refund")

        if self.coins_refunded > 0:
            raise ValueError("Already refunded")

        credit_student_coins(
            self.student,
            self.exam.coin_refund,
            f"SAT Refund: {self.exam.title} (Score: {self.total_score}/1600)",
        )

        self.coins_refunded = self.exam.coin_refund
        self.save()


class SATAnswer(models.Model):
    """
    Student's answer to a SAT question
    """
    attempt = models.ForeignKey(SATAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(SATQuestion, on_delete=models.CASCADE, related_name='student_answers')

    # Student's answer
    answer_given = models.JSONField(
        help_text="For MCQ: {'answer': 'B'}. For SPR: {'answer': '42'}"
    )

    # Grading
    is_correct = models.BooleanField(default=False)
    points_earned = models.DecimalField(max_digits=3, decimal_places=1, default=Decimal('0.0'))

    # Timing
    time_spent_seconds = models.PositiveIntegerField(default=0)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'student_profile_sat2025_answer'
        unique_together = ['attempt', 'question']
        ordering = ['attempt', 'question__question_number']
        indexes = [
            models.Index(fields=['attempt', 'question']),
        ]

    def __str__(self):
        return f"{self.attempt.student.username} - {self.question} - {'✓' if self.is_correct else '✗'}"

    def grade_answer(self):
        """Grade the answer and update points"""
        correct_ans = self.question.correct_answer.get('answer', '')
        given_ans = self.answer_given.get('answer', '')

        # Case-insensitive comparison
        self.is_correct = str(correct_ans).strip().lower() == str(given_ans).strip().lower()

        if self.is_correct:
            self.points_earned = self.question.points
        else:
            self.points_earned = Decimal('0.0')

        self.save()

"""
LMS Enhancement Models
Course categorization, CEFR levels, vocabulary, flashcards, and SAT-specific models
"""

from django.db import models
from django.conf import settings
from django.utils.text import slugify


class CourseCategory(models.Model):
    """Course categories and subjects"""

    CATEGORY_TYPES = [
        ('language', 'Language'),
        ('math', 'Mathematics'),
        ('test_prep', 'Test Preparation'),
        ('it', 'Information Technology'),
        ('business', 'Business'),
        ('science', 'Science'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    category_type = models.CharField(max_length=50, choices=CATEGORY_TYPES)
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='subcategories'
    )
    icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name")
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'Course Categories'

    def __str__(self):
        return f"{self.name} ({self.get_category_type_display()})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class CEFRLevel(models.Model):
    """Common European Framework of Reference for Languages levels"""

    LEVELS = [
        ('A1', 'A1 - Beginner'),
        ('A2', 'A2 - Elementary'),
        ('B1', 'B1 - Intermediate'),
        ('B2', 'B2 - Upper Intermediate'),
        ('C1', 'C1 - Advanced'),
        ('C2', 'C2 - Proficiency'),
    ]

    level = models.CharField(max_length=2, choices=LEVELS, unique=True)
    description = models.TextField()
    skills_description = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structure: {reading, writing, speaking, listening}"
    )

    class Meta:
        ordering = ['level']
        verbose_name = 'CEFR Level'
        verbose_name_plural = 'CEFR Levels'

    def __str__(self):
        return self.get_level_display()


class SkillTag(models.Model):
    """Skills and competencies"""

    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(
        CourseCategory,
        on_delete=models.CASCADE,
        related_name='skills'
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class VocabularyWord(models.Model):
    """Vocabulary items for language courses"""

    course = models.ForeignKey(
        'student_profile.Course',
        on_delete=models.CASCADE,
        related_name='vocabulary'
    )
    lesson = models.ForeignKey(
        'student_profile.Lesson',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='vocabulary'
    )

    word = models.CharField(max_length=200)
    pronunciation = models.CharField(max_length=200, blank=True, help_text="IPA or phonetic")
    part_of_speech = models.CharField(max_length=50, blank=True, help_text="noun, verb, adjective, etc.")

    definition = models.TextField()
    example_sentence = models.TextField(blank=True)
    translation = models.CharField(max_length=200, blank=True, help_text="Uzbek/Russian translation")

    # Audio pronunciation
    audio_url = models.URLField(blank=True)
    audio_file = models.FileField(upload_to='vocabulary/audio/', blank=True, null=True)

    # Images
    image = models.ImageField(upload_to='vocabulary/images/', blank=True, null=True)

    # CEFR level
    cefr_level = models.ForeignKey(
        CEFRLevel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Tags
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="e.g., ['common', 'academic', 'business']"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course', 'word']
        indexes = [
            models.Index(fields=['course', 'cefr_level']),
            models.Index(fields=['word']),
        ]

    def __str__(self):
        return f"{self.word} ({self.part_of_speech})"


class StudentVocabularyProgress(models.Model):
    """Track student vocabulary mastery using spaced repetition"""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vocabulary_progress'
    )
    word = models.ForeignKey(
        VocabularyWord,
        on_delete=models.CASCADE,
        related_name='student_progress'
    )

    # Spaced repetition
    mastery_level = models.PositiveIntegerField(default=0, help_text="0-5 scale")
    times_reviewed = models.PositiveIntegerField(default=0)
    times_correct = models.PositiveIntegerField(default=0)
    next_review_date = models.DateTimeField(null=True, blank=True)

    last_reviewed = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'word']
        ordering = ['next_review_date', '-mastery_level']
        verbose_name_plural = 'Student Vocabulary Progress'
        indexes = [
            models.Index(fields=['student', 'next_review_date']),
            models.Index(fields=['student', 'mastery_level']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.word.word} (Level {self.mastery_level})"


class Flashcard(models.Model):
    """Flashcard decks for study"""

    course = models.ForeignKey(
        'student_profile.Course',
        on_delete=models.CASCADE,
        related_name='flashcards'
    )
    lesson = models.ForeignKey(
        'student_profile.Lesson',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='flashcards'
    )

    front_text = models.TextField()
    back_text = models.TextField()

    # Optional media
    front_image = models.ImageField(upload_to='flashcards/images/', blank=True, null=True)
    back_image = models.ImageField(upload_to='flashcards/images/', blank=True, null=True)
    front_audio = models.FileField(upload_to='flashcards/audio/', blank=True, null=True)
    back_audio = models.FileField(upload_to='flashcards/audio/', blank=True, null=True)

    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course', 'lesson', 'order']

    def __str__(self):
        return f"{self.course.name} - {self.front_text[:50]}"


class FlashcardProgress(models.Model):
    """Track student flashcard review progress"""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='flashcard_progress'
    )
    flashcard = models.ForeignKey(
        Flashcard,
        on_delete=models.CASCADE,
        related_name='student_progress'
    )

    # Spaced repetition
    mastery_level = models.PositiveIntegerField(default=0, help_text="0-5 scale")
    times_reviewed = models.PositiveIntegerField(default=0)
    times_correct = models.PositiveIntegerField(default=0)
    next_review_date = models.DateTimeField(null=True, blank=True)

    last_reviewed = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'flashcard']
        ordering = ['next_review_date', '-mastery_level']
        verbose_name_plural = 'Flashcard Progress'

    def __str__(self):
        return f"{self.student.username} - {self.flashcard.front_text[:30]} (Level {self.mastery_level})"

"""
Hybrid Search Models for EduVoice AI Assistant
Combines keyword-based and semantic (vector) search
"""

from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.conf import settings
from pgvector.django import VectorField
import uuid


class SearchIndex(models.Model):
    """
    Unified search index for all platform data.
    Supports both keyword and semantic search using pgvector.
    """

    # Unique identifier
    index_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)

    # Content identification
    content_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Model type: 'user', 'course', 'lead', etc."
    )
    object_id = models.BigIntegerField(db_index=True, help_text="ID of the indexed object")

    # Search fields
    title = models.CharField(max_length=500)
    content = models.TextField()
    keywords = models.JSONField(default=list, help_text="List of keywords for exact matching")

    # Semantic search (pgvector)
    embedding = VectorField(
        dimensions=384,
        help_text="384-dimensional vector from all-MiniLM-L6-v2"
    )

    # Filtering and RBAC
    branch_id = models.BigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Filter by branch (null = global)"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    required_roles = models.JSONField(
        default=list,
        help_text="Required roles to see this result: ['teacher', 'admin', 'student']"
    )

    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        help_text="Additional data specific to content type"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['branch_id', 'is_active']),
            models.Index(fields=['content_type', 'is_active']),
            GinIndex(fields=['keywords']),  # For fast keyword array search
        ]
        unique_together = [['content_type', 'object_id']]
        verbose_name = "Search Index"
        verbose_name_plural = "Search Indexes"

    def __str__(self):
        return f"{self.content_type}:{self.object_id} - {self.title[:50]}"


class SearchQuery(models.Model):
    """
    Track search queries for learning and improvement.
    Used for self-learning feedback loop.
    """

    # User who made the query
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='search_queries'
    )

    # Query details
    query_text = models.TextField()
    query_embedding = VectorField(
        dimensions=384,
        help_text="Embedding of the query for similarity search"
    )

    # Results
    results_count = models.IntegerField(default=0)
    clicked_result_ids = models.JSONField(
        default=list,
        help_text="List of SearchIndex IDs that were clicked"
    )

    # Feedback signals
    was_helpful = models.BooleanField(
        null=True,
        blank=True,
        help_text="User feedback: was this search helpful?"
    )
    rephrased_query = models.TextField(
        blank=True,
        help_text="If user rephrased, store new query (negative signal)"
    )

    # Metadata
    processing_time_ms = models.IntegerField(
        default=0,
        help_text="Search processing time in milliseconds"
    )
    filters_applied = models.JSONField(
        default=dict,
        help_text="Filters used: content_types, branch_id, etc."
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['was_helpful']),
        ]
        verbose_name = "Search Query"
        verbose_name_plural = "Search Queries"

    def __str__(self):
        return f"{self.user.username}: {self.query_text[:50]}"

    def record_click(self, result_id: int):
        """Record that a result was clicked (positive signal)."""
        if result_id not in self.clicked_result_ids:
            self.clicked_result_ids.append(result_id)
            self.save(update_fields=['clicked_result_ids'])

    def mark_helpful(self, helpful: bool):
        """Mark whether the search was helpful."""
        self.was_helpful = helpful
        self.save(update_fields=['was_helpful'])


class IndexingQueue(models.Model):
    """
    Queue for objects that need to be indexed/reindexed.
    Used when real-time indexing fails or for batch processing.
    """

    content_type = models.CharField(max_length=50)
    object_id = models.BigIntegerField()

    # Status
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)

    # Error handling
    attempts = models.IntegerField(default=0)
    last_error = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"{self.content_type}:{self.object_id} - {self.status}"

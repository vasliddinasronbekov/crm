"""
Knowledge Base System for Self-Learning LLM

The LLM learns about the CRM/LMS/ERP platform during conversations:
- Extracts key information from successful interactions
- Stores platform-specific knowledge
- Retrieves relevant context for future queries
- Improves responses over time
"""
import logging
import json
from typing import List, Dict, Optional, Any
from datetime import datetime
from django.core.cache import cache
from django.db import models
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.contrib.postgres.indexes import GinIndex

logger = logging.getLogger(__name__)


class KnowledgeCategory(models.TextChoices):
    """Categories of knowledge about the platform."""
    CRM = 'crm', 'CRM Features'
    LMS = 'lms', 'LMS Features'
    ERP = 'erp', 'ERP Features'
    WORKFLOW = 'workflow', 'Workflows & Processes'
    FEATURE = 'feature', 'Platform Features'
    FAQ = 'faq', 'Frequently Asked Questions'
    TUTORIAL = 'tutorial', 'Tutorials & Guides'
    TROUBLESHOOTING = 'troubleshooting', 'Troubleshooting'
    API = 'api', 'API Documentation'
    GENERAL = 'general', 'General Information'


class PlatformKnowledge(models.Model):
    """
    Stores learned knowledge about the platform.
    This grows over time as the LLM learns from conversations.
    """
    # Identification
    knowledge_id = models.UUIDField(default=__import__('uuid').uuid4, unique=True, db_index=True)
    category = models.CharField(max_length=50, choices=KnowledgeCategory.choices, db_index=True)

    # Content
    title = models.CharField(max_length=255, help_text="Short title/summary")
    content = models.TextField(help_text="Detailed knowledge content")
    keywords = models.JSONField(default=list, help_text="Keywords for search")

    # Multilingual support
    language = models.CharField(max_length=5, default='en', db_index=True)  # en, ru, uz
    translations = models.JSONField(default=dict, help_text="Translations in other languages")

    # Source & Quality
    source = models.CharField(max_length=50, help_text="Where this knowledge came from")
    confidence_score = models.FloatField(default=0.5, help_text="Confidence in this knowledge (0-1)")
    verified = models.BooleanField(default=False, help_text="Verified by admin")

    # Usage tracking
    times_used = models.IntegerField(default=0, help_text="How many times this was helpful")
    last_used = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.JSONField(default=dict, help_text="Additional metadata")

    class Meta:
        ordering = ['-confidence_score', '-times_used', '-created_at']
        indexes = [
            models.Index(fields=['category', '-confidence_score']),
            models.Index(fields=['language', 'category']),
            GinIndex(fields=['keywords']),  # For fast keyword search
        ]
        verbose_name = "Platform Knowledge"
        verbose_name_plural = "Platform Knowledge"

    def __str__(self):
        return f"{self.category}: {self.title}"

    def increment_usage(self):
        """Track that this knowledge was used."""
        self.times_used += 1
        self.last_used = datetime.now()
        self.save(update_fields=['times_used', 'last_used'])

    def improve_confidence(self, amount: float = 0.1):
        """Increase confidence when knowledge proves helpful."""
        self.confidence_score = min(1.0, self.confidence_score + amount)
        self.save(update_fields=['confidence_score'])


class ConversationLearning(models.Model):
    """
    Tracks what the LLM learned from specific conversations.
    Used to extract knowledge for the knowledge base.
    """
    conversation_id = models.UUIDField(db_index=True)

    # What was learned
    learned_topic = models.CharField(max_length=255)
    learned_content = models.TextField()
    category = models.CharField(max_length=50, choices=KnowledgeCategory.choices)

    # How it was learned
    user_query = models.TextField(help_text="Original user question")
    llm_response = models.TextField(help_text="LLM response that was helpful")
    was_helpful = models.BooleanField(default=False, help_text="User confirmed it was helpful")

    # Processing status
    extracted_to_kb = models.BooleanField(default=False, help_text="Extracted to knowledge base")
    knowledge_entry = models.ForeignKey(
        PlatformKnowledge,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='learned_from'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['conversation_id', '-created_at']),
            models.Index(fields=['category', 'was_helpful']),
        ]

    def __str__(self):
        return f"Learning: {self.learned_topic}"


class KnowledgeRetrieval:
    """
    RAG (Retrieval Augmented Generation) system.
    Retrieves relevant knowledge to augment LLM prompts.
    """

    def __init__(self, language: str = 'en'):
        """Initialize knowledge retrieval."""
        self.language = language
        self.cache_ttl = 3600  # 1 hour

    def search(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
        min_confidence: float = 0.3,
        auto_detect_language: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search knowledge base for relevant information.

        Args:
            query: Search query
            category: Filter by category
            limit: Maximum results
            min_confidence: Minimum confidence score
            auto_detect_language: Auto-detect language from query

        Returns:
            List of relevant knowledge entries
        """
        # Auto-detect language from query if enabled
        search_language = self.language
        if auto_detect_language:
            try:
                from .language_detector import detect_language
                detected = detect_language(query)
                if detected:
                    search_language = detected
                    logger.info(f"Auto-detected language for KB search: {detected}")
            except Exception as e:
                logger.warning(f"Language detection failed: {e}")

        # Check cache first
        cache_key = f"kb_search:{query}:{category}:{search_language}:{limit}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        # Build queryset (use detected language)
        queryset = PlatformKnowledge.objects.filter(
            language=search_language,
            confidence_score__gte=min_confidence
        )

        if category:
            queryset = queryset.filter(category=category)

        # Search by keywords and content
        results = []
        query_lower = query.lower()

        for kb_entry in queryset[:limit * 2]:  # Get more to filter
            # Calculate relevance score
            score = 0.0

            # Keyword matching
            for keyword in kb_entry.keywords:
                if keyword.lower() in query_lower:
                    score += 1.0

            # Title matching
            if any(word in kb_entry.title.lower() for word in query_lower.split()):
                score += 0.5

            # Content matching (partial)
            if any(word in kb_entry.content.lower() for word in query_lower.split()):
                score += 0.3

            # Boost by confidence and usage
            score *= kb_entry.confidence_score
            score += (kb_entry.times_used * 0.01)  # Small boost for frequently used

            if score > 0:
                results.append({
                    'knowledge_id': str(kb_entry.knowledge_id),
                    'title': kb_entry.title,
                    'content': kb_entry.content,
                    'category': kb_entry.category,
                    'confidence': kb_entry.confidence_score,
                    'relevance_score': score,
                    'times_used': kb_entry.times_used,
                    'kb_entry': kb_entry
                })

        # Sort by relevance
        results.sort(key=lambda x: x['relevance_score'], reverse=True)
        results = results[:limit]

        # Track usage
        for result in results:
            result['kb_entry'].increment_usage()

        # Cache results
        cache.set(cache_key, results, self.cache_ttl)

        return results

    def get_context_for_prompt(
        self,
        query: str,
        category: Optional[str] = None,
        max_context_length: int = 1000
    ) -> str:
        """
        Get relevant context to inject into LLM prompt.

        Args:
            query: User query
            category: Filter category
            max_context_length: Maximum context length in characters

        Returns:
            Formatted context string
        """
        results = self.search(query, category=category, limit=5)

        if not results:
            return ""

        context_parts = ["Platform Knowledge:"]
        current_length = len(context_parts[0])

        for result in results:
            entry = f"\n- {result['title']}: {result['content']}"
            if current_length + len(entry) > max_context_length:
                break
            context_parts.append(entry)
            current_length += len(entry)

        return "\n".join(context_parts)

    def learn_from_conversation(
        self,
        conversation_id: str,
        user_query: str,
        llm_response: str,
        category: str = KnowledgeCategory.GENERAL,
        was_helpful: bool = False
    ):
        """
        Extract learning from a conversation.

        Args:
            conversation_id: Conversation ID
            user_query: User's question
            llm_response: LLM's response
            category: Knowledge category
            was_helpful: Whether response was helpful
        """
        # Extract topic from query
        topic = self._extract_topic(user_query)

        # Store learning
        learning = ConversationLearning.objects.create(
            conversation_id=conversation_id,
            learned_topic=topic,
            learned_content=llm_response[:500],  # Summary
            category=category,
            user_query=user_query,
            llm_response=llm_response,
            was_helpful=was_helpful
        )

        # If helpful, consider adding to KB immediately
        if was_helpful:
            self._extract_to_kb(learning)

        return learning

    def _extract_topic(self, query: str) -> str:
        """Extract main topic from query."""
        # Simple extraction (can be improved with NLP)
        words = query.split()
        if len(words) > 5:
            return ' '.join(words[:5])
        return query

    def _extract_to_kb(self, learning: ConversationLearning):
        """
        Extract learning to knowledge base.

        Args:
            learning: ConversationLearning instance
        """
        # Check if similar knowledge exists
        existing = PlatformKnowledge.objects.filter(
            title__icontains=learning.learned_topic[:50],
            category=learning.category,
            language=self.language
        ).first()

        if existing:
            # Update existing knowledge
            existing.content += f"\n\n{learning.learned_content}"
            existing.times_used += 1
            existing.improve_confidence(0.05)
            knowledge_entry = existing
        else:
            # Create new knowledge entry
            keywords = self._extract_keywords(learning.user_query + " " + learning.learned_content)

            knowledge_entry = PlatformKnowledge.objects.create(
                category=learning.category,
                title=learning.learned_topic,
                content=learning.learned_content,
                keywords=keywords,
                language=self.language,
                source='conversation',
                confidence_score=0.6 if learning.was_helpful else 0.3
            )

        # Link learning to KB entry
        learning.extracted_to_kb = True
        learning.knowledge_entry = knowledge_entry
        learning.save()

        logger.info(f"Extracted learning to KB: {knowledge_entry.title}")
        return knowledge_entry

    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text."""
        # Simple keyword extraction (can be improved with NLP)
        from collections import Counter
        import re

        # Remove common words
        stop_words = {
            'en': ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were'],
            'ru': ['и', 'в', 'на', 'с', 'по', 'для', 'от', 'к', 'о', 'об', 'это', 'как', 'что'],
            'uz': ['va', 'ва', 'bo\'lgan', 'uchun', 'ning', 'ni', 'da', 'bu']
        }

        words = re.findall(r'\w+', text.lower())
        words = [w for w in words if w not in stop_words.get(self.language, []) and len(w) > 3]

        # Count and return top keywords
        counter = Counter(words)
        return [word for word, count in counter.most_common(max_keywords)]


class KnowledgeManager:
    """High-level interface for knowledge management."""

    def __init__(self, language: str = 'en'):
        """Initialize knowledge manager."""
        self.language = language
        self.retrieval = KnowledgeRetrieval(language=language)

    def add_platform_knowledge(
        self,
        title: str,
        content: str,
        category: str,
        keywords: List[str] = None,
        source: str = 'manual',
        verified: bool = True
    ) -> PlatformKnowledge:
        """
        Add knowledge to the platform knowledge base.

        Args:
            title: Knowledge title
            content: Knowledge content
            category: Category
            keywords: Keywords for search
            source: Source of knowledge
            verified: Is this verified knowledge

        Returns:
            Created knowledge entry
        """
        if keywords is None:
            keywords = self.retrieval._extract_keywords(title + " " + content)

        knowledge = PlatformKnowledge.objects.create(
            category=category,
            title=title,
            content=content,
            keywords=keywords,
            language=self.language,
            source=source,
            confidence_score=1.0 if verified else 0.7,
            verified=verified
        )

        logger.info(f"Added knowledge: {title}")
        return knowledge

    def bulk_load_from_docs(self, docs_path: str):
        """
        Load knowledge from documentation files.

        Args:
            docs_path: Path to documentation directory
        """
        import os
        from pathlib import Path

        docs_dir = Path(docs_path)
        if not docs_dir.exists():
            logger.error(f"Documentation directory not found: {docs_path}")
            return

        loaded_count = 0

        # Load markdown files
        for md_file in docs_dir.glob('**/*.md'):
            try:
                content = md_file.read_text(encoding='utf-8')
                title = md_file.stem.replace('_', ' ').replace('-', ' ').title()

                # Determine category from path or filename
                category = self._determine_category(md_file.name)

                self.add_platform_knowledge(
                    title=title,
                    content=content[:2000],  # First 2000 chars
                    category=category,
                    source=f'docs:{md_file.name}',
                    verified=True
                )
                loaded_count += 1

            except Exception as e:
                logger.error(f"Failed to load {md_file}: {e}")

        logger.info(f"Loaded {loaded_count} knowledge entries from documentation")
        return loaded_count

    def _determine_category(self, filename: str) -> str:
        """Determine category from filename."""
        filename_lower = filename.lower()

        if 'crm' in filename_lower or 'lead' in filename_lower or 'customer' in filename_lower:
            return KnowledgeCategory.CRM
        elif 'lms' in filename_lower or 'course' in filename_lower or 'student' in filename_lower:
            return KnowledgeCategory.LMS
        elif 'erp' in filename_lower or 'payment' in filename_lower or 'invoice' in filename_lower:
            return KnowledgeCategory.ERP
        elif 'api' in filename_lower:
            return KnowledgeCategory.API
        elif 'tutorial' in filename_lower or 'guide' in filename_lower:
            return KnowledgeCategory.TUTORIAL
        elif 'faq' in filename_lower:
            return KnowledgeCategory.FAQ
        elif 'workflow' in filename_lower or 'process' in filename_lower:
            return KnowledgeCategory.WORKFLOW
        else:
            return KnowledgeCategory.GENERAL


# Convenience functions
def get_knowledge_manager(language: str = 'en') -> KnowledgeManager:
    """Get knowledge manager instance."""
    return KnowledgeManager(language=language)


def search_knowledge(query: str, language: str = 'en', category: str = None) -> List[Dict]:
    """Search knowledge base."""
    retrieval = KnowledgeRetrieval(language=language)
    return retrieval.search(query, category=category)


def get_context(query: str, language: str = 'en', category: str = None) -> str:
    """Get context for LLM prompt."""
    retrieval = KnowledgeRetrieval(language=language)
    return retrieval.get_context_for_prompt(query, category=category)

"""
Service for indexing data into the unified search index.
"""

from typing import Any, Dict, List, Optional
from django.db import models
from .search_models import SearchIndex
from .embedding_service import get_embedding_service
import logging

logger = logging.getLogger(__name__)


class IndexingService:
    """
    Handles the logic of converting a model instance into a SearchIndex entry.
    """

    def __init__(self):
        self.embedding_service = get_embedding_service()

    def index_object(self, instance: models.Model, content_type: str):
        """
        Indexes a single Django model instance.
        """
        try:
            data = self._extract_data(instance, content_type)
            if not data:
                logger.warning(f"No data extracted for {content_type}:{instance.pk}. Skipping.")
                return

            embedding = self.embedding_service.embed_text(data['content'])

            SearchIndex.objects.update_or_create(
                content_type=content_type,
                object_id=instance.pk,
                defaults={
                    'title': data['title'],
                    'content': data['content'],
                    'keywords': data['keywords'],
                    'embedding': embedding,
                    'branch_id': data.get('branch_id'),
                    'is_active': data.get('is_active', True),
                    'required_roles': data.get('required_roles', []),
                    'metadata': data.get('metadata', {}),
                }
            )
            logger.info(f"Successfully indexed {content_type}:{instance.pk}")
        except Exception as e:
            logger.error(f"Failed to index {content_type}:{instance.pk}. Error: {e}", exc_info=True)

    def deindex_object(self, instance: models.Model, content_type: str):
        """
        Removes an object from the search index.
        """
        SearchIndex.objects.filter(content_type=content_type, object_id=instance.pk).delete()
        logger.info(f"Successfully de-indexed {content_type}:{instance.pk}")

    def _extract_data(self, instance: models.Model, content_type: str) -> Optional[Dict[str, Any]]:
        """
        Extracts and transforms data from a model instance.
        This method should be customized for each model type.
        """
        if content_type == 'user':
            return {
                'title': instance.get_full_name() or instance.username,
                'content': f"User: {instance.get_full_name()} ({instance.email})",
                'keywords': [instance.username, instance.email],
                'branch_id': getattr(instance, 'branch_id', None),
                'required_roles': ['admin', 'teacher'],
            }
        elif content_type == 'course':
            return {
                'title': instance.name,
                'content': instance.description or '',
                'keywords': [instance.name],
                'branch_id': None,  # Courses are global
                'required_roles': ['admin', 'teacher', 'student'],
            }
        elif content_type == 'group':
            return {
                'title': f"Group: {instance.name}",
                'content': f"Group for course {instance.course.name} in branch {instance.branch.name if instance.branch else 'N/A'}",
                'keywords': [instance.name, instance.course.name],
                'branch_id': instance.branch_id,
                'required_roles': ['admin', 'teacher'],
            }
        elif content_type == 'lead':
            return {
                'title': f"Lead: {instance.full_name}",
                'content': f"Lead with phone {instance.phone}, interested in {instance.interested_course.name if instance.interested_course else 'N/A'}",
                'keywords': [instance.full_name, instance.phone],
                'branch_id': instance.branch_id,
                'required_roles': ['admin'],
            }
        elif content_type == 'task':
            return {
                'title': f"Task: {instance.title}",
                'content': instance.description or '',
                'keywords': [instance.title],
                'branch_id': None, # Tasks are not directly associated with a branch
                'required_roles': ['admin', 'teacher'],
                'metadata': {'user_id': instance.user_id}
            }
        elif content_type == 'chatmessage':
            return {
                'title': f"Message from {instance.sender.get_full_name() if instance.sender else 'System'}",
                'content': instance.content,
                'keywords': [],
                'branch_id': None, # Chat messages are not directly associated with a branch
                'required_roles': ['admin', 'teacher', 'student'],
                'metadata': {'conversation_id': str(instance.conversation.conversation_id)}
            }
        # Add more content types here as needed
        return None


def get_indexing_service():
    """
    Returns an instance of the IndexingService.
    """
    return IndexingService()

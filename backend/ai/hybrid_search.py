"""
Hybrid search: keyword + semantic search using pgvector.
"""

from typing import List, Dict, Optional
from django.db.models import Q
from django.db import connection
from .search_models import SearchIndex, SearchQuery
from .embedding_service import get_embedding_service
import logging
import time

logger = logging.getLogger(__name__)


class HybridSearchEngine:
    """Combines keyword and semantic search with RBAC filtering."""

    def __init__(self, user=None):
        self.user = user
        self.embedding_service = get_embedding_service()

    def search(
        self,
        query: str,
        content_types: Optional[List[str]] = None,
        branch_id: Optional[int] = None,
        limit: int = 10,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[Dict]:
        """
        Hybrid search with keyword + semantic.

        Args:
            query: Search query
            content_types: Filter by types ['user', 'course']
            branch_id: Filter by branch
            limit: Max results
            semantic_weight: Weight for semantic (0-1)
            keyword_weight: Weight for keyword (0-1)

        Returns:
            List of search results with scores
        """
        start_time = time.time()

        # Generate query embedding
        query_embedding = self.embedding_service.embed_text(query)

        # Build queryset
        qs = SearchIndex.objects.filter(is_active=True)

        if content_types:
            qs = qs.filter(content_type__in=content_types)

        if branch_id:
            qs = qs.filter(Q(branch_id=branch_id) | Q(branch_id__isnull=True))

        # RBAC filtering
        if self.user:
            roles = self._get_user_roles()
            qs = qs.filter(
                Q(required_roles__len=0) | Q(required_roles__overlap=roles)
            )

        # Keyword search
        query_lower = query.lower()
        keyword_scores = {}

        for item in qs:
            score = 0.0

            if query_lower in item.title.lower():
                score += 5.0

            for kw in item.keywords:
                if query_lower in kw.lower():
                    score += 2.0

            if query_lower in item.content.lower():
                score += 1.0

            if score > 0:
                keyword_scores[item.id] = score

        # Semantic search with pgvector
        semantic_scores = {}
        ids = list(qs.values_list('id', flat=True))

        if ids:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id, 1 - (embedding <=> %s::vector) as similarity
                    FROM ai_searchindex
                    WHERE id = ANY(%s)
                """, [query_embedding.tolist(), ids])

                for row in cursor.fetchall():
                    semantic_scores[row[0]] = row[1]

        # Combine scores
        combined = {}
        all_ids = set(keyword_scores.keys()) | set(semantic_scores.keys())

        for idx in all_ids:
            kw = keyword_scores.get(idx, 0.0)
            sem = semantic_scores.get(idx, 0.0)
            combined[idx] = (kw * keyword_weight) + (sem * semantic_weight)

        # Get top results
        top_ids = sorted(combined.keys(), key=lambda x: combined[x], reverse=True)[:limit]

        results = []
        for item in SearchIndex.objects.filter(id__in=top_ids):
            results.append({
                'id': item.id,
                'content_type': item.content_type,
                'object_id': item.object_id,
                'title': item.title,
                'content': item.content[:200],
                'score': combined[item.id],
                'keyword_score': keyword_scores.get(item.id, 0.0),
                'semantic_score': semantic_scores.get(item.id, 0.0),
                'metadata': item.metadata,
            })

        results.sort(key=lambda x: x['score'], reverse=True)

        # Track query
        processing_time = int((time.time() - start_time) * 1000)
        if self.user:
            SearchQuery.objects.create(
                user=self.user,
                query_text=query,
                query_embedding=query_embedding.tolist(),
                results_count=len(results),
                processing_time_ms=processing_time,
                filters_applied={
                    'content_types': content_types,
                    'branch_id': branch_id,
                }
            )

        return results

    def _get_user_roles(self) -> List[str]:
        """Get user roles for RBAC."""
        roles = []
        if self.user.is_staff:
            roles.append('admin')
        if getattr(self.user, 'is_teacher', False):
            roles.append('teacher')
        if not self.user.is_staff and not getattr(self.user, 'is_teacher', False):
            roles.append('student')
        return roles


def search(query: str, user=None, **kwargs) -> List[Dict]:
    """Quick search function."""
    engine = HybridSearchEngine(user=user)
    return engine.search(query, **kwargs)

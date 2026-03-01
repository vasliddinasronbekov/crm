"""
Celery tasks for automatic search indexing.
"""

from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from .search_models import SearchIndex, IndexingQueue
from .embedding_service import get_embedding_service
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def index_object(self, content_type_id: int, object_id: int):
    """Index single object asynchronously."""
    try:
        ct = ContentType.objects.get(id=content_type_id)
        obj = ct.get_object_for_this_type(pk=object_id)

        indexer = get_indexer(ct.model)
        if not indexer:
            logger.warning(f"No indexer for {ct.model}")
            return

        data = indexer(obj)
        if not data:
            return

        # Generate embedding
        embedding_service = get_embedding_service()
        combined = f"{data['title']} {data['content']}"
        embedding = embedding_service.embed_text(combined)

        # Save to index
        SearchIndex.objects.update_or_create(
            content_type=ct.model,
            object_id=object_id,
            defaults={
                'title': data['title'],
                'content': data['content'],
                'keywords': data.get('keywords', []),
                'embedding': embedding.tolist(),
                'branch_id': data.get('branch_id'),
                'required_roles': data.get('required_roles', []),
                'metadata': data.get('metadata', {}),
                'is_active': data.get('is_active', True),
            }
        )

        logger.info(f"Indexed {ct.model}:{object_id}")

    except Exception as e:
        logger.error(f"Failed to index {content_type_id}:{object_id}: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task
def bulk_reindex(content_type: str = None):
    """Reindex all objects or specific type."""
    from users.models import User
    from student_profile.models import Course, Group, Room
    from crm.models import Lead

    models = {
        'user': User,
        'course': Course,
        'group': Group,
        'room': Room,
        'lead': Lead,
    }

    if content_type:
        models = {content_type: models[content_type]}

    count = 0
    for name, model_class in models.items():
        ct = ContentType.objects.get_for_model(model_class)
        for obj in model_class.objects.all():
            index_object.delay(ct.id, obj.pk)
            count += 1

    logger.info(f"Queued {count} objects for indexing")
    return count


def get_indexer(model_name: str):
    """Get indexer function for model."""
    indexers = {
        'user': index_user,
        'course': index_course,
        'group': index_group,
        'room': index_room,
        'lead': index_lead,
    }
    return indexers.get(model_name)


# Model-specific indexers

def index_user(user):
    """Index User."""
    return {
        'title': f"{user.first_name} {user.last_name}".strip() or user.username,
        'content': f"{user.username} {user.email} {user.phone or ''}",
        'keywords': [user.username, user.email, user.phone or ''],
        'branch_id': getattr(user.branch, 'id', None) if hasattr(user, 'branch') else None,
        'required_roles': [],
        'metadata': {
            'user_id': user.id,
            'is_teacher': user.is_teacher,
            'is_staff': user.is_staff,
        },
        'is_active': user.is_active,
    }


def index_course(course):
    """Index Course."""
    desc = getattr(course, 'description', '') or ''
    return {
        'title': course.name,
        'content': f"{course.name} {desc}",
        'keywords': [course.name],
        'branch_id': None,
        'required_roles': [],
        'metadata': {
            'course_id': course.id,
            'price': course.price,
        },
        'is_active': getattr(course, 'is_active', True),
    }


def index_group(group):
    """Index Group."""
    course_name = group.course.name if group.course else ''
    return {
        'title': group.name,
        'content': f"{group.name} {course_name}",
        'keywords': [group.name],
        'branch_id': group.branch_id if group.branch else None,
        'required_roles': ['teacher', 'admin'],
        'metadata': {
            'group_id': group.id,
            'course_id': group.course_id if group.course else None,
        },
        'is_active': True,
    }


def index_room(room):
    """Index Room."""
    return {
        'title': f"Room {room.name}",
        'content': f"Room {room.name} capacity {room.capacity}",
        'keywords': [room.name, f"room{room.name}"],
        'branch_id': room.branch_id if room.branch else None,
        'required_roles': ['teacher', 'admin'],
        'metadata': {
            'room_id': room.id,
            'capacity': room.capacity,
        },
        'is_active': True,
    }


def index_lead(lead):
    """Index Lead."""
    return {
        'title': f"{lead.first_name} {lead.last_name}",
        'content': f"{lead.first_name} {lead.last_name} {lead.email} {lead.phone or ''}",
        'keywords': [lead.email, lead.phone or ''],
        'branch_id': None,
        'required_roles': ['admin', 'staff'],
        'metadata': {
            'lead_id': lead.id,
            'status': lead.status,
        },
        'is_active': True,
    }

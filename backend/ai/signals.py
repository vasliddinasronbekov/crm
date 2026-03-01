"""
Django signals for the AI app to trigger indexing.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.conf import settings
from student_profile.models import Group, Course
from crm.models import Lead
from task.models import Task
from messaging.models import ChatMessage
from .tasks import index_object_task, deindex_object_task

# Core models to be indexed
INDEXABLE_MODELS = {
    'user': settings.AUTH_USER_MODEL,
    'group': Group,
    'course': Course,
    'lead': Lead,
    'task': Task,
    'chatmessage': ChatMessage,
}

def get_content_type_for_model(model):
    for content_type, model_class in INDEXABLE_MODELS.items():
        if model == model_class:
            return content_type
    return None

@receiver(post_save)
def on_save(sender, instance, created, **kwargs):
    """
    Trigger indexing on model save.
    """
    content_type = get_content_type_for_model(sender)
    if content_type:
        index_object_task.delay(content_type, instance.pk)

@receiver(post_delete)
def on_delete(sender, instance, **kwargs):
    """
    Trigger de-indexing on model delete.
    """
    content_type = get_content_type_for_model(sender)
    if content_type:
        deindex_object_task.delay(content_type, instance.pk)
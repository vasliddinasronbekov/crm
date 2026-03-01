# ai/tasks.py
"""
Celery/asynchronous task wrapper.
If Celery is configured in the project, we register a real task.
Otherwise provide a dummy object with .delay that executes sync.
"""

from pathlib import Path
import logging
from django.apps import apps
from .indexing_service import get_indexing_service

log = logging.getLogger(__name__)

try:
    from celery import shared_task
    _HAS_CELERY = True
except Exception:
    _HAS_CELERY = False

from .services import transcribe_audio, extract_intent, extract_entities, spell_correct
from .intent_handler import handle_nlu_result_sync

if _HAS_CELERY:
    @shared_task(bind=True)
    def stt_and_parse(self, local_path: str):
        try:
            raw_text, duration = transcribe_audio(local_path)
            corrected = spell_correct(raw_text)
            nlu = extract_intent(corrected)
            nlu["entities"] = extract_entities(corrected)
            # NOTE: can't access request.user in celery, so handler receives None
            result = handle_nlu_result_sync(nlu, transcript=corrected, user=None)
            return {"raw": raw_text, "corrected": corrected, "duration": duration, "nlu": nlu, "result": result}
        except Exception as e:
            log.exception("stt_and_parse failed")
            return {"error": str(e)}

    @shared_task(bind=True)
    def index_object_task(self, content_type: str, object_id: int):
        """
        Celery task to index an object.
        """
        try:
            from .signals import INDEXABLE_MODELS
            model_class = apps.get_model(INDEXABLE_MODELS[content_type])
            instance = model_class.objects.get(pk=object_id)
            service = get_indexing_service()
            service.index_object(instance, content_type)
        except Exception as e:
            log.exception(f"Failed to index {content_type}:{object_id}")
            return {"error": str(e)}

    @shared_task(bind=True)
    def deindex_object_task(self, content_type: str, object_id: int):
        """
        Celery task to de-index an object.
        """
        try:
            from .signals import INDEXABLE_MODELS
            model_class = apps.get_model(INDEXABLE_MODELS[content_type])
            # The instance might not exist anymore, so we just pass a dummy object with the pk
            instance = model_class(pk=object_id)
            service = get_indexing_service()
            service.deindex_object(instance, content_type)
        except Exception as e:
            log.exception(f"Failed to de-index {content_type}:{object_id}")
            return {"error": str(e)}

else:
    # Fallback: simple synchronous wrapper object
    class _FakeAsyncResult:
        def __init__(self, result):
            self._result = result
            self.id = None
        def get(self, timeout=None):
            return self._result

    def stt_and_parse_delay(local_path: str):
        try:
            raw_text, duration = transcribe_audio(local_path)
            corrected = spell_correct(raw_text)
            nlu = extract_intent(corrected)
            nlu["entities"] = extract_entities(corrected)
            result = handle_nlu_result_sync(nlu, transcript=corrected, user=None)
            return {"raw": raw_text, "corrected": corrected, "duration": duration, "nlu": nlu, "result": result}
        except Exception as e:
            log.exception("stt_and_parse fallback failed")
            return {"error": str(e)}

    def index_object_delay(content_type: str, object_id: int):
        try:
            from .signals import INDEXABLE_MODELS
            model_class = apps.get_model(INDEXABLE_MODELS[content_type])
            instance = model_class.objects.get(pk=object_id)
            service = get_indexing_service()
            service.index_object(instance, content_type)
        except Exception as e:
            log.exception(f"Failed to index {content_type}:{object_id}")
            return {"error": str(e)}

    def deindex_object_delay(content_type: str, object_id: int):
        try:
            from .signals import INDEXABLE_MODELS
            model_class = apps.get_model(INDEXABLE_MODELS[content_type])
            instance = model_class(pk=object_id)
            service = get_indexing_service()
            service.deindex_object(instance, content_type)
        except Exception as e:
            log.exception(f"Failed to de-index {content_type}:{object_id}")
            return {"error": str(e)}

    class _Stub:
        @staticmethod
        def delay(*args, **kwargs):
            if args[0] == "stt_and_parse":
                return _FakeAsyncResult(stt_and_parse_delay(args[1]))
            elif args[0] == "index_object_task":
                return _FakeAsyncResult(index_object_delay(args[1], args[2]))
            elif args[0] == "deindex_object_task":
                return _FakeAsyncResult(deindex_object_delay(args[1], args[2]))

    stt_and_parse = _Stub()
    index_object_task = _Stub()
    deindex_object_task = _Stub()

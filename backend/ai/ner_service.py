"""
Named Entity Recognition (NER) Service
Extracts structured entities from text using a pre-trained model.
"""

from transformers import pipeline
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class EntityExtractor:
    """
    Extracts named entities from text using a pre-trained transformer model.
    """

    def __init__(self, model_name: str = "dslim/bert-base-NER"):
        try:
            self.nlp = pipeline("ner", model=model_name, aggregation_strategy="simple")
            logger.info(f"NER model '{model_name}' loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load NER model '{model_name}': {e}", exc_info=True)
            self.nlp = None

    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts entities from a given text.

        Args:
            text: The input text.

        Returns:
            A list of extracted entities, where each entity is a dictionary.
        """
        if not self.nlp:
            logger.warning("NER model not loaded. Cannot extract entities.")
            return []

        try:
            entities = self.nlp(text)
            return self._post_process(entities)
        except Exception as e:
            logger.error(f"Failed to extract entities: {e}", exc_info=True)
            return []

    def _post_process(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Post-processes the extracted entities to a more usable format.
        """
        processed = []
        for entity in entities:
            processed.append({
                'entity': entity['entity_group'],
                'value': entity['word'],
                'score': entity['score'],
                'start': entity['start'],
                'end': e['end'],
            })
        return processed

_entity_extractor = None

def get_entity_extractor() -> EntityExtractor:
    """
    Returns a singleton instance of the EntityExtractor.
    """
    global _entity_extractor
    if _entity_extractor is None:
        _entity_extractor = EntityExtractor()
    return _entity_extractor

def extract_entities(text: str) -> List[Dict[str, Any]]:
    """
    Convenience function to extract entities from text.
    """
    extractor = get_entity_extractor()
    return extractor.extract_entities(text)
"""
Open-source embedding service using sentence-transformers.
100% free, multilingual support (uz, ru, en).
CPU-ONLY (no GPU required).
"""

from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np
from django.core.cache import cache
import logging
import os

logger = logging.getLogger(__name__)

# Force CPU usage (no GPU required)
os.environ['CUDA_VISIBLE_DEVICES'] = ''


class EmbeddingService:
    """
    Embedding service using sentence-transformers.
    Model: all-MiniLM-L6-v2 (384 dimensions, multilingual, fast)

    CPU-OPTIMIZED:
    - Runs on CPU only (no GPU required)
    - Lightweight model (90MB)
    - Fast inference even on CPU (~50ms per embedding)
    """

    def __init__(self, model_name: str = 'sentence-transformers/all-MiniLM-L6-v2'):
        self.model_name = model_name
        self._model = None
        self.device = 'cpu'  # Force CPU

    @property
    def model(self):
        """Lazy load model on first use (CPU only)."""
        if self._model is None:
            logger.info(f"Attempting to load embedding model on CPU: {self.model_name}")
            try:
                self._model = SentenceTransformer(self.model_name, device=self.device)
                logger.info(f"Embedding model loaded successfully on {self.device.upper()}")
            except Exception as e:
                logger.exception(f"Failed to load embedding model '{self.model_name}'. "
                                 f"This may be due to a network issue or missing model files. "
                                 f"Please ensure you have an internet connection to download the model on first run. "
                                 f"Error: {e}")
                raise e  # Re-raise the exception to be caught by the view
        return self._model

    def embed_text(self, text: str) -> np.ndarray:
        """
        Generate 384-dim embedding for text.
        Cached for 1 hour.
        """
        cache_key = f"emb:{hash(text)}"
        cached = cache.get(cache_key)
        if cached is not None:
            return np.array(cached)

        embedding = self.model.encode(text, convert_to_numpy=True)
        cache.set(cache_key, embedding.tolist(), 3600)
        return embedding

    def embed_batch(self, texts: List[str], batch_size: int = 16) -> np.ndarray:
        """
        Generate embeddings for multiple texts (CPU-optimized).

        Args:
            texts: List of texts to embed
            batch_size: Smaller batch size for CPU (default: 16)

        Returns:
            Array of embeddings
        """
        return self.model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            show_progress_bar=False,
            device=self.device
        )

    def similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Cosine similarity between two embeddings."""
        return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))


# Singleton
_service = None

def get_embedding_service() -> EmbeddingService:
    global _service
    if _service is None:
        _service = EmbeddingService()
    return _service

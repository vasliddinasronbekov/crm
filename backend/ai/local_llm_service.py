"""
Local LLM Service - Free, Private, Multilingual (en/ru/uz)

Supports:
- LLaMA models (via llama-cpp-python or transformers)
- Mistral models
- Multilingual models (mGPT, BLOOM, etc.)
- No API costs, runs locally
"""
import os
import logging
import torch
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class LocalModelType(Enum):
    """Supported local model types."""
    LLAMA_CPP = "llama_cpp"  # Fast, quantized models
    TRANSFORMERS = "transformers"  # HuggingFace transformers
    GGUF = "gguf"  # GGUF format models


@dataclass
class ModelConfig:
    """Configuration for local LLM models."""
    name: str
    type: LocalModelType
    model_path: str
    context_length: int
    languages: List[str]  # Supported languages
    description: str
    recommended_for: str


class LocalLLMService:
    """
    Local LLM service with multilingual support.
    Zero API costs, privacy-friendly, offline capable.
    """

    # Recommended models for multilingual support (en/ru/uz)
    MODELS = {
        # LLaMA-based models (best performance)
        "llama-3-8b-instruct-q4": ModelConfig(
            name="LLaMA 3 8B Instruct (4-bit)",
            type=LocalModelType.LLAMA_CPP,
            model_path="models/llama-3-8b-instruct-q4_k_m.gguf",
            context_length=8192,
            languages=["en", "ru"],  # uz needs fine-tuning
            description="Fast, efficient LLaMA 3 model with quantization",
            recommended_for="General chat, good English/Russian"
        ),

        "mistral-7b-instruct-q4": ModelConfig(
            name="Mistral 7B Instruct (4-bit)",
            type=LocalModelType.LLAMA_CPP,
            model_path="models/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            context_length=8192,
            languages=["en", "ru"],
            description="Fast Mistral model, excellent quality",
            recommended_for="Balanced performance and quality"
        ),

        "openchat-3.5-q4": ModelConfig(
            name="OpenChat 3.5 (4-bit)",
            type=LocalModelType.LLAMA_CPP,
            model_path="models/openchat-3.5-0106.Q4_K_M.gguf",
            context_length=8192,
            languages=["en", "ru", "uz"],  # Better multilingual
            description="OpenChat 3.5 with multilingual support",
            recommended_for="Multilingual conversations"
        ),

        # Multilingual models via Transformers
        "bloom-560m": ModelConfig(
            name="BLOOM 560M",
            type=LocalModelType.TRANSFORMERS,
            model_path="bigscience/bloom-560m",
            context_length=2048,
            languages=["en", "ru", "uz"],
            description="Lightweight multilingual model",
            recommended_for="Low-resource environments, true multilingual"
        ),

        "mGPT-1.3B": ModelConfig(
            name="mGPT 1.3B",
            type=LocalModelType.TRANSFORMERS,
            model_path="ai-forever/mGPT-1.3B",
            context_length=2048,
            languages=["en", "ru"],
            description="Russian-focused GPT model",
            recommended_for="Russian language tasks"
        ),

        "saiga-mistral-7b": ModelConfig(
            name="Saiga Mistral 7B (Russian)",
            type=LocalModelType.LLAMA_CPP,
            model_path="models/saiga_mistral_7b.Q4_K_M.gguf",
            context_length=8192,
            languages=["ru", "en"],
            description="Russian-tuned Mistral model",
            recommended_for="Best Russian language quality"
        ),
    }

    # System prompts in multiple languages
    SYSTEM_PROMPTS = {
        'en': {
            'student': """You are an AI assistant for an educational platform helping students.
You help with questions about courses, schedules, assignments, grades, and payments.
Be helpful, encouraging, and educational. Keep responses concise and clear.""",

            'staff': """You are an AI assistant for educational institution staff.
You help with managing students, groups, courses, analytics, and CRM tasks.
Be professional, efficient, and data-driven.""",

            'general': """You are a helpful AI assistant for an educational platform.
Assist with questions and provide clear, concise information."""
        },
        'ru': {
            'student': """Вы AI-помощник образовательной платформы для студентов.
Вы помогаете с вопросами о курсах, расписании, заданиях, оценках и оплате.
Будьте полезным, воодушевляющим и образовательным. Отвечайте кратко и ясно.""",

            'staff': """Вы AI-помощник для сотрудников образовательного учреждения.
Вы помогаете с управлением студентами, группами, курсами, аналитикой и CRM.
Будьте профессиональным, эффективным и ориентированным на данные.""",

            'general': """Вы полезный AI-помощник образовательной платформы.
Помогайте с вопросами и предоставляйте четкую, краткую информацию."""
        },
        'uz': {
            'student': """Siz talabalar uchun ta'lim platformasining AI yordamchisisiz.
Siz kurslar, jadval, topshiriqlar, baholar va to'lovlar haqida yordam berasiz.
Foydali, dalda beruvchi va ta'limiy bo'ling. Javoblarni qisqa va aniq bering.""",

            'staff': """Siz ta'lim muassasasi xodimlari uchun AI yordamchisisiz.
Siz talabalar, guruhlar, kurslar, analitika va CRM bilan ishlashda yordam berasiz.
Professional, samarali va ma'lumotlarga asoslangan bo'ling.""",

            'general': """Siz ta'lim platformasining foydali AI yordamchisisiz.
Savollarga yordam bering va aniq, qisqa ma'lumot bering."""
        }
    }

    def __init__(
        self,
        model_name: str = "openchat-3.5-q4",
        device: str = "auto",
        cache_responses: bool = True,
        max_tokens: int = 512,
        temperature: float = 0.7
    ):
        """
        Initialize Local LLM service.

        Args:
            model_name: Model to use (from MODELS dict)
            device: Device to run on ('cpu', 'cuda', 'auto')
            cache_responses: Enable response caching
            max_tokens: Maximum response length
            temperature: Response creativity (0-1)
        """
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.cache_responses = cache_responses

        if model_name not in self.MODELS:
            logger.warning(f"Unknown model '{model_name}', using 'openchat-3.5-q4'")
            model_name = "openchat-3.5-q4"

        self.model_config = self.MODELS[model_name]

        # Detect device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        logger.info(f"Initializing Local LLM: {self.model_config.name} on {self.device}")

        # Initialize model
        self.model = None
        self.tokenizer = None
        self._init_model()

    def _init_model(self):
        """Initialize the selected model."""
        try:
            if self.model_config.type == LocalModelType.LLAMA_CPP:
                self._init_llama_cpp()
            elif self.model_config.type == LocalModelType.TRANSFORMERS:
                self._init_transformers()
            else:
                raise ValueError(f"Unsupported model type: {self.model_config.type}")

            logger.info(f"✅ Model loaded: {self.model_config.name}")
        except Exception as e:
            logger.error(f"Failed to initialize model: {e}")
            logger.warning("Local LLM will be disabled. Install models or use API LLMs.")
            self.model = None

    def _init_llama_cpp(self):
        """Initialize llama-cpp-python model."""
        try:
            from llama_cpp import Llama

            model_path = self._get_model_path()

            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model not found: {model_path}\n"
                    f"Download it using: python scripts/download_models.py {self.model_name}"
                )

            # Initialize with optimized settings
            self.model = Llama(
                model_path=model_path,
                n_ctx=self.model_config.context_length,
                n_threads=os.cpu_count() or 4,
                n_gpu_layers=35 if self.device == "cuda" else 0,  # GPU offloading
                verbose=False
            )

            logger.info(f"Loaded llama.cpp model from {model_path}")

        except ImportError:
            raise ImportError(
                "llama-cpp-python not installed. Install with:\n"
                "pip install llama-cpp-python"
            )

    def _init_transformers(self):
        """Initialize HuggingFace transformers model."""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer

            model_path = self.model_config.model_path

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)

            # Load model with optimizations
            self.model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map=self.device if self.device == "cuda" else None,
                low_cpu_mem_usage=True
            )

            if self.device == "cpu":
                self.model = self.model.to(self.device)

            logger.info(f"Loaded transformers model: {model_path}")

        except ImportError:
            raise ImportError("transformers not installed. Already in requirements.txt")

    def _get_model_path(self) -> str:
        """Get full path to model file."""
        base_dir = getattr(settings, 'LOCAL_LLM_DIR', '/home/gradientvvv/untilIwin/backend/ai/models')
        return os.path.join(base_dir, self.model_config.model_path)

    def chat(
        self,
        messages: List[Dict[str, str]],
        language: Optional[str] = None,  # Auto-detect if None
        user_role: str = 'general',
        stream: bool = False,
        use_knowledge_base: bool = True,
        knowledge_category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate chat response with knowledge base augmentation.

        Args:
            messages: List of {'role': 'user/assistant', 'content': str}
            language: Language code ('en', 'ru', 'uz') or None for auto-detection
            user_role: User role ('student', 'staff', 'general')
            stream: Enable streaming (not implemented yet)
            use_knowledge_base: Use RAG to augment with platform knowledge
            knowledge_category: Filter knowledge by category

        Returns:
            Dict with response, tokens, time, etc.
        """
        if not self.model:
            raise Exception("Model not initialized. Check logs for errors.")

        # Auto-detect language if not specified
        if language is None:
            from .language_detector import detect_language
            # Get last user message for detection
            last_user_msg = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), '')
            if last_user_msg:
                language = detect_language(last_user_msg)
                logger.info(f"Auto-detected language: {language}")
            else:
                language = 'en'  # Default

        # Validate language
        if language not in self.model_config.languages:
            logger.warning(
                f"Language '{language}' not optimal for {self.model_config.name}. "
                f"Supported: {self.model_config.languages}"
            )

        # Check cache
        if self.cache_responses:
            cache_key = self._get_cache_key(messages, language, user_role)
            cached = cache.get(cache_key)
            if cached:
                logger.info("Returning cached response")
                return {**cached, 'cached': True}

        # Augment with knowledge base (RAG)
        knowledge_context = ""
        if use_knowledge_base and messages:
            try:
                from .knowledge_base import get_context
                last_user_message = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), '')
                if last_user_message:
                    knowledge_context = get_context(
                        last_user_message,
                        language=language,
                        category=knowledge_category
                    )
                    if knowledge_context:
                        logger.info(f"Injected knowledge context: {len(knowledge_context)} chars")
            except Exception as e:
                logger.warning(f"Failed to get knowledge context: {e}")

        # Build prompt with system message + knowledge
        system_prompt = self._get_system_prompt(language, user_role)
        if knowledge_context:
            system_prompt += f"\n\n{knowledge_context}"

        full_prompt = self._build_prompt(system_prompt, messages)

        # Generate response
        import time
        start_time = time.time()

        if self.model_config.type == LocalModelType.LLAMA_CPP:
            response_text, tokens = self._generate_llama_cpp(full_prompt)
        else:
            response_text, tokens = self._generate_transformers(full_prompt)

        generation_time = time.time() - start_time

        result = {
            'response': response_text.strip(),
            'model': self.model_config.name,
            'tokens_used': tokens,
            'generation_time': generation_time,
            'language': language,
            'language_detected': language if language else 'auto',
            'cost_usd': 0.0,  # Local = FREE!
            'cached': False,
            'device': self.device
        }

        # Cache response
        if self.cache_responses:
            cache.set(cache_key, result, 3600)  # 1 hour

        return result

    def _generate_llama_cpp(self, prompt: str) -> tuple:
        """Generate response using llama.cpp."""
        output = self.model(
            prompt,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            top_p=0.95,
            repeat_penalty=1.1,
            stop=["User:", "Assistant:", "\n\n\n"],
            echo=False
        )

        response_text = output['choices'][0]['text']
        tokens = output['usage']['total_tokens']

        return response_text, tokens

    def _generate_transformers(self, prompt: str) -> tuple:
        """Generate response using transformers."""
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=self.max_tokens,
                temperature=self.temperature,
                top_p=0.95,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        response_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Remove prompt from response
        response_text = response_text[len(prompt):].strip()

        tokens = len(outputs[0])

        return response_text, tokens

    def _get_system_prompt(self, language: str, user_role: str) -> str:
        """Get system prompt in specified language."""
        lang_prompts = self.SYSTEM_PROMPTS.get(language, self.SYSTEM_PROMPTS['en'])
        return lang_prompts.get(user_role, lang_prompts['general'])

    def _build_prompt(self, system_prompt: str, messages: List[Dict]) -> str:
        """Build formatted prompt from system + messages."""
        # Format depends on model
        if "llama-3" in self.model_name:
            # LLaMA 3 format
            prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n{system_prompt}<|eot_id|>"
            for msg in messages:
                role = msg['role']
                content = msg['content']
                prompt += f"<|start_header_id|>{role}<|end_header_id|>\n{content}<|eot_id|>"
            prompt += "<|start_header_id|>assistant<|end_header_id|>\n"

        elif "mistral" in self.model_name or "saiga" in self.model_name:
            # Mistral/Saiga format
            prompt = f"<s>[INST] {system_prompt}\n\n"
            for i, msg in enumerate(messages):
                if msg['role'] == 'user':
                    prompt += msg['content']
                    if i < len(messages) - 1 and messages[i+1]['role'] == 'assistant':
                        prompt += f" [/INST] {messages[i+1]['content']}</s>[INST] "
            prompt += " [/INST]"

        else:
            # Generic format
            prompt = f"System: {system_prompt}\n\n"
            for msg in messages:
                role = "User" if msg['role'] == 'user' else "Assistant"
                prompt += f"{role}: {msg['content']}\n"
            prompt += "Assistant:"

        return prompt

    def _get_cache_key(self, messages: List[Dict], language: str, user_role: str) -> str:
        """Generate cache key for request."""
        import hashlib
        content = str(messages) + language + user_role + self.model_name
        return f"local_llm:{hashlib.md5(content.encode()).hexdigest()}"

    def get_model_info(self) -> Dict:
        """Get information about loaded model."""
        return {
            'model_name': self.model_config.name,
            'model_type': self.model_config.type.value,
            'languages': self.model_config.languages,
            'context_length': self.model_config.context_length,
            'device': self.device,
            'description': self.model_config.description,
            'loaded': self.model is not None,
            'cost_per_request': 0.0  # FREE!
        }


# Convenience function
def create_local_llm(model_name: str = "openchat-3.5-q4") -> LocalLLMService:
    """Create local LLM service instance."""
    return LocalLLMService(model_name=model_name)


def chat_local(
    message: str,
    language: Optional[str] = None,  # Auto-detect if None
    user_role: str = 'general',
    model_name: str = "openchat-3.5-q4"
) -> str:
    """
    Simple chat interface with local LLM.

    Args:
        message: User message
        language: Language ('en', 'ru', 'uz') or None for auto-detection
        user_role: User role ('student', 'staff', 'general')
        model_name: Model to use

    Returns:
        str: AI response
    """
    # Auto-detect language if not specified
    if language is None:
        from .language_detector import detect_language
        language = detect_language(message)
        logger.info(f"Auto-detected language: {language} for message: '{message[:50]}...'")

    llm = create_local_llm(model_name)

    messages = [{'role': 'user', 'content': message}]

    result = llm.chat(messages, language=language, user_role=user_role)

    return result['response']

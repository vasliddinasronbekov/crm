#!/usr/bin/env python3
"""
Download and setup local LLM models for multilingual support (en/ru/uz).

Usage:
    python scripts/download_local_llm.py openchat-3.5-q4
    python scripts/download_local_llm.py mistral-7b-instruct-q4
    python scripts/download_local_llm.py bloom-560m
"""
import os
import sys
import argparse
from pathlib import Path
import urllib.request
from tqdm import tqdm


class ModelDownloader:
    """Download and setup local LLM models."""

    # HuggingFace model URLs (GGUF format for llama.cpp)
    GGUF_MODELS = {
        "openchat-3.5-q4": {
            "url": "https://huggingface.co/TheBloke/openchat-3.5-0106-GGUF/resolve/main/openchat-3.5-0106.Q4_K_M.gguf",
            "filename": "openchat-3.5-0106.Q4_K_M.gguf",
            "size_gb": 4.9,
            "description": "OpenChat 3.5 (best multilingual support for en/ru/uz)"
        },
        "mistral-7b-instruct-q4": {
            "url": "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            "filename": "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            "size_gb": 4.4,
            "description": "Mistral 7B Instruct (excellent quality, good for en/ru)"
        },
        "llama-3-8b-instruct-q4": {
            "url": "https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf",
            "filename": "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf",
            "size_gb": 4.9,
            "description": "LLaMA 3 8B (best quality for en/ru)"
        },
        "saiga-mistral-7b": {
            "url": "https://huggingface.co/IlyaGusev/saiga_mistral_7b_gguf/resolve/main/model-q4_K.gguf",
            "filename": "saiga_mistral_7b.Q4_K_M.gguf",
            "size_gb": 4.4,
            "description": "Saiga Mistral 7B (Russian-optimized)"
        }
    }

    # HuggingFace Transformers models
    TRANSFORMERS_MODELS = {
        "bloom-560m": {
            "model_id": "bigscience/bloom-560m",
            "size_gb": 1.1,
            "description": "BLOOM 560M (small, true multilingual including uz)"
        },
        "bloom-1b7": {
            "model_id": "bigscience/bloom-1b7",
            "size_gb": 3.5,
            "description": "BLOOM 1.7B (better quality, multilingual)"
        },
        "mGPT-1.3B": {
            "model_id": "ai-forever/mGPT-1.3B",
            "size_gb": 2.6,
            "description": "mGPT 1.3B (Russian-focused multilingual)"
        }
    }

    def __init__(self, models_dir: str = None):
        """Initialize downloader."""
        if models_dir is None:
            # Default to backend/ai/models/
            base_dir = Path(__file__).parent.parent / "ai" / "models"
        else:
            base_dir = Path(models_dir)

        self.models_dir = base_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Models directory: {self.models_dir}")

    def download_gguf(self, model_name: str):
        """Download GGUF model for llama.cpp."""
        if model_name not in self.GGUF_MODELS:
            print(f"❌ Unknown GGUF model: {model_name}")
            print(f"Available models: {', '.join(self.GGUF_MODELS.keys())}")
            return False

        model_info = self.GGUF_MODELS[model_name]
        url = model_info['url']
        filename = model_info['filename']
        output_path = self.models_dir / filename

        if output_path.exists():
            print(f"✅ Model already exists: {output_path}")
            return True

        print(f"📥 Downloading: {model_info['description']}")
        print(f"   Size: ~{model_info['size_gb']} GB")
        print(f"   URL: {url}")
        print(f"   Destination: {output_path}")

        try:
            # Download with progress bar
            print("   Downloading...")
            self._download_with_progress(url, output_path)
            print(f"✅ Downloaded successfully: {output_path}")
            return True

        except Exception as e:
            print(f"❌ Download failed: {e}")
            if output_path.exists():
                output_path.unlink()  # Clean up partial download
            return False

    def download_transformers(self, model_name: str):
        """Download HuggingFace transformers model."""
        if model_name not in self.TRANSFORMERS_MODELS:
            print(f"❌ Unknown transformers model: {model_name}")
            print(f"Available models: {', '.join(self.TRANSFORMERS_MODELS.keys())}")
            return False

        model_info = self.TRANSFORMERS_MODELS[model_name]
        model_id = model_info['model_id']

        print(f"📥 Downloading: {model_info['description']}")
        print(f"   Size: ~{model_info['size_gb']} GB")
        print(f"   Model ID: {model_id}")

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer

            print("   Downloading tokenizer...")
            tokenizer = AutoTokenizer.from_pretrained(model_id)

            print("   Downloading model...")
            model = AutoModelForCausalLM.from_pretrained(model_id)

            print(f"✅ Downloaded successfully: {model_id}")
            print(f"   Cached in: ~/.cache/huggingface/")
            return True

        except Exception as e:
            print(f"❌ Download failed: {e}")
            return False

    def _download_with_progress(self, url: str, output_path: Path):
        """Download file with progress bar."""
        with tqdm(unit='B', unit_scale=True, miniters=1, desc=output_path.name) as t:
            def update_progress(block_num, block_size, total_size):
                if t.total is None and total_size:
                    t.total = total_size
                t.update(block_size)

            urllib.request.urlretrieve(url, output_path, reporthook=update_progress)

    def list_models(self):
        """List available models."""
        print("\n📋 Available Local LLM Models:\n")

        print("GGUF Models (for llama.cpp - RECOMMENDED):")
        print("=" * 80)
        for name, info in self.GGUF_MODELS.items():
            installed = "✅" if (self.models_dir / info['filename']).exists() else "⬜"
            print(f"{installed} {name:30} - {info['description']}")
            print(f"   Size: {info['size_gb']} GB | Languages: en, ru" + (", uz" if "openchat" in name else ""))
            print()

        print("\nTransformers Models (via HuggingFace):")
        print("=" * 80)
        for name, info in self.TRANSFORMERS_MODELS.items():
            print(f"⬜ {name:30} - {info['description']}")
            print(f"   Size: {info['size_gb']} GB | Model ID: {info['model_id']}")
            print()

    def recommend_model(self):
        """Recommend best model based on system resources."""
        import psutil

        mem_gb = psutil.virtual_memory().total / (1024**3)
        print(f"\n💡 System RAM: {mem_gb:.1f} GB")
        print("\n🎯 Recommended Models:\n")

        if mem_gb < 8:
            print("   For low-resource systems (<8GB RAM):")
            print("   → bloom-560m (1.1 GB, true multilingual with uz)")
            print("   Download: python scripts/download_local_llm.py bloom-560m")
        elif mem_gb < 16:
            print("   For medium systems (8-16GB RAM):")
            print("   → openchat-3.5-q4 (4.9 GB, best multilingual)")
            print("   → mistral-7b-instruct-q4 (4.4 GB, excellent quality)")
            print("   Download: python scripts/download_local_llm.py openchat-3.5-q4")
        else:
            print("   For high-resource systems (16GB+ RAM):")
            print("   → llama-3-8b-instruct-q4 (4.9 GB, best quality)")
            print("   → openchat-3.5-q4 (4.9 GB, best multilingual)")
            print("   Download: python scripts/download_local_llm.py llama-3-8b-instruct-q4")

        print("\n   For best Russian support:")
        print("   → saiga-mistral-7b (4.4 GB)")
        print("   Download: python scripts/download_local_llm.py saiga-mistral-7b")


def main():
    parser = argparse.ArgumentParser(
        description="Download local LLM models for multilingual chat (en/ru/uz)"
    )
    parser.add_argument(
        "model",
        nargs="?",
        help="Model name to download (or 'list' to see all models)"
    )
    parser.add_argument(
        "--models-dir",
        help="Directory to store models (default: backend/ai/models/)"
    )
    parser.add_argument(
        "--recommend",
        action="store_true",
        help="Show recommended model for your system"
    )

    args = parser.parse_args()

    downloader = ModelDownloader(models_dir=args.models_dir)

    if args.recommend:
        downloader.recommend_model()
        return

    if not args.model or args.model == "list":
        downloader.list_models()
        return

    # Download specific model
    model_name = args.model

    # Try GGUF first
    if model_name in downloader.GGUF_MODELS:
        success = downloader.download_gguf(model_name)
    elif model_name in downloader.TRANSFORMERS_MODELS:
        success = downloader.download_transformers(model_name)
    else:
        print(f"❌ Unknown model: {model_name}")
        print("\nUse 'list' to see all available models:")
        print("   python scripts/download_local_llm.py list")
        return

    if success:
        print("\n✅ Setup complete! You can now use local LLM:")
        print(f"\n   export USE_LOCAL_LLM=true")
        print(f"   export LOCAL_LLM_MODEL={model_name}")
        print(f"   python manage.py shell")
        print(f"\n   >>> from ai.local_llm_service import chat_local")
        print(f"   >>> response = chat_local('Hello', language='en')")
        print(f"   >>> print(response)")


if __name__ == "__main__":
    # Check if tqdm is installed
    try:
        from tqdm import tqdm
    except ImportError:
        print("Installing tqdm for progress bars...")
        os.system("pip install tqdm")

    main()

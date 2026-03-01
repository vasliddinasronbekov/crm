#!/usr/bin/env python3
"""
AI Model Download Automation Script

Downloads recommended AI models for production use:
- Local LLM models (OpenChat, Mistral, etc.)
- Whisper STT models
- Piper TTS voices

Usage:
    python scripts/download_ai_models.py all              # Download all recommended models
    python scripts/download_ai_models.py llm              # Download LLM only
    python scripts/download_ai_models.py stt              # Download STT only
    python scripts/download_ai_models.py tts              # Download TTS only
    python scripts/download_ai_models.py openchat-3.5     # Download specific model
"""
import os
import sys
import argparse
import urllib.request
from pathlib import Path
from typing import Dict, List
import hashlib
import json


# Model configurations
MODELS = {
    # Local LLM Models
    "openchat-3.5-q4": {
        "name": "OpenChat 3.5 (4-bit quantized)",
        "type": "llm",
        "size": "4.5 GB",
        "url": "https://huggingface.co/TheBloke/openchat-3.5-1210-GGUF/resolve/main/openchat-3.5-1210.Q4_K_M.gguf",
        "filename": "openchat-3.5-0106.Q4_K_M.gguf",
        "description": "Best multilingual LLM for Uzbek/Russian/English",
        "recommended": True
    },

    "mistral-7b-q4": {
        "name": "Mistral 7B Instruct (4-bit)",
        "type": "llm",
        "size": "4.1 GB",
        "url": "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
        "filename": "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
        "description": "Excellent quality, fast inference",
        "recommended": True
    },

    "llama-3-8b-q4": {
        "name": "LLaMA 3 8B Instruct (4-bit)",
        "type": "llm",
        "size": "4.7 GB",
        "url": "https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf",
        "filename": "llama-3-8b-instruct-q4_k_m.gguf",
        "description": "Latest LLaMA model, great for English/Russian",
        "recommended": False
    },

    # Whisper STT Models
    "whisper-base": {
        "name": "Whisper Base",
        "type": "stt",
        "size": "150 MB",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        "filename": "ggml-base.bin",
        "description": "Fast, good for real-time transcription",
        "recommended": False
    },

    "whisper-medium": {
        "name": "Whisper Medium",
        "type": "stt",
        "size": "1.5 GB",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        "filename": "ggml-medium.bin",
        "description": "Best balance of speed/accuracy",
        "recommended": True
    },

    "whisper-large": {
        "name": "Whisper Large V3",
        "type": "stt",
        "size": "3.1 GB",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
        "filename": "ggml-large-v3.bin",
        "description": "Highest accuracy, slower",
        "recommended": False
    },

    # Piper TTS Voices
    "piper-uz": {
        "name": "Piper Uzbek Voice (Dilnavoz)",
        "type": "tts",
        "size": "100 MB",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/uz/uz_UZ/dilnavoz/medium/uz_UZ-dilnavoz-medium.onnx",
        "filename": "uz_UZ-dilnavoz-medium.onnx",
        "description": "Uzbek female voice",
        "recommended": True,
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/uz/uz_UZ/dilnavoz/medium/uz_UZ-dilnavoz-medium.onnx.json",
        "config_filename": "uz_UZ-dilnavoz-medium.onnx.json"
    },

    "piper-ru": {
        "name": "Piper Russian Voice (Irina)",
        "type": "tts",
        "size": "100 MB",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx",
        "filename": "ru_RU-irina-medium.onnx",
        "description": "Russian female voice",
        "recommended": True,
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json",
        "config_filename": "ru_RU-irina-medium.onnx.json"
    },

    "piper-en": {
        "name": "Piper English Voice (Amy)",
        "type": "tts",
        "size": "100 MB",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx",
        "filename": "en_US-amy-medium.onnx",
        "description": "English female voice",
        "recommended": True,
        "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json",
        "config_filename": "en_US-amy-medium.onnx.json"
    }
}


class ModelDownloader:
    """Downloads and manages AI models."""

    def __init__(self, models_dir: str = None):
        """
        Initialize downloader.

        Args:
            models_dir: Directory to download models to
        """
        if models_dir is None:
            # Default to backend/ai/models
            models_dir = Path(__file__).parent.parent / "ai" / "models"

        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)

        print(f"📁 Models directory: {self.models_dir}")

    def download_model(self, model_key: str, force: bool = False) -> bool:
        """
        Download a specific model.

        Args:
            model_key: Model key from MODELS dict
            force: Force re-download even if exists

        Returns:
            True if successful
        """
        if model_key not in MODELS:
            print(f"❌ Unknown model: {model_key}")
            print(f"Available models: {', '.join(MODELS.keys())}")
            return False

        model_info = MODELS[model_key]
        filepath = self.models_dir / model_info["filename"]

        # Check if already exists
        if filepath.exists() and not force:
            print(f"✅ {model_info['name']} already exists at {filepath}")
            return True

        print(f"\n📥 Downloading {model_info['name']}...")
        print(f"   Size: {model_info['size']}")
        print(f"   Description: {model_info['description']}")

        try:
            # Download with progress
            self._download_with_progress(model_info["url"], filepath)

            # Download config file if exists (for TTS)
            if "config_url" in model_info:
                config_filepath = self.models_dir / model_info["config_filename"]
                print(f"   Downloading config file...")
                self._download_with_progress(model_info["config_url"], config_filepath)

            print(f"✅ Downloaded successfully to {filepath}")
            return True

        except Exception as e:
            print(f"❌ Failed to download: {e}")
            # Cleanup partial download
            if filepath.exists():
                filepath.unlink()
            return False

    def _download_with_progress(self, url: str, filepath: Path):
        """Download file with progress bar."""
        def progress_hook(block_num, block_size, total_size):
            if total_size > 0:
                percent = (block_num * block_size * 100) / total_size
                downloaded = block_num * block_size / (1024 * 1024)  # MB
                total = total_size / (1024 * 1024)  # MB
                print(f"\r   Progress: {percent:.1f}% ({downloaded:.1f}/{total:.1f} MB)", end='')

        urllib.request.urlretrieve(url, filepath, reporthook=progress_hook)
        print()  # New line after progress

    def download_all(self, model_type: str = None, recommended_only: bool = True):
        """
        Download all models of a specific type.

        Args:
            model_type: Filter by type ('llm', 'stt', 'tts') or None for all
            recommended_only: Only download recommended models
        """
        to_download = []

        for key, info in MODELS.items():
            # Filter by type
            if model_type and info["type"] != model_type:
                continue

            # Filter by recommended
            if recommended_only and not info.get("recommended", False):
                continue

            to_download.append(key)

        if not to_download:
            print("No models to download")
            return

        print(f"\n🚀 Downloading {len(to_download)} model(s)...\n")

        success_count = 0
        for key in to_download:
            if self.download_model(key):
                success_count += 1

        print(f"\n✅ Successfully downloaded {success_count}/{len(to_download)} models")

    def list_models(self, installed_only: bool = False):
        """List available models."""
        print("\n📦 Available Models:\n")

        for model_type in ["llm", "stt", "tts"]:
            type_models = {k: v for k, v in MODELS.items() if v["type"] == model_type}

            if not type_models:
                continue

            type_name = {
                "llm": "Local LLM Models",
                "stt": "Speech-to-Text Models",
                "tts": "Text-to-Speech Voices"
            }[model_type]

            print(f"\n{type_name}:")
            print("-" * 80)

            for key, info in type_models.items():
                filepath = self.models_dir / info["filename"]
                installed = "✅ INSTALLED" if filepath.exists() else "❌ Not installed"
                recommended = "⭐ RECOMMENDED" if info.get("recommended") else ""

                if installed_only and not filepath.exists():
                    continue

                print(f"\n{key}")
                print(f"  Name: {info['name']}")
                print(f"  Size: {info['size']}")
                print(f"  Status: {installed} {recommended}")
                print(f"  Description: {info['description']}")

    def get_disk_usage(self):
        """Show disk usage of downloaded models."""
        total_size = 0
        model_count = 0

        print("\n💾 Disk Usage:\n")

        for key, info in MODELS.items():
            filepath = self.models_dir / info["filename"]
            if filepath.exists():
                size_bytes = filepath.stat().st_size
                size_mb = size_bytes / (1024 * 1024)
                total_size += size_bytes
                model_count += 1
                print(f"  {info['name']}: {size_mb:.1f} MB")

        total_gb = total_size / (1024 * 1024 * 1024)
        print(f"\n  Total: {total_gb:.2f} GB ({model_count} models)")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Download AI models for the EDU platform"
    )

    parser.add_argument(
        "action",
        nargs="?",
        default="list",
        help="Action: all, llm, stt, tts, <model-name>, list, usage"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download even if exists"
    )

    parser.add_argument(
        "--all-models",
        action="store_true",
        help="Download all models (not just recommended)"
    )

    parser.add_argument(
        "--models-dir",
        type=str,
        help="Custom models directory"
    )

    args = parser.parse_args()

    downloader = ModelDownloader(models_dir=args.models_dir)

    if args.action == "list":
        downloader.list_models()

    elif args.action == "usage":
        downloader.get_disk_usage()

    elif args.action == "all":
        downloader.download_all(recommended_only=not args.all_models)

    elif args.action in ["llm", "stt", "tts"]:
        downloader.download_all(model_type=args.action, recommended_only=not args.all_models)

    elif args.action in MODELS:
        downloader.download_model(args.action, force=args.force)

    else:
        print(f"Unknown action: {args.action}")
        print("Use 'list' to see available models")


if __name__ == "__main__":
    main()

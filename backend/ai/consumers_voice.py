"""
WebSocket Consumer for Real-Time Voice Interaction

Features:
- Streaming audio input/output
- Real-time STT (Speech-to-Text)
- Intent processing with hybrid AI
- Streaming TTS (Text-to-Speech)
- Conversation context management
- Automatic language detection
"""
import json
import logging
import time
import asyncio
from typing import Optional
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser
from .dialog_manager import get_dialog_manager

logger = logging.getLogger(__name__)


class VoiceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time voice interaction.

    Protocol:
    - Client sends audio chunks as binary data
    - Client sends commands as JSON: {"type": "command", "action": "..."}
    - Server sends transcripts: {"type": "transcript", "text": "...", "language": "uz"}
    - Server sends responses: {"type": "response", "text": "...", "intent": "..."}
    - Server sends audio as binary data
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conversation_id = None
        self.user = None
        self.language = None
        self.is_recording = False
        self.audio_buffer = bytearray()
        self.dialog_manager = get_dialog_manager()
        self.settings = {
            'auto_tts': True,
            'voice_feedback': True,
            'continuous_mode': False,
            'language': None  # Auto-detect
        }

    async def connect(self):
        """Handle WebSocket connection."""
        # Get user from scope
        self.user = self.scope.get('user')

        if isinstance(self.user, AnonymousUser):
            logger.warning("Anonymous user attempted to connect to voice chat")
            await self.close(code=4001)
            return

        # Accept connection
        await self.accept()

        # Generate conversation ID
        self.conversation_id = self.dialog_manager.create_conversation(self.user.id)

        logger.info(f"Voice WebSocket connected: user={self.user.id}, conversation={self.conversation_id}")

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'conversation_id': self.conversation_id,
            'user_id': self.user.id,
            'settings': self.settings
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        logger.info(f"Voice WebSocket disconnected: user={self.user.id if self.user else 'unknown'}, code={close_code}")

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming WebSocket messages.

        Args:
            text_data: JSON commands from client
            bytes_data: Audio data chunks from client
        """
        try:
            if bytes_data:
                # Audio chunk received
                await self.handle_audio_chunk(bytes_data)
            elif text_data:
                # Command received
                data = json.loads(text_data)
                await self.handle_command(data)
        except Exception as e:
            logger.exception("Error in receive handler")
            await self.send_error(str(e))

    async def handle_audio_chunk(self, audio_data: bytes):
        """
        Process incoming audio chunk.

        Args:
            audio_data: Raw audio bytes (WAV format)
        """
        # Add to buffer
        self.audio_buffer.extend(audio_data)

        # Check if we should process (e.g., silence detection or fixed interval)
        # For now, we'll process immediately when we get a complete chunk
        # In production, you'd want silence detection or VAD (Voice Activity Detection)

        if len(self.audio_buffer) > 16000 * 2:  # ~1 second of 16kHz audio
            await self.process_audio_buffer()

    async def process_audio_buffer(self):
        """Process accumulated audio buffer."""
        if not self.audio_buffer:
            return

        audio_bytes = bytes(self.audio_buffer)
        self.audio_buffer.clear()

        try:
            # Step 1: Speech-to-Text
            transcript_result = await self.transcribe_audio(audio_bytes)

            if not transcript_result or not transcript_result.get('text'):
                logger.debug("No speech detected in audio chunk")
                return

            transcript_text = transcript_result['text']
            detected_language = transcript_result.get('language', 'uz')

            # Update language if not set
            if not self.language:
                self.language = detected_language
            
            await sync_to_async(self.dialog_manager.add_to_history)(self.conversation_id, 'user', transcript_text)

            # Send transcript to client
            await self.send(text_data=json.dumps({
                'type': 'transcript',
                'text': transcript_text,
                'language': detected_language,
                'confidence': transcript_result.get('confidence', 0.0)
            }))

            # Step 2: Process with Hybrid AI
            ai_result = await self.process_with_ai(transcript_text)

            # Send AI response
            await self.send(text_data=json.dumps({
                'type': 'response',
                'text': ai_result['response'],
                'intent': ai_result.get('intent'),
                'confidence': ai_result.get('confidence', 0.0),
                'data': ai_result.get('data'),
                'metadata': ai_result.get('metadata', {})
            }))

            # Step 3: Text-to-Speech (if enabled)
            if self.settings['auto_tts']:
                audio_response = await self.synthesize_speech(
                    ai_result['response'],
                    language=detected_language
                )

                if audio_response:
                    # Send audio response
                    await self.send(bytes_data=audio_response)

        except Exception as e:
            logger.exception("Error processing audio buffer")
            await self.send_error(f"Failed to process audio: {str(e)}")

    async def handle_command(self, data: dict):
        """
        Handle JSON commands from client.

        Commands:
        - start_recording: Begin recording
        - stop_recording: Stop recording and process
        - set_language: Set language preference
        - toggle_tts: Enable/disable TTS
        - clear_conversation: Clear conversation history
        """
        command = data.get('type')

        if command == 'start_recording':
            self.is_recording = True
            self.audio_buffer.clear()
            await self.send(text_data=json.dumps({
                'type': 'recording_started'
            }))

        elif command == 'stop_recording':
            self.is_recording = False
            await self.process_audio_buffer()
            await self.send(text_data=json.dumps({
                'type': 'recording_stopped'
            }))

        elif command == 'set_language':
            self.language = data.get('language', 'uz')
            self.settings['language'] = self.language
            await self.send(text_data=json.dumps({
                'type': 'settings_updated',
                'settings': self.settings
            }))

        elif command == 'toggle_tts':
            self.settings['auto_tts'] = not self.settings['auto_tts']
            await self.send(text_data=json.dumps({
                'type': 'settings_updated',
                'settings': self.settings
            }))

        elif command == 'clear_conversation':
            # Clear conversation history
            await self.clear_conversation_history()
            await self.send(text_data=json.dumps({
                'type': 'conversation_cleared'
            }))

        elif command == 'process_text':
            # Text input (instead of voice)
            text = data.get('text', '')
            if text:
                await sync_to_async(self.dialog_manager.add_to_history)(self.conversation_id, 'user', text)
                ai_result = await self.process_with_ai(text)
                await self.send(text_data=json.dumps({
                    'type': 'response',
                    'text': ai_result['response'],
                    'intent': ai_result.get('intent'),
                    'confidence': ai_result.get('confidence', 0.0),
                    'data': ai_result.get('data')
                }))

        else:
            logger.warning(f"Unknown command: {command}")


    @sync_to_async
    def transcribe_audio(self, audio_bytes: bytes) -> Optional[dict]:
        """
        Transcribe audio using STT service.

        Args:
            audio_bytes: Raw audio data

        Returns:
            Dict with 'text', 'language', 'confidence'
        """
        try:
            from .services import transcribe_audio
            import tempfile
            import os

            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # Transcribe
                raw_text, duration = transcribe_audio(tmp_path)

                # Auto-detect language
                from .language_detector import detect_language
                language = detect_language(raw_text) if raw_text else 'uz'

                return {
                    'text': raw_text,
                    'language': language,
                    'duration': duration,
                    'confidence': 0.9  # Whisper doesn't provide confidence, assume high
                }
            finally:
                # Cleanup
                try:
                    os.remove(tmp_path)
                except:
                    pass

        except Exception as e:
            logger.exception("STT failed")
            return None

    @sync_to_async
    def process_with_ai(self, text: str) -> dict:
        """
        Process text with hybrid AI handler.

        Args:
            text: User message text

        Returns:
            Dict with 'response', 'intent', 'confidence', 'data'
        """
        try:
            from .hybrid_ai_handler import get_hybrid_handler

            handler = get_hybrid_handler()
            result = handler.process(
                text=text,
                user=self.user,
                conversation_id=self.conversation_id,
                user_context={
                    'language': self.language or 'uz',
                    'via': 'voice'
                }
            )

            return {
                'status': result.get('status', 'ok'),
                'response': result.get('response', ''),
                'intent': result.get('detected_intent'),
                'confidence': result.get('intent_confidence', 0.0),
                'data': result.get('data'),
                'metadata': result.get('metadata', {})
            }

        except Exception as e:
            logger.exception("AI processing failed")
            return {
                'status': 'error',
                'response': 'Kechirasiz, xatolik yuz berdi. / Sorry, an error occurred.',
                'error': str(e)
            }

    @sync_to_async
    def synthesize_speech(self, text: str, language: str = 'uz') -> Optional[bytes]:
        """
        Convert text to speech.

        Args:
            text: Text to synthesize
            language: Language code

        Returns:
            Audio bytes (WAV format) or None
        """
        try:
            from .services_tts import text_to_speech
            import os

            # Generate speech
            audio_path = text_to_speech(text, language=language)

            # Read audio file
            with open(audio_path, 'rb') as f:
                audio_bytes = f.read()

            # Cleanup
            try:
                os.remove(audio_path)
            except:
                pass

            return audio_bytes

        except Exception as e:
            logger.exception("TTS failed")
            return None

    @sync_to_async
    def clear_conversation_history(self):
        """Clear conversation history."""
        try:
            from .hybrid_ai_handler import get_hybrid_handler

            handler = get_hybrid_handler()
            handler.clear_conversation(self.conversation_id)

        except Exception as e:
            logger.exception("Failed to clear conversation")

    async def send_error(self, message: str):
        """Send error message to client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))


class TextChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for text-based chat with AI.
    Similar to VoiceConsumer but for text-only interaction.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conversation_id = None
        self.user = None
        self.language = None
        self.dialog_manager = get_dialog_manager()

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user')

        if isinstance(self.user, AnonymousUser):
            await self.close(code=4001)
            return

        await self.accept()

        self.conversation_id = self.dialog_manager.create_conversation(self.user.id)

        await self.send(text_data=json.dumps({
            'type': 'connected',
            'conversation_id': self.conversation_id
        }))

    async def disconnect(self, close_code):
        """Handle disconnection."""
        logger.info(f"Text chat disconnected: user={self.user.id if self.user else 'unknown'}")

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages."""
        if not text_data:
            return

        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'message':
                # User sent a message
                user_message = data.get('text', '')
                await sync_to_async(self.dialog_manager.add_to_history)(self.conversation_id, 'user', user_message)

                # Send typing indicator
                await self.send(text_data=json.dumps({
                    'type': 'typing',
                    'is_typing': True
                }))

                # Process with AI
                ai_result = await self.process_message(user_message)
                await sync_to_async(self.dialog_manager.add_to_history)(self.conversation_id, 'assistant', ai_result['response'])


                # Send response
                await self.send(text_data=json.dumps({
                    'type': 'message',
                    'role': 'assistant',
                    'text': ai_result['response'],
                    'intent': ai_result.get('intent'),
                    'confidence': ai_result.get('confidence', 0.0),
                    'data': ai_result.get('data'),
                    'suggestions': ai_result.get('suggestions', [])
                }))

                # Stop typing indicator
                await self.send(text_data=json.dumps({
                    'type': 'typing',
                    'is_typing': False
                }))

        except Exception as e:
            logger.exception("Error in text chat")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    @sync_to_async
    def process_message(self, text: str) -> dict:
        """Process message with AI."""
        try:
            from .hybrid_ai_handler import get_hybrid_handler

            # Auto-detect language
            if not self.language:
                from .language_detector import detect_language
                self.language = detect_language(text)

            handler = get_hybrid_handler()
            result = handler.process(
                text=text,
                user=self.user,
                conversation_id=self.conversation_id,
                user_context={'language': self.language}
            )

            # Generate smart suggestions
            suggestions = self._generate_suggestions(result)

            return {
                'response': result.get('response', ''),
                'intent': result.get('detected_intent'),
                'confidence': result.get('intent_confidence', 0.0),
                'data': result.get('data'),
                'suggestions': suggestions
            }

        except Exception as e:
            logger.exception("Message processing failed")
            return {
                'response': 'Kechirasiz, xatolik yuz berdi. / Sorry, an error occurred.',
                'error': str(e)
            }

    def _generate_suggestions(self, ai_result: dict) -> list:
        """Generate smart reply suggestions based on AI result."""
        suggestions = []
        intent = ai_result.get('detected_intent')

        # Intent-based suggestions
        if intent == 'student_schedule':
            suggestions = [
                'Show next week',
                'Show today only',
                'Export to calendar'
            ]
        elif intent == 'payment_check':
            suggestions = [
                'View payment history',
                'Make a payment',
                'Download invoice'
            ]
        elif intent == 'greeting':
            suggestions = [
                'What can you help with?',
                'Show my dashboard',
                'Check notifications'
            ]
        else:
            # Default suggestions
            suggestions = [
                'Tell me more',
                'Show details',
                'Go back'
            ]

        return suggestions[:3]  # Max 3 suggestions

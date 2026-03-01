"""
Enhanced WebSocket Consumer for realtime chat with:
- Message persistence
- Typing indicators
- User presence tracking
- Hybrid AI (Intent + LLM) integration
"""
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.core.cache import cache

from .models import Conversation, ChatMessage, UserPresence
from ai.hybrid_ai_handler import process_user_message
from ai.knowledge_base import KnowledgeRetrieval, KnowledgeCategory

logger = logging.getLogger(__name__)
User = get_user_model()


class EnhancedChatConsumer(AsyncWebsocketConsumer):
    """
    Enhanced WebSocket consumer with full chat features.

    Supported message types:
    - message: Send a chat message
    - typing_start: User started typing
    - typing_stop: User stopped typing
    - mark_read: Mark messages as read
    - get_history: Request message history
    """

    async def connect(self):
        """Handle new WebSocket connection."""
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user
        self.conversation_id = self.scope["url_route"]["kwargs"].get("conversation_id")

        # Create or get conversation
        if not self.conversation_id:
            self.conversation_id = str(uuid.uuid4())

        # Join conversation room
        self.room_group_name = f"chat_{self.conversation_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        # Update user presence
        await self.update_presence('online')

        await self.accept()
        await self.send_json({
            "type": "connected",
            "conversation_id": self.conversation_id,
            "message": "Connected to chat"
        })

        logger.info(f"User {user.id} connected to conversation {self.conversation_id}")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Update user presence
        await self.update_presence('offline')

        # Leave conversation room
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        logger.info(f"User {self.user.id} disconnected from conversation {self.conversation_id}")

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages."""
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_json({"type": "error", "message": "Invalid JSON"})
            return

        msg_type = data.get("type")

        # Route message to appropriate handler
        handlers = {
            "message": self.handle_message,
            "typing_start": self.handle_typing_start,
            "typing_stop": self.handle_typing_stop,
            "mark_read": self.handle_mark_read,
            "get_history": self.handle_get_history,
        }

        handler = handlers.get(msg_type)
        if handler:
            await handler(data)
        else:
            await self.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    async def handle_message(self, data: Dict):
        """Handle incoming chat message."""
        content = data.get("content", "").strip()
        if not content:
            await self.send_json({"type": "error", "message": "Empty message"})
            return

        message_type = data.get("message_type", "text")
        metadata = data.get("metadata", {})

        try:
            # Save user message
            user_message = await self.save_message(
                sender_type="user",
                content=content,
                message_type=message_type,
                metadata=metadata
            )

            # Broadcast user message to all participants
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": {
                        "message_id": str(user_message['message_id']),
                        "sender_type": "user",
                        "content": content,
                        "message_type": message_type,
                        "created_at": user_message['created_at'],
                        "status": "sent"
                    }
                }
            )

            # Process with AI (async to not block)
            ai_response = await self.process_with_ai(content)

            # Save AI response
            ai_message = await self.save_message(
                sender_type="ai",
                content=ai_response['response'],
                message_type="text",
                intent=ai_response.get('detected_intent'),
                confidence=ai_response.get('intent_confidence'),
                metadata=ai_response.get('metadata', {})
            )

            # Learn from this interaction (async)
            await self.learn_from_interaction(
                user_query=content,
                ai_response=ai_response['response'],
                intent=ai_response.get('detected_intent'),
                confidence=ai_response.get('intent_confidence', 0)
            )

            # Send AI response
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": {
                        "message_id": str(ai_message['message_id']),
                        "sender_type": "ai",
                        "content": ai_response['response'],
                        "intent": ai_response.get('detected_intent'),
                        "confidence": ai_response.get('intent_confidence'),
                        "created_at": ai_message['created_at'],
                        "status": "sent",
                        "metadata": ai_response.get('metadata')
                    }
                }
            )

        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            await self.send_json({
                "type": "error",
                "message": "Failed to process message",
                "error": str(e)
            })

    async def handle_typing_start(self, data: Dict):
        """Handle typing indicator start."""
        await self.update_typing_status(True)

        # Broadcast typing indicator
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_indicator",
                "user_id": self.user.id,
                "username": self.user.username,
                "is_typing": True
            }
        )

    async def handle_typing_stop(self, data: Dict):
        """Handle typing indicator stop."""
        await self.update_typing_status(False)

        # Broadcast typing stopped
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_indicator",
                "user_id": self.user.id,
                "username": self.user.username,
                "is_typing": False
            }
        )

    async def handle_mark_read(self, data: Dict):
        """Mark messages as read."""
        message_ids = data.get("message_ids", [])
        if not message_ids:
            return

        try:
            await self.mark_messages_read(message_ids)
            await self.send_json({
                "type": "read_receipt",
                "message_ids": message_ids,
                "read_at": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error marking messages read: {e}")

    async def handle_get_history(self, data: Dict):
        """Send conversation history."""
        limit = data.get("limit", 50)
        before_message_id = data.get("before")

        try:
            messages = await self.get_conversation_history(limit, before_message_id)
            await self.send_json({
                "type": "history",
                "messages": messages,
                "has_more": len(messages) >= limit
            })
        except Exception as e:
            logger.error(f"Error fetching history: {e}")
            await self.send_json({"type": "error", "message": "Failed to fetch history"})

    # Channel layer handlers
    async def chat_message(self, event):
        """Send chat message to WebSocket."""
        await self.send_json(event["message"])

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket."""
        # Don't send to the typing user themselves
        if event["user_id"] != self.user.id:
            await self.send_json({
                "type": "typing",
                "user_id": event["user_id"],
                "username": event["username"],
                "is_typing": event["is_typing"]
            })

    # Database operations
    @database_sync_to_async
    def save_message(
        self,
        sender_type: str,
        content: str,
        message_type: str = "text",
        intent: Optional[str] = None,
        confidence: Optional[float] = None,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Save message to database."""
        # Get or create conversation
        conversation, created = Conversation.objects.get_or_create(
            conversation_id=self.conversation_id,
            defaults={
                'user': self.user,
                'conversation_type': 'ai_chat',
                'title': content[:50] if created else None
            }
        )

        # Create message
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender_type=sender_type,
            sender=self.user if sender_type == 'user' else None,
            message_type=message_type,
            content=content,
            intent=intent,
            confidence=confidence,
            metadata=metadata or {}
        )

        return {
            'message_id': message.message_id,
            'created_at': message.created_at.isoformat()
        }

    @database_sync_to_async
    def process_with_ai(self, text: str) -> Dict[str, Any]:
        """Process message with hybrid AI handler."""
        return process_user_message(
            text=text,
            user=self.user,
            conversation_id=self.conversation_id
        )

    @database_sync_to_async
    def update_presence(self, status: str):
        """Update user presence status."""
        try:
            presence, _ = UserPresence.objects.get_or_create(user=self.user)
            presence.status = status
            presence.save()
        except Exception as e:
            logger.error(f"Error updating presence: {e}")

    @database_sync_to_async
    def update_typing_status(self, is_typing: bool):
        """Update typing status."""
        try:
            presence, _ = UserPresence.objects.get_or_create(user=self.user)
            presence.is_typing = is_typing
            if is_typing:
                conversation = Conversation.objects.get(conversation_id=self.conversation_id)
                presence.typing_in_conversation = conversation
            else:
                presence.typing_in_conversation = None
            presence.save()
        except Exception as e:
            logger.error(f"Error updating typing status: {e}")

    @database_sync_to_async
    def mark_messages_read(self, message_ids: list):
        """Mark messages as read."""
        ChatMessage.objects.filter(
            message_id__in=message_ids,
            conversation__conversation_id=self.conversation_id
        ).update(
            status='read',
            read_at=datetime.now()
        )

    @database_sync_to_async
    def learn_from_interaction(
        self,
        user_query: str,
        ai_response: str,
        intent: Optional[str],
        confidence: float
    ):
        """
        Learn from successful interaction - add to knowledge base.

        Args:
            user_query: User's question
            ai_response: AI's response
            intent: Detected intent
            confidence: Intent confidence
        """
        try:
            # Only learn from high-confidence interactions
            if confidence >= 0.7:
                # Determine category from intent
                category = self._get_category_from_intent(intent)

                # Auto-detect language from query
                from ai.language_detector import detect_language
                detected_lang = detect_language(user_query)

                # Use knowledge retrieval to learn
                kr = KnowledgeRetrieval(language=detected_lang)
                kr.learn_from_conversation(
                    conversation_id=self.conversation_id,
                    user_query=user_query,
                    llm_response=ai_response,
                    category=category,
                    was_helpful=True  # Assume helpful for high confidence
                )

                logger.info(f"Learned from interaction: {intent} (confidence: {confidence})")

        except Exception as e:
            logger.error(f"Failed to learn from interaction: {e}")

    def _get_category_from_intent(self, intent: Optional[str]) -> str:
        """Map intent to knowledge category."""
        if not intent:
            return KnowledgeCategory.GENERAL

        intent_lower = intent.lower()

        # CRM intents
        if any(keyword in intent_lower for keyword in ['lead', 'crm', 'add_lead', 'list_leads']):
            return KnowledgeCategory.CRM

        # LMS intents
        if any(keyword in intent_lower for keyword in ['course', 'enroll', 'schedule', 'attendance', 'score']):
            return KnowledgeCategory.LMS

        # Payment/ERP intents
        if any(keyword in intent_lower for keyword in ['payment', 'balance', 'invoice']):
            return KnowledgeCategory.ERP

        # FAQ
        if any(keyword in intent_lower for keyword in ['help', 'how', 'what', 'guide']):
            return KnowledgeCategory.FAQ

        return KnowledgeCategory.GENERAL

    @database_sync_to_async
    def get_conversation_history(self, limit: int, before_message_id: Optional[str]) -> list:
        """Get conversation message history."""
        queryset = ChatMessage.objects.filter(
            conversation__conversation_id=self.conversation_id
        ).order_by('-created_at')

        if before_message_id:
            try:
                before_message = ChatMessage.objects.get(message_id=before_message_id)
                queryset = queryset.filter(created_at__lt=before_message.created_at)
            except ChatMessage.DoesNotExist:
                pass

        messages = queryset[:limit]

        return [
            {
                'message_id': str(msg.message_id),
                'sender_type': msg.sender_type,
                'content': msg.content,
                'message_type': msg.message_type,
                'intent': msg.intent,
                'confidence': msg.confidence,
                'status': msg.status,
                'created_at': msg.created_at.isoformat(),
                'metadata': msg.metadata
            }
            for msg in reversed(messages)  # Reverse to get chronological order
        ]

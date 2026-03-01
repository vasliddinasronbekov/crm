# messaging/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings

class AIConsumer(AsyncWebsocketConsumer):
    """
    Handles:
    - voice_chunk (base64) -> forward to worker (Celery) for STT
    - stt_result -> forward to client
    - intent -> process action (attendance/payment) and respond with action_result
    """

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.tenant_id = self.scope["url_route"]["kwargs"]["tenant_id"]
        self.room_group_name = f"ai_room_{self.tenant_id}_{user.id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "message": "connected"})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """
        Expected JSON messages:
        { "type":"voice_chunk", "chunk_id":"uuid", "data":"base64", "seq":1 }
        { "type":"stt_result", "text":"...", "final": True/False }
        { "type":"intent", "name":"mark_absent", "entities": {"names":["Ali"]} }
        """
        if text_data:
            try:
                data = json.loads(text_data)
            except Exception:
                await self.send_json({"type":"error","message":"invalid json"})
                return

            msg_type = data.get("type")
            if msg_type == "voice_chunk":
                # forward to worker via channel layer or HTTP endpoint
                # store metadata + send to Celery via channel layer
                await self.channel_layer.send(
                    "stt_router",  # consumer/worker listening entrypoint
                    {"type": "process.voice_chunk", "payload": data, "room": self.room_group_name}
                )
                await self.send_json({"type":"ack","chunk_id":data.get("chunk_id")})
            elif msg_type == "stt_result":
                # client can also push stt results (if STT client-side)
                await self.channel_layer.group_send(
                    self.room_group_name, {"type":"broadcast.message","message":data}
                )
            elif msg_type == "intent":
                # process intent (call business logic via DB)
                result = await self.handle_intent(data)
                await self.send_json({"type":"action_result","status":"ok","result": result})
            else:
                await self.send_json({"type":"error","message":"unknown message type"})

    async def broadcast_message(self, event):
        await self.send_json(event["message"])

    @database_sync_to_async
    def handle_intent(self, intent_payload):
        """
        Synchronous DB operations:
        - validate entity names against enrollments
        - create attendance records
        - return applied ids
        """
        # TODO: implement actual business logic here.
        # placeholder response:
        return {"applied": [], "note": "intent handling not yet implemented"}


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat functionality

    Features:
    - Real-time message delivery
    - Typing indicators
    - Read receipts
    - Connection status
    """

    async def connect(self):
        """Handle WebSocket connection"""
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']

        # Verify user has access to this conversation
        has_access = await self.verify_conversation_access()

        if not has_access:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Notify others that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'status': 'online'
            }
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Notify others that user left
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'status': 'offline'
            }
        )

        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """Receive message from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing_start':
                await self.handle_typing_start()
            elif message_type == 'typing_stop':
                await self.handle_typing_stop()
            elif message_type == 'mark_read':
                await self.handle_mark_read(data)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON'
            }))

    async def handle_chat_message(self, data):
        """Handle incoming chat message"""
        content = data.get('content', '').strip()

        if not content:
            return

        # Save message to database
        message = await self.save_message(content)

        # Broadcast message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': message.id,
                    'content': message.content,
                    'sender': {
                        'id': self.user.id,
                        'first_name': self.user.first_name,
                        'last_name': self.user.last_name,
                    },
                    'created_at': message.created_at.isoformat(),
                    'is_read': False,
                }
            }
        )

    async def handle_typing_start(self):
        """Handle typing indicator start"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'user_name': f"{self.user.first_name} {self.user.last_name}",
                'is_typing': True,
            }
        )

    async def handle_typing_stop(self):
        """Handle typing indicator stop"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'user_name': f"{self.user.first_name} {self.user.last_name}",
                'is_typing': False,
            }
        )

    async def handle_mark_read(self, data):
        """Handle marking messages as read"""
        message_ids = data.get('message_ids', [])
        await self.mark_messages_read(message_ids)

        # Notify sender that messages were read
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_receipt',
                'message_ids': message_ids,
                'reader_id': self.user.id,
            }
        )

    # Event handlers (receive from channel layer)

    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        # Don't send typing indicator to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'user_name': event['user_name'],
                'is_typing': event['is_typing'],
            }))

    async def user_status(self, event):
        """Send user status to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'status',
            'user_id': event['user_id'],
            'status': event['status'],
        }))

    async def read_receipt(self, event):
        """Send read receipt to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'read',
            'message_ids': event['message_ids'],
            'reader_id': event['reader_id'],
        }))

    # Database operations

    @database_sync_to_async
    def verify_conversation_access(self):
        """Verify user has access to conversation"""
        from .models import Conversation
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            return conversation.participants.filter(id=self.user.id).exists()
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content):
        """Save message to database"""
        from .models import Conversation, ChatMessage
        conversation = Conversation.objects.get(id=self.conversation_id)
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content
        )
        return message

    @database_sync_to_async
    def mark_messages_read(self, message_ids):
        """Mark messages as read"""
        from .models import ChatMessage
        ChatMessage.objects.filter(
            id__in=message_ids,
            conversation_id=self.conversation_id
        ).exclude(
            sender=self.user
        ).update(is_read=True)

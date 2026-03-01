"""
Dialog state management using Redis.
Tracks conversation context and confirmations.
"""

from django.core.cache import cache
from typing import Dict, List, Optional, Any
import uuid
import json
import logging

logger = logging.getLogger(__name__)


class DialogState:
    """Represents a dialog state."""

    STATE_IDLE = 'idle'
    STATE_LISTENING = 'listening'
    STATE_PROCESSING = 'processing'
    STATE_AWAITING_CONFIRMATION = 'awaiting_confirmation'
    STATE_SPEAKING = 'speaking'

    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.state = self.STATE_IDLE
        self.context = {}
        self.pending_action = None
        self.history = []

    def to_dict(self) -> Dict:
        return {
            'conversation_id': self.conversation_id,
            'state': self.state,
            'context': self.context,
            'pending_action': self.pending_action,
            'history': self.history,
        }

    @classmethod
    def from_dict(cls, data: Dict):
        state = cls(data['conversation_id'])
        state.state = data.get('state', cls.STATE_IDLE)
        state.context = data.get('context', {})
        state.pending_action = data.get('pending_action')
        state.history = data.get('history', [])
        return state


class DialogManager:
    """Manages dialog states with Redis."""

    def __init__(self, ttl: int = 3600):
        self.ttl = ttl  # 1 hour default

    def _key(self, conversation_id: str) -> str:
        return f"dialog:{conversation_id}"

    def get_state(self, conversation_id: str) -> DialogState:
        """Get or create dialog state."""
        key = self._key(conversation_id)
        data = cache.get(key)

        if data:
            return DialogState.from_dict(json.loads(data))

        return DialogState(conversation_id)

    def save_state(self, state: DialogState):
        """Save dialog state to Redis."""
        key = self._key(state.conversation_id)
        data = json.dumps(state.to_dict())
        cache.set(key, data, self.ttl)

    def update_context(self, conversation_id: str, **kwargs):
        """Update context variables."""
        state = self.get_state(conversation_id)
        state.context.update(kwargs)
        self.save_state(state)

    def set_pending_action(self, conversation_id: str, action: Dict):
        """
        Set pending action awaiting confirmation.

        action = {
            'type': 'add_student_to_group',
            'params': {'student_id': 123, 'group_id': 456},
            'message': 'Add Akmal to Group A1-Morning?',
        }
        """
        state = self.get_state(conversation_id)
        state.pending_action = action
        state.state = DialogState.STATE_AWAITING_CONFIRMATION
        self.save_state(state)

    def get_pending_action(self, conversation_id: str) -> Optional[Dict]:
        """Get pending action."""
        state = self.get_state(conversation_id)
        return state.pending_action

    def confirm_action(self, conversation_id: str) -> Optional[Dict]:
        """Confirm and return pending action."""
        state = self.get_state(conversation_id)
        action = state.pending_action

        if action:
            state.pending_action = None
            state.state = DialogState.STATE_IDLE
            self.save_state(state)

        return action

    def cancel_action(self, conversation_id: str):
        """Cancel pending action."""
        state = self.get_state(conversation_id)
        state.pending_action = None
        state.state = DialogState.STATE_IDLE
        self.save_state(state)

    def add_to_history(self, conversation_id: str, role: str, content: str):
        """Add message to conversation history."""
        state = self.get_state(conversation_id)
        state.history.append({
            'role': role,  # 'user' or 'assistant'
            'content': content,
        })

        # Keep last 10 messages
        if len(state.history) > 10:
            state.history = state.history[-10:]

        self.save_state(state)

    def get_history(self, conversation_id: str) -> List[Dict]:
        """Get conversation history."""
        state = self.get_state(conversation_id)
        return state.history

    def clear(self, conversation_id: str):
        """Clear dialog state."""
        key = self._key(conversation_id)
        cache.delete(key)

    def create_conversation(self, user_id: int) -> str:
        """Create new conversation ID."""
        conversation_id = f"user_{user_id}_{uuid.uuid4().hex[:8]}"
        state = DialogState(conversation_id)
        self.save_state(state)
        return conversation_id


# Singleton
_manager = None

def get_dialog_manager() -> DialogManager:
    global _manager
    if _manager is None:
        _manager = DialogManager()
    return _manager

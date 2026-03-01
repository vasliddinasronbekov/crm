"""
Unified AI service combining all components.
Single entry point for voice/text commands.
"""

from typing import Dict, Optional
from .hybrid_search import HybridSearchEngine
from .ner_service import get_entity_extractor
from .dialog_manager import get_dialog_manager
from .language_detector import detect_language
from .services import extract_intent
from .intent_fulfillment import fulfill_intent
import logging

logger = logging.getLogger(__name__)


class UnifiedAIService:
    """
    Unified AI service: STT → Search/Intent → NER → Action → TTS
    """

    def __init__(self):
        self.search_engine = None
        self.entity_extractor = get_entity_extractor()
        self.dialog_manager = get_dialog_manager()

    def process_command(
        self,
        text: str,
        user,
        conversation_id: Optional[str] = None,
        audio_file=None
    ) -> Dict:
        """
        Process voice/text command end-to-end.

        Args:
            text: User input text (or from STT)
            user: Current user
            conversation_id: Conversation ID for context
            audio_file: Optional audio file for STT

        Returns:
            {
                'status': 'ok',
                'response': 'Your balance is 500,000 UZS',
                'action_type': 'data_retrieval',
                'data': {...},
                'tts_text': 'Your balance is 500 thousand sum',
                'conversation_id': 'user_123_abc',
                'metadata': {...}
            }
        """
        try:
            # 1. Create/get conversation
            if not conversation_id:
                conversation_id = self.dialog_manager.create_conversation(user.id)

            # Add to history
            self.dialog_manager.add_to_history(conversation_id, 'user', text)

            # 2. Detect language
            language = detect_language(text) or 'en'

            # 3. Check for pending confirmation
            pending = self.dialog_manager.get_pending_action(conversation_id)
            if pending:
                return self._handle_confirmation(text, pending, conversation_id, user)

            # 4. Extract entities
            entities = self.entity_extractor.extract_entities(text)

            # 5. Try intent classification first
            intent_result = extract_intent(text)

            if intent_result.get('confidence', 0) > 0.5:
                # High confidence intent - execute directly
                response = self._execute_intent(intent_result, entities, user, conversation_id)

            else:
                # Low confidence - try hybrid search
                search_engine = HybridSearchEngine(user=user)
                search_results = search_engine.search(text, limit=5)

                if search_results:
                    response = self._format_search_results(search_results, language)
                else:
                    # Fallback to general response
                    response = {
                        'status': 'ok',
                        'response': 'I could not understand your request. Please try again.',
                        'action_type': 'unknown',
                        'data': {},
                    }

            # Add conversation ID and language
            response['conversation_id'] = conversation_id
            response['language'] = language

            # Add to history
            self.dialog_manager.add_to_history(
                conversation_id,
                'assistant',
                response.get('response', '')
            )

            return response

        except Exception as e:
            logger.exception(f"Error processing command: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'conversation_id': conversation_id,
            }

    def _execute_intent(self, intent_result: Dict, entities: Dict, user, conversation_id: str) -> Dict:
        """Execute intent with entity parameters."""
        intent = intent_result.get('intent')

        # Navigation intents
        if intent == 'NAVIGATE':
            target = entities.get('target', '/dashboard')
            return {
                'status': 'ok',
                'action_type': 'navigate',
                'target': target,
                'response': f'Navigating to {target}',
            }
        
        if intent == 'navigate_dashboard':
            return {
                'status': 'ok',
                'action_type': 'navigate',
                'target': '/dashboard',
                'response': 'Opening dashboard',
            }

        elif intent == 'navigate_students':
            return {
                'status': 'ok',
                'action_type': 'navigate',
                'target': '/dashboard/students',
                'response': 'Opening students page',
            }

        elif intent == 'navigate_schedule':
            return {
                'status': 'ok',
                'action_type': 'navigate',
                'target': '/dashboard/schedule',
                'response': 'Opening schedule',
            }

        # Data retrieval intents
        elif intent == 'get_student_balance':
            return self._get_student_balance(entities, user)

        elif intent == 'get_room_capacity':
            return self._get_room_capacity(entities)

        elif intent == 'get_student_info':
            return self._get_student_info(entities)

        # Action intents (require confirmation)
        elif intent == 'add_student_to_group':
            return self._prepare_add_student(entities, conversation_id)

        else:
            # Try fulfillment service
            return fulfill_intent(intent, entities, user)

    def _get_student_balance(self, entities: Dict, user) -> Dict:
        """Get student balance."""
        from student_profile.models import StudentBalance

        persons = entities.get('person_names', [])
        if not persons:
            return {'status': 'error', 'response': 'Which student?'}

        student_id = persons[0]['user_id']
        try:
            balance = StudentBalance.objects.get(student_id=student_id)
            amount = balance.balance / 100  # Convert from tiyin

            return {
                'status': 'ok',
                'action_type': 'data_retrieval',
                'response': f"Balance for {persons[0]['full_name']}: {amount:,.0f} UZS",
                'data': {
                    'student_id': student_id,
                    'balance': amount,
                },
            }
        except StudentBalance.DoesNotExist:
            return {
                'status': 'ok',
                'response': f"No balance record for {persons[0]['full_name']}",
                'data': {},
            }

    def _get_room_capacity(self, entities: Dict) -> Dict:
        """Get room available capacity."""
        from student_profile.models import Room, Group

        room_num = entities.get('room_number')
        if not room_num:
            return {'status': 'error', 'response': 'Which room?'}

        try:
            room = Room.objects.get(name__icontains=room_num)
            groups = Group.objects.filter(room=room)
            total_students = sum(g.students.count() for g in groups)
            available = room.capacity - total_students

            return {
                'status': 'ok',
                'action_type': 'data_retrieval',
                'response': f"Room {room.name}: {available} seats available (capacity {room.capacity})",
                'data': {
                    'room_id': room.id,
                    'capacity': room.capacity,
                    'occupied': total_students,
                    'available': available,
                },
            }
        except Room.DoesNotExist:
            return {'status': 'error', 'response': f"Room {room_num} not found"}

    def _get_student_info(self, entities: Dict) -> Dict:
        """Get student information."""
        persons = entities.get('person_names', [])
        if not persons:
            return {'status': 'error', 'response': 'Which student?'}

        from users.models import User
        try:
            student = User.objects.get(id=persons[0]['user_id'])
            groups = student.student_groups.all()

            return {
                'status': 'ok',
                'action_type': 'data_retrieval',
                'response': f"{student.first_name} {student.last_name} is in {groups.count()} groups",
                'data': {
                    'student_id': student.id,
                    'groups': [g.name for g in groups],
                },
            }
        except User.DoesNotExist:
            return {'status': 'error', 'response': 'Student not found'}

    def _prepare_add_student(self, entities: Dict, conversation_id: str) -> Dict:
        """Prepare add student action (requires confirmation)."""
        persons = entities.get('person_names', [])
        group = entities.get('group_name')

        if not persons or not group:
            return {'status': 'error', 'response': 'I need student name and group name'}

        # Set pending action
        action = {
            'type': 'add_student_to_group',
            'params': {
                'student_id': persons[0]['user_id'],
                'group_name': group,
            },
            'message': f"Add {persons[0]['full_name']} to group {group}?",
        }

        self.dialog_manager.set_pending_action(conversation_id, action)

        return {
            'status': 'ok',
            'action_type': 'confirmation_required',
            'response': action['message'],
            'data': action,
        }

    def _handle_confirmation(self, text: str, pending: Dict, conversation_id: str, user) -> Dict:
        """Handle yes/no confirmation."""
        text_lower = text.lower()

        # Check for yes/no in multiple languages
        yes_words = ['yes', 'ha', 'да', 'ok', 'confirm']
        no_words = ['no', "yo'q", 'нет', 'cancel', 'bekor']

        if any(word in text_lower for word in yes_words):
            # Execute action
            self.dialog_manager.confirm_action(conversation_id)
            return self._execute_pending_action(pending, user)

        elif any(word in text_lower for word in no_words):
            # Cancel action
            self.dialog_manager.cancel_action(conversation_id)
            return {
                'status': 'ok',
                'response': 'Action cancelled',
                'action_type': 'cancelled',
            }

        else:
            return {
                'status': 'ok',
                'response': f"{pending['message']} (Yes/No)",
                'action_type': 'confirmation_required',
            }

    def _execute_pending_action(self, action: Dict, user) -> Dict:
        """Execute confirmed action."""
        action_type = action['type']
        params = action['params']

        if action_type == 'add_student_to_group':
            from student_profile.models import Group
            from users.models import User

            try:
                student = User.objects.get(id=params['student_id'])
                group = Group.objects.get(name__icontains=params['group_name'])
                group.students.add(student)

                return {
                    'status': 'ok',
                    'response': f"Added {student.first_name} to {group.name}",
                    'action_type': 'action_completed',
                }
            except Exception as e:
                return {'status': 'error', 'response': str(e)}

        return {'status': 'error', 'response': 'Unknown action'}

    def _format_search_results(self, results: list, language: str) -> Dict:
        """Format search results for response."""
        if not results:
            return {'status': 'ok', 'response': 'No results found', 'data': {}}

        top = results[0]
        response_text = f"Found: {top['title']}\n{top['content']}"

        return {
            'status': 'ok',
            'action_type': 'search_result',
            'response': response_text,
            'data': {
                'results': results,
                'top_result': top,
            },
        }


# Singleton
_service = None

def get_unified_ai() -> UnifiedAIService:
    global _service
    if _service is None:
        _service = UnifiedAIService()
    return _service

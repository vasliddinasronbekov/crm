"""
Celery tasks for exam draft AI review and generation
"""

from celery import shared_task
from django.utils import timezone
import json


@shared_task
def review_exam_with_ai(exam_draft_id):
    """
    AI reviews an exam draft and provides suggestions
    """
    from .exam_draft_models import IELTSExamDraft, ExamDraftStatus
    from ai.llm_service import LLMService

    try:
        exam_draft = IELTSExamDraft.objects.get(id=exam_draft_id)
        llm = LLMService()

        # Collect all questions from draft
        questions = exam_draft.draft_questions.all().order_by('order')
        questions_data = []

        for q in questions:
            questions_data.append({
                'order': q.order,
                'type': q.question_type,
                'question': q.question_text,
                'passage': q.passage_text[:500] if q.passage_text else '',  # First 500 chars
                'options': q.options,
                'correct_answer': q.correct_answer,
                'points': str(q.points)
            })

        # Create comprehensive review prompt
        prompt = f"""
You are an IELTS exam quality reviewer. Analyze this {exam_draft.get_section_display()} exam draft and provide detailed feedback.

Exam Details:
- Title: {exam_draft.title}
- Section: {exam_draft.get_section_display()}
- Number of Questions: {len(questions_data)}
- Time Limit: {exam_draft.time_limit_minutes} minutes
- Created by: {exam_draft.created_by.get_full_name()}

Questions:
{json.dumps(questions_data, indent=2)}

Please evaluate the exam based on:
1. **Alignment with IELTS Format**: Does it follow official IELTS structure and question types?
2. **Question Quality**: Are questions clear, unambiguous, and appropriate difficulty?
3. **Content Authenticity**: Is the content similar to real IELTS materials?
4. **Balance**: Is there good variety in question types and difficulty levels?
5. **Answer Keys**: Are correct answers accurate and well-justified?
6. **Time Appropriateness**: Is the number of questions appropriate for the time limit?

Provide your evaluation in JSON format:
{{
    "quality_score": 85,  // Overall score 0-100
    "alignment_score": 90,  // IELTS format alignment
    "content_quality": 80,  // Question quality
    "difficulty_balance": 85,  // Difficulty distribution
    "overall_assessment": "This is a well-structured exam...",
    "strengths": [
        "Good variety of question types",
        "Clear and unambiguous questions"
    ],
    "improvements": [
        "Question 5 could be more challenging",
        "Consider adding more passage-based questions"
    ],
    "question_feedback": [
        {{
            "question_number": 1,
            "feedback": "Well-crafted question...",
            "suggestion": "Consider making option C less obviously incorrect"
        }}
    ],
    "recommendations": "Overall excellent exam. Minor improvements suggested above."
}}
"""

        # Get AI evaluation
        try:
            response = llm.generate_response(prompt)
            ai_suggestions = json.loads(response)
        except:
            # Fallback if JSON parsing fails
            ai_suggestions = {
                'quality_score': 75,
                'overall_assessment': response[:500] if len(response) > 500 else response,
                'strengths': ['Exam structure follows IELTS format'],
                'improvements': ['AI could not provide detailed analysis'],
                'recommendations': 'Please review the exam manually'
            }

        # Update exam draft with AI feedback
        exam_draft.ai_suggestions = ai_suggestions
        exam_draft.ai_quality_score = ai_suggestions.get('quality_score', 75)
        exam_draft.ai_reviewed_at = timezone.now()
        exam_draft.status = ExamDraftStatus.AI_REVIEWED
        exam_draft.save()

        # Update individual question feedback
        question_feedback = ai_suggestions.get('question_feedback', [])
        for feedback in question_feedback:
            q_number = feedback.get('question_number')
            if q_number and q_number <= len(questions):
                question = questions[q_number - 1]
                question.ai_feedback = {
                    'feedback': feedback.get('feedback', ''),
                    'suggestion': feedback.get('suggestion', '')
                }
                question.save()

        # Create notification
        from .notification_models import Notification
        Notification.create_ai_review_complete(exam_draft)

        return {
            'success': True,
            'quality_score': exam_draft.ai_quality_score,
            'exam_draft_id': exam_draft.id
        }

    except Exception as e:
        # Mark as failed and save error
        if 'exam_draft' in locals():
            exam_draft.status = ExamDraftStatus.DRAFT
            exam_draft.ai_suggestions = {'error': str(e)}
            exam_draft.save()

        return {'success': False, 'error': str(e)}


@shared_task
def generate_exam_with_ai(request_id):
    """
    Generate a complete IELTS exam using AI
    """
    from .exam_draft_models import AIExamGenerationRequest, IELTSExamDraft, IELTSQuestionDraft
    from ai.llm_service import LLMService

    try:
        request_obj = AIExamGenerationRequest.objects.get(id=request_id)
        request_obj.status = 'generating'
        request_obj.save()

        llm = LLMService()

        # Define question counts and types per section
        section_configs = {
            'reading': {
                'time_limit': 60,
                'question_count': 40,
                'question_types': [
                    'multiple_choice', 'true_false_notgiven', 'matching_headings',
                    'sentence_completion', 'summary_completion'
                ]
            },
            'listening': {
                'time_limit': 30,
                'question_count': 40,
                'question_types': [
                    'multiple_choice', 'form_completion', 'note_completion',
                    'table_completion', 'diagram_labeling'
                ]
            },
            'writing': {
                'time_limit': 60,
                'question_count': 2,
                'question_types': ['task1_academic', 'task2_essay']
            },
            'speaking': {
                'time_limit': 14,
                'question_count': 12,  # 4-5 Part 1, 1 Part 2, 4-5 Part 3
                'question_types': ['introduction', 'long_turn', 'discussion']
            }
        }

        config = section_configs.get(request_obj.section)
        if not config:
            raise ValueError(f"Invalid section: {request_obj.section}")

        # Generate exam with AI
        prompt = f"""
Generate a complete IELTS {request_obj.section.upper()} exam in JSON format.

Requirements:
- Section: {request_obj.section.upper()}
- Number of questions: {config['question_count']}
- Time limit: {config['time_limit']} minutes
- Difficulty: {request_obj.difficulty_level}
- Topic focus: {request_obj.topic or 'General IELTS topics'}
- Custom instructions: {request_obj.custom_instructions or 'None'}

Generate realistic IELTS questions following official format. Include:
- Authentic passages/scenarios
- Varied question types
- Clear correct answers
- Appropriate difficulty progression

Return JSON format:
{{
    "title": "IELTS {request_obj.section.title()} Practice Test",
    "description": "AI-generated {request_obj.section} exam...",
    "instructions": "Read carefully and answer all questions...",
    "questions": [
        {{
            "order": 1,
            "question_type": "multiple_choice",
            "passage_text": "Full passage text here...",
            "question_text": "What is the main idea?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": {{"answer": "Option B", "explanation": "Because..."}},
            "points": 1.0,
            "speaking_prompts": []  // Only for speaking questions
        }}
    ]
}}
"""

        response = llm.generate_response(prompt)
        exam_data = json.loads(response)

        # Create exam draft
        exam_draft = IELTSExamDraft.objects.create(
            created_by=request_obj.requested_by,
            section=request_obj.section,
            title=exam_data.get('title', f'AI Generated {request_obj.section.title()} Exam'),
            description=exam_data.get('description', ''),
            coin_cost=50,
            coin_refund=10,
            time_limit_minutes=config['time_limit'],
            passing_band_score=5.0,
            instructions=exam_data.get('instructions', ''),
            status='draft',
            is_ai_generated=True
        )

        # Create questions
        for q_data in exam_data.get('questions', []):
            IELTSQuestionDraft.objects.create(
                exam_draft=exam_draft,
                question_type=q_data.get('question_type'),
                order=q_data.get('order'),
                passage_text=q_data.get('passage_text', ''),
                question_text=q_data.get('question_text'),
                options=q_data.get('options', []),
                correct_answer=q_data.get('correct_answer', {}),
                points=q_data.get('points', 1.0),
                speaking_prompts=q_data.get('speaking_prompts', [])
            )

        # Update request
        request_obj.status = 'completed'
        request_obj.generated_draft = exam_draft
        request_obj.completed_at = timezone.now()
        request_obj.save()

        # Notify user
        from .notification_models import Notification
        Notification.objects.create(
            recipient=request_obj.requested_by,
            notification_type='general',
            title='AI Exam Generation Complete',
            message=f'Your AI-generated {request_obj.section} exam is ready for review.',
            exam_draft=exam_draft,
            action_url=f'/exams/drafts/{exam_draft.id}',
            action_label='View Generated Exam'
        )

        return {
            'success': True,
            'exam_draft_id': exam_draft.id,
            'question_count': exam_draft.draft_questions.count()
        }

    except Exception as e:
        request_obj.status = 'failed'
        request_obj.error_message = str(e)
        request_obj.save()

        return {'success': False, 'error': str(e)}

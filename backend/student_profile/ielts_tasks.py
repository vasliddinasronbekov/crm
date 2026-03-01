"""
Celery tasks for IELTS AI evaluation
"""

from celery import shared_task
from django.utils import timezone
from decimal import Decimal
import json

from .ai_json import parse_llm_json


def _score_value(value, default=5.0):
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return default


def _ensure_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        normalized = value.replace("\r", "\n")
        parts = [part.strip("- ").strip() for part in normalized.split("\n") if part.strip()]
        return parts
    return []


def _join_list(value):
    items = _ensure_list(value)
    return "\n".join(items) if items else str(value or "")


def _build_rubric_cards(section, evaluation):
    criteria = evaluation.get('criteria') or {}
    if section == 'writing':
        defaults = [
            ('task_achievement', 'Task Achievement'),
            ('coherence_cohesion', 'Coherence & Cohesion'),
            ('lexical_resource', 'Lexical Resource'),
            ('grammatical_accuracy', 'Grammar Accuracy'),
        ]
    else:
        defaults = [
            ('fluency_coherence', 'Fluency & Coherence'),
            ('lexical_resource', 'Lexical Resource'),
            ('grammatical_accuracy', 'Grammar Accuracy'),
            ('pronunciation', 'Pronunciation'),
        ]

    cards = []
    for key, label in defaults:
        entry = criteria.get(key, {})
        cards.append({
            'key': key,
            'label': label,
            'score': _score_value(entry.get('score')),
            'summary': entry.get('summary', ''),
        })
    return cards


def _normalize_evaluation(section, evaluation):
    normalized = {
        **evaluation,
        'overall_band_score': _score_value(evaluation.get('overall_band_score')),
        'overall_feedback': evaluation.get('overall_feedback') or evaluation.get('overall_assessment', ''),
        'strengths_list': _ensure_list(evaluation.get('overall_strengths') or evaluation.get('strengths')),
        'weaknesses_list': _ensure_list(evaluation.get('overall_weaknesses') or evaluation.get('weaknesses')),
        'recommendations_list': _ensure_list(evaluation.get('recommendations')),
    }
    normalized['rubric_cards'] = evaluation.get('rubric_cards') or _build_rubric_cards(section, normalized)
    return normalized


@shared_task
def evaluate_ielts_attempt(attempt_id):
    """
    AI Evaluation for IELTS Writing and Speaking sections
    """
    from .ielts_models import IELTSAttempt, IELTSSection
    from ai.llm_service import LLMService

    try:
        attempt = IELTSAttempt.objects.get(id=attempt_id)

        if attempt.exam.section == IELTSSection.WRITING:
            result = evaluate_writing(attempt)
        elif attempt.exam.section == IELTSSection.SPEAKING:
            result = evaluate_speaking(attempt)
        else:
            return {'error': 'Invalid section for AI evaluation'}

        # Update attempt with results
        attempt.raw_score = Decimal(str(result['raw_score']))
        attempt.band_score = Decimal(str(result['band_score']))
        attempt.ai_evaluation = result['evaluation']
        attempt.strengths = result['strengths']
        attempt.weaknesses = result['weaknesses']
        attempt.recommendations = result['recommendations']
        attempt.ai_evaluated_at = timezone.now()
        attempt.status = 'completed'
        attempt.completed_at = timezone.now()
        attempt.save()

        # Auto-refund if eligible
        if attempt.band_score >= attempt.exam.passing_band_score:
            attempt.refund_coins()

        return result

    except Exception as e:
        return {'error': str(e)}


def evaluate_writing(attempt):
    """
    Evaluate IELTS Writing section using AI
    """
    from ai.llm_service import LLMService

    llm = LLMService()

    # Collect all essays
    answers = attempt.answers.all()
    essays = []

    for answer in answers:
        if answer.essay_content:
            essays.append({
                'question': answer.question.question_text,
                'essay': answer.essay_content,
                'word_count': answer.word_count
            })

    # Create evaluation prompt
    prompt = f"""
You are an IELTS Writing examiner. Evaluate the following IELTS Writing responses according to IELTS band descriptors.

Evaluate based on:
1. Task Achievement/Response (25%)
2. Coherence and Cohesion (25%)
3. Lexical Resource (25%)
4. Grammatical Range and Accuracy (25%)

For each essay, provide:
- Band score (0.0 - 9.0)
- Detailed feedback for each criterion
- Overall strengths
- Areas for improvement
- Specific recommendations

Essays to evaluate:
{json.dumps(essays, indent=2)}

Provide your evaluation in JSON format with the following structure:
{{
    "essays": [
        {{
            "band_score": 7.0,
            "task_achievement": 7.0,
            "coherence_cohesion": 7.5,
            "lexical_resource": 7.0,
            "grammatical_accuracy": 6.5,
            "feedback": "...",
            "strengths": [...],
            "weaknesses": [...]
        }}
    ],
    "overall_band_score": 7.0,
    "overall_strengths": "...",
    "overall_weaknesses": "...",
    "recommendations": "..."
}}
"""

    try:
        # Get AI evaluation
        response = llm.generate_response(prompt)

        # Parse response (assuming JSON format)
        evaluation = parse_llm_json(response, {
            'overall_band_score': 5.0,
            'overall_feedback': 'Evaluation is still being prepared.',
            'overall_strengths': ['Your response was submitted successfully.'],
            'overall_weaknesses': ['Detailed automated evaluation was not available.'],
            'recommendations': ['Review the prompt and compare your answer with a model response.'],
        })
        evaluation = _normalize_evaluation('writing', evaluation)

        # Calculate scores
        band_score = _score_value(evaluation.get('overall_band_score', 5.0))
        raw_score = band_score * 10  # Convert to points

        # Update individual answer scores
        essay_evaluations = evaluation.get('essays', [])
        for i, answer in enumerate(answers):
            if i < len(essay_evaluations):
                essay_eval = essay_evaluations[i]
                answer.ai_score = essay_eval
                answer.points_earned = Decimal(str(essay_eval.get('band_score', 5.0)))
                answer.ai_feedback = essay_eval.get('feedback', '')
                answer.save()

        return {
            'raw_score': raw_score,
            'band_score': band_score,
            'evaluation': evaluation,
            'strengths': _join_list(evaluation.get('strengths_list', [])),
            'weaknesses': _join_list(evaluation.get('weaknesses_list', [])),
            'recommendations': _join_list(evaluation.get('recommendations_list', []))
        }

    except Exception as e:
        # Fallback evaluation
        return {
            'raw_score': 50.0,
            'band_score': 5.0,
            'evaluation': _normalize_evaluation('writing', {'error': str(e)}),
            'strengths': 'Your response has been received',
            'weaknesses': 'Automated evaluation temporarily unavailable',
            'recommendations': 'Please consult with your teacher for detailed feedback'
        }


def evaluate_speaking(attempt):
    """
    Evaluate IELTS Speaking section using AI
    """
    from ai.enterprise_stt import EnterpriseSTTService
    from ai.llm_service import LLMService

    stt = EnterpriseSTTService()
    llm = LLMService()

    # Collect all speaking responses
    answers = attempt.answers.all()
    responses = []

    for answer in answers:
        if answer.audio_response:
            # Transcribe audio if not already done
            if not answer.transcription:
                try:
                    transcription = stt.transcribe_audio(answer.audio_response.path)
                    answer.transcription = transcription
                    answer.save()
                except:
                    answer.transcription = "[Transcription failed]"
                    answer.save()

            responses.append({
                'question': answer.question.question_text,
                'prompts': answer.question.speaking_prompts,
                'transcription': answer.transcription,
                'duration': answer.time_taken_seconds
            })

    # Create evaluation prompt
    prompt = f"""
You are an IELTS Speaking examiner. Evaluate the following IELTS Speaking responses according to IELTS band descriptors.

Evaluate based on:
1. Fluency and Coherence (25%)
2. Lexical Resource (25%)
3. Grammatical Range and Accuracy (25%)
4. Pronunciation (25%)

For each response, provide:
- Band score (0.0 - 9.0)
- Detailed feedback for each criterion
- Overall strengths
- Areas for improvement
- Specific recommendations

Speaking responses to evaluate:
{json.dumps(responses, indent=2)}

Provide your evaluation in JSON format with the following structure:
{{
    "responses": [
        {{
            "band_score": 7.0,
            "fluency_coherence": 7.0,
            "lexical_resource": 7.5,
            "grammatical_accuracy": 7.0,
            "pronunciation": 6.5,
            "feedback": "...",
            "strengths": [...],
            "weaknesses": [...]
        }}
    ],
    "overall_band_score": 7.0,
    "overall_strengths": "...",
    "overall_weaknesses": "...",
    "recommendations": "..."
}}
"""

    try:
        # Get AI evaluation
        response = llm.generate_response(prompt)

        # Parse response
        evaluation = parse_llm_json(response, {
            'overall_band_score': 5.0,
            'overall_feedback': 'Evaluation is still being prepared.',
            'overall_strengths': ['Your response was recorded successfully.'],
            'overall_weaknesses': ['Detailed automated evaluation was not available.'],
            'recommendations': ['Practice another speaking attempt with a timer and recording review.'],
        })
        evaluation = _normalize_evaluation('speaking', evaluation)

        # Calculate scores
        band_score = _score_value(evaluation.get('overall_band_score', 5.0))
        raw_score = band_score * 10

        # Update individual answer scores
        response_evaluations = evaluation.get('responses', [])
        for i, answer in enumerate(answers):
            if i < len(response_evaluations):
                resp_eval = response_evaluations[i]
                answer.ai_score = resp_eval
                answer.points_earned = Decimal(str(resp_eval.get('band_score', 5.0)))
                answer.ai_feedback = resp_eval.get('feedback', '')
                answer.save()

        return {
            'raw_score': raw_score,
            'band_score': band_score,
            'evaluation': evaluation,
            'strengths': _join_list(evaluation.get('strengths_list', [])),
            'weaknesses': _join_list(evaluation.get('weaknesses_list', [])),
            'recommendations': _join_list(evaluation.get('recommendations_list', []))
        }

    except Exception as e:
        # Fallback evaluation
        return {
            'raw_score': 50.0,
            'band_score': 5.0,
            'evaluation': _normalize_evaluation('speaking', {'error': str(e)}),
            'strengths': 'Your response has been recorded',
            'weaknesses': 'Automated evaluation temporarily unavailable',
            'recommendations': 'Please consult with your teacher for detailed feedback'
        }

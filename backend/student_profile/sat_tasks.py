"""
Celery tasks for SAT AI analysis and feedback
"""

from celery import shared_task
import json

from .ai_json import parse_llm_json


TOPIC_METADATA = {
    'reading_writing': {
        'craft_structure': {
            'label': 'Craft and Structure',
            'resource_title': 'Official SAT Craft and Structure Drill Set',
            'resource_type': 'question_bank',
            'action': 'Practice author purpose, tone, and word-in-context questions in short timed sets.',
        },
        'information_ideas': {
            'label': 'Information and Ideas',
            'resource_title': 'Evidence and Inference Passage Review',
            'resource_type': 'passage_review',
            'action': 'Focus on evidence pairing, inference, and central idea questions with annotation.',
        },
        'expression_ideas': {
            'label': 'Expression of Ideas',
            'resource_title': 'Revision and Rhetorical Skills Pack',
            'resource_type': 'skills_pack',
            'action': 'Drill sentence placement, transitions, and paragraph purpose revisions.',
        },
        'standard_conventions': {
            'label': 'Standard English Conventions',
            'resource_title': 'Grammar Accuracy Sprint Set',
            'resource_type': 'grammar_drill',
            'action': 'Run daily punctuation, verb agreement, and sentence boundary drills.',
        },
    },
    'math': {
        'algebra': {
            'label': 'Algebra',
            'resource_title': 'Linear Equations and Functions Set',
            'resource_type': 'question_bank',
            'action': 'Rebuild algebra fluency with equations, inequalities, and linear function drills.',
        },
        'advanced_math': {
            'label': 'Advanced Math',
            'resource_title': 'Nonlinear and Polynomial Practice Set',
            'resource_type': 'question_bank',
            'action': 'Work polynomial, quadratic, and exponential problems until setup is automatic.',
        },
        'problem_solving': {
            'label': 'Problem-Solving and Data Analysis',
            'resource_title': 'Ratios, Rates, and Data Reasoning Pack',
            'resource_type': 'data_analysis',
            'action': 'Train ratios, percentages, tables, and statistics with multi-step word problems.',
        },
        'geometry': {
            'label': 'Geometry and Trigonometry',
            'resource_title': 'Geometry Diagram and Angle Review',
            'resource_type': 'diagram_practice',
            'action': 'Review geometry formulas, triangle relationships, and diagram translation steps.',
        },
    },
}

SECTION_LABELS = {
    'reading_writing': 'Reading & Writing',
    'math': 'Math',
}


def _coerce_string_list(value, limit=5):
    if isinstance(value, str):
        items = [value]
    elif isinstance(value, list):
        items = value
    else:
        items = []

    cleaned = []
    seen = set()
    for item in items:
        text = str(item or '').strip()
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _get_topic_meta(section_key, topic_key):
    return TOPIC_METADATA.get(section_key, {}).get(
        topic_key,
        {
            'label': topic_key.replace('_', ' ').title(),
            'resource_title': f'{topic_key.replace("_", " ").title()} Practice Set',
            'resource_type': 'practice_set',
            'action': f'Review {topic_key.replace("_", " ")} questions and log repeated mistakes.',
        },
    )


def _performance_band(percentage):
    if percentage >= 85:
        return 'strong'
    if percentage >= 70:
        return 'developing'
    if percentage >= 50:
        return 'needs_work'
    return 'critical'


def _focus_minutes_per_day(percentage):
    if percentage >= 85:
        return 10
    if percentage >= 70:
        return 15
    if percentage >= 50:
        return 20
    return 25


def _time_estimate_for_gap(score_gap):
    if score_gap <= 60:
        return '2-4 weeks of focused practice'
    if score_gap <= 120:
        return '4-8 weeks of focused practice'
    if score_gap <= 220:
        return '2-3 months of focused practice'
    return '3-5 months of structured practice'


def _build_topic_diagnostics(analysis_by_section):
    diagnostics = []
    for section_key, section_analysis in analysis_by_section.items():
        for topic_key, stats in section_analysis.items():
            correct = int(stats.get('correct') or 0)
            total = int(stats.get('total') or 0)
            percentage = round(float(stats.get('percentage') or 0), 1)
            missed = max(total - correct, 0)
            meta = _get_topic_meta(section_key, topic_key)
            band = _performance_band(percentage)

            diagnostics.append(
                {
                    'section': section_key,
                    'section_label': SECTION_LABELS.get(section_key, section_key.replace('_', ' ').title()),
                    'topic': topic_key,
                    'topic_label': meta['label'],
                    'correct': correct,
                    'total': total,
                    'missed': missed,
                    'accuracy': percentage,
                    'performance_band': band,
                    'recommended_action': meta['action'],
                    'focus_minutes_per_day': _focus_minutes_per_day(percentage),
                    'resource_title': meta['resource_title'],
                    'resource_type': meta['resource_type'],
                }
            )

    diagnostics.sort(key=lambda item: (item['accuracy'], -item['missed'], item['section'], item['topic_label']))
    for index, item in enumerate(diagnostics, start=1):
        item['priority_rank'] = index
    return diagnostics


def _enrich_section_analysis(section_key, analysis, diagnostics):
    diagnostic_map = {
        item['topic']: item
        for item in diagnostics
        if item['section'] == section_key
    }

    enriched = {}
    for topic_key, stats in analysis.items():
        diagnostic = diagnostic_map.get(topic_key, {})
        enriched[topic_key] = {
            **stats,
            'label': diagnostic.get('topic_label') or _get_topic_meta(section_key, topic_key)['label'],
            'section': section_key,
            'section_label': diagnostic.get('section_label') or SECTION_LABELS.get(section_key, section_key.title()),
            'performance_band': diagnostic.get('performance_band') or _performance_band(stats.get('percentage') or 0),
            'priority_rank': diagnostic.get('priority_rank'),
            'recommended_action': diagnostic.get('recommended_action'),
            'focus_minutes_per_day': diagnostic.get('focus_minutes_per_day'),
            'resource_title': diagnostic.get('resource_title'),
            'resource_type': diagnostic.get('resource_type'),
        }
    return enriched


def _build_priority_areas(raw_feedback, topic_diagnostics):
    items = _coerce_string_list(raw_feedback.get('priority_areas'), limit=5)
    if len(items) >= 3:
        return items

    for diagnostic in topic_diagnostics[:4]:
        candidate = f"{diagnostic['section_label']}: {diagnostic['topic_label']} ({diagnostic['accuracy']}% accuracy)"
        if candidate.lower() not in {item.lower() for item in items}:
            items.append(candidate)
        if len(items) >= 3:
            break

    if not items:
        items.append('Stabilize pacing and review missed question patterns.')
    return items[:5]


def _normalize_section_feedback(section_key, raw_section_feedback, topic_diagnostics):
    section_label = SECTION_LABELS[section_key]
    section_items = [item for item in topic_diagnostics if item['section'] == section_key]
    strong_topics = list(reversed([item for item in section_items if item['performance_band'] in {'strong', 'developing'}]))
    weak_topics = [item for item in section_items if item['performance_band'] in {'critical', 'needs_work', 'developing'}]

    strengths = _coerce_string_list(raw_section_feedback.get('strengths'), limit=3)
    weaknesses = _coerce_string_list(raw_section_feedback.get('weaknesses'), limit=3)
    improvement_tips = _coerce_string_list(raw_section_feedback.get('improvement_tips'), limit=4)

    for item in strong_topics:
        candidate = f"{item['topic_label']} is comparatively stable at {item['accuracy']}% accuracy."
        if candidate.lower() not in {entry.lower() for entry in strengths}:
            strengths.append(candidate)
        if len(strengths) >= 3:
            break

    if not strengths:
        strengths.append(f"{section_label} has a usable foundation to build on with targeted review.")

    for item in weak_topics:
        candidate = f"{item['topic_label']} needs repair after {item['missed']} misses out of {item['total']}."
        if candidate.lower() not in {entry.lower() for entry in weaknesses}:
            weaknesses.append(candidate)
        if len(weaknesses) >= 3:
            break

    if not weaknesses:
        weaknesses.append(f"Keep auditing {section_label} errors to isolate recurring patterns.")

    for item in weak_topics:
        candidate = (
            f"Spend {item['focus_minutes_per_day']} minutes daily on {item['topic_label']} and review every miss."
        )
        if candidate.lower() not in {entry.lower() for entry in improvement_tips}:
            improvement_tips.append(candidate)
        if len(improvement_tips) >= 4:
            break

    if len(improvement_tips) < 3:
        improvement_tips.append(f"Run timed {section_label} sets and write a one-line error reason for each miss.")

    return {
        'strengths': strengths[:3],
        'weaknesses': weaknesses[:3],
        'improvement_tips': improvement_tips[:4],
    }


def _normalize_score_potential(raw_score_potential, attempt):
    score_gap = max(0, 1400 - int(attempt.total_score or 0))
    current_score = int(raw_score_potential.get('current_score') or attempt.total_score or 400)
    realistic_target = raw_score_potential.get('realistic_target')
    if realistic_target is None:
        realistic_target = min(1600, current_score + max(60, min(220, score_gap or 80)))

    target_breakdown = raw_score_potential.get('target_breakdown') or {}
    rw_target = int(target_breakdown.get('reading_writing') or max(attempt.reading_writing_score or 200, int(realistic_target / 2)))
    math_target = int(target_breakdown.get('math') or max(attempt.math_score or 200, realistic_target - rw_target))
    if rw_target + math_target != realistic_target:
        math_target = realistic_target - rw_target

    return {
        'current_score': current_score,
        'realistic_target': realistic_target,
        'target_breakdown': {
            'reading_writing': rw_target,
            'math': math_target,
        },
        'time_estimate': raw_score_potential.get('time_estimate') or _time_estimate_for_gap(realistic_target - current_score),
    }


def _build_study_plan(raw_feedback, topic_diagnostics):
    if isinstance(raw_feedback.get('study_plan_structured'), list):
        structured = [item for item in raw_feedback['study_plan_structured'] if isinstance(item, dict)]
    else:
        structured = []

    if not structured:
        top_items = topic_diagnostics[:3]
        first_focus = [item['topic_label'] for item in top_items[:2]] or ['Error log review']
        second_focus = [item['section_label'] for item in top_items] or ['Mixed SAT practice']
        structured = [
            {
                'phase': 'Weeks 1-2',
                'title': 'Repair the weakest topics',
                'focus_areas': first_focus,
                'daily_minutes': max([item['focus_minutes_per_day'] for item in top_items[:2]] or [20]),
                'goal': 'Rebuild accuracy with untimed drills and a strict error log.',
            },
            {
                'phase': 'Weeks 3-4',
                'title': 'Add timed section work',
                'focus_areas': second_focus,
                'daily_minutes': 35,
                'goal': 'Practice pacing while keeping accuracy stable on medium-difficulty sets.',
            },
            {
                'phase': 'Weeks 5-6',
                'title': 'Blend topics under pressure',
                'focus_areas': [item['topic_label'] for item in topic_diagnostics[:3]] or ['Mixed review'],
                'daily_minutes': 45,
                'goal': 'Use mixed sets and review misses the same day.',
            },
            {
                'phase': 'Weeks 7-8',
                'title': 'Full mock and targeted review',
                'focus_areas': ['Full-length digital SAT review'],
                'daily_minutes': 60,
                'goal': 'Take one full mock each week and revisit the two weakest topics after each test.',
            },
        ]

    summary_strings = _coerce_string_list(raw_feedback.get('study_plan'), limit=8)
    if not summary_strings:
        summary_strings = [
            f"{item['phase']}: {item['title']} - {item['goal']}"
            for item in structured[:4]
        ]

    return summary_strings[:8], structured[:6]


def _build_recommended_resources(raw_feedback, topic_diagnostics):
    if isinstance(raw_feedback.get('recommended_resources_structured'), list):
        structured = [item for item in raw_feedback['recommended_resources_structured'] if isinstance(item, dict)]
    else:
        structured = []

    if not structured:
        structured = []
        for item in topic_diagnostics[:4]:
            structured.append(
                {
                    'title': item['resource_title'],
                    'type': item['resource_type'],
                    'section': item['section'],
                    'topic': item['topic'],
                    'reason': item['recommended_action'],
                    'priority_rank': item['priority_rank'],
                }
            )

        structured.append(
            {
                'title': 'Official Digital SAT Full-Length Review',
                'type': 'full_mock',
                'section': 'mixed',
                'topic': 'full_exam',
                'reason': 'Use a full test weekly to validate pacing and confirm whether weak topics are improving.',
                'priority_rank': len(structured) + 1,
            }
        )

    summary_strings = _coerce_string_list(raw_feedback.get('recommended_resources'), limit=8)
    if not summary_strings:
        summary_strings = [
            f"{item['title']}: {item['reason']}"
            for item in structured[:5]
        ]

    return summary_strings[:8], structured[:6]


def _build_overall_assessment(raw_feedback, attempt, topic_diagnostics):
    current = str(raw_feedback.get('overall_assessment') or '').strip()
    if current:
        return current

    weakest = topic_diagnostics[0] if topic_diagnostics else None
    if weakest:
        return (
            f"The student is currently at {attempt.total_score}/1600 with the clearest drag coming from "
            f"{weakest['section_label']} - {weakest['topic_label']} ({weakest['accuracy']}% accuracy). "
            "A structured repair plan with timed review should raise consistency across the next full mock."
        )
    return f"The student is currently at {attempt.total_score}/1600 and should continue focused review with timed practice."


@shared_task
def analyze_sat_performance(attempt_id):
    """
    AI analyzes SAT performance and provides detailed feedback
    Analyzes performance by section, question type, and provides improvement suggestions
    """
    from .sat_models import SATAttempt
    from ai.llm_service import LLMService

    try:
        attempt = SATAttempt.objects.get(id=attempt_id)
        llm = LLMService()

        # Collect performance data
        answers = attempt.answers.select_related('question', 'question__module').all()

        # Analyze by section
        rw_answers = answers.filter(question__module__section='reading_writing')
        math_answers = answers.filter(question__module__section='math')

        # Analyze by question type (Reading & Writing)
        rw_analysis = {}
        for rw_type in ['craft_structure', 'information_ideas', 'expression_ideas', 'standard_conventions']:
            type_answers = rw_answers.filter(question__rw_type=rw_type)
            if type_answers.exists():
                correct = type_answers.filter(is_correct=True).count()
                total = type_answers.count()
                rw_analysis[rw_type] = {
                    'correct': correct,
                    'total': total,
                    'percentage': round((correct / total) * 100, 1) if total > 0 else 0
                }

        # Analyze by question type (Math)
        math_analysis = {}
        for math_type in ['algebra', 'advanced_math', 'problem_solving', 'geometry']:
            type_answers = math_answers.filter(question__math_type=math_type)
            if type_answers.exists():
                correct = type_answers.filter(is_correct=True).count()
                total = type_answers.count()
                math_analysis[math_type] = {
                    'correct': correct,
                    'total': total,
                    'percentage': round((correct / total) * 100, 1) if total > 0 else 0
                }

        raw_analysis = {
            'reading_writing': rw_analysis,
            'math': math_analysis,
        }
        topic_diagnostics = _build_topic_diagnostics(raw_analysis)

        # Create AI prompt for personalized feedback
        prompt = f"""
You are an SAT expert tutor analyzing a student's performance. Provide detailed, actionable feedback.

Student Performance Summary:
- Total Score: {attempt.total_score}/1600
- Reading & Writing: {attempt.reading_writing_score}/800 ({attempt.rw_correct}/54 correct)
- Math: {attempt.math_score}/800 ({attempt.math_correct}/44 correct)

Reading & Writing Breakdown:
{json.dumps(rw_analysis, indent=2)}

Math Breakdown:
{json.dumps(math_analysis, indent=2)}

Analyze this performance and provide feedback in JSON format:
{{
    "overall_assessment": "Brief overall performance summary (2-3 sentences)",
    "reading_writing_feedback": {{
        "strengths": ["Strength 1", "Strength 2"],
        "weaknesses": ["Weakness 1", "Weakness 2"],
        "improvement_tips": ["Tip 1", "Tip 2", "Tip 3"]
    }},
    "math_feedback": {{
        "strengths": ["Strength 1", "Strength 2"],
        "weaknesses": ["Weakness 1", "Weakness 2"],
        "improvement_tips": ["Tip 1", "Tip 2", "Tip 3"]
    }},
    "score_potential": {{
        "current_score": {attempt.total_score},
        "realistic_target": 1400,
        "target_breakdown": {{
            "reading_writing": 700,
            "math": 700
        }},
        "time_estimate": "2-3 months of focused practice"
    }},
    "priority_areas": ["Area 1 to focus on", "Area 2 to focus on", "Area 3 to focus on"],
    "study_plan": [
        "Week 1-2: Focus on...",
        "Week 3-4: Practice...",
        "Week 5-6: Master..."
    ],
    "recommended_resources": [
        "Resource 1 with explanation",
        "Resource 2 with explanation"
    ],
    "study_plan_structured": [
        {{
            "phase": "Weeks 1-2",
            "title": "Short title",
            "focus_areas": ["Topic A", "Topic B"],
            "daily_minutes": 30,
            "goal": "Concrete measurable goal"
        }}
    ],
    "recommended_resources_structured": [
        {{
            "title": "Resource title",
            "type": "question_bank",
            "section": "reading_writing",
            "topic": "craft_structure",
            "reason": "Why this matters now"
        }}
    ]
}}
"""

        # Get AI analysis
        try:
            response = llm.generate_response(prompt)
            ai_feedback = parse_llm_json(response, {})
        except Exception:
            # Fallback if JSON parsing fails
            ai_feedback = {
                'overall_assessment': 'Performance analysis completed.',
                'reading_writing_feedback': {
                    'strengths': ['Good effort'],
                    'weaknesses': ['Review materials'],
                    'improvement_tips': ['Continue practicing']
                },
                'math_feedback': {
                    'strengths': ['Good effort'],
                    'weaknesses': ['Review materials'],
                    'improvement_tips': ['Continue practicing']
                },
                'priority_areas': ['Continue studying'],
            }

        priority_areas = _build_priority_areas(ai_feedback, topic_diagnostics)
        study_plan, study_plan_structured = _build_study_plan(ai_feedback, topic_diagnostics)
        recommended_resources, recommended_resources_structured = _build_recommended_resources(ai_feedback, topic_diagnostics)
        rw_feedback_normalized = _normalize_section_feedback(
            'reading_writing',
            ai_feedback.get('reading_writing_feedback') or {},
            topic_diagnostics,
        )
        math_feedback_normalized = _normalize_section_feedback(
            'math',
            ai_feedback.get('math_feedback') or {},
            topic_diagnostics,
        )
        score_potential = _normalize_score_potential(ai_feedback.get('score_potential') or {}, attempt)
        enriched_rw_analysis = _enrich_section_analysis('reading_writing', rw_analysis, topic_diagnostics)
        enriched_math_analysis = _enrich_section_analysis('math', math_analysis, topic_diagnostics)
        avg_seconds = round(attempt.time_taken_seconds / 98, 1) if attempt.time_taken_seconds > 0 else 0

        ai_feedback['overall_assessment'] = _build_overall_assessment(ai_feedback, attempt, topic_diagnostics)
        ai_feedback['priority_areas'] = priority_areas
        ai_feedback['study_plan'] = study_plan
        ai_feedback['study_plan_structured'] = study_plan_structured
        ai_feedback['recommended_resources'] = recommended_resources
        ai_feedback['recommended_resources_structured'] = recommended_resources_structured
        ai_feedback['reading_writing_feedback'] = rw_feedback_normalized
        ai_feedback['math_feedback'] = math_feedback_normalized
        ai_feedback['score_potential'] = score_potential
        ai_feedback['topic_diagnostics'] = topic_diagnostics

        # Add performance data to feedback
        ai_feedback['performance_data'] = {
            'total_score': attempt.total_score,
            'reading_writing': {
                'score': attempt.reading_writing_score,
                'correct': attempt.rw_correct,
                'total': 54,
                'by_type': enriched_rw_analysis
            },
            'math': {
                'score': attempt.math_score,
                'correct': attempt.math_correct,
                'total': 44,
                'by_type': enriched_math_analysis
            },
            'time_management': {
                'total_time_seconds': attempt.time_taken_seconds,
                'time_per_question_avg': avg_seconds,
                'time_per_question_avg_seconds': avg_seconds,
                'official_time_per_question_avg_seconds': round((134 * 60) / 98, 1),
                'pacing_status': (
                    'fast' if avg_seconds and avg_seconds <= 76
                    else 'slow' if avg_seconds >= 90
                    else 'on_track'
                ),
            },
            'topic_diagnostics': topic_diagnostics,
        }

        # Update attempt with AI feedback
        attempt.ai_feedback = ai_feedback
        attempt.save()

        return {
            'success': True,
            'attempt_id': attempt.id,
            'total_score': attempt.total_score
        }

    except Exception as e:
        # Log error and save partial feedback
        if 'attempt' in locals():
            attempt.ai_feedback = {
                'error': str(e),
                'message': 'AI analysis could not be completed'
            }
            attempt.save()

        return {'success': False, 'error': str(e)}


@shared_task
def generate_sat_practice_questions(section, difficulty, topic=None, count=10):
    """
    Generate SAT practice questions using AI
    Used for creating new SAT exams or additional practice

    Args:
        section: 'reading_writing' or 'math'
        difficulty: 'easy', 'medium', 'hard'
        topic: Optional specific topic
        count: Number of questions to generate
    """
    from ai.llm_service import LLMService

    try:
        llm = LLMService()

        section_info = {
            'reading_writing': {
                'types': ['craft_structure', 'information_ideas', 'expression_ideas', 'standard_conventions'],
                'description': 'SAT Reading and Writing questions testing comprehension, grammar, and writing skills'
            },
            'math': {
                'types': ['algebra', 'advanced_math', 'problem_solving', 'geometry'],
                'description': 'SAT Math questions covering algebra, advanced math, data analysis, and geometry'
            }
        }

        section_data = section_info.get(section, section_info['reading_writing'])

        prompt = f"""
Generate {count} SAT {section.replace('_', ' ').title()} practice questions in JSON format.

Requirements:
- Section: {section.replace('_', ' ').title()}
- Difficulty: {difficulty}
- Topic focus: {topic or 'General SAT topics'}
- Follow official SAT 2025 digital format
- Include variety of question types: {', '.join(section_data['types'])}

For each question, provide:
1. Passage/context (if applicable)
2. Question text
3. 4 answer choices (A, B, C, D) for multiple choice
4. Correct answer with explanation
5. Question type classification
6. Difficulty level

Return JSON array:
[
    {{
        "question_number": 1,
        "question_type": "{section_data['types'][0]}",
        "passage_text": "Context or passage here (if applicable)...",
        "question_text": "What is the main idea?",
        "answer_type": "mcq",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": {{"answer": "B"}},
        "explanation": "Detailed explanation of why B is correct...",
        "difficulty_level": "{difficulty}"
    }}
]
"""

        response = llm.generate_response(prompt)
        questions = json.loads(response)

        return {
            'success': True,
            'questions': questions,
            'count': len(questions)
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

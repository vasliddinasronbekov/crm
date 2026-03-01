from __future__ import annotations

from collections import Counter, defaultdict
from typing import Iterable

from django.db.models import Avg, Count, Q

from .exam_draft_models import IELTSExamDraft
from .ielts_models import IELTSSection
from .sat_models import SATExam, SATModule, SATQuestion


SAT_SECTION_LABELS = {
    "reading_writing": "Reading & Writing",
    "math": "Math",
}

IELTS_SECTION_TARGETS = {
    IELTSSection.READING: {"target_questions": 40, "mode": "exact"},
    IELTSSection.LISTENING: {"target_questions": 40, "mode": "exact"},
    IELTSSection.WRITING: {"target_questions": 2, "mode": "exact"},
    IELTSSection.SPEAKING: {"target_questions": 3, "mode": "minimum"},
}


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _preview_text(value: str | None, length: int = 120) -> str:
    normalized = " ".join((value or "").split())
    if len(normalized) <= length:
        return normalized
    return f"{normalized[:length].rstrip()}..."


def _percentage(numerator: int | float, denominator: int | float) -> float:
    if not denominator:
        return 0.0
    return round((float(numerator) / float(denominator)) * 100, 1)


def _list_duplicates(items: Iterable[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        key = f"{_normalize_text(item.get('question_text'))}|{_normalize_text(item.get('passage_text'))}"
        if key == "|":
            continue
        grouped[key].append(item)

    duplicates = []
    for entries in grouped.values():
        if len(entries) < 2:
            continue
        duplicates.append(
            {
                "question_ids": [entry["id"] for entry in entries],
                "count": len(entries),
                "preview": _preview_text(entries[0].get("question_text")),
            }
        )
    return sorted(duplicates, key=lambda item: (-item["count"], item["question_ids"][0]))


def build_sat_exam_quality_report(exam: SATExam) -> dict:
    modules = list(
        exam.modules.prefetch_related("questions").all().order_by("section", "module_number")
    )
    questions = [
        question
        for module in modules
        for question in module.questions.all().order_by("question_number", "id")
    ]
    expected_modules = [
        ("reading_writing", 1),
        ("reading_writing", 2),
        ("math", 1),
        ("math", 2),
    ]
    module_lookup = {(module.section, module.module_number): module for module in modules}
    missing_modules = [
        {
            "section": section,
            "section_label": SAT_SECTION_LABELS[section],
            "module_number": module_number,
        }
        for section, module_number in expected_modules
        if (section, module_number) not in module_lookup
    ]

    question_type_counts = {
        "reading_writing": Counter(),
        "math": Counter(),
    }
    difficulty_counts = Counter()
    duplicate_candidates = []
    missing_explanations = 0
    missing_correct_answers = 0
    invalid_option_sets = 0
    missing_classification = 0
    module_rows = []
    blockers: list[str] = []
    warnings: list[str] = []

    for module in modules:
        module_questions = list(module.questions.all().order_by("question_number", "id"))
        target_question_count = (
            exam.rw_total_questions // 2
            if module.section == "reading_writing"
            else exam.math_total_questions // 2
        )
        question_count = len(module_questions)
        completion_percentage = _percentage(question_count, target_question_count)
        issues = []

        if question_count < target_question_count:
            issues.append(
                f"Needs {target_question_count - question_count} more question"
                f"{'' if target_question_count - question_count == 1 else 's'}"
            )
        elif question_count > target_question_count:
            issues.append(f"Has {question_count - target_question_count} extra questions")

        if module.module_number == 1 and module.difficulty != "medium":
            issues.append("Module 1 should stay medium difficulty")

        if module.time_minutes <= 0:
            issues.append("Missing time limit")

        for question in module_questions:
            difficulty_counts[question.difficulty_level] += 1
            duplicate_candidates.append(
                {
                    "id": question.id,
                    "question_text": question.question_text,
                    "passage_text": question.passage_text,
                }
            )

            if module.section == "reading_writing":
                if question.rw_type:
                    question_type_counts["reading_writing"][question.rw_type] += 1
                else:
                    missing_classification += 1
            else:
                if question.math_type:
                    question_type_counts["math"][question.math_type] += 1
                else:
                    missing_classification += 1

            if not question.correct_answer:
                missing_correct_answers += 1
            if not question.explanation:
                missing_explanations += 1
            if question.answer_type == "mcq" and (
                not isinstance(question.options, list) or len(question.options) < 2
            ):
                invalid_option_sets += 1

        module_rows.append(
            {
                "id": module.id,
                "section": module.section,
                "section_label": SAT_SECTION_LABELS[module.section],
                "module_number": module.module_number,
                "difficulty": module.difficulty,
                "time_minutes": module.time_minutes,
                "question_count": question_count,
                "target_question_count": target_question_count,
                "completion_percentage": completion_percentage,
                "is_complete": question_count == target_question_count,
                "issues": issues,
            }
        )

    duplicates = _list_duplicates(duplicate_candidates)
    total_target_questions = exam.rw_total_questions + exam.math_total_questions
    total_actual_questions = len(questions)

    if missing_modules:
        blockers.append(f"Missing {len(missing_modules)} required SAT modules")
    if total_actual_questions != total_target_questions:
        blockers.append(
            f"Question inventory is {total_actual_questions}/{total_target_questions}; totals must match before publish"
        )
    if missing_correct_answers:
        blockers.append(f"{missing_correct_answers} questions are missing correct answers")
    if invalid_option_sets:
        blockers.append(f"{invalid_option_sets} MCQ questions have invalid option sets")
    if missing_classification:
        blockers.append(f"{missing_classification} questions are missing section classification")
    if duplicates:
        blockers.append(f"{len(duplicates)} duplicate question clusters detected")
    if missing_explanations:
        warnings.append(f"{missing_explanations} questions are missing explanations")

    attempt_queryset = exam.attempts.filter(status__in=["completed", "evaluated"])
    attempt_stats = attempt_queryset.aggregate(
        average_total_score=Avg("total_score"),
        average_rw_score=Avg("reading_writing_score"),
        average_math_score=Avg("math_score"),
        average_time_taken=Avg("time_taken_seconds"),
    )
    total_attempts = exam.attempts.count()
    completed_attempts = attempt_queryset.count()
    passed_attempts = attempt_queryset.filter(total_score__gte=exam.passing_score).count()

    hardest_questions = list(
        SATQuestion.objects.filter(
            module__exam=exam,
            student_answers__attempt__status__in=["completed", "evaluated"],
        )
        .annotate(
            submissions=Count("student_answers"),
            correct_submissions=Count(
                "student_answers",
                filter=Q(student_answers__is_correct=True),
            ),
        )
        .filter(submissions__gt=0)
        .order_by("submissions", "question_number")
        .values(
            "id",
            "question_number",
            "module__section",
            "module__module_number",
            "question_text",
            "submissions",
            "correct_submissions",
        )[:8]
    )
    for question in hardest_questions:
        question["accuracy_percentage"] = _percentage(
            question["correct_submissions"], question["submissions"]
        )
        question["preview"] = _preview_text(question["question_text"])

    coverage_by_section = []
    for section, label in SAT_SECTION_LABELS.items():
        actual = sum(1 for question in questions if question.module.section == section)
        target = exam.rw_total_questions if section == "reading_writing" else exam.math_total_questions
        coverage_by_section.append(
            {
                "section": section,
                "label": label,
                "actual": actual,
                "target": target,
                "completion_percentage": _percentage(actual, target),
            }
        )

    return {
        "summary": {
            "is_publish_ready": len(blockers) == 0,
            "total_questions": total_actual_questions,
            "target_questions": total_target_questions,
            "completion_percentage": _percentage(total_actual_questions, total_target_questions),
            "required_modules": len(expected_modules),
            "actual_modules": len(modules),
        },
        "blockers": blockers,
        "warnings": warnings,
        "missing_modules": missing_modules,
        "module_readiness": module_rows,
        "coverage": {
            "by_section": coverage_by_section,
            "question_types": {
                section: [
                    {"key": key, "count": count}
                    for key, count in sorted(counter.items(), key=lambda item: item[0])
                ]
                for section, counter in question_type_counts.items()
            },
            "difficulty": [
                {"key": key, "count": count}
                for key, count in sorted(difficulty_counts.items(), key=lambda item: item[0])
            ],
        },
        "data_quality": {
            "missing_explanations": missing_explanations,
            "missing_correct_answers": missing_correct_answers,
            "invalid_option_sets": invalid_option_sets,
            "missing_classification": missing_classification,
            "duplicate_clusters": duplicates,
        },
        "analytics": {
            "total_attempts": total_attempts,
            "completed_attempts": completed_attempts,
            "pass_rate": _percentage(passed_attempts, completed_attempts),
            "average_total_score": round(attempt_stats["average_total_score"] or 0),
            "average_rw_score": round(attempt_stats["average_rw_score"] or 0),
            "average_math_score": round(attempt_stats["average_math_score"] or 0),
            "average_time_minutes": round((attempt_stats["average_time_taken"] or 0) / 60, 1),
            "hardest_questions": hardest_questions,
        },
    }


def build_ielts_draft_quality_report(draft: IELTSExamDraft) -> dict:
    questions = list(draft.draft_questions.all().order_by("order", "id"))
    config = IELTS_SECTION_TARGETS[draft.section]
    question_type_counts = Counter(question.question_type for question in questions)
    duplicate_candidates = [
        {
            "id": question.id,
            "question_text": question.question_text,
            "passage_text": question.passage_text,
        }
        for question in questions
    ]

    duplicates = _list_duplicates(duplicate_candidates)
    missing_correct_answers = sum(1 for question in questions if not question.correct_answer)
    missing_options = sum(
        1
        for question in questions
        if question.question_type == "multiple_choice"
        and (not isinstance(question.options, list) or len(question.options) < 2)
    )
    missing_audio = sum(
        1 for question in questions if draft.section == IELTSSection.LISTENING and not question.audio_file
    )
    missing_speaking_prompts = sum(
        1
        for question in questions
        if draft.section == IELTSSection.SPEAKING and not question.speaking_prompts
    )
    missing_passages = sum(
        1
        for question in questions
        if draft.section in {IELTSSection.READING, IELTSSection.LISTENING} and not question.passage_text
    )

    blockers = []
    warnings = []

    actual_question_count = len(questions)
    target_question_count = config["target_questions"]
    if config["mode"] == "exact" and actual_question_count != target_question_count:
        blockers.append(
            f"Question inventory is {actual_question_count}/{target_question_count}; this section must match the official target"
        )
    if config["mode"] == "minimum" and actual_question_count < target_question_count:
        blockers.append(f"At least {target_question_count} speaking prompts are required")
    if missing_correct_answers:
        blockers.append(f"{missing_correct_answers} draft questions are missing correct answers")
    if missing_options:
        blockers.append(f"{missing_options} multiple-choice questions are missing answer options")
    if duplicates:
        blockers.append(f"{len(duplicates)} duplicate draft question clusters detected")
    if missing_audio:
        blockers.append(f"{missing_audio} listening questions are missing audio")
    if missing_speaking_prompts:
        blockers.append(f"{missing_speaking_prompts} speaking questions are missing prompts")
    if missing_passages:
        warnings.append(f"{missing_passages} questions are missing passage or script text")
    if draft.ai_quality_score is None:
        warnings.append("AI review has not been completed yet")
    elif draft.ai_quality_score < 70:
        warnings.append("AI quality score is below the recommended publish threshold")

    required_type_issues = []
    if draft.section == IELTSSection.WRITING:
        has_task1 = any(
            question.question_type in {"task1_academic", "task1_general"} for question in questions
        )
        has_task2 = any(question.question_type == "task2_essay" for question in questions)
        if not has_task1:
            required_type_issues.append("Missing Task 1 prompt")
        if not has_task2:
            required_type_issues.append("Missing Task 2 essay prompt")
    elif draft.section == IELTSSection.SPEAKING:
        for required_type in ("introduction", "long_turn", "discussion"):
            if question_type_counts[required_type] == 0:
                required_type_issues.append(f"Missing speaking part: {required_type.replace('_', ' ')}")

    blockers.extend(required_type_issues)

    published_exam = draft.published_exam
    analytics = {
        "total_attempts": 0,
        "completed_attempts": 0,
        "pending_evaluation": 0,
        "pass_rate": 0.0,
        "average_band_score": 0.0,
        "average_time_minutes": 0.0,
        "hardest_questions": [],
    }

    if published_exam:
        attempt_queryset = published_exam.attempts.all()
        completed_queryset = attempt_queryset.filter(status__in=["completed", "refunded"])
        completed_stats = completed_queryset.aggregate(
            average_band_score=Avg("band_score"),
            average_time_taken=Avg("time_taken_seconds"),
        )
        completed_attempts = completed_queryset.count()
        passed_attempts = completed_queryset.filter(
            band_score__gte=published_exam.passing_band_score
        ).count()
        analytics.update(
            {
                "total_attempts": attempt_queryset.count(),
                "completed_attempts": completed_attempts,
                "pending_evaluation": attempt_queryset.filter(
                    status__in=["submitted", "evaluating"]
                ).count(),
                "pass_rate": _percentage(passed_attempts, completed_attempts),
                "average_band_score": round(float(completed_stats["average_band_score"] or 0), 1),
                "average_time_minutes": round((completed_stats["average_time_taken"] or 0) / 60, 1),
            }
        )

        if published_exam.section in {IELTSSection.READING, IELTSSection.LISTENING}:
            hardest_questions = list(
                published_exam.questions.filter(
                    answers__attempt__status__in=["completed", "refunded"]
                )
                .annotate(
                    submissions=Count("answers"),
                    correct_submissions=Count("answers", filter=Q(answers__is_correct=True)),
                )
                .filter(submissions__gt=0)
                .order_by("submissions", "order")
                .values("id", "order", "question_text", "submissions", "correct_submissions")[:8]
            )
            for question in hardest_questions:
                question["accuracy_percentage"] = _percentage(
                    question["correct_submissions"], question["submissions"]
                )
                question["preview"] = _preview_text(question["question_text"])
            analytics["hardest_questions"] = hardest_questions

    return {
        "summary": {
            "is_content_ready": len(blockers) == 0,
            "question_count": actual_question_count,
            "target_question_count": target_question_count,
            "completion_percentage": _percentage(actual_question_count, target_question_count),
            "status": draft.status,
            "published_exam_id": draft.published_exam_id,
        },
        "blockers": blockers,
        "warnings": warnings,
        "workflow": {
            "status": draft.status,
            "ai_quality_score": float(draft.ai_quality_score) if draft.ai_quality_score is not None else None,
            "ai_reviewed_at": draft.ai_reviewed_at,
            "reviewed_at": draft.reviewed_at,
            "published_at": draft.published_at,
        },
        "coverage": {
            "question_types": [
                {"key": key, "count": count}
                for key, count in sorted(question_type_counts.items(), key=lambda item: item[0])
            ],
            "required_type_issues": required_type_issues,
        },
        "data_quality": {
            "missing_correct_answers": missing_correct_answers,
            "missing_options": missing_options,
            "missing_audio": missing_audio,
            "missing_speaking_prompts": missing_speaking_prompts,
            "missing_passages": missing_passages,
            "duplicate_clusters": duplicates,
        },
        "ai_review": {
            "quality_score": float(draft.ai_quality_score) if draft.ai_quality_score is not None else None,
            "overall_assessment": draft.ai_suggestions.get("overall_assessment", ""),
            "strengths": draft.ai_suggestions.get("strengths", []),
            "improvements": draft.ai_suggestions.get("improvements", []),
            "question_feedback": draft.ai_suggestions.get("question_feedback", []),
        },
        "analytics": analytics,
    }

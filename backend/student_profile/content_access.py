"""
Helpers for LMS access control and continue-learning logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Set

from django.db.models import Q

from .content_models import CourseModule, Lesson, StudentProgress
from users.roles import has_capability


@dataclass
class ContentAccessState:
    completed_lesson_ids: Set[int]
    progress_map: Dict[int, StudentProgress]
    module_completion_map: Dict[int, bool]


def _published_module_lessons(module: CourseModule):
    return module.lessons.filter(Q(is_published=True) | Q(is_free_preview=True)).order_by("order", "id")


def _has_lms_editor_access(user) -> bool:
    return has_capability(user, "lms.edit")


def is_module_completed(module: CourseModule, completed_lesson_ids: Set[int]) -> bool:
    published_lessons = list(_published_module_lessons(module))
    if not published_lessons:
        return True

    required_lesson_ids = {
        lesson.id for lesson in published_lessons if lesson.requires_completion or lesson.lesson_type in {"quiz", "assignment"}
    }
    if not required_lesson_ids:
        required_lesson_ids = {lesson.id for lesson in published_lessons}

    return required_lesson_ids.issubset(completed_lesson_ids)


def build_content_access_state(user, course=None) -> ContentAccessState:
    progress_queryset = StudentProgress.objects.filter(student=user, lesson__isnull=False).select_related(
        "lesson", "lesson__module", "lesson__module__course"
    )
    modules_queryset = CourseModule.objects.all()

    if course is not None:
        progress_queryset = progress_queryset.filter(lesson__module__course=course)
        modules_queryset = modules_queryset.filter(course=course)

    progress_map = {progress.lesson_id: progress for progress in progress_queryset}
    completed_lesson_ids = {
        lesson_id
        for lesson_id, progress in progress_map.items()
        if progress.is_completed or progress.completion_percentage >= 100
    }

    module_completion_map = {
        module.id: is_module_completed(module, completed_lesson_ids)
        for module in modules_queryset.prefetch_related("lessons")
    }

    return ContentAccessState(
        completed_lesson_ids=completed_lesson_ids,
        progress_map=progress_map,
        module_completion_map=module_completion_map,
    )


def get_module_lock_state(
    user,
    module: CourseModule,
    state: Optional[ContentAccessState] = None,
):
    if _has_lms_editor_access(user):
        return False, ""

    if module.is_free_preview:
        return False, "Preview module"

    state = state or build_content_access_state(user, course=module.course)

    prerequisite_modules = list(module.prerequisite_modules.all().order_by("order", "id"))
    if prerequisite_modules:
        missing = [
            prerequisite.title
            for prerequisite in prerequisite_modules
            if not state.module_completion_map.get(prerequisite.id, False)
        ]
        if missing:
            return True, f"Complete prerequisite module: {missing[0]}"
        return False, ""

    previous_module = (
        CourseModule.objects.filter(
            course=module.course,
            order__lt=module.order,
        ).filter(Q(is_published=True) | Q(is_free_preview=True))
        .order_by("-order", "-id")
        .first()
    )
    if previous_module and not state.module_completion_map.get(previous_module.id, False):
        return True, f"Complete previous module: {previous_module.title}"

    return False, ""


def get_lesson_lock_state(
    user,
    lesson: Lesson,
    state: Optional[ContentAccessState] = None,
):
    if _has_lms_editor_access(user):
        return False, ""

    if lesson.is_free_preview or lesson.module.is_free_preview:
        return False, "Preview lesson"

    state = state or build_content_access_state(user, course=lesson.module.course)
    module_locked, module_reason = get_module_lock_state(user, lesson.module, state)
    if module_locked:
        return True, module_reason

    previous_required_lessons = (
        lesson.module.lessons.filter(is_published=True, order__lt=lesson.order)
        .order_by("order", "id")
    )
    for previous_lesson in previous_required_lessons:
        if previous_lesson.is_free_preview:
            continue
        if not previous_lesson.requires_completion and previous_lesson.lesson_type not in {"quiz", "assignment"}:
            continue
        if previous_lesson.id not in state.completed_lesson_ids:
            return True, f"Complete previous lesson: {previous_lesson.title}"

    return False, ""


def get_module_completion_snapshot(module: CourseModule, state: ContentAccessState):
    lessons = list(_published_module_lessons(module))
    total_lessons = len(lessons)
    completed_lessons = sum(1 for lesson in lessons if lesson.id in state.completed_lesson_ids)
    completion_percentage = round((completed_lessons / total_lessons) * 100, 2) if total_lessons else 0
    return completed_lessons, total_lessons, completion_percentage


def get_next_lesson_in_module(module: CourseModule, user, state: ContentAccessState):
    for lesson in _published_module_lessons(module):
        locked, _ = get_lesson_lock_state(user, lesson, state)
        if locked:
            continue
        if lesson.id not in state.completed_lesson_ids:
            return lesson
    return None


def get_continue_learning_lesson(user, course=None, state: Optional[ContentAccessState] = None):
    if not user.is_authenticated:
        return None

    state = state or build_content_access_state(user, course=course)
    lessons_queryset = Lesson.objects.filter(Q(is_published=True) | Q(is_free_preview=True))
    if course is not None:
        lessons_queryset = lessons_queryset.filter(module__course=course)

    ordered_lessons = list(lessons_queryset.select_related("module", "module__course").order_by("module__order", "order", "id"))

    in_progress = []
    for lesson in ordered_lessons:
        locked, _ = get_lesson_lock_state(user, lesson, state)
        if locked:
            continue
        progress = state.progress_map.get(lesson.id)
        if progress and not progress.is_completed and progress.completion_percentage > 0:
            in_progress.append((progress.last_accessed, lesson))

    if in_progress:
        in_progress.sort(key=lambda item: item[0], reverse=True)
        return in_progress[0][1]

    for lesson in ordered_lessons:
        locked, _ = get_lesson_lock_state(user, lesson, state)
        if not locked and lesson.id not in state.completed_lesson_ids:
            return lesson

    return None

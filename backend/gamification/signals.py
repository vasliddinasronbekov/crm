"""
Gamification Signals

Auto-award XP, badges, and track achievements based on user actions
"""

from django.db.models.signals import post_save
from django.dispatch import receiver, Signal
from django.contrib.auth import get_user_model
from .models import (
    UserLevel, UserBadge, Badge, UserAchievement,
    Achievement, DailyChallenge, UserDailyChallenge
)
from django.utils import timezone

User = get_user_model()

# Custom signals
lesson_completed = Signal()  # providing_args=["user", "lesson"]
quiz_completed = Signal()  # providing_args=["user", "quiz", "score"]
assignment_submitted = Signal()  # providing_args=["user", "assignment"]
course_completed = Signal()  # providing_args=["user", "course"]


@receiver(post_save, sender=User)
def create_user_level(sender, instance, created, **kwargs):
    """Create UserLevel when a new user is created"""
    if created:
        UserLevel.objects.get_or_create(user=instance)


@receiver(lesson_completed)
def handle_lesson_completed(sender, user, lesson, **kwargs):
    """Award XP and check for badges when a lesson is completed"""
    user_level, created = UserLevel.objects.get_or_create(user=user)

    # Base XP for lesson completion
    xp_amount = 20
    user_level.add_xp(xp_amount, reason=f"Completed lesson: {lesson.title}")

    # Update streak
    user_level.update_streak()

    # Update daily challenges
    update_daily_challenge_progress(user, 'lessons', 1)

    # Check for lesson completion badges
    check_lesson_milestones(user)


@receiver(quiz_completed)
def handle_quiz_completed(sender, user, quiz, score, **kwargs):
    """Award XP based on quiz performance"""
    user_level, created = UserLevel.objects.get_or_create(user=user)

    # XP based on score (10-50 XP)
    xp_amount = int(10 + (score / 100 * 40))
    user_level.add_xp(xp_amount, reason=f"Completed quiz: {quiz.title} ({score}%)")

    # Bonus for perfect score
    if score == 100:
        user_level.add_xp(25, reason="Perfect quiz score bonus!")
        update_daily_challenge_progress(user, 'perfect_score', 1)

    update_daily_challenge_progress(user, 'quiz', 1)

    # Check for quiz-related badges
    check_quiz_achievements(user, score)


@receiver(assignment_submitted)
def handle_assignment_submitted(sender, user, assignment, **kwargs):
    """Award XP for assignment submission"""
    user_level, created = UserLevel.objects.get_or_create(user=user)

    xp_amount = 30
    user_level.add_xp(xp_amount, reason=f"Submitted assignment: {assignment.title}")

    # Update daily challenges
    update_daily_challenge_progress(user, 'social', 1)  # Adjust as needed


@receiver(course_completed)
def handle_course_completed(sender, user, course, **kwargs):
    """Award significant XP and check for course completion badges"""
    user_level, created = UserLevel.objects.get_or_create(user=user)

    xp_amount = 200
    user_level.add_xp(xp_amount, reason=f"Completed course: {course.name}")

    # Check for course completion badges and achievements
    check_course_milestones(user)


def update_daily_challenge_progress(user, challenge_type, increment=1):
    """Update progress on relevant daily challenges"""
    today = timezone.now().date()

    # Get today's challenges of this type
    challenges = UserDailyChallenge.objects.filter(
        user=user,
        date_assigned=today,
        challenge__challenge_type=challenge_type,
        is_completed=False
    )

    for user_challenge in challenges:
        user_challenge.update_progress(increment)


def check_lesson_milestones(user):
    """Check if user has earned lesson-based badges"""
    from student_profile.models import StudentProgress

    # Count completed lessons
    completed_lessons = StudentProgress.objects.filter(
        student=user,
        lesson__isnull=False,
        is_completed=True
    ).count()

    # Check for milestone badges
    milestones = {
        10: 'first_10_lessons',
        50: 'first_50_lessons',
        100: 'century_learner',
        500: 'dedicated_scholar'
    }

    for count, badge_slug in milestones.items():
        if completed_lessons >= count:
            try:
                badge = Badge.objects.get(criteria__slug=badge_slug)
                UserBadge.objects.get_or_create(
                    user=user,
                    badge=badge,
                    defaults={'earned_for': f'Completed {count} lessons'}
                )
            except Badge.DoesNotExist:
                pass


def check_quiz_achievements(user, score):
    """Check for quiz-related achievements"""
    from student_profile.models import QuizAttempt

    # Count perfect scores
    if score == 100:
        perfect_scores = QuizAttempt.objects.filter(
            student=user,
            percentage_score=100
        ).count()

        # Award perfectionist badge at 10 perfect scores
        if perfect_scores >= 10:
            try:
                badge = Badge.objects.get(criteria__slug='perfectionist')
                UserBadge.objects.get_or_create(
                    user=user,
                    badge=badge,
                    defaults={'earned_for': '10 perfect quiz scores'}
                )
            except Badge.DoesNotExist:
                pass


def check_course_milestones(user):
    """Check for course completion badges"""
    from student_profile.models import StudentProgress

    completed_courses = StudentProgress.objects.filter(
        student=user,
        course__isnull=False,
        is_completed=True
    ).values('course').distinct().count()

    milestones = {
        1: 'first_course_complete',
        5: 'knowledge_seeker',
        10: 'learning_master'
    }

    for count, badge_slug in milestones.items():
        if completed_courses >= count:
            try:
                badge = Badge.objects.get(criteria__slug=badge_slug)
                UserBadge.objects.get_or_create(
                    user=user,
                    badge=badge,
                    defaults={'earned_for': f'Completed {count} courses'}
                )
            except Badge.DoesNotExist:
                pass


def assign_daily_challenges(user):
    """Assign 3 daily challenges to a user"""
    from random import sample

    today = timezone.now().date()
    day_of_week = str(today.weekday() + 1)  # 1-7

    # Check if already assigned
    existing = UserDailyChallenge.objects.filter(
        user=user,
        date_assigned=today
    ).count()

    if existing >= 3:
        return

    # Get active challenges for today
    available_challenges = DailyChallenge.objects.filter(
        is_active=True,
        available_days__contains=day_of_week
    )

    if available_challenges.count() < 3:
        available_challenges = DailyChallenge.objects.filter(is_active=True)

    # Pick 3 random challenges (one of each difficulty if possible)
    challenges_to_assign = []
    for difficulty in ['easy', 'medium', 'hard']:
        challenges = available_challenges.filter(difficulty=difficulty)
        if challenges.exists():
            challenges_to_assign.append(challenges.order_by('?').first())

    # If we don't have 3, fill with random ones
    while len(challenges_to_assign) < 3 and available_challenges.exists():
        challenge = available_challenges.order_by('?').first()
        if challenge not in challenges_to_assign:
            challenges_to_assign.append(challenge)

    # Create assignments
    for challenge in challenges_to_assign:
        UserDailyChallenge.objects.get_or_create(
            user=user,
            challenge=challenge,
            date_assigned=today
        )

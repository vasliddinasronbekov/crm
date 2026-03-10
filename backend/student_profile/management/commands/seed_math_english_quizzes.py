"""
Seed math and English quizzes (easy/medium/hard) for LMS operations.

Usage:
  python manage.py seed_math_english_quizzes
  python manage.py seed_math_english_quizzes --subject english
  python manage.py seed_math_english_quizzes --replace-existing
"""

from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from student_profile.content_models import CourseModule
from student_profile.models import Course
from student_profile.quiz_models import Question, QuestionOption, Quiz
from users.models import User


@dataclass(frozen=True)
class QuestionSeed:
    question_type: str
    question_text: str
    points: int
    explanation: str
    options: list[tuple[str, bool]]


def _true_false_options(answer_is_true: bool) -> list[tuple[str, bool]]:
    return [('True', answer_is_true), ('False', not answer_is_true)]


QUIZ_BLUEPRINTS: dict[str, dict[str, object]] = {
    'english': {
        'course_name': 'English Language Mastery',
        'module_name': 'English Placement Assessments',
        'quizzes': {
            'easy': {
                'title': 'English Foundations - Easy',
                'description': 'Basic vocabulary and grammar checks for beginner students.',
                'quiz_type': 'practice',
                'time_limit_minutes': 15,
                'passing_score': 60,
                'questions': [
                    QuestionSeed('multiple_choice', 'Choose the correct plural: "woman"', 1, '"Woman" becomes "women" in plural.', [('womans', False), ('women', True), ('womanes', False), ('womens', False)]),
                    QuestionSeed('multiple_choice', 'Select the correct sentence.', 1, 'The subject "He" takes "is".', [('He are at school.', False), ('He is at school.', True), ('He am at school.', False), ('He be at school.', False)]),
                    QuestionSeed('multiple_choice', 'What is the opposite of "early"?', 1, '"Late" is the opposite of "early".', [('before', False), ('late', True), ('quick', False), ('soon', False)]),
                    QuestionSeed('true_false', 'The sentence "I has a pen." is grammatically correct.', 1, 'With "I", use "have", not "has".', _true_false_options(False)),
                    QuestionSeed('multiple_choice', 'Choose the correct article: "__ orange"', 1, 'Use "an" before vowel sounds.', [('a', False), ('an', True), ('the', False), ('no article', False)]),
                ],
            },
            'medium': {
                'title': 'English Communication - Medium',
                'description': 'Intermediate grammar and usage for ongoing groups.',
                'quiz_type': 'graded',
                'time_limit_minutes': 20,
                'passing_score': 70,
                'questions': [
                    QuestionSeed('multiple_choice', 'Choose the correct present perfect sentence.', 2, 'Present perfect is "has/have + past participle".', [('She has went home.', False), ('She has gone home.', True), ('She had gone home.', False), ('She go home.', False)]),
                    QuestionSeed('multiple_choice', 'Pick the best synonym for "reliable".', 2, '"Dependable" means reliable.', [('careless', False), ('dependable', True), ('fragile', False), ('confused', False)]),
                    QuestionSeed('multiple_choice', 'Identify the passive sentence.', 2, 'Passive: object + be + past participle.', [('The chef cooks dinner.', False), ('Dinner was cooked by the chef.', True), ('The chef is cooking dinner.', False), ('The chef cooked dinner.', False)]),
                    QuestionSeed('true_false', 'In English, adverbs can modify verbs.', 2, 'Adverbs often modify verbs, adjectives, or other adverbs.', _true_false_options(True)),
                    QuestionSeed('multiple_choice', 'Complete: "If I ____ enough money, I would travel more."', 2, 'Second conditional uses past simple in the if-clause.', [('have', False), ('had', True), ('will have', False), ('has', False)]),
                ],
            },
            'hard': {
                'title': 'English Mastery - Hard',
                'description': 'Advanced grammar, nuance, and contextual usage.',
                'quiz_type': 'exam',
                'time_limit_minutes': 30,
                'passing_score': 75,
                'questions': [
                    QuestionSeed('multiple_choice', 'Select the sentence with correct inversion.', 3, 'Negative adverbials trigger inversion in formal English.', [('Rarely I have seen such discipline.', False), ('Rarely have I seen such discipline.', True), ('Rarely seen I such discipline.', False), ('Have I rarely seen such discipline.', False)]),
                    QuestionSeed('multiple_choice', 'Choose the best replacement for: "The plan was very unique."', 3, '"Unique" is absolute; avoid "very unique".', [('The plan was unusual.', False), ('The plan was unique.', True), ('The plan was mostly unique.', False), ('The plan was little unique.', False)]),
                    QuestionSeed('multiple_choice', 'Identify the clause type in: "What she suggested surprised everyone."', 3, '"What she suggested" is a noun clause functioning as subject.', [('Adverbial clause', False), ('Relative clause', False), ('Noun clause', True), ('Conditional clause', False)]),
                    QuestionSeed('true_false', 'Subjunctive mood is used in: "It is essential that he be informed."', 3, 'The base verb "be" shows subjunctive usage.', _true_false_options(True)),
                    QuestionSeed('multiple_choice', 'Pick the most precise transition: "The sample size was limited; ____, the conclusions remain tentative."', 3, '"therefore" signals logical consequence from limited data.', [('nevertheless', False), ('therefore', True), ('meanwhile', False), ('similarly', False)]),
                ],
            },
        },
    },
    'math': {
        'course_name': 'Mathematics Core Program',
        'module_name': 'Math Placement Assessments',
        'quizzes': {
            'easy': {
                'title': 'Mathematics Basics - Easy',
                'description': 'Arithmetic fluency checks for new learners.',
                'quiz_type': 'practice',
                'time_limit_minutes': 15,
                'passing_score': 60,
                'questions': [
                    QuestionSeed('multiple_choice', 'What is 14 + 9?', 1, '14 + 9 = 23.', [('21', False), ('22', False), ('23', True), ('24', False)]),
                    QuestionSeed('multiple_choice', 'What is 7 × 8?', 1, '7 multiplied by 8 is 56.', [('48', False), ('54', False), ('56', True), ('64', False)]),
                    QuestionSeed('multiple_choice', 'Solve: 45 - 18', 1, '45 - 18 = 27.', [('25', False), ('27', True), ('29', False), ('31', False)]),
                    QuestionSeed('true_false', 'The number 37 is odd.', 1, 'Numbers ending with 1,3,5,7,9 are odd.', _true_false_options(True)),
                    QuestionSeed('multiple_choice', 'If a notebook costs 12,000 so\'m, how much do 3 notebooks cost?', 1, '12,000 × 3 = 36,000 so\'m.', [('24,000', False), ('30,000', False), ('36,000', True), ('42,000', False)]),
                ],
            },
            'medium': {
                'title': 'Mathematics Applied - Medium',
                'description': 'Algebra and proportional reasoning at intermediate level.',
                'quiz_type': 'graded',
                'time_limit_minutes': 25,
                'passing_score': 70,
                'questions': [
                    QuestionSeed('multiple_choice', 'Solve for x: 3x + 7 = 25', 2, '3x = 18 so x = 6.', [('4', False), ('5', False), ('6', True), ('7', False)]),
                    QuestionSeed('multiple_choice', 'If y = 2x - 3 and x = 5, what is y?', 2, 'y = 2(5) - 3 = 7.', [('5', False), ('6', False), ('7', True), ('8', False)]),
                    QuestionSeed('multiple_choice', 'A class has 12 boys and 18 girls. What is the ratio of boys to girls?', 2, '12:18 simplifies to 2:3.', [('2:3', True), ('3:2', False), ('12:30', False), ('5:3', False)]),
                    QuestionSeed('true_false', 'The expression (a + b)^2 equals a^2 + b^2.', 2, 'Correct expansion is a^2 + 2ab + b^2.', _true_false_options(False)),
                    QuestionSeed('multiple_choice', 'What is 15% of 240?', 2, '10% is 24 and 5% is 12, total 36.', [('30', False), ('34', False), ('36', True), ('38', False)]),
                ],
            },
            'hard': {
                'title': 'Mathematics Problem Solving - Hard',
                'description': 'Advanced algebraic and reasoning-heavy problems.',
                'quiz_type': 'exam',
                'time_limit_minutes': 35,
                'passing_score': 75,
                'questions': [
                    QuestionSeed('multiple_choice', 'Solve: 2x^2 - 7x + 3 = 0', 3, 'Factor to (2x-1)(x-3)=0, roots are 1/2 and 3.', [('x = 1 and x = 3', False), ('x = 1/2 and x = 3', True), ('x = -1/2 and x = -3', False), ('x = 2 and x = 3', False)]),
                    QuestionSeed('multiple_choice', 'If f(x)=x^2-4x+1, find f(6).', 3, 'f(6)=36-24+1=13.', [('9', False), ('11', False), ('13', True), ('15', False)]),
                    QuestionSeed('multiple_choice', 'A sequence starts 5, 11, 17, ... What is the 10th term?', 3, 'Arithmetic sequence with d=6: a_n=5+(n-1)6, so a_10=59.', [('53', False), ('55', False), ('59', True), ('65', False)]),
                    QuestionSeed('true_false', 'If two triangles are similar, their corresponding angles are equal.', 3, 'This is the defining property of similarity.', _true_false_options(True)),
                    QuestionSeed('multiple_choice', 'A rectangle has area 96 and perimeter 40. What are its side lengths?', 3, 'Let sides be a,b: ab=96 and a+b=20 -> 12 and 8.', [('10 and 10', False), ('12 and 8', True), ('14 and 6', False), ('16 and 4', False)]),
                ],
            },
        },
    },
}


class Command(BaseCommand):
    help = 'Seed math and English quizzes with easy/medium/hard levels.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--subject',
            choices=['all', 'english', 'math'],
            default='all',
            help='Seed only a single subject or all subjects.',
        )
        parser.add_argument(
            '--replace-existing',
            action='store_true',
            help='Replace questions/settings for quizzes that already exist.',
        )
        parser.add_argument(
            '--publish',
            action='store_true',
            help='Publish generated quizzes immediately.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        subject_filter = options['subject']
        replace_existing = bool(options['replace_existing'])
        publish = bool(options['publish'])

        created_by = User.objects.filter(is_staff=True).order_by('id').first()
        if not created_by:
            self.stdout.write(self.style.ERROR('No staff user found. Create at least one staff user first.'))
            return

        selected_subjects = (
            [subject_filter]
            if subject_filter in {'english', 'math'}
            else ['english', 'math']
        )

        created_count = 0
        updated_count = 0

        for subject_key in selected_subjects:
            subject_payload = QUIZ_BLUEPRINTS[subject_key]
            course = self._get_or_create_course(subject_payload)
            module = self._get_or_create_module(course, subject_payload)

            quizzes_by_level = subject_payload['quizzes']
            for level, quiz_payload in quizzes_by_level.items():
                created, updated = self._upsert_quiz(
                    course=course,
                    module=module,
                    created_by=created_by,
                    subject=subject_key,
                    difficulty_level=level,
                    quiz_payload=quiz_payload,
                    replace_existing=replace_existing,
                    publish=publish,
                )
                created_count += int(created)
                updated_count += int(updated)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Quiz seeding completed.'))
        self.stdout.write(self.style.SUCCESS(f'Created: {created_count}'))
        self.stdout.write(self.style.SUCCESS(f'Updated: {updated_count}'))
        self.stdout.write('')
        self.stdout.write('Run this on VPS:')
        self.stdout.write(self.style.WARNING('  python manage.py seed_math_english_quizzes --publish'))
        self.stdout.write(self.style.WARNING('  python manage.py seed_math_english_quizzes --subject english --replace-existing --publish'))

    def _get_or_create_course(self, subject_payload):
        course_name = subject_payload['course_name']
        defaults = {
            'description': f'{course_name} - seeded for LMS quiz operations.',
            'price': 45000000,
            'duration_months': 6,
            'is_published': True,
        }
        course, _ = Course.objects.get_or_create(name=course_name, defaults=defaults)
        return course

    def _get_or_create_module(self, course: Course, subject_payload):
        module_name = subject_payload['module_name']
        module, _ = CourseModule.objects.get_or_create(
            course=course,
            title=module_name,
            defaults={
                'description': 'Auto-seeded assessment module.',
                'order': 1,
                'is_published': True,
            },
        )
        return module

    def _upsert_quiz(
        self,
        *,
        course: Course,
        module: CourseModule,
        created_by: User,
        subject: str,
        difficulty_level: str,
        quiz_payload: dict[str, object],
        replace_existing: bool,
        publish: bool,
    ):
        title = quiz_payload['title']
        quiz, created = Quiz.objects.get_or_create(
            course=course,
            title=title,
            defaults={
                'module': module,
                'description': quiz_payload['description'],
                'quiz_type': quiz_payload['quiz_type'],
                'subject': subject,
                'difficulty_level': difficulty_level,
                'time_limit_minutes': quiz_payload['time_limit_minutes'],
                'passing_score': quiz_payload['passing_score'],
                'show_correct_answers': True,
                'shuffle_questions': True,
                'shuffle_answers': True,
                'max_attempts': 0,
                'allow_review': True,
                'available_from': timezone.now(),
                'is_published': publish,
                'created_by': created_by,
            },
        )

        should_update_questions = created or replace_existing
        updated = False

        if not created and replace_existing:
            quiz.module = module
            quiz.description = quiz_payload['description']
            quiz.quiz_type = quiz_payload['quiz_type']
            quiz.subject = subject
            quiz.difficulty_level = difficulty_level
            quiz.time_limit_minutes = quiz_payload['time_limit_minutes']
            quiz.passing_score = quiz_payload['passing_score']
            quiz.show_correct_answers = True
            quiz.shuffle_questions = True
            quiz.shuffle_answers = True
            quiz.max_attempts = 0
            quiz.allow_review = True
            quiz.is_published = publish
            quiz.save()
            updated = True

        if should_update_questions:
            quiz.questions.all().delete()
            for index, question_seed in enumerate(quiz_payload['questions'], start=1):
                question = Question.objects.create(
                    quiz=quiz,
                    question_type=question_seed.question_type,
                    question_text=question_seed.question_text,
                    explanation=question_seed.explanation,
                    points=question_seed.points,
                    order=index,
                    is_required=True,
                )
                for option_index, (option_text, is_correct) in enumerate(question_seed.options, start=1):
                    QuestionOption.objects.create(
                        question=question,
                        option_text=option_text,
                        is_correct=is_correct,
                        order=option_index,
                    )

        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created quiz: {quiz.title}'))
        elif updated:
            self.stdout.write(self.style.WARNING(f'↺ Updated quiz: {quiz.title}'))
        else:
            self.stdout.write(f'• Skipped existing quiz: {quiz.title}')

        return created, updated

"""
Create English Language Quizzes with Easy, Medium, and Hard levels
Run with: python manage.py shell < scripts/create_english_quizzes.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from django.utils import timezone
from student_profile.models import Course
from student_profile.quiz_models import Quiz, Question, QuestionOption
from users.models import User

def create_english_quizzes():
    """Create comprehensive English quizzes for all levels"""

    # Get or create English course
    try:
        english_course = Course.objects.filter(name__icontains='English').first()
        if not english_course:
            # Create a default English course
            admin_user = User.objects.filter(is_staff=True).first()
            english_course = Course.objects.create(
                name='English Language',
                description='Comprehensive English language learning course',
                created_by=admin_user,
                is_published=True
            )
            print(f"✓ Created English course: {english_course.name}")
        else:
            print(f"✓ Using existing course: {english_course.name}")
    except Exception as e:
        print(f"✗ Error creating course: {e}")
        return

    admin_user = User.objects.filter(is_staff=True).first()

    # ==================== EASY LEVEL QUIZ ====================
    easy_quiz_data = {
        'title': 'English Basics - Easy Level',
        'description': 'Beginner level English quiz covering basic grammar and vocabulary',
        'quiz_type': 'practice',
        'time_limit_minutes': 15,
        'passing_score': 60,
        'show_correct_answers': True,
        'shuffle_questions': True,
        'shuffle_answers': True,
        'max_attempts': 0,  # Unlimited
        'is_published': True,
        'questions': [
            {
                'text': 'What is the correct plural form of "child"?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'childs', 'correct': False},
                    {'text': 'children', 'correct': True},
                    {'text': 'childes', 'correct': False},
                    {'text': 'child', 'correct': False},
                ],
                'explanation': 'The plural of "child" is "children", an irregular plural form.'
            },
            {
                'text': 'Choose the correct verb: She ___ to school every day.',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'go', 'correct': False},
                    {'text': 'goes', 'correct': True},
                    {'text': 'going', 'correct': False},
                    {'text': 'gone', 'correct': False},
                ],
                'explanation': 'With third person singular (she, he, it), we add "s" to the verb in present simple.'
            },
            {
                'text': 'What is the opposite of "hot"?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'warm', 'correct': False},
                    {'text': 'cool', 'correct': False},
                    {'text': 'cold', 'correct': True},
                    {'text': 'wet', 'correct': False},
                ],
                'explanation': 'The opposite (antonym) of "hot" is "cold".'
            },
            {
                'text': '"I am happy" is a correct English sentence.',
                'type': 'true_false',
                'points': 1,
                'options': [
                    {'text': 'True', 'correct': True},
                    {'text': 'False', 'correct': False},
                ],
                'explanation': 'This is correct! "I am happy" uses proper subject-verb-adjective structure.'
            },
            {
                'text': 'Which word is a verb?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'beautiful', 'correct': False},
                    {'text': 'quickly', 'correct': False},
                    {'text': 'run', 'correct': True},
                    {'text': 'happiness', 'correct': False},
                ],
                'explanation': '"Run" is a verb (action word). Beautiful is an adjective, quickly is an adverb, and happiness is a noun.'
            },
            {
                'text': 'Complete the sentence: ___ name is John.',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'He', 'correct': False},
                    {'text': 'His', 'correct': True},
                    {'text': 'Him', 'correct': False},
                    {'text': 'He\'s', 'correct': False},
                ],
                'explanation': '"His" is the possessive form showing ownership of the name.'
            },
            {
                'text': 'What is the past tense of "eat"?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'eated', 'correct': False},
                    {'text': 'ate', 'correct': True},
                    {'text': 'eaten', 'correct': False},
                    {'text': 'eating', 'correct': False},
                ],
                'explanation': '"Ate" is the simple past tense of "eat". "Eaten" is the past participle.'
            },
            {
                'text': 'The word "cat" has three letters.',
                'type': 'true_false',
                'points': 1,
                'options': [
                    {'text': 'True', 'correct': True},
                    {'text': 'False', 'correct': False},
                ],
                'explanation': 'Yes! C-A-T has three letters.'
            },
            {
                'text': 'Which article should go before "apple"?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'a', 'correct': False},
                    {'text': 'an', 'correct': True},
                    {'text': 'the', 'correct': False},
                    {'text': 'no article needed', 'correct': False},
                ],
                'explanation': 'We use "an" before words starting with vowel sounds (a, e, i, o, u).'
            },
            {
                'text': 'What color do you get when you mix blue and yellow?',
                'type': 'multiple_choice',
                'points': 1,
                'options': [
                    {'text': 'red', 'correct': False},
                    {'text': 'green', 'correct': True},
                    {'text': 'purple', 'correct': False},
                    {'text': 'orange', 'correct': False},
                ],
                'explanation': 'Blue + Yellow = Green'
            },
        ]
    }

    # ==================== MEDIUM LEVEL QUIZ ====================
    medium_quiz_data = {
        'title': 'English Intermediate - Medium Level',
        'description': 'Intermediate English quiz covering grammar, vocabulary, and comprehension',
        'quiz_type': 'graded',
        'time_limit_minutes': 20,
        'passing_score': 70,
        'show_correct_answers': True,
        'shuffle_questions': True,
        'shuffle_answers': True,
        'max_attempts': 3,
        'is_published': True,
        'questions': [
            {
                'text': 'Which sentence uses the present perfect tense correctly?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'I have went to Paris last year.', 'correct': False},
                    {'text': 'I have been to Paris before.', 'correct': True},
                    {'text': 'I had went to Paris.', 'correct': False},
                    {'text': 'I am been to Paris.', 'correct': False},
                ],
                'explanation': 'Present perfect uses "have/has + past participle". "Been" is the past participle of "be".'
            },
            {
                'text': 'Identify the conditional sentence: "If I had known, I would have helped."',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'Zero conditional', 'correct': False},
                    {'text': 'First conditional', 'correct': False},
                    {'text': 'Second conditional', 'correct': False},
                    {'text': 'Third conditional', 'correct': True},
                ],
                'explanation': 'Third conditional discusses hypothetical past situations: "If + past perfect, would have + past participle".'
            },
            {
                'text': 'What is a synonym for "enormous"?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'tiny', 'correct': False},
                    {'text': 'huge', 'correct': True},
                    {'text': 'average', 'correct': False},
                    {'text': 'narrow', 'correct': False},
                ],
                'explanation': 'Both "enormous" and "huge" mean very large or gigantic.'
            },
            {
                'text': 'Which sentence demonstrates correct use of a phrasal verb?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'She turned the offer down.', 'correct': True},
                    {'text': 'She turned down the offer.', 'correct': True},
                    {'text': 'She turned offer the down.', 'correct': False},
                    {'text': 'Both A and B are correct', 'correct': True},
                ],
                'explanation': 'Phrasal verbs can often be separated: "turn down" means to refuse or reject.'
            },
            {
                'text': 'Choose the sentence with correct passive voice:',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'The book was wrote by her.', 'correct': False},
                    {'text': 'The book was written by her.', 'correct': True},
                    {'text': 'The book were written by her.', 'correct': False},
                    {'text': 'The book written by her.', 'correct': False},
                ],
                'explanation': 'Passive voice: be + past participle. "Written" is the past participle of "write".'
            },
            {
                'text': 'What does the idiom "break the ice" mean?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'To break something frozen', 'correct': False},
                    {'text': 'To make people feel more comfortable', 'correct': True},
                    {'text': 'To interrupt someone', 'correct': False},
                    {'text': 'To start a fight', 'correct': False},
                ],
                'explanation': '"Break the ice" means to initiate conversation or make people feel relaxed in social situations.'
            },
            {
                'text': 'Relative pronouns can never be omitted in English.',
                'type': 'true_false',
                'points': 2,
                'options': [
                    {'text': 'True', 'correct': False},
                    {'text': 'False', 'correct': True},
                ],
                'explanation': 'False! In defining relative clauses where the relative pronoun is the object, it can be omitted (e.g., "The book [that] I read").'
            },
            {
                'text': 'Which word is spelled correctly?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'recieve', 'correct': False},
                    {'text': 'recive', 'correct': False},
                    {'text': 'receive', 'correct': True},
                    {'text': 'receieve', 'correct': False},
                ],
                'explanation': 'Remember: "i before e except after c" - receive is spelled correctly.'
            },
            {
                'text': 'Identify the gerund in: "Swimming is my favorite activity."',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'Swimming', 'correct': True},
                    {'text': 'is', 'correct': False},
                    {'text': 'favorite', 'correct': False},
                    {'text': 'activity', 'correct': False},
                ],
                'explanation': 'A gerund is a verb form ending in -ing that functions as a noun. "Swimming" is the gerund here.'
            },
            {
                'text': 'What is the superlative form of "good"?',
                'type': 'multiple_choice',
                'points': 2,
                'options': [
                    {'text': 'gooder', 'correct': False},
                    {'text': 'goodest', 'correct': False},
                    {'text': 'better', 'correct': False},
                    {'text': 'best', 'correct': True},
                ],
                'explanation': 'Good → Better (comparative) → Best (superlative). It\'s an irregular form.'
            },
        ]
    }

    # ==================== HARD LEVEL QUIZ ====================
    hard_quiz_data = {
        'title': 'English Advanced - Hard Level',
        'description': 'Advanced English quiz for proficient learners covering complex grammar, idioms, and nuanced usage',
        'quiz_type': 'exam',
        'time_limit_minutes': 30,
        'passing_score': 80,
        'show_correct_answers': False,  # Don't show answers immediately for exams
        'shuffle_questions': True,
        'shuffle_answers': True,
        'max_attempts': 2,
        'is_published': True,
        'questions': [
            {
                'text': 'Which sentence correctly uses the subjunctive mood?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'I wish I was taller.', 'correct': False},
                    {'text': 'I wish I were taller.', 'correct': True},
                    {'text': 'I wish I am taller.', 'correct': False},
                    {'text': 'I wish I would be taller.', 'correct': False},
                ],
                'explanation': 'The subjunctive mood uses "were" for all persons when expressing wishes or hypothetical situations.'
            },
            {
                'text': 'Identify the sentence with correct parallel structure:',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'She likes hiking, to swim, and biking.', 'correct': False},
                    {'text': 'She likes hiking, swimming, and to bike.', 'correct': False},
                    {'text': 'She likes hiking, swimming, and biking.', 'correct': True},
                    {'text': 'She likes to hike, swimming, and biking.', 'correct': False},
                ],
                'explanation': 'Parallel structure requires consistent grammatical form. All gerunds (-ing) maintain parallelism.'
            },
            {
                'text': 'What does the idiom "to pull someone\'s leg" mean?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'To physically pull their leg', 'correct': False},
                    {'text': 'To help someone up', 'correct': False},
                    {'text': 'To joke or tease someone', 'correct': True},
                    {'text': 'To trip someone', 'correct': False},
                ],
                'explanation': '"Pulling someone\'s leg" means to joke with them or tell them something untrue in a playful way.'
            },
            {
                'text': 'Which sentence demonstrates correct use of the future perfect continuous tense?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'By next year, I will have been working here for ten years.', 'correct': True},
                    {'text': 'By next year, I will be working here for ten years.', 'correct': False},
                    {'text': 'By next year, I will have worked here for ten years.', 'correct': False},
                    {'text': 'By next year, I had been working here for ten years.', 'correct': False},
                ],
                'explanation': 'Future perfect continuous: "will have been + -ing" describes an action continuing up to a future point.'
            },
            {
                'text': 'Cleft sentences are used to add emphasis in English.',
                'type': 'true_false',
                'points': 3,
                'options': [
                    {'text': 'True', 'correct': True},
                    {'text': 'False', 'correct': False},
                ],
                'explanation': 'True! Cleft sentences (e.g., "It was John who broke the window") emphasize specific information.'
            },
            {
                'text': 'Which word best completes: "The politician\'s speech was full of ___, deliberately ambiguous to avoid commitment."',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'rhetoric', 'correct': False},
                    {'text': 'equivocation', 'correct': True},
                    {'text': 'eloquence', 'correct': False},
                    {'text': 'platitudes', 'correct': False},
                ],
                'explanation': '"Equivocation" means using ambiguous language to conceal the truth or avoid commitment.'
            },
            {
                'text': 'Identify the dangling modifier: "Walking down the street, the trees were beautiful."',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'walking', 'correct': False},
                    {'text': 'the street', 'correct': False},
                    {'text': 'Walking down the street', 'correct': True},
                    {'text': 'There is no dangling modifier', 'correct': False},
                ],
                'explanation': 'The phrase "Walking down the street" dangles because it doesn\'t clearly modify a subject (trees can\'t walk).'
            },
            {
                'text': 'Which sentence uses "whom" correctly?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'Whom is going to the party?', 'correct': False},
                    {'text': 'To whom did you give the book?', 'correct': True},
                    {'text': 'Whom wants ice cream?', 'correct': False},
                    {'text': 'The person whom called is here.', 'correct': False},
                ],
                'explanation': '"Whom" is used as an object. "To whom" is correct as it follows a preposition and acts as the object.'
            },
            {
                'text': 'What literary device is used in "The pen is mightier than the sword"?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'Simile', 'correct': False},
                    {'text': 'Metaphor', 'correct': False},
                    {'text': 'Metonymy', 'correct': True},
                    {'text': 'Personification', 'correct': False},
                ],
                'explanation': 'Metonymy uses a related word to represent something (pen = writing/words, sword = violence/military power).'
            },
            {
                'text': 'Which sentence demonstrates correct use of inversion for emphasis?',
                'type': 'multiple_choice',
                'points': 3,
                'options': [
                    {'text': 'Never I have seen such beauty.', 'correct': False},
                    {'text': 'Never have I seen such beauty.', 'correct': True},
                    {'text': 'I never have seen such beauty.', 'correct': False},
                    {'text': 'I have never seen such beauty.', 'correct': False},
                ],
                'explanation': 'After negative adverbs like "never" at the start, we invert subject and auxiliary: "Never have I..."'
            },
        ]
    }

    # Create quizzes
    quiz_datasets = [
        ('Easy', easy_quiz_data),
        ('Medium', medium_quiz_data),
        ('Hard', hard_quiz_data)
    ]

    created_count = 0
    for level, quiz_data in quiz_datasets:
        try:
            # Check if quiz already exists
            existing_quiz = Quiz.objects.filter(
                course=english_course,
                title=quiz_data['title']
            ).first()

            if existing_quiz:
                print(f"⚠ {level} quiz already exists: {quiz_data['title']}")
                continue

            # Create quiz
            questions_data = quiz_data.pop('questions')
            quiz = Quiz.objects.create(
                course=english_course,
                created_by=admin_user,
                **quiz_data
            )

            # Create questions and options
            for idx, q_data in enumerate(questions_data, start=1):
                options_data = q_data.pop('options')
                explanation = q_data.pop('explanation', '')

                question = Question.objects.create(
                    quiz=quiz,
                    question_type=q_data['type'],
                    question_text=q_data['text'],
                    points=q_data['points'],
                    explanation=explanation,
                    order=idx
                )

                # Create options
                for opt_idx, opt_data in enumerate(options_data, start=1):
                    QuestionOption.objects.create(
                        question=question,
                        option_text=opt_data['text'],
                        is_correct=opt_data['correct'],
                        order=opt_idx
                    )

            print(f"✓ Created {level} quiz: {quiz.title} ({len(questions_data)} questions)")
            created_count += 1

        except Exception as e:
            print(f"✗ Error creating {level} quiz: {e}")

    print(f"\n{'='*60}")
    print(f"Quiz creation complete! Created {created_count} new quizzes.")
    print(f"Total quizzes in database: {Quiz.objects.filter(course=english_course).count()}")
    print(f"{'='*60}")

if __name__ == '__main__':
    print("Starting English quiz creation...\n")
    create_english_quizzes()

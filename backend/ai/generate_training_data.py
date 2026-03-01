"""
Training Data Generator for Intent Classification
=================================================
Generates comprehensive training data from intent definitions
for training the ML classification model.

Output: intents.csv with thousands of labeled examples
"""

import csv
import random
from pathlib import Path
from .intent_config import INTENT_DEFINITIONS

# =============================================================================
# TRAINING DATA TEMPLATES
# =============================================================================

# Additional training examples per intent (beyond the examples in config)
ADDITIONAL_EXAMPLES = {
    # STUDENT INTENTS
    'student_enroll': [
        'Men kursga yozilishim kerak',
        'Kursga qanday yozilaman?',
        'Register me for the course',
        'I need to enroll',
        'Yozilish jarayoni',
        'Ro\'yxatdan o\'tmoqchiman',
    ],
    'student_schedule': [
        'Bugun dars bormi?',
        'Ertaga qaysi darslar bor?',
        'Keyingi darsim qachon?',
        'Darslar jadvali',
        'When is my next class?',
        'Class schedule please',
    ],
    'student_profile': [
        'Mening ma\'lumotlarim',
        'Profil ma\'lumotlari',
        'Account settings',
        'My information',
        'Shaxsiy ma\'lumotlar',
    ],
    'student_courses': [
        'Qaysi kurslarda o\'qiyapman?',
        'My enrolled courses',
        'Kurslarim ro\'yxati',
        'What classes am I taking?',
        'Qaysi darslarni o\'qiyapman?',
    ],
    'student_progress': [
        'Mening yutuqlarim',
        'O\'quv jarayonim',
        'How am I doing?',
        'My progress report',
        'Progressimni ko\'rsating',
    ],

    # COURSE INTENTS
    'course_catalog': [
        'Barcha kurslar',
        'Qanday kurslar mavjud?',
        'Show all courses',
        'Available courses',
        'Kurs katalogi',
        'List of courses',
    ],
    'course_details': [
        'Python kursi haqida',
        'Tell me about this course',
        'Kurs ma\'lumoti',
        'Course information',
        'Kurs tavsifi',
    ],
    'course_price': [
        'Kurs qancha turadi?',
        'Narxi',
        'How much is the course?',
        'Price',
        'To\'lov qancha?',
        'Course fee',
    ],

    # ASSESSMENT INTENTS
    'quiz_list': [
        'Qanday testlar bor?',
        'Show quizzes',
        'Available tests',
        'Testlar ro\'yxati',
        'Quiz list',
    ],
    'quiz_results': [
        'Mening natijalarim',
        'Test ballarim',
        'Show my scores',
        'My results',
        'Natijalarni ko\'rsating',
        'How did I do?',
    ],
    'quiz_start': [
        'Testni boshlash',
        'Start the quiz',
        'Begin test',
        'Test yechish',
        'Take the quiz',
    ],
    'assignment_list': [
        'Vazifalarim',
        'Homework list',
        'My assignments',
        'Topshiriqlar',
        'Show assignments',
    ],
    'grade_check': [
        'Baholarim',
        'My grades',
        'Show my marks',
        'Baholarni ko\'rsating',
        'Grade report',
    ],

    # PAYMENT INTENTS
    'payment_check': [
        'Balansingiz',
        'Qarzim qancha?',
        'Check balance',
        'My payment status',
        'To\'lov holati',
    ],
    'payment_history': [
        'To\'lov tarixi',
        'Payment history',
        'Past payments',
        'Avvalgi to\'lovlar',
        'Transaction history',
    ],
    'payment_make': [
        'To\'lov qilish',
        'Make a payment',
        'Pay tuition',
        'To\'lamoqchiman',
        'Process payment',
    ],

    # ATTENDANCE INTENTS
    'attendance_check': [
        'Davomatim',
        'My attendance',
        'Attendance record',
        'Davomat holati',
        'Show attendance',
    ],
    'attendance_mark': [
        'Men keldim',
        'Mark me present',
        'Check in',
        'Kelganman',
        'I\'m here',
    ],
    'attendance_percentage': [
        'Davomat foizim',
        'Attendance rate',
        'My attendance percentage',
        'Davomat statistikasi',
    ],

    # CRM INTENTS
    'lead_list': [
        'Lidlar ro\'yxati',
        'Show leads',
        'New prospects',
        'Yangi mijozlar',
        'Lead list',
    ],
    'lead_stats': [
        'Lid statistikasi',
        'Lead statistics',
        'CRM stats',
        'Mijozlar hisoboti',
        'Conversion rate',
    ],
    'student_count': [
        'Necha o\'quvchi bor?',
        'Student count',
        'Total students',
        'O\'quvchilar soni',
        'How many students?',
    ],
    'today_payments': [
        'Bugungi to\'lovlar',
        'Today\'s revenue',
        'Payments today',
        'Kunlik to\'lov',
        'Daily payments',
    ],

    # GREETINGS
    'greeting': [
        'Salom',
        'Hi there',
        'Assalomu alaykum',
        'Hello',
        'Hey',
        'Good morning',
        'Hayrli kun',
    ],
    'goodbye': [
        'Xayr',
        'Goodbye',
        'Bye',
        'See you',
        'Ko\'rishamiz',
        'До свидания',
    ],
    'thanks': [
        'Rahmat',
        'Thanks',
        'Thank you',
        'Tashakkur',
        'Спасибо',
        'Thanks a lot',
    ],
    'help': [
        'Yordam',
        'Help me',
        'I need help',
        'Yordam bering',
        'Assist me',
        'Support',
    ],
}

# Uzbek/Russian/English variations for augmentation
QUESTION_PREFIXES_UZ = [
    '',
    'Iltimos, ',
    'Menga ',
    'Men ',
    'Bizga ',
]

QUESTION_PREFIXES_EN = [
    '',
    'Please ',
    'Can you ',
    'Could you ',
    'I want to ',
    'I need to ',
]

QUESTION_SUFFIXES_UZ = [
    '',
    ' kerak',
    ' qilish kerak',
    ' qilib bering',
    ' iltimos',
]

QUESTION_SUFFIXES_EN = [
    '',
    ' please',
    ' now',
    ' for me',
]

# =============================================================================
# DATA GENERATION
# =============================================================================

def generate_training_data(output_path: str = None) -> int:
    """
    Generate comprehensive training data CSV

    Returns:
        Number of examples generated
    """
    if output_path is None:
        output_path = Path(__file__).parent / 'intent_data' / 'intents.csv'
    else:
        output_path = Path(output_path)

    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    examples = []

    # Generate examples for each intent
    for intent_name, config in INTENT_DEFINITIONS.items():
        # 1. Add examples from config
        for example in config.examples:
            examples.append({'text': example, 'intent': intent_name})

        # 2. Add additional examples
        additional = ADDITIONAL_EXAMPLES.get(intent_name, [])
        for example in additional:
            examples.append({'text': example, 'intent': intent_name})

        # 3. Generate variations with keywords
        for keyword in config.keywords[:10]:  # Use first 10 keywords
            # Simple variations
            examples.append({
                'text': keyword,
                'intent': intent_name
            })

            # With prefixes (Uzbek)
            for prefix in random.sample(QUESTION_PREFIXES_UZ, min(3, len(QUESTION_PREFIXES_UZ))):
                examples.append({
                    'text': f'{prefix}{keyword}',
                    'intent': intent_name
                })

            # With suffixes (Uzbek)
            for suffix in random.sample(QUESTION_SUFFIXES_UZ, min(2, len(QUESTION_SUFFIXES_UZ))):
                examples.append({
                    'text': f'{keyword}{suffix}',
                    'intent': intent_name
                })

        # 4. Generate variations with examples (English)
        for example in config.examples[:5]:
            if any(word in example.lower() for word in ['show', 'check', 'get', 'tell']):
                for prefix in random.sample(QUESTION_PREFIXES_EN, min(3, len(QUESTION_PREFIXES_EN))):
                    if prefix and not example.lower().startswith(prefix.lower().strip()):
                        examples.append({
                            'text': f'{prefix}{example}',
                            'intent': intent_name
                        })

    # Write to CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['text', 'intent'])
        writer.writeheader()
        writer.writerows(examples)

    print(f"✅ Generated {len(examples)} training examples")
    print(f"📁 Saved to: {output_path}")

    # Print statistics
    intent_counts = {}
    for example in examples:
        intent = example['intent']
        intent_counts[intent] = intent_counts.get(intent, 0) + 1

    print(f"\n📊 Examples per intent (top 10):")
    for intent, count in sorted(intent_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {intent}: {count}")

    return len(examples)


def generate_intent_report() -> str:
    """
    Generate a comprehensive report of all intents

    Returns:
        Formatted report string
    """
    from .intent_config import IntentCategory

    report = []
    report.append("="*80)
    report.append("INTENT SYSTEM REPORT")
    report.append("="*80)
    report.append(f"\nTotal Intents: {len(INTENT_DEFINITIONS)}\n")

    # Group by category
    by_category = {}
    for intent_name, config in INTENT_DEFINITIONS.items():
        category = config.category.value
        if category not in by_category:
            by_category[category] = []
        by_category[category].append((intent_name, config))

    # Print by category
    for category in sorted(by_category.keys()):
        intents = by_category[category]
        report.append(f"\n{category.upper()} ({len(intents)} intents)")
        report.append("-" * 80)

        for intent_name, config in sorted(intents, key=lambda x: x[0]):
            report.append(f"\n  📌 {intent_name}")
            report.append(f"     Description: {config.description}")
            report.append(f"     Keywords: {len(config.keywords)}")
            report.append(f"     Examples: {len(config.examples)}")
            if config.requires_entities:
                report.append(f"     Required: {', '.join(config.requires_entities)}")

    report.append("\n" + "="*80)

    return "\n".join(report)


# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate training data for intent classification')
    parser.add_argument('--output', '-o', help='Output CSV file path')
    parser.add_argument('--report', '-r', action='store_true', help='Generate intent report')

    args = parser.parse_args()

    if args.report:
        print(generate_intent_report())
    else:
        count = generate_training_data(args.output)
        print(f"\n✅ Successfully generated {count} training examples!")
        print("\nNext steps:")
        print("1. Review the generated intents.csv file")
        print("2. Train the model: python manage.py train_intent_model")
        print("3. Test the model: python manage.py test_intents")

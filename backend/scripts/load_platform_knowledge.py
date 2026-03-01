#!/usr/bin/env python3
"""
Load initial platform knowledge into the knowledge base.

This creates a foundation of knowledge about CRM, LMS, and ERP features
that the LLM can use to improve responses.

Usage:
    python scripts/load_platform_knowledge.py
    python scripts/load_platform_knowledge.py --language ru
    python scripts/load_platform_knowledge.py --from-docs /path/to/docs
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from ai.knowledge_base import KnowledgeManager, KnowledgeCategory


# Initial platform knowledge
INITIAL_KNOWLEDGE = {
    # CRM Knowledge
    KnowledgeCategory.CRM: [
        {
            "title": "Lead Management",
            "content": """The CRM system manages leads (potential students).
Features:
- Add new leads with contact information
- Track lead status (new, contacted, interested, enrolled, lost)
- Assign leads to staff members
- Track communication history
- Convert leads to students
- Lead statistics and reporting

API: POST /api/v1/crm/leads/ to create a lead
Intent: 'list_leads', 'add_lead', 'lead_stats'""",
            "keywords": ["lead", "crm", "potential student", "conversion", "sales"],
            "translations": {
                "ru": {
                    "title": "Управление лидами",
                    "content": """CRM система управляет лидами (потенциальными студентами).
Функции:
- Добавление новых лидов с контактной информацией
- Отслеживание статуса лида
- Назначение лидов сотрудникам
- История коммуникации
- Конвертация лидов в студентов
- Статистика и отчёты"""
                },
                "uz": {
                    "title": "Lidlarni boshqarish",
                    "content": """CRM tizimi lidlarni (potensial talabalarni) boshqaradi.
Funktsiyalar:
- Yangi lidlarni qo'shish
- Lid statusini kuzatish
- Lidlarni xodimlarga tayinlash
- Aloqa tarixini saqlash
- Lidlarni talabalarga aylantirish"""
                }
            }
        },
        {
            "title": "Student Management",
            "content": """Manage enrolled students in the CRM.
Features:
- Student profiles with personal information
- Group assignments
- Contact management
- Parent/guardian information
- Enrollment history
- Communication tracking

Intent: 'student_count', 'check_attendance'""",
            "keywords": ["student", "enrollment", "profile", "group"],
        }
    ],

    # LMS Knowledge
    KnowledgeCategory.LMS: [
        {
            "title": "Course Management",
            "content": """The LMS manages courses and educational content.
Features:
- Create and organize courses
- Course modules and lessons
- Course materials (videos, documents, presentations)
- Course prerequisites and requirements
- Course schedules
- Student enrollment in courses

API: GET /api/v1/student-profile/courses/ to list courses
Intent: 'enroll_course'""",
            "keywords": ["course", "lms", "curriculum", "lesson", "module"],
            "translations": {
                "ru": {
                    "title": "Управление курсами",
                    "content": """LMS управляет курсами и образовательным контентом.
Функции:
- Создание и организация курсов
- Модули и уроки
- Материалы курса
- Расписание
- Запись студентов"""
                }
            }
        },
        {
            "title": "Assignments and Quizzes",
            "content": """Students can complete assignments and take quizzes.
Features:
- Create assignments with deadlines
- Multiple question types (multiple choice, text, file upload)
- Automatic grading for quizzes
- Manual grading for assignments
- Submission tracking
- Grade management
- Feedback and comments

API: GET /api/v1/student-profile/assignments/
Intent: 'check_scores'""",
            "keywords": ["assignment", "quiz", "test", "homework", "grade", "score"],
        },
        {
            "title": "Class Schedule",
            "content": """View and manage class schedules.
Features:
- Daily/weekly/monthly schedule views
- Group schedules
- Teacher schedules
- Room assignments
- Schedule conflicts detection
- Schedule modifications

Intent: 'schedule'""",
            "keywords": ["schedule", "timetable", "class time", "jadval"],
        },
        {
            "title": "Attendance Tracking",
            "content": """Track student attendance.
Features:
- Mark attendance (present, absent, late, excused)
- Attendance reports
- Attendance percentage calculation
- Attendance history
- Absence notifications

API: GET /api/v1/student-profile/attendance/
Intent: 'check_attendance'""",
            "keywords": ["attendance", "davomat", "посещаемость", "absent", "present"],
        }
    ],

    # ERP/Payment Knowledge
    KnowledgeCategory.ERP: [
        {
            "title": "Payment Management",
            "content": """Track student payments and balances.
Features:
- Record payments
- Payment history
- Balance tracking
- Payment plans
- Payment reminders
- Invoice generation
- Receipt generation

API: GET /api/v1/crm/payments/ to view payments
Intent: 'check_payment', 'today_payments'""",
            "keywords": ["payment", "to'lov", "оплата", "balance", "invoice"],
            "translations": {
                "ru": {
                    "title": "Управление платежами",
                    "content": """Отслеживание платежей и балансов студентов.
Функции:
- Запись платежей
- История платежей
- Отслеживание баланса
- Графики платежей
- Генерация счетов"""
                },
                "uz": {
                    "title": "To'lovlarni boshqarish",
                    "content": """Talabalar to'lovlari va balanslarini kuzatish.
Funktsiyalar:
- To'lovlarni qayd qilish
- To'lov tarixi
- Balansni kuzatish
- To'lov rejalari
- Hisob-faktura yaratish"""
                }
            }
        },
        {
            "title": "Certificate Generation",
            "content": """Generate and manage student certificates.
Features:
- Certificate templates
- Automatic certificate generation upon course completion
- QR code for verification
- Digital signatures
- Certificate download
- Certificate tracking

API: POST /api/v1/task/certificates/ to generate certificate""",
            "keywords": ["certificate", "sertifikat", "сертификат", "completion", "graduation"],
        }
    ],

    # Workflows
    KnowledgeCategory.WORKFLOW: [
        {
            "title": "Student Enrollment Workflow",
            "content": """Complete workflow for enrolling a new student:
1. Lead creation (contact comes in)
2. Lead contacted (initial conversation)
3. Lead interested (wants to join)
4. Student enrollment (pay and enroll)
5. Group assignment
6. Account creation
7. Schedule assignment
8. Welcome email/SMS

The system automates many of these steps.""",
            "keywords": ["enrollment", "workflow", "process", "registration"],
        },
        {
            "title": "Payment Collection Workflow",
            "content": """Payment collection process:
1. Payment due reminder (3 days before)
2. Payment collected
3. Receipt generated
4. Balance updated
5. Student notified
6. Parent notified (if configured)
7. Payment recorded in system

Automated reminders via SMS and email.""",
            "keywords": ["payment workflow", "collection", "reminder"],
        }
    ],

    # FAQ
    KnowledgeCategory.FAQ: [
        {
            "title": "How to check my balance?",
            "content": """To check your payment balance:
- Via chat: Ask "What's my balance?" or "Balansim qancha?"
- Via API: GET /api/v1/crm/payments/balance/
- Via mobile app: Go to Profile → Payments
- Via voice: Say "Check my payment balance"

Intent: 'check_payment'""",
            "keywords": ["balance", "balans", "баланс", "payment", "how to check"],
        },
        {
            "title": "How to view my schedule?",
            "content": """To view your class schedule:
- Via chat: Ask "What's my schedule?" or "Jadvalim qanday?"
- Via API: GET /api/v1/student-profile/schedule/
- Via mobile app: Go to Schedule tab
- Via voice: Say "Show my schedule"

Intent: 'schedule'""",
            "keywords": ["schedule", "jadval", "расписание", "class time", "how to view"],
        }
    ],

    # Features
    KnowledgeCategory.FEATURE: [
        {
            "title": "Voice Control Features",
            "content": """The platform supports voice control in 3 languages:
- English: "What courses are available?"
- Russian: "Какие курсы доступны?"
- Uzbek: "Qanday kurslar mavjud?"

Supported voice commands:
- Check balance, schedule, attendance, grades
- View courses, assignments
- Ask questions about the platform
- Get help and support

Uses STT (Speech-to-Text) and TTS (Text-to-Speech).""",
            "keywords": ["voice", "ovoz", "голос", "speech", "stt", "tts"],
        },
        {
            "title": "AI Assistant Features",
            "content": """The AI assistant can help with:
- Answering questions about courses, schedules, payments
- Explaining educational concepts
- Providing study guidance
- Troubleshooting platform issues
- General information and support

Available via:
- Web chat
- Mobile app
- Voice commands
- API integration

Supports English, Russian, and Uzbek languages.""",
            "keywords": ["ai", "assistant", "chatbot", "help", "support"],
        }
    ]
}


def load_knowledge(language='en', verbose=True):
    """
    Load initial platform knowledge.

    Args:
        language: Language code ('en', 'ru', 'uz')
        verbose: Print progress
    """
    km = KnowledgeManager(language=language)
    total_loaded = 0

    for category, knowledge_list in INITIAL_KNOWLEDGE.items():
        if verbose:
            print(f"\nLoading {category} knowledge...")

        for kb_data in knowledge_list:
            title = kb_data['title']
            content = kb_data['content']
            keywords = kb_data.get('keywords', [])
            translations = kb_data.get('translations', {})

            # Load in specified language
            if language != 'en' and language in translations:
                title = translations[language].get('title', title)
                content = translations[language].get('content', content)

            try:
                kb = km.add_platform_knowledge(
                    title=title,
                    content=content,
                    category=category,
                    keywords=keywords,
                    source='initial_load',
                    verified=True
                )

                # Add translations
                if translations:
                    kb.translations = translations
                    kb.save()

                total_loaded += 1
                if verbose:
                    print(f"  ✓ {title}")

            except Exception as e:
                if verbose:
                    print(f"  ✗ Failed to load '{title}': {e}")

    if verbose:
        print(f"\n✅ Loaded {total_loaded} knowledge entries in {language}")

    return total_loaded


def load_from_docs(docs_path, language='en'):
    """
    Load knowledge from documentation files.

    Args:
        docs_path: Path to documentation directory
        language: Language code
    """
    km = KnowledgeManager(language=language)
    count = km.bulk_load_from_docs(docs_path)
    print(f"✅ Loaded {count} entries from documentation")
    return count


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Load platform knowledge for AI learning"
    )
    parser.add_argument(
        "--language",
        default="en",
        choices=["en", "ru", "uz"],
        help="Language to load knowledge in"
    )
    parser.add_argument(
        "--from-docs",
        help="Load from documentation directory"
    )
    parser.add_argument(
        "--all-languages",
        action="store_true",
        help="Load knowledge in all supported languages"
    )

    args = parser.parse_args()

    print("🧠 Platform Knowledge Loader\n")

    if args.from_docs:
        # Load from documentation
        load_from_docs(args.from_docs, args.language)
    elif args.all_languages:
        # Load in all languages
        total = 0
        for lang in ['en', 'ru', 'uz']:
            print(f"\n{'='*60}")
            print(f"Loading knowledge in {lang.upper()}")
            print(f"{'='*60}")
            total += load_knowledge(language=lang, verbose=True)

        print(f"\n✅ Total loaded: {total} knowledge entries across all languages")
    else:
        # Load in specified language
        load_knowledge(language=args.language, verbose=True)

    print("\n✨ Knowledge base ready! The LLM will now use this knowledge to improve responses.")
    print("\nTest it:")
    print("  python manage.py shell")
    print("  >>> from ai.knowledge_base import search_knowledge")
    print("  >>> search_knowledge('How to check balance?', language='en')")


if __name__ == "__main__":
    main()

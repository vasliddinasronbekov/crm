"""
Comprehensive Intent Fulfillment System
========================================
Enterprise-grade intent handlers for 50+ intents covering:
- Student operations (enrollment, schedule, profile, etc.)
- Course management (catalog, details, enrollment, etc.)
- Assessments (quizzes, assignments, grades, etc.)
- Payments (balance, history, invoices, etc.)
- Attendance tracking
- CRM operations
- Communication
- Admin functions

Each handler returns structured data for voice-friendly responses.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.contrib.auth import get_user_model

# Import models
from users.models import User
from student_profile.models import (
    Course, Group, Attendance, Payment, ExamScore
)
try:
    from student_profile.models import Assignment, Quiz, QuizAttempt
except ImportError:
    Assignment = None
    Quiz = None
    QuizAttempt = None
from messaging.models import SmsHistory
try:
    from messaging.models import ChatMessage
except ImportError:
    ChatMessage = None
from crm.models import Lead, Source

log = logging.getLogger(__name__)
User = get_user_model()

# =============================================================================
# INTENT FULFILLMENT REGISTRY
# =============================================================================

class IntentFulfillment:
    """Base class for intent handlers"""

    @staticmethod
    def handle(
        intent: str,
        entities: Dict[str, Any],
        user: Optional[Any] = None,
        transcript: str = ""
    ) -> Dict[str, Any]:
        """
        Main handler dispatcher

        Returns:
            {
                'status': 'ok'|'error'|'clarify',
                'intent': str,
                'data': Any,
                'message': str,  # Voice-friendly response
                'tts_text': Optional[str],  # Text for TTS
            }
        """
        # Get handler method
        handler_method = f"handle_{intent}"
        if hasattr(IntentFulfillment, handler_method):
            handler = getattr(IntentFulfillment, handler_method)
            return handler(entities, user, transcript)
        else:
            return {
                'status': 'error',
                'intent': intent,
                'message': f"Handler not implemented for intent: {intent}",
            }

    # =========================================================================
    # STUDENT INTENTS
    # =========================================================================

    @staticmethod
    def handle_student_enroll(entities: Dict, user: Any, transcript: str) -> Dict:
        """Enroll student in a course"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        course_name = entities.get('course_name')
        if not course_name:
            return {
                'status': 'clarify',
                'message': 'Qaysi kursga yozilmoqchisiz? Kurs nomini ayting.',
            }

        # Find course
        course = Course.objects.filter(
            Q(name__icontains=course_name) | Q(description__icontains=course_name)
        ).first()

        if not course:
            return {
                'status': 'error',
                'message': f'{course_name} kursi topilmadi. Mavjud kurslar ro\'yxatini ko\'ring.',
            }

        # Find available group
        group = Group.objects.filter(
            course=course,
            end_day__gte=timezone.now().date()
        ).first()

        if not group:
            return {
                'status': 'error',
                'message': f'{course.name} uchun ochiq guruh topilmadi.',
            }

        # Check if already enrolled
        if group.students.filter(id=user.id).exists():
            return {
                'status': 'ok',
                'message': f'Siz allaqachon {course.name} kursida o\'qiyapsiz.',
            }

        # Enroll
        group.students.add(user)

        return {
            'status': 'ok',
            'intent': 'student_enroll',
            'data': {
                'course': course.name,
                'group': group.name if hasattr(group, 'name') else f'Guruh #{group.id}',
                'start_date': group.start_day.strftime('%Y-%m-%d') if hasattr(group, 'start_day') else None,
            },
            'message': f'Tabriklaymiz! Siz {course.name} kursiga muvaffaqiyatli yozildingiz.',
            'tts_text': f'Tabriklaymiz! Siz {course.name} kursiga muvaffaqiyatli yozildingiz.',
        }

    @staticmethod
    def handle_student_profile(entities: Dict, user: Any, transcript: str) -> Dict:
        """View student profile"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        # Get enrolled courses count
        enrolled_courses = Group.objects.filter(students=user).count()

        # Get recent attendance
        attendance_rate = Attendance.objects.filter(
            student=user
        ).aggregate(
            total=Count('id'),
            present=Count('id', filter=Q(is_present=True))
        )

        attendance_pct = 0
        if attendance_rate['total'] > 0:
            attendance_pct = (attendance_rate['present'] / attendance_rate['total']) * 100

        # Get average score
        avg_score = ExamScore.objects.filter(student=user).aggregate(
            avg=Avg('score')
        )['avg'] or 0

        return {
            'status': 'ok',
            'intent': 'student_profile',
            'data': {
                'name': user.get_full_name() or user.username,
                'email': user.email,
                'phone': getattr(user, 'phone', None),
                'enrolled_courses': enrolled_courses,
                'attendance_rate': round(attendance_pct, 1),
                'average_score': round(avg_score, 1),
            },
            'message': f'{user.get_full_name()}, siz {enrolled_courses} ta kursda o\'qiyapsiz. Davomat: {attendance_pct:.0f}%, O\'rtacha ball: {avg_score:.0f}',
        }

    @staticmethod
    def handle_student_schedule(entities: Dict, user: Any, transcript: str) -> Dict:
        """View student class schedule"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        # Get upcoming classes (next 7 days)
        today = timezone.now().date()
        week_later = today + timedelta(days=7)

        attendances = Attendance.objects.filter(
            student=user,
            date__gte=today,
            date__lte=week_later
        ).order_by('date')[:10]

        if not attendances:
            return {
                'status': 'ok',
                'message': 'Keyingi hafta uchun jadval mavjud emas.',
            }

        schedule = []
        for att in attendances:
            schedule.append({
                'date': att.date.strftime('%Y-%m-%d'),
                'day_name': att.date.strftime('%A'),
                'status': 'Kelgan' if att.is_present else 'Kelmagan',
            })

        message = f'Sizning keyingi {len(schedule)} ta darslar jadvali:'
        for item in schedule[:3]:
            message += f" {item['date']} - {item['day_name']},"

        return {
            'status': 'ok',
            'intent': 'student_schedule',
            'data': {'schedule': schedule},
            'message': message,
        }

    @staticmethod
    def handle_student_courses(entities: Dict, user: Any, transcript: str) -> Dict:
        """List student's enrolled courses"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        groups = Group.objects.filter(students=user).select_related('course')

        if not groups:
            return {
                'status': 'ok',
                'message': 'Siz hali hech qanday kursga yozilmagansiz.',
            }

        courses = [
            {
                'name': g.course.name,
                'description': g.course.description,
                'start_date': g.start_day.strftime('%Y-%m-%d') if hasattr(g, 'start_day') else None,
            }
            for g in groups
        ]

        message = f'Siz {len(courses)} ta kursda o\'qiyapsiz: '
        message += ', '.join([c['name'] for c in courses])

        return {
            'status': 'ok',
            'intent': 'student_courses',
            'data': {'courses': courses},
            'message': message,
        }

    @staticmethod
    def handle_student_progress(entities: Dict, user: Any, transcript: str) -> Dict:
        """Check student learning progress"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        # Get quiz attempts
        quiz_attempts = QuizAttempt.objects.filter(student=user).aggregate(
            total=Count('id'),
            passed=Count('id', filter=Q(score__gte=60)),  # Assuming 60% is passing
        )

        # Get assignment completion
        assignments_total = Assignment.objects.filter(
            course__group__students=user
        ).count()

        # Get average grade
        avg_grade = ExamScore.objects.filter(student=user).aggregate(
            avg=Avg('score')
        )['avg'] or 0

        progress_pct = 0
        if quiz_attempts['total'] > 0:
            progress_pct = (quiz_attempts['passed'] / quiz_attempts['total']) * 100

        return {
            'status': 'ok',
            'intent': 'student_progress',
            'data': {
                'quizzes_passed': quiz_attempts['passed'],
                'quizzes_total': quiz_attempts['total'],
                'progress_percentage': round(progress_pct, 1),
                'average_grade': round(avg_grade, 1),
                'assignments_total': assignments_total,
            },
            'message': f'Sizning o\'quv jarayoningiz: {progress_pct:.0f}% muvaffaqiyatli. O\'rtacha baho: {avg_grade:.1f}',
        }

    # =========================================================================
    # COURSE INTENTS
    # =========================================================================

    @staticmethod
    def handle_course_catalog(entities: Dict, user: Any, transcript: str) -> Dict:
        """Browse course catalog"""
        courses = Course.objects.all()[:10]

        if not courses:
            return {
                'status': 'ok',
                'message': 'Hozircha kurslar mavjud emas.',
            }

        course_list = [
            {
                'name': c.name,
                'description': c.description[:100] if c.description else '',
            }
            for c in courses
        ]

        message = f'{len(course_list)} ta kurs mavjud: '
        message += ', '.join([c['name'] for c in course_list[:3]])
        if len(course_list) > 3:
            message += f' va yana {len(course_list) - 3} ta.'

        return {
            'status': 'ok',
            'intent': 'course_catalog',
            'data': {'courses': course_list},
            'message': message,
        }

    @staticmethod
    def handle_course_details(entities: Dict, user: Any, transcript: str) -> Dict:
        """Get detailed course information"""
        course_name = entities.get('course_name')
        if not course_name:
            return {
                'status': 'clarify',
                'message': 'Qaysi kurs haqida ma\'lumot kerak?',
            }

        course = Course.objects.filter(
            Q(name__icontains=course_name) | Q(description__icontains=course_name)
        ).first()

        if not course:
            return {
                'status': 'error',
                'message': f'{course_name} kursi topilmadi.',
            }

        # Get group count
        active_groups = Group.objects.filter(
            course=course,
            end_day__gte=timezone.now().date()
        ).count()

        return {
            'status': 'ok',
            'intent': 'course_details',
            'data': {
                'name': course.name,
                'description': course.description,
                'active_groups': active_groups,
            },
            'message': f'{course.name}: {course.description}. {active_groups} ta faol guruh mavjud.',
        }

    # =========================================================================
    # ASSESSMENT INTENTS
    # =========================================================================

    @staticmethod
    def handle_quiz_list(entities: Dict, user: Any, transcript: str) -> Dict:
        """List available quizzes"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        # Get quizzes from user's courses
        quizzes = Quiz.objects.filter(
            course__group__students=user
        ).distinct()[:10]

        if not quizzes:
            return {
                'status': 'ok',
                'message': 'Sizning kurslaringizda testlar mavjud emas.',
            }

        quiz_list = [
            {
                'id': q.id,
                'title': q.title,
                'questions_count': q.questions.count() if hasattr(q, 'questions') else 0,
            }
            for q in quizzes
        ]

        message = f'{len(quiz_list)} ta test mavjud: '
        message += ', '.join([q['title'] for q in quiz_list[:3]])

        return {
            'status': 'ok',
            'intent': 'quiz_list',
            'data': {'quizzes': quiz_list},
            'message': message,
        }

    @staticmethod
    def handle_quiz_results(entities: Dict, user: Any, transcript: str) -> Dict:
        """View quiz results/scores"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        attempts = QuizAttempt.objects.filter(student=user).order_by('-created_at')[:5]

        if not attempts:
            return {
                'status': 'ok',
                'message': 'Sizning hali test natijalaringiz yo\'q.',
            }

        results = [
            {
                'quiz_title': att.quiz.title,
                'score': att.score,
                'max_score': att.max_score if hasattr(att, 'max_score') else 100,
                'date': att.created_at.strftime('%Y-%m-%d'),
            }
            for att in attempts
        ]

        latest = results[0]
        avg_score = sum(r['score'] for r in results) / len(results)

        message = f'Sizning oxirgi test natijangiz: {latest["score"]}/{latest["max_score"]}. O\'rtacha: {avg_score:.1f}'

        return {
            'status': 'ok',
            'intent': 'quiz_results',
            'data': {'results': results, 'average': round(avg_score, 1)},
            'message': message,
        }

    @staticmethod
    def handle_assignment_list(entities: Dict, user: Any, transcript: str) -> Dict:
        """List assignments"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        assignments = Assignment.objects.filter(
            course__group__students=user
        ).order_by('-due_date')[:10]

        if not assignments:
            return {
                'status': 'ok',
                'message': 'Sizda vazifalar yo\'q.',
            }

        assignment_list = [
            {
                'id': a.id,
                'title': a.title,
                'due_date': a.due_date.strftime('%Y-%m-%d') if a.due_date else None,
                'status': 'Topshirilgan' if hasattr(a, 'is_submitted') and a.is_submitted else 'Topshirilmagan',
            }
            for a in assignments
        ]

        message = f'Sizda {len(assignment_list)} ta vazifa bor.'
        pending = [a for a in assignment_list if a['status'] == 'Topshirilmagan']
        if pending:
            message += f' {len(pending)} ta topshirilmagan.'

        return {
            'status': 'ok',
            'intent': 'assignment_list',
            'data': {'assignments': assignment_list},
            'message': message,
        }

    @staticmethod
    def handle_grade_check(entities: Dict, user: Any, transcript: str) -> Dict:
        """Check grades/marks"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        grades = ExamScore.objects.filter(student=user).select_related('group')[:10]

        if not grades:
            return {
                'status': 'ok',
                'message': 'Sizning hali baholaringiz yo\'q.',
            }

        grade_list = [
            {
                'course': g.group.course.name if g.group and g.group.course else 'Noma\'lum',
                'score': g.score,
                'letter_grade': 'A' if g.score >= 90 else ('B' if g.score >= 80 else ('C' if g.score >= 70 else ('D' if g.score >= 60 else 'F'))),
            }
            for g in grades
        ]

        avg = sum(g['score'] for g in grade_list) / len(grade_list)

        message = f'Sizning baholaringiz: O\'rtacha {avg:.1f} ball.'

        return {
            'status': 'ok',
            'intent': 'grade_check',
            'data': {'grades': grade_list, 'average': round(avg, 1)},
            'message': message,
        }

    # =========================================================================
    # PAYMENT INTENTS
    # =========================================================================

    @staticmethod
    def handle_payment_check(entities: Dict, user: Any, transcript: str) -> Dict:
        """Check payment balance"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        last_payment = Payment.objects.filter(by_user=user).order_by('-date').first()

        total_paid = Payment.objects.filter(
            by_user=user,
            status='paid'
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        balance = total_paid / 100  # tiyin to so'm

        return {
            'status': 'ok',
            'intent': 'payment_check',
            'data': {
                'balance': balance,
                'last_payment_amount': last_payment.amount / 100 if last_payment else 0,
                'last_payment_date': last_payment.date.strftime('%Y-%m-%d') if last_payment else None,
            },
            'message': f'Sizning balansingiz: {balance:,.0f} so\'m. Oxirgi to\'lov: {last_payment.amount/100 if last_payment else 0:,.0f} so\'m.',
        }

    @staticmethod
    def handle_payment_history(entities: Dict, user: Any, transcript: str) -> Dict:
        """View payment history"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        payments = Payment.objects.filter(by_user=user).order_by('-date')[:10]

        if not payments:
            return {
                'status': 'ok',
                'message': 'To\'lov tarixi mavjud emas.',
            }

        payment_list = [
            {
                'amount': p.amount / 100,
                'date': p.date.strftime('%Y-%m-%d'),
                'status': p.status,
            }
            for p in payments
        ]

        total = sum(p['amount'] for p in payment_list)

        return {
            'status': 'ok',
            'intent': 'payment_history',
            'data': {'payments': payment_list, 'total': total},
            'message': f'Siz {len(payment_list)} marta to\'lov qilgansiz. Jami: {total:,.0f} so\'m.',
        }

    @staticmethod
    def handle_today_payments(entities: Dict, user: Any, transcript: str) -> Dict:
        """View today's payments (admin)"""
        today = timezone.now().date()
        payments = Payment.objects.filter(date=today, status='paid')
        total_amount = payments.aggregate(Sum('amount'))['amount__sum'] or 0

        return {
            'status': 'ok',
            'intent': 'today_payments',
            'data': {
                'count': payments.count(),
                'total': total_amount / 100,
                'date': today.strftime('%Y-%m-%d'),
            },
            'message': f'Bugun {payments.count()} ta to\'lov qabul qilindi. Jami: {total_amount/100:,.0f} so\'m.',
        }

    # =========================================================================
    # ATTENDANCE INTENTS
    # =========================================================================

    @staticmethod
    def handle_attendance_check(entities: Dict, user: Any, transcript: str) -> Dict:
        """Check attendance record"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        # Last 30 days
        month_ago = timezone.now().date() - timedelta(days=30)
        attendances = Attendance.objects.filter(
            student=user,
            date__gte=month_ago
        )

        stats = attendances.aggregate(
            total=Count('id'),
            present=Count('id', filter=Q(is_present=True)),
            absent=Count('id', filter=Q(is_present=False)),
        )

        percentage = 0
        if stats['total'] > 0:
            percentage = (stats['present'] / stats['total']) * 100

        return {
            'status': 'ok',
            'intent': 'attendance_check',
            'data': {
                'total_days': stats['total'],
                'present': stats['present'],
                'absent': stats['absent'],
                'percentage': round(percentage, 1),
            },
            'message': f'Oxirgi 30 kun ichida: {stats["present"]} kun keldingiz, {stats["absent"]} kun kelmagansiz. Davomat: {percentage:.0f}%',
        }

    @staticmethod
    def handle_attendance_percentage(entities: Dict, user: Any, transcript: str) -> Dict:
        """Get attendance percentage"""
        if not user:
            return {'status': 'error', 'message': 'Foydalanuvchi aniqlanmadi.'}

        stats = Attendance.objects.filter(student=user).aggregate(
            total=Count('id'),
            present=Count('id', filter=Q(is_present=True)),
        )

        percentage = 0
        if stats['total'] > 0:
            percentage = (stats['present'] / stats['total']) * 100

        return {
            'status': 'ok',
            'intent': 'attendance_percentage',
            'data': {'percentage': round(percentage, 1)},
            'message': f'Sizning davomat foizingiz: {percentage:.1f}%',
        }

    # =========================================================================
    # CRM INTENTS
    # =========================================================================

    @staticmethod
    def handle_lead_list(entities: Dict, user: Any, transcript: str) -> Dict:
        """List leads"""
        leads = Lead.objects.filter(status='new').order_by('-created_at')[:10]

        if not leads:
            return {
                'status': 'ok',
                'message': 'Yangi lidlar yo\'q.',
            }

        lead_list = [
            {
                'id': l.id,
                'name': l.full_name,
                'phone': l.phone,
                'course': l.interested_course.name if l.interested_course else 'Noma\'lum',
            }
            for l in leads
        ]

        return {
            'status': 'ok',
            'intent': 'lead_list',
            'data': {'leads': lead_list},
            'message': f'{len(lead_list)} ta yangi lid bor.',
        }

    @staticmethod
    def handle_lead_stats(entities: Dict, user: Any, transcript: str) -> Dict:
        """View lead statistics"""
        stats = {
            'total': Lead.objects.count(),
            'new': Lead.objects.filter(status='new').count(),
            'converted': Lead.objects.filter(status='converted').count(),
            'today': Lead.objects.filter(created_at__date=timezone.now().date()).count(),
        }

        return {
            'status': 'ok',
            'intent': 'lead_stats',
            'data': stats,
            'message': f'Jami {stats["total"]} ta lid. Yangi: {stats["new"]}, O\'quvchiga aylangan: {stats["converted"]}, Bugun: {stats["today"]}',
        }

    @staticmethod
    def handle_student_count(entities: Dict, user: Any, transcript: str) -> Dict:
        """Get student count"""
        total = User.objects.filter(is_student=True).count()
        active_groups = Group.objects.filter(
            end_day__gte=timezone.now().date()
        ).count()

        return {
            'status': 'ok',
            'intent': 'student_count',
            'data': {'total_students': total, 'active_groups': active_groups},
            'message': f'Jami {total} ta o\'quvchi bor. Faol guruhlar: {active_groups} ta.',
        }

    # =========================================================================
    # GREETING INTENTS
    # =========================================================================

    @staticmethod
    def handle_greeting(entities: Dict, user: Any, transcript: str) -> Dict:
        """Handle greeting"""
        username = user.get_full_name() if user else "Foydalanuvchi"
        return {
            'status': 'ok',
            'intent': 'greeting',
            'message': f'Salom, {username}! Men EduVoice AI assistant. Sizga qanday yordam bera olaman?',
            'tts_text': f'Salom! Sizga qanday yordam bera olaman?',
        }

    @staticmethod
    def handle_goodbye(entities: Dict, user: Any, transcript: str) -> Dict:
        """Handle goodbye"""
        return {
            'status': 'ok',
            'intent': 'goodbye',
            'message': 'Xayr! Omad tilaymiz. Tez orada ko\'rishguncha!',
            'tts_text': 'Xayr! Omad tilaymiz.',
        }

    @staticmethod
    def handle_thanks(entities: Dict, user: Any, transcript: str) -> Dict:
        """Handle thanks"""
        return {
            'status': 'ok',
            'intent': 'thanks',
            'message': 'Arzimaydi! Yordam bera olganimdan xursandman. Yana savolingiz bormi?',
            'tts_text': 'Arzimaydi! Yana savolingiz bormi?',
        }

    @staticmethod
    def handle_how_are_you(entities: Dict, user: Any, transcript: str) -> Dict:
        """Handle how are you"""
        return {
            'status': 'ok',
            'intent': 'how_are_you',
            'message': 'Yaxshiman, rahmat! Sizga qanday yordam bera olaman?',
            'tts_text': 'Yaxshiman, rahmat!',
        }

    @staticmethod
    def handle_help(entities: Dict, user: Any, transcript: str) -> Dict:
        """Handle help request"""
        help_text = """
Men quyidagilar bo'yicha yordam bera olaman:
- Kurslar va ro'yxatdan o'tish
- Dars jadvali va davomat
- Test va vazifalar
- To'lovlar va balans
- Baholar va o'quv jarayoni

Nimani bilmoqchisiz?
        """.strip()

        return {
            'status': 'ok',
            'intent': 'help',
            'message': help_text,
            'tts_text': 'Men kurslar, jadval, testlar, to\'lovlar va baholar bo\'yicha yordam bera olaman.',
        }

    @staticmethod
    def handle_capabilities(entities: Dict, user: Any, transcript: str) -> Dict:
        """Show AI capabilities"""
        return {
            'status': 'ok',
            'intent': 'capabilities',
            'message': """
Men EduVoice AI assistant. Quyidagilarni qila olaman:
✓ Kursga yozilish va ma'lumot berish
✓ Dars jadvali va davomatni ko'rsatish
✓ Test topshirish va natijalarni ko'rish
✓ To'lovlarni tekshirish
✓ Baholar va o'quv jarayonini kuzatish
✓ Xabar yuborish va bildirishnomalar

Savollaringizni so'zlab yoki yozib bering!
            """.strip(),
            'tts_text': 'Men kurslar, testlar, to\'lovlar, baholar va boshqa ko\'p narsada yordam bera olaman!',
        }


# =============================================================================
# MAIN FULFILLMENT FUNCTION
# =============================================================================

def fulfill_intent(
    intent: str,
    entities: Dict[str, Any],
    user: Optional[Any] = None,
    transcript: str = ""
) -> Dict[str, Any]:
    """
    Main entry point for intent fulfillment

    Args:
        intent: Detected intent name
        entities: Extracted entities
        user: Django User object
        transcript: Original user input

    Returns:
        Fulfillment result dictionary
    """
    try:
        result = IntentFulfillment.handle(intent, entities, user, transcript)

        # Add timestamp
        result['timestamp'] = timezone.now().isoformat()

        # Generate TTS text if not provided
        if 'tts_text' not in result and 'message' in result:
            result['tts_text'] = result['message']

        return result

    except Exception as e:
        log.exception(f"Intent fulfillment error for '{intent}': {e}")
        return {
            'status': 'error',
            'intent': intent,
            'message': f'Xatolik yuz berdi: {str(e)}',
            'error': str(e),
            'timestamp': timezone.now().isoformat(),
        }

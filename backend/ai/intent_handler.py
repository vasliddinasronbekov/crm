import logging
from django.utils import timezone
from django.db.models import Sum, Count, Q
from users.models import User
from student_profile.models import Course, Group, Attendance, Payment, ExamScore
from messaging.models import SmsHistory
from crm.models import Lead, Source
from datetime import datetime, timedelta

log = logging.getLogger(__name__)


def handle_nlu_result_sync(nlu: dict, transcript: str = None, user=None, entities: dict = None):
    """
    NLU natijasini qayta ishlash va real action bajarish.
    Voice-first CRM & LMS platform with complete intent handling.

    Args:
        nlu: {"intent": "...", "confidence": 0.85}
        transcript: Asl matn (STT yoki foydalanuvchi yozgan text)
        user: Request qilgan foydalanuvchi (User modeli)
        entities: STT/NLU orqali ajratilgan entitilar (phone, amount, date)
    Returns:
        dict (action natijasi with voice-friendly response)
    """

    intent = nlu.get("intent")
    confidence = nlu.get("confidence", 0)

    if not intent or confidence < 0.4:
        return {"status": "clarify", "response": "Nimani nazarda tutyapsiz? Men to'lov, jadval, lidlar, o'quvchilar haqida ma'lumot bera olaman."}

    # --- STUDENT/LMS INTENTS ---
    if intent == "check_payment":
        return check_payment_action(user)

    elif intent == "enroll_course":
        return enroll_course_action(user)

    elif intent == "schedule":
        return schedule_action(user)

    elif intent == "check_attendance":
        return check_attendance_action(user)

    elif intent == "check_scores":
        return check_scores_action(user)

    # --- CRM INTENTS ---
    elif intent == "list_leads":
        return list_leads_action(user)

    elif intent == "lead_stats":
        return lead_stats_action(user)

    elif intent == "add_lead":
        return add_lead_action(user, entities)

    elif intent == "student_count":
        return student_count_action(user)

    elif intent == "today_payments":
        return today_payments_action(user)

    # --- COMMUNICATION ---
    elif intent == "send_sms":
        return send_sms_action(user, transcript, entities)

    # --- GREETINGS ---
    elif intent == "greeting":
        return {"status": "ok", "response": "Salom! Men AI assistant. Sizga to'lov, dars jadvali, lidlar yoki o'quvchilar haqida ma'lumot bera olaman."}

    elif intent == "goodbye":
        return {"status": "ok", "response": "Xayr! Siz bilan tez orada qayta ko'rishamiz. Omad tilaymiz!"}

    else:
        return {"status": "unknown", "response": f"Kechirasiz, '{intent}' buyrug'ini tushunmadim. Boshqa narsa so'rang."}


# --- ACTION FUNKSIYALAR ---

def check_payment_action(user):
    """ Student balansini tekshirish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    # Oxirgi to'lov
    last_payment = Payment.objects.filter(by_user=user).order_by("-date").first()
    balance = 0

    if last_payment:
        balance = last_payment.amount / 100  # tiyin -> so‘m

    return {
        "status": "ok",
        "intent": "check_payment",
        "balance": f"{balance:.2f} UZS",
        "last_payment": str(last_payment.amount / 100) if last_payment else "yo‘q",
        "message": f"Balansingiz: {balance:.2f} UZS. Oxirgi to‘lov: {last_payment.amount/100 if last_payment else 'yo‘q'}"
    }


def enroll_course_action(user):
    """ Studentni kursga yozish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    course = Course.objects.first()
    if not course:
        return {"status": "error", "response": "Hozircha kurslar mavjud emas."}

    # Studentni birinchi guruhga qo‘shamiz
    group = Group.objects.filter(course=course).first()
    if not group:
        return {"status": "error", "response": f"{course.name} uchun guruh topilmadi."}

    group.students.add(user)

    return {
        "status": "ok",
        "intent": "enroll_course",
        "course": course.name,
        "message": f"Siz {course.name} kursiga muvaffaqiyatli yozildingiz!"
    }


def schedule_action(user):
    """ Student dars jadvalini qaytarish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    attendances = Attendance.objects.filter(student=user).order_by("date")[:5]

    schedule = [
        {"date": a.date.strftime("%Y-%m-%d"), "status": "✅" if a.is_present else "❌"}
        for a in attendances
    ]

    return {
        "status": "ok",
        "intent": "schedule",
        "schedule": schedule,
        "message": f"Sizning yaqin darslaringiz: {len(schedule)} ta"
    }


def send_sms_action(user, transcript, entities=None):
    """ Student yoki ota-onasiga SMS yuborish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    # Telefon raqam entity dan yoki userdan olinadi
    phone = None
    if entities and entities.get("phone"):
        phone = entities["phone"]
    else:
        phone = getattr(user, "parents_phone", None) or getattr(user, "phone", None)

    if not phone:
        return {"status": "error", "response": "Telefon raqam topilmadi."}

    sms = SmsHistory.objects.create(
        phone=phone,
        message=f"AI xabari: {transcript or 'Avtomatik xabar'}",
        sent_at=timezone.now()
    )

    return {
        "status": "ok",
        "intent": "send_sms",
        "phone": phone,
        "message": f"{phone} raqamiga SMS yuborildi ✅"
    }


# --- CRM ACTION FUNKSIYALAR ---

def list_leads_action(user):
    """ Yangi lidlarni ko'rsatish """
    leads = Lead.objects.filter(status='new').order_by('-created_at')[:5]

    if not leads:
        return {
            "status": "ok",
            "intent": "list_leads",
            "data": [],
            "message": "Hozirda yangi lidlar yo'q."
        }

    lead_list = [
        {
            "name": lead.full_name,
            "phone": lead.phone,
            "course": lead.interested_course.name if lead.interested_course else "Noma'lum"
        }
        for lead in leads
    ]

    message = f"Siz {len(leads)} ta yangi lid bor. "
    message += f"Birinchisi: {leads[0].full_name}, {leads[0].phone}."

    return {
        "status": "ok",
        "intent": "list_leads",
        "data": lead_list,
        "message": message
    }


def lead_stats_action(user):
    """ Lid statistikasini ko'rsatish """
    total_leads = Lead.objects.count()
    new_leads = Lead.objects.filter(status='new').count()
    converted_leads = Lead.objects.filter(status='converted').count()
    today_leads = Lead.objects.filter(created_at__date=timezone.now().date()).count()

    message = f"Jami {total_leads} ta lid bor. "
    message += f"Yangilari: {new_leads} ta. "
    message += f"O'quvchiga aylanganlar: {converted_leads} ta. "
    message += f"Bugun qo'shilgan: {today_leads} ta."

    return {
        "status": "ok",
        "intent": "lead_stats",
        "data": {
            "total": total_leads,
            "new": new_leads,
            "converted": converted_leads,
            "today": today_leads
        },
        "message": message
    }


def add_lead_action(user, entities=None):
    """ Yangi lid qo'shish """
    if not entities:
        return {
            "status": "error",
            "message": "Lid qo'shish uchun ism va telefon raqam kerak. Iltimos qaytadan ayting."
        }

    phone = entities.get("phone")
    if not phone:
        return {
            "status": "error",
            "message": "Telefon raqam topilmadi. Qaytadan telefon raqam bilan birga ayting."
        }

    # Default values
    lead = Lead.objects.create(
        full_name=entities.get("name", "Noma'lum"),
        phone=phone,
        status='new'
    )

    return {
        "status": "ok",
        "intent": "add_lead",
        "data": {"id": lead.id, "name": lead.full_name, "phone": lead.phone},
        "message": f"{lead.full_name} yangi lid sifatida qo'shildi. Telefon: {lead.phone}."
    }


def student_count_action(user):
    """ O'quvchilar sonini ko'rsatish """
    total_students = User.objects.filter(is_student=True).count()
    active_groups = Group.objects.filter(
        end_day__gte=timezone.now().date()
    ).count()

    message = f"Jami {total_students} ta o'quvchi bor. "
    message += f"Faol guruhlar: {active_groups} ta."

    return {
        "status": "ok",
        "intent": "student_count",
        "data": {
            "total_students": total_students,
            "active_groups": active_groups
        },
        "message": message
    }


def today_payments_action(user):
    """ Bugungi to'lovlarni ko'rsatish """
    today = timezone.now().date()
    payments = Payment.objects.filter(date=today, status='paid')
    total_amount = payments.aggregate(Sum('amount'))['amount__sum'] or 0

    message = f"Bugun {payments.count()} ta to'lov qabul qilindi. "
    message += f"Jami: {total_amount / 100:.2f} so'm."

    return {
        "status": "ok",
        "intent": "today_payments",
        "data": {
            "count": payments.count(),
            "total": total_amount / 100
        },
        "message": message
    }


# --- LMS ACTION FUNKSIYALAR ---

def check_attendance_action(user):
    """ O'quvchi davomatini tekshirish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    # Oxirgi 7 kunlik davomat
    week_ago = timezone.now().date() - timedelta(days=7)
    attendances = Attendance.objects.filter(
        student=user,
        date__gte=week_ago
    ).order_by('-date')[:7]

    present_count = attendances.filter(is_present=True).count()
    absent_count = attendances.filter(is_present=False).count()

    message = f"Oxirgi 7 kun ichida {present_count} kun keldingiz, "
    message += f"{absent_count} kun kelmagansiz."

    return {
        "status": "ok",
        "intent": "check_attendance",
        "data": {
            "present": present_count,
            "absent": absent_count,
            "total_days": attendances.count()
        },
        "message": message
    }


def check_scores_action(user):
    """ O'quvchi natijalarini tekshirish """
    if not user:
        return {"status": "error", "response": "Foydalanuvchi aniqlanmadi."}

    scores = ExamScore.objects.filter(student=user).order_by('-date')[:3]

    if not scores:
        return {
            "status": "ok",
            "intent": "check_scores",
            "data": [],
            "message": "Sizning hali test natijalaringiz yo'q."
        }

    avg_score = sum(s.score for s in scores) / len(scores)
    latest_score = scores[0]

    message = f"Sizning oxirgi test natijangiz: {latest_score.score} ball. "
    message += f"O'rtacha: {avg_score:.1f} ball."

    return {
        "status": "ok",
        "intent": "check_scores",
        "data": {
            "latest": latest_score.score,
            "average": round(avg_score, 1),
            "count": scores.count()
        },
        "message": message
    }

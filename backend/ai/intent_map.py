# ai/intent_map.py
from student_profile.models import Payment
from datetime import datetime

def handle_intent(intent, entities, user):
    """
    Intent -> Action mapping
    """

    if intent == "check_payment":
        qs = Payment.objects.filter(by_user=user).order_by("-date")[:3]
        return {
            "status": "ok",
            "action": "check_payment",
            "data": [{"amount": p.amount / 100, "date": p.date.strftime("%Y-%m-%d")} for p in qs],
        }

    if intent == "schedule":
        # bu joyda real jadval modelidan foydalanishingiz mumkin
        return {
            "status": "ok",
            "action": "schedule",
            "data": "Sizning keyingi darsingiz dushanba soat 18:00 da.",
        }

    if intent == "enroll_course":
        course = entities.get("course", None)
        return {
            "status": "ok",
            "action": "enroll_course",
            "data": f"Siz kursga yozilish uchun admin bilan bog'lanishingiz kerak. Kurs: {course or 'aniqlanmagan'}",
        }

    if intent == "greeting":
        return {"status": "ok", "action": "greeting", "data": "Salom! Qanday yordam bera olaman?"}

    if intent == "goodbye":
        return {"status": "ok", "action": "goodbye", "data": "Xayr! Omad tilaymiz."}

    return {"status": "unknown_intent", "action": intent, "data": None}

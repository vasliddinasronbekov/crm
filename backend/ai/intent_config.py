"""
Enterprise-Grade Intent Configuration System
============================================
Comprehensive intent definitions for EduVoice LMS with 50+ intents
organized by domain categories for education, CRM, communication, and administration.

Categories:
- STUDENT: Student-related queries (enrollment, schedule, grades, etc.)
- COURSE: Course management (catalog, content, progress, etc.)
- ASSESSMENT: Quizzes, assignments, exams, grading
- PAYMENT: Billing, payments, invoices, financial queries
- ATTENDANCE: Check-in, attendance tracking, tardiness
- CRM: Lead management, conversions, sales
- COMMUNICATION: Messaging, notifications, announcements
- ADMIN: System administration, reporting, analytics
- GREETINGS: Social interactions
- HELP: Help and support queries
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

class IntentCategory(str, Enum):
    """Intent category enumeration"""
    STUDENT = "student"
    COURSE = "course"
    ASSESSMENT = "assessment"
    PAYMENT = "payment"
    ATTENDANCE = "attendance"
    CRM = "crm"
    COMMUNICATION = "communication"
    ADMIN = "admin"
    GREETINGS = "greetings"
    HELP = "help"

@dataclass
class IntentConfig:
    """Intent configuration with metadata"""
    name: str
    category: IntentCategory
    description: str
    keywords: List[str]
    aliases: List[str] = field(default_factory=list)
    requires_auth: bool = True
    requires_entities: List[str] = field(default_factory=list)
    min_confidence: float = 0.4
    examples: List[str] = field(default_factory=list)
    response_template: Optional[str] = None

# =============================================================================
# COMPREHENSIVE INTENT DEFINITIONS (50+ intents)
# =============================================================================

INTENT_DEFINITIONS: Dict[str, IntentConfig] = {

    # =========================================================================
    # STUDENT INTENTS (15 intents)
    # =========================================================================

    "student_enroll": IntentConfig(
        name="student_enroll",
        category=IntentCategory.STUDENT,
        description="Enroll student in a course or program",
        keywords=["yozil", "ro'yxat", "kursga", "boshlash", "kirish", "enroll", "register", "join", "sign up"],
        aliases=["enroll_course", "register_course", "join_course"],
        requires_entities=["course_name"],
        examples=[
            "Men ingliz tili kursiga yozilmoqchiman",
            "I want to enroll in Python programming",
            "Matematika darsiga ro'yxatdan o'tish",
        ],
    ),

    "student_profile": IntentConfig(
        name="student_profile",
        category=IntentCategory.STUDENT,
        description="View student profile information",
        keywords=["profil", "ma'lumot", "shaxsiy", "info", "profile", "account", "details"],
        examples=[
            "Mening profilimni ko'rsating",
            "Show my profile",
            "Account information",
        ],
    ),

    "student_schedule": IntentConfig(
        name="student_schedule",
        category=IntentCategory.STUDENT,
        description="View student class schedule",
        keywords=["jadval", "dars", "soat", "vaqt", "schedule", "timetable", "class time", "when"],
        aliases=["schedule", "class_schedule", "timetable"],
        examples=[
            "Mening dars jadvalim",
            "What's my class schedule?",
            "Bugun dars bormi?",
            "When is my next class?",
        ],
    ),

    "student_courses": IntentConfig(
        name="student_courses",
        category=IntentCategory.STUDENT,
        description="List student's enrolled courses",
        keywords=["kurslarim", "o'qiyotgan", "darslar", "my courses", "enrolled", "classes"],
        examples=[
            "Qaysi kurslarda o'qiyapman?",
            "Show my courses",
            "What classes am I taking?",
        ],
    ),

    "student_progress": IntentConfig(
        name="student_progress",
        category=IntentCategory.STUDENT,
        description="Check student learning progress",
        keywords=["progress", "yutuqlar", "natija", "advancement", "completion", "muvaffaqiyat"],
        examples=[
            "Mening progressim qanday?",
            "How am I doing in the course?",
            "Kurs jarayonim",
        ],
    ),

    "student_certificates": IntentConfig(
        name="student_certificates",
        category=IntentCategory.STUDENT,
        description="View or download certificates",
        keywords=["sertifikat", "certificate", "diploma", "attestat", "credential"],
        examples=[
            "Sertifikatlarimni ko'rsating",
            "Download my certificate",
            "Do I have any certificates?",
        ],
    ),

    "student_withdraw": IntentConfig(
        name="student_withdraw",
        category=IntentCategory.STUDENT,
        description="Withdraw from a course",
        keywords=["chiqish", "tark etish", "bekor", "withdraw", "drop", "leave", "cancel"],
        requires_entities=["course_name"],
        examples=[
            "Men kursdan chiqmoqchiman",
            "I want to drop this course",
            "Cancel my enrollment",
        ],
    ),

    "student_groupmates": IntentConfig(
        name="student_groupmates",
        category=IntentCategory.STUDENT,
        description="View classmates/groupmates",
        keywords=["guruh", "sinfdoshlar", "o'quvchilar", "classmates", "groupmates", "students", "peers"],
        examples=[
            "Mening guruhim kimlar?",
            "Who are my classmates?",
            "Show students in my group",
        ],
    ),

    "student_teacher": IntentConfig(
        name="student_teacher",
        category=IntentCategory.STUDENT,
        description="Get teacher information",
        keywords=["o'qituvchi", "ustoz", "teacher", "instructor", "professor", "mentor"],
        examples=[
            "Mening o'qituvchim kim?",
            "Who is teaching this course?",
            "Teacher contact information",
        ],
    ),

    "student_feedback": IntentConfig(
        name="student_feedback",
        category=IntentCategory.STUDENT,
        description="Submit feedback or review",
        keywords=["fikr", "sharh", "baholash", "feedback", "review", "rating", "comment"],
        examples=[
            "Kurs haqida fikr bildirish",
            "I want to leave a review",
            "Rate this course",
        ],
    ),

    "student_materials": IntentConfig(
        name="student_materials",
        category=IntentCategory.STUDENT,
        description="Access course materials",
        keywords=["material", "resurs", "kitob", "video", "resources", "materials", "downloads", "files"],
        examples=[
            "Dars materiallari",
            "Download course materials",
            "Where are the resources?",
        ],
    ),

    "student_homework": IntentConfig(
        name="student_homework",
        category=IntentCategory.STUDENT,
        description="View homework/assignments",
        keywords=["vazifa", "uy ishi", "homework", "assignment", "task", "mashq"],
        examples=[
            "Mening vazifalarim",
            "What homework do I have?",
            "Show assignments",
        ],
    ),

    "student_support": IntentConfig(
        name="student_support",
        category=IntentCategory.STUDENT,
        description="Request student support",
        keywords=["yordam", "muammo", "help", "support", "problem", "issue", "assistance"],
        examples=[
            "Yordam kerak",
            "I need help",
            "Having trouble with...",
        ],
    ),

    "student_ranking": IntentConfig(
        name="student_ranking",
        category=IntentCategory.STUDENT,
        description="View student ranking/leaderboard",
        keywords=["reyting", "o'rin", "ranking", "leaderboard", "position", "top students"],
        examples=[
            "Mening reytingim",
            "Where do I rank?",
            "Show leaderboard",
        ],
    ),

    "student_announcements": IntentConfig(
        name="student_announcements",
        category=IntentCategory.STUDENT,
        description="View announcements and news",
        keywords=["e'lon", "yangilik", "xabar", "announcement", "news", "update", "notice"],
        examples=[
            "Yangiliklar",
            "Show announcements",
            "Any updates?",
        ],
    ),

    # =========================================================================
    # COURSE INTENTS (8 intents)
    # =========================================================================

    "course_catalog": IntentConfig(
        name="course_catalog",
        category=IntentCategory.COURSE,
        description="Browse course catalog",
        keywords=["kurslar", "katalog", "mavjud", "catalog", "available courses", "browse", "list"],
        requires_auth=False,
        examples=[
            "Qanday kurslar bor?",
            "Show all courses",
            "Browse course catalog",
        ],
    ),

    "course_details": IntentConfig(
        name="course_details",
        category=IntentCategory.COURSE,
        description="Get detailed course information",
        keywords=["kurs haqida", "ma'lumot", "details", "about", "description", "information"],
        requires_entities=["course_name"],
        examples=[
            "Python kursi haqida ma'lumot",
            "Tell me about the Data Science course",
            "Course details",
        ],
    ),

    "course_syllabus": IntentConfig(
        name="course_syllabus",
        category=IntentCategory.COURSE,
        description="View course syllabus/curriculum",
        keywords=["dastur", "curriculum", "syllabus", "plan", "o'quv dasturi", "mavzular"],
        examples=[
            "Kurs dasturi",
            "Show syllabus",
            "What topics are covered?",
        ],
    ),

    "course_duration": IntentConfig(
        name="course_duration",
        category=IntentCategory.COURSE,
        description="Check course duration",
        keywords=["davomiylik", "vaqt", "muddat", "duration", "how long", "length", "time"],
        examples=[
            "Kurs qancha davom etadi?",
            "How long is the course?",
            "Course duration",
        ],
    ),

    "course_price": IntentConfig(
        name="course_price",
        category=IntentCategory.COURSE,
        description="Get course pricing information",
        keywords=["narx", "to'lov", "price", "cost", "fee", "qancha", "how much"],
        requires_auth=False,
        examples=[
            "Kurs narxi qancha?",
            "How much does it cost?",
            "Course price",
        ],
    ),

    "course_start_date": IntentConfig(
        name="course_start_date",
        category=IntentCategory.COURSE,
        description="Check course start date",
        keywords=["boshlash", "boshlanish", "start date", "when starts", "qachon boshlanadi"],
        examples=[
            "Kurs qachon boshlanadi?",
            "When does the course start?",
            "Start date",
        ],
    ),

    "course_prerequisites": IntentConfig(
        name="course_prerequisites",
        category=IntentCategory.COURSE,
        description="Check course prerequisites",
        keywords=["talab", "shart", "oldin", "prerequisites", "requirements", "prior knowledge"],
        examples=[
            "Kursga kirish talablari",
            "What do I need to know before?",
            "Prerequisites",
        ],
    ),

    "course_instructor": IntentConfig(
        name="course_instructor",
        category=IntentCategory.COURSE,
        description="Get course instructor information",
        keywords=["o'qituvchi", "instruktor", "instructor", "teacher", "who teaches"],
        examples=[
            "Kursni kim o'qitadi?",
            "Who is the instructor?",
            "Teacher information",
        ],
    ),

    # =========================================================================
    # ASSESSMENT INTENTS (10 intents)
    # =========================================================================

    "quiz_list": IntentConfig(
        name="quiz_list",
        category=IntentCategory.ASSESSMENT,
        description="List available quizzes",
        keywords=["test", "quiz", "imtihon", "sinov", "quizzes", "tests"],
        examples=[
            "Qanday testlar bor?",
            "Show available quizzes",
            "List quizzes",
        ],
    ),

    "quiz_start": IntentConfig(
        name="quiz_start",
        category=IntentCategory.ASSESSMENT,
        description="Start a quiz",
        keywords=["test boshlash", "start quiz", "begin test", "take quiz"],
        requires_entities=["quiz_name"],
        examples=[
            "Testni boshlash",
            "I want to start the quiz",
            "Begin assessment",
        ],
    ),

    "quiz_results": IntentConfig(
        name="quiz_results",
        category=IntentCategory.ASSESSMENT,
        description="View quiz results/scores",
        keywords=["natija", "ball", "score", "result", "grade", "marks"],
        aliases=["check_scores", "test_results"],
        examples=[
            "Mening test natijam",
            "Show my quiz scores",
            "What did I get?",
        ],
    ),

    "quiz_retake": IntentConfig(
        name="quiz_retake",
        category=IntentCategory.ASSESSMENT,
        description="Retake a quiz",
        keywords=["qayta topshirish", "retake", "try again", "redo"],
        requires_entities=["quiz_name"],
        examples=[
            "Testni qayta topshirish",
            "I want to retake the quiz",
            "Try the test again",
        ],
    ),

    "assignment_list": IntentConfig(
        name="assignment_list",
        category=IntentCategory.ASSESSMENT,
        description="List assignments",
        keywords=["topshiriq", "vazifa", "assignment", "task", "homework"],
        examples=[
            "Mening topshiriqlarim",
            "Show assignments",
            "What homework do I have?",
        ],
    ),

    "assignment_submit": IntentConfig(
        name="assignment_submit",
        category=IntentCategory.ASSESSMENT,
        description="Submit an assignment",
        keywords=["topshirish", "submit", "yuborish", "send", "upload"],
        requires_entities=["assignment_id"],
        examples=[
            "Vazifani topshirish",
            "Submit assignment",
            "Upload homework",
        ],
    ),

    "assignment_deadline": IntentConfig(
        name="assignment_deadline",
        category=IntentCategory.ASSESSMENT,
        description="Check assignment deadline",
        keywords=["muddat", "deadline", "oxirgi kun", "due date", "when due"],
        examples=[
            "Vazifa muddati",
            "When is it due?",
            "Assignment deadline",
        ],
    ),

    "grade_check": IntentConfig(
        name="grade_check",
        category=IntentCategory.ASSESSMENT,
        description="Check grades/marks",
        keywords=["baho", "grade", "marks", "baholarim", "my grades"],
        examples=[
            "Mening baholarim",
            "Show my grades",
            "What are my marks?",
        ],
    ),

    "grade_average": IntentConfig(
        name="grade_average",
        category=IntentCategory.ASSESSMENT,
        description="Calculate grade average/GPA",
        keywords=["o'rtacha", "average", "GPA", "mean score"],
        examples=[
            "O'rtacha bahom",
            "What's my GPA?",
            "Calculate average grade",
        ],
    ),

    "exam_schedule": IntentConfig(
        name="exam_schedule",
        category=IntentCategory.ASSESSMENT,
        description="View exam schedule",
        keywords=["imtihon", "jadvali", "exam schedule", "test dates"],
        examples=[
            "Imtihon jadvali",
            "When are exams?",
            "Exam schedule",
        ],
    ),

    # =========================================================================
    # PAYMENT INTENTS (8 intents)
    # =========================================================================

    "payment_check": IntentConfig(
        name="payment_check",
        category=IntentCategory.PAYMENT,
        description="Check payment balance",
        keywords=["to'lov", "balans", "qarz", "payment", "balance", "debt", "owe"],
        aliases=["check_payment", "balance"],
        examples=[
            "Mening balansingiz",
            "Do I owe any payment?",
            "Check my balance",
        ],
    ),

    "payment_history": IntentConfig(
        name="payment_history",
        category=IntentCategory.PAYMENT,
        description="View payment history",
        keywords=["tarix", "o'tmish", "history", "past payments", "transactions"],
        examples=[
            "To'lov tarixi",
            "Show payment history",
            "Past transactions",
        ],
    ),

    "payment_make": IntentConfig(
        name="payment_make",
        category=IntentCategory.PAYMENT,
        description="Make a payment",
        keywords=["to'lash", "to'lov qilish", "pay", "make payment", "transfer"],
        requires_entities=["amount"],
        examples=[
            "To'lov qilmoqchiman",
            "I want to make a payment",
            "Pay my tuition",
        ],
    ),

    "payment_methods": IntentConfig(
        name="payment_methods",
        category=IntentCategory.PAYMENT,
        description="View available payment methods",
        keywords=["usul", "method", "qanday", "how to pay", "payment options"],
        requires_auth=False,
        examples=[
            "Qanday to'lash mumkin?",
            "Payment methods",
            "How can I pay?",
        ],
    ),

    "payment_invoice": IntentConfig(
        name="payment_invoice",
        category=IntentCategory.PAYMENT,
        description="Get invoice/receipt",
        keywords=["kvitansiya", "chek", "invoice", "receipt", "bill"],
        examples=[
            "Kvitansiya",
            "Send me the invoice",
            "Receipt for payment",
        ],
    ),

    "payment_plan": IntentConfig(
        name="payment_plan",
        category=IntentCategory.PAYMENT,
        description="View or setup payment plan",
        keywords=["reja", "bo'lib", "plan", "installment", "monthly"],
        examples=[
            "Bo'lib to'lash",
            "Payment plan options",
            "Can I pay in installments?",
        ],
    ),

    "payment_discount": IntentConfig(
        name="payment_discount",
        category=IntentCategory.PAYMENT,
        description="Check for discounts/scholarships",
        keywords=["chegirma", "stipendiya", "discount", "scholarship", "promo"],
        examples=[
            "Chegirma bormi?",
            "Are there any scholarships?",
            "Discount codes",
        ],
    ),

    "payment_refund": IntentConfig(
        name="payment_refund",
        category=IntentCategory.PAYMENT,
        description="Request refund",
        keywords=["qaytarish", "refund", "money back", "return"],
        examples=[
            "Pulni qaytarish",
            "I want a refund",
            "Return my payment",
        ],
    ),

    # =========================================================================
    # ATTENDANCE INTENTS (5 intents)
    # =========================================================================

    "attendance_check": IntentConfig(
        name="attendance_check",
        category=IntentCategory.ATTENDANCE,
        description="Check attendance record",
        keywords=["davomat", "qatnashish", "attendance", "presence", "keldim"],
        aliases=["check_attendance"],
        examples=[
            "Mening davomatim",
            "Check my attendance",
            "How many classes did I attend?",
        ],
    ),

    "attendance_mark": IntentConfig(
        name="attendance_mark",
        category=IntentCategory.ATTENDANCE,
        description="Mark attendance (check-in)",
        keywords=["kelganman", "check in", "present", "here", "borman"],
        examples=[
            "Men keldim",
            "Mark me present",
            "Check me in",
        ],
    ),

    "attendance_excuse": IntentConfig(
        name="attendance_excuse",
        category=IntentCategory.ATTENDANCE,
        description="Submit absence excuse",
        keywords=["sabab", "excuse", "reason", "kelolmadim", "couldn't attend"],
        examples=[
            "Kela olmadim, sababi...",
            "Submit excuse for absence",
            "I was sick",
        ],
    ),

    "attendance_percentage": IntentConfig(
        name="attendance_percentage",
        category=IntentCategory.ATTENDANCE,
        description="Get attendance percentage",
        keywords=["foiz", "percentage", "necha foiz", "attendance rate"],
        examples=[
            "Davomat foizim",
            "What's my attendance rate?",
            "Attendance percentage",
        ],
    ),

    "attendance_minimum": IntentConfig(
        name="attendance_minimum",
        category=IntentCategory.ATTENDANCE,
        description="Check minimum attendance requirement",
        keywords=["minimal", "talab", "kerak", "requirement", "minimum needed"],
        examples=[
            "Minimal davomat qancha?",
            "What's the attendance requirement?",
            "How much attendance is needed?",
        ],
    ),

    # =========================================================================
    # CRM INTENTS (7 intents)
    # =========================================================================

    "lead_list": IntentConfig(
        name="lead_list",
        category=IntentCategory.CRM,
        description="List leads",
        keywords=["lidlar", "mijozlar", "leads", "prospects", "clients"],
        aliases=["list_leads"],
        examples=[
            "Yangi lidlar",
            "Show leads",
            "List prospects",
        ],
    ),

    "lead_add": IntentConfig(
        name="lead_add",
        category=IntentCategory.CRM,
        description="Add new lead",
        keywords=["lid qo'shish", "yangi mijoz", "add lead", "new prospect"],
        aliases=["add_lead"],
        requires_entities=["name", "phone"],
        examples=[
            "Yangi lid qo'shish",
            "Add a new lead",
            "Register prospect",
        ],
    ),

    "lead_stats": IntentConfig(
        name="lead_stats",
        category=IntentCategory.CRM,
        description="View lead statistics",
        keywords=["statistika", "hisobot", "stats", "statistics", "report"],
        aliases=["lead_stats"],
        examples=[
            "Lid statistikasi",
            "Show lead stats",
            "How many leads?",
        ],
    ),

    "lead_convert": IntentConfig(
        name="lead_convert",
        category=IntentCategory.CRM,
        description="Convert lead to student",
        keywords=["aylantirish", "convert", "o'quvchiga", "enroll lead"],
        requires_entities=["lead_id"],
        examples=[
            "Lidni o'quvchiga aylantirish",
            "Convert lead to student",
            "Enroll this prospect",
        ],
    ),

    "lead_source": IntentConfig(
        name="lead_source",
        category=IntentCategory.CRM,
        description="View lead sources",
        keywords=["manba", "source", "qayerdan", "where from", "channel"],
        examples=[
            "Lidlar qayerdan keladi?",
            "Lead sources",
            "Where do leads come from?",
        ],
    ),

    "lead_followup": IntentConfig(
        name="lead_followup",
        category=IntentCategory.CRM,
        description="Schedule lead follow-up",
        keywords=["kuzatish", "follow up", "qayta aloqa", "contact again"],
        requires_entities=["lead_id", "date"],
        examples=[
            "Lid bilan qayta bog'lanish",
            "Schedule follow-up",
            "Contact lead again",
        ],
    ),

    "student_count": IntentConfig(
        name="student_count",
        category=IntentCategory.CRM,
        description="Get student count statistics",
        keywords=["necha o'quvchi", "talaba soni", "how many students", "student count"],
        examples=[
            "Necha o'quvchi bor?",
            "Total students",
            "Student count",
        ],
    ),

    # =========================================================================
    # COMMUNICATION INTENTS (5 intents)
    # =========================================================================

    "send_message": IntentConfig(
        name="send_message",
        category=IntentCategory.COMMUNICATION,
        description="Send message to teacher/student",
        keywords=["xabar", "yuborish", "message", "send", "contact"],
        requires_entities=["recipient", "message"],
        examples=[
            "O'qituvchiga xabar yuborish",
            "Send message to teacher",
            "Contact instructor",
        ],
    ),

    "send_sms": IntentConfig(
        name="send_sms",
        category=IntentCategory.COMMUNICATION,
        description="Send SMS notification",
        keywords=["sms", "yuborish", "send sms", "text message"],
        aliases=["send_sms"],
        requires_entities=["phone", "message"],
        examples=[
            "SMS yuborish",
            "Send text message",
            "Notify by SMS",
        ],
    ),

    "notification_settings": IntentConfig(
        name="notification_settings",
        category=IntentCategory.COMMUNICATION,
        description="Manage notification settings",
        keywords=["bildirishnoma", "sozlash", "notifications", "settings", "alerts"],
        examples=[
            "Bildirishnoma sozlamalari",
            "Notification settings",
            "Manage alerts",
        ],
    ),

    "inbox": IntentConfig(
        name="inbox",
        category=IntentCategory.COMMUNICATION,
        description="View inbox/messages",
        keywords=["xabarlar", "inbox", "messages", "mail"],
        examples=[
            "Xabarlarim",
            "Check inbox",
            "Show messages",
        ],
    ),

    "announcement_create": IntentConfig(
        name="announcement_create",
        category=IntentCategory.COMMUNICATION,
        description="Create announcement",
        keywords=["e'lon", "announcement", "eʼlon", "notice", "broadcast"],
        requires_entities=["message"],
        examples=[
            "E'lon qilish",
            "Make announcement",
            "Send notice to all",
        ],
    ),

    # =========================================================================
    # ADMIN INTENTS (5 intents)
    # =========================================================================

    "report_generate": IntentConfig(
        name="report_generate",
        category=IntentCategory.ADMIN,
        description="Generate reports",
        keywords=["hisobot", "report", "statistika", "analytics"],
        examples=[
            "Hisobot yaratish",
            "Generate report",
            "Show statistics",
        ],
    ),

    "today_payments": IntentConfig(
        name="today_payments",
        category=IntentCategory.ADMIN,
        description="View today's payments",
        keywords=["bugungi to'lov", "today payments", "kunlik", "daily revenue"],
        aliases=["today_payments"],
        examples=[
            "Bugungi to'lovlar",
            "Today's revenue",
            "Daily payments",
        ],
    ),

    "group_manage": IntentConfig(
        name="group_manage",
        category=IntentCategory.ADMIN,
        description="Manage student groups",
        keywords=["guruh", "group", "boshqarish", "manage"],
        examples=[
            "Guruh boshqarish",
            "Manage groups",
            "Create new group",
        ],
    ),

    "teacher_assign": IntentConfig(
        name="teacher_assign",
        category=IntentCategory.ADMIN,
        description="Assign teacher to course",
        keywords=["o'qituvchi tayinlash", "assign teacher", "instructor assignment"],
        requires_entities=["teacher_name", "course_name"],
        examples=[
            "O'qituvchini kursga tayinlash",
            "Assign teacher to course",
            "Set instructor",
        ],
    ),

    "backup_data": IntentConfig(
        name="backup_data",
        category=IntentCategory.ADMIN,
        description="Backup system data",
        keywords=["zaxira", "backup", "nusxa", "save data"],
        examples=[
            "Ma'lumotlarni zaxiralash",
            "Backup data",
            "Save system data",
        ],
    ),

    # =========================================================================
    # GREETING/SOCIAL INTENTS (4 intents)
    # =========================================================================

    "greeting": IntentConfig(
        name="greeting",
        category=IntentCategory.GREETINGS,
        description="Greeting/hello",
        keywords=["salom", "assalomu", "hello", "hi", "hey", "good morning", "good day"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Salom",
            "Hello",
            "Assalomu alaykum",
            "Good morning",
        ],
        response_template="Salom! Men EduVoice AI assistant. Sizga qanday yordam bera olaman?",
    ),

    "goodbye": IntentConfig(
        name="goodbye",
        category=IntentCategory.GREETINGS,
        description="Goodbye/farewell",
        keywords=["xayr", "ko'rishamiz", "goodbye", "bye", "see you", "до свидания"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Xayr",
            "Goodbye",
            "Ko'rishguncha",
        ],
        response_template="Xayr! Omad tilaymiz. Tez orada ko'rishguncha!",
    ),

    "thanks": IntentConfig(
        name="thanks",
        category=IntentCategory.GREETINGS,
        description="Thank you",
        keywords=["rahmat", "tashakkur", "thank", "thanks", "спасибо"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Rahmat",
            "Thank you",
            "Thanks a lot",
        ],
        response_template="Arzimaydi! Yordam bera olganimdan xursandman. Yana savolingiz bormi?",
    ),

    "how_are_you": IntentConfig(
        name="how_are_you",
        category=IntentCategory.GREETINGS,
        description="How are you",
        keywords=["qalaysan", "ahvoling", "how are you", "what's up", "как дела"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Qalaysan?",
            "How are you?",
            "What's up?",
        ],
        response_template="Yaxshiman, rahmat! Sizga qanday yordam bera olaman?",
    ),

    # =========================================================================
    # HELP INTENTS (2 intents)
    # =========================================================================

    "help": IntentConfig(
        name="help",
        category=IntentCategory.HELP,
        description="Request help/assistance",
        keywords=["yordam", "help", "assist", "qanday", "how to"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Yordam",
            "Help me",
            "How do I...",
        ],
    ),

    "capabilities": IntentConfig(
        name="capabilities",
        category=IntentCategory.HELP,
        description="Ask what AI can do",
        keywords=["nima qila olasiz", "what can you do", "capabilities", "features", "возможности"],
        requires_auth=False,
        min_confidence=0.3,
        examples=[
            "Nima qila olasiz?",
            "What can you help with?",
            "Show me what you can do",
        ],
    ),
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_intent_config(intent_name: str) -> Optional[IntentConfig]:
    """Get intent configuration by name"""
    return INTENT_DEFINITIONS.get(intent_name)

def get_intents_by_category(category: IntentCategory) -> List[IntentConfig]:
    """Get all intents in a category"""
    return [config for config in INTENT_DEFINITIONS.values() if config.category == category]

def get_all_keywords() -> Dict[str, List[str]]:
    """Get all keywords mapped to intent names"""
    return {intent.name: intent.keywords for intent in INTENT_DEFINITIONS.values()}

def get_all_intents() -> List[str]:
    """Get list of all intent names"""
    return list(INTENT_DEFINITIONS.keys())

def get_intent_count_by_category() -> Dict[str, int]:
    """Get count of intents per category"""
    counts = {}
    for config in INTENT_DEFINITIONS.values():
        category = config.category.value
        counts[category] = counts.get(category, 0) + 1
    return counts

# Export total count
TOTAL_INTENTS = len(INTENT_DEFINITIONS)

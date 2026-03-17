from datetime import date, time

from django.test import TestCase, override_settings
from unittest.mock import patch

from users.models import User
from student_profile.models import Attendance, Branch, Course, Group, Payment
from student_profile.accounting_models import (
    AttendanceCharge,
    CompanyShareEntry,
    StudentAccount,
    TeacherEarnings,
)
from student_profile.services.financial_automation import (
    apply_attendance_policies,
    apply_payment_to_student_account,
    calculate_per_lesson_fee_tiyin,
    estimate_group_class_days,
)


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_BROKER_URL='memory://',
    CHANNEL_LAYERS={
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    },
)
class FinancialAutomationTests(TestCase):
    def setUp(self):
        self._index_delay_patcher = patch('ai.signals.index_object_task.delay', return_value=None)
        self._deindex_delay_patcher = patch('ai.signals.deindex_object_task.delay', return_value=None)
        self._index_delay_patcher.start()
        self._deindex_delay_patcher.start()
        self.addCleanup(self._index_delay_patcher.stop)
        self.addCleanup(self._deindex_delay_patcher.stop)

        self.admin = User.objects.create_user(
            username='admin_test',
            password='admin123',
            is_staff=True,
        )
        self.student = User.objects.create_user(
            username='student_test',
            password='student123',
        )
        self.teacher = User.objects.create_user(
            username='teacher_test',
            password='teacher123',
            is_teacher=True,
            salary_percentage=40,
        )
        self.branch = Branch.objects.create(name='Main Branch')
        self.course = Course.objects.create(
            name='Math',
            price=60_000_000,  # 600,000 UZS stored as tiyin
            duration_months=1,
        )
        self.group = Group.objects.create(
            name='Group A',
            branch=self.branch,
            course=self.course,
            main_teacher=self.teacher,
            start_day=date(2026, 3, 1),
            end_day=date(2026, 12, 1),
            start_time=time(9, 0),
            end_time=time(10, 0),
            days='mon,wed,fri',
            billing_mode=Group.BILLING_MODE_FIXED_PLANNED,
            planned_monthly_lessons=12,
        )
        self.group.students.add(self.student)

    def test_present_attendance_posts_charge_and_split(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=10_000_000)
        attendance = Attendance.objects.create(
            student=self.student,
            group=self.group,
            date=date(2026, 3, 2),
            attendance_status=Attendance.STATUS_PRESENT,
        )

        apply_attendance_policies(attendance, actor=self.admin)

        account.refresh_from_db()
        charge = AttendanceCharge.objects.get(
            attendance=attendance,
            entry_type=AttendanceCharge.ENTRY_CHARGE,
            is_active_charge=True,
        )

        self.assertEqual(account.balance_tiyin, 5_000_000)
        self.assertEqual(charge.per_lesson_fee_tiyin, 5_000_000)
        self.assertEqual(charge.teacher_amount_tiyin, 2_000_000)
        self.assertEqual(charge.company_amount_tiyin, 3_000_000)
        self.assertTrue(TeacherEarnings.objects.filter(attendance_charge=charge, amount=2_000_000).exists())
        self.assertTrue(CompanyShareEntry.objects.filter(charge=charge, amount_tiyin=3_000_000).exists())

    def test_present_marking_is_idempotent(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=10_000_000)
        attendance = Attendance.objects.create(
            student=self.student,
            group=self.group,
            date=date(2026, 3, 2),
            attendance_status=Attendance.STATUS_PRESENT,
        )

        apply_attendance_policies(attendance, actor=self.admin)
        apply_attendance_policies(attendance, actor=self.admin)

        account.refresh_from_db()
        self.assertEqual(account.balance_tiyin, 5_000_000)
        self.assertEqual(
            AttendanceCharge.objects.filter(
                attendance=attendance,
                entry_type=AttendanceCharge.ENTRY_CHARGE,
                is_active_charge=True,
            ).count(),
            1,
        )

    def test_reversal_restores_balance_and_financial_entries(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=10_000_000)
        attendance = Attendance.objects.create(
            student=self.student,
            group=self.group,
            date=date(2026, 3, 2),
            attendance_status=Attendance.STATUS_PRESENT,
        )
        apply_attendance_policies(attendance, actor=self.admin)

        attendance.attendance_status = Attendance.STATUS_ABSENT_UNEXCUSED
        attendance.save(update_fields=['attendance_status', 'is_present'])
        apply_attendance_policies(attendance, actor=self.admin)

        account.refresh_from_db()
        original_charge = AttendanceCharge.objects.filter(
            attendance=attendance,
            entry_type=AttendanceCharge.ENTRY_CHARGE,
        ).first()
        reversal_charge = AttendanceCharge.objects.filter(
            attendance=attendance,
            entry_type=AttendanceCharge.ENTRY_REVERSAL,
        ).first()

        self.assertIsNotNone(original_charge)
        self.assertIsNotNone(reversal_charge)
        self.assertFalse(original_charge.is_active_charge)
        self.assertEqual(account.balance_tiyin, 10_000_000)
        self.assertEqual(
            TeacherEarnings.objects.filter(attendance_charge__attendance=attendance).count(),
            2,
        )
        teacher_net = sum(
            row.amount for row in TeacherEarnings.objects.filter(attendance_charge__attendance=attendance)
        )
        company_net = sum(
            row.amount_tiyin for row in CompanyShareEntry.objects.filter(charge__attendance=attendance)
        )
        self.assertEqual(teacher_net, 0)
        self.assertEqual(company_net, 0)

    def test_negative_balance_is_allowed(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=0)
        attendance = Attendance.objects.create(
            student=self.student,
            group=self.group,
            date=date(2026, 3, 2),
            attendance_status=Attendance.STATUS_PRESENT,
        )
        apply_attendance_policies(attendance, actor=self.admin)
        account.refresh_from_db()
        self.assertEqual(account.balance_tiyin, -5_000_000)

    def test_payment_reduces_existing_debt(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=-5_000_000)
        payment = Payment.objects.create(
            by_user=self.student,
            group=self.group,
            amount=10_000_000,  # 100,000 UZS stored as tiyin
            status=Payment.PaymentStatus.PAID,
            course_price=self.course.price,
            date=date(2026, 3, 2),
        )

        apply_payment_to_student_account(payment, actor=self.admin)
        account.refresh_from_db()
        self.assertEqual(account.balance_tiyin, 5_000_000)

    def test_actual_monthly_mode_uses_calendar_denominator(self):
        self.group.billing_mode = Group.BILLING_MODE_ACTUAL_MONTHLY
        self.group.days = 'mon,tue,wed,thu'
        self.group.save(update_fields=['billing_mode', 'days'])

        lesson_date = date(2026, 3, 10)
        estimated_days = estimate_group_class_days(self.group, lesson_date.year, lesson_date.month)
        _, denominator, per_lesson_fee_tiyin = calculate_per_lesson_fee_tiyin(self.group, lesson_date)

        self.assertEqual(denominator, estimated_days)
        self.assertEqual(per_lesson_fee_tiyin, round(self.course.price / estimated_days))

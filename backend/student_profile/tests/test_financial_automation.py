from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from users.models import User
from student_profile.models import Branch, Course, Group, Attendance
from student_profile.accounting_models import (
    AccountingActivityLog,
    MonthlySubscriptionCharge,
    StudentAccount,
)
from student_profile.services.financial_automation import (
    accounting_realtime_metrics,
    apply_attendance_policies,
    apply_monthly_subscription_charge,
    calculate_teacher_salary_tiyin,
)


class FinancialAutomationTests(TestCase):
    def setUp(self):
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
        )
        self.branch = Branch.objects.create(name='Main Branch')
        self.course = Course.objects.create(
            name='Math',
            price=1_000_000,
            duration_months=1,
        )
        today = timezone.now().date()
        self.group = Group.objects.create(
            name='Group A',
            branch=self.branch,
            course=self.course,
            main_teacher=self.teacher,
            start_day=today - timedelta(days=15),
            end_day=today + timedelta(days=60),
            start_time=time(9, 0),
            end_time=time(10, 0),
            days='mon,tue,wed,thu,fri',
        )
        self.group.students.add(self.student)

    def test_monthly_charge_can_create_negative_debt(self):
        account = StudentAccount.objects.create(student=self.student, balance_tiyin=500_000)
        charge, created = apply_monthly_subscription_charge(
            student=self.student,
            group=self.group,
            target_date=timezone.now().date(),
            actor=self.admin,
        )
        account.refresh_from_db()

        self.assertTrue(created)
        self.assertIsNotNone(charge)
        self.assertEqual(account.balance_tiyin, -500_000)
        self.assertTrue(
            AccountingActivityLog.objects.filter(
                student=self.student,
                action_type=AccountingActivityLog.ACTION_DEBT_CREATED,
            ).exists()
        )

    def test_three_unexcused_absences_deactivate_student(self):
        apply_monthly_subscription_charge(
            student=self.student,
            group=self.group,
            target_date=timezone.now().date(),
            actor=self.admin,
        )

        base_date = timezone.now().date()
        for offset in range(3):
            attendance = Attendance.objects.create(
                student=self.student,
                group=self.group,
                date=base_date - timedelta(days=offset),
                attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED,
            )
            apply_attendance_policies(attendance, actor=self.admin)

        account = StudentAccount.objects.get(student=self.student)
        charge = MonthlySubscriptionCharge.objects.get(
            student=self.student,
            group=self.group,
            year=base_date.year,
            month=base_date.month,
        )
        self.student.refresh_from_db()

        self.assertEqual(account.status, StudentAccount.STATUS_DEACTIVATED)
        self.assertFalse(self.student.is_active)
        self.assertEqual(charge.settlement_status, MonthlySubscriptionCharge.SETTLEMENT_DEACTIVATED)

    def test_three_excused_absences_freeze_student(self):
        apply_monthly_subscription_charge(
            student=self.student,
            group=self.group,
            target_date=timezone.now().date(),
            actor=self.admin,
        )

        base_date = timezone.now().date()
        present = Attendance.objects.create(
            student=self.student,
            group=self.group,
            date=base_date - timedelta(days=3),
            attendance_status=Attendance.STATUS_PRESENT,
        )
        apply_attendance_policies(present, actor=self.admin)

        for offset in range(3):
            attendance = Attendance.objects.create(
                student=self.student,
                group=self.group,
                date=base_date - timedelta(days=offset),
                attendance_status=Attendance.STATUS_ABSENCE_EXCUSED,
            )
            apply_attendance_policies(attendance, actor=self.admin)

        account = StudentAccount.objects.get(student=self.student)
        charge = MonthlySubscriptionCharge.objects.get(
            student=self.student,
            group=self.group,
            year=base_date.year,
            month=base_date.month,
        )
        self.student.refresh_from_db()

        self.assertEqual(account.status, StudentAccount.STATUS_FROZEN)
        self.assertFalse(self.student.is_active)
        self.assertEqual(charge.settlement_status, MonthlySubscriptionCharge.SETTLEMENT_FROZEN)
        self.assertGreaterEqual(charge.refunded_tiyin, 0)

    def test_teacher_salary_calculation_active_student(self):
        salary_tiyin = calculate_teacher_salary_tiyin(
            monthly_price_tiyin=1_200_000,
            present_days=12,
            billable_days=12,
            total_sessions=12,
        )
        self.assertEqual(salary_tiyin, 480_000)

    def test_teacher_salary_calculation_prorated_after_status_change(self):
        salary_tiyin = calculate_teacher_salary_tiyin(
            monthly_price_tiyin=1_200_000,
            present_days=5,
            billable_days=5,
            total_sessions=12,
        )
        self.assertEqual(salary_tiyin, 200_000)

    def test_realtime_metrics_include_teacher_payroll(self):
        apply_monthly_subscription_charge(
            student=self.student,
            group=self.group,
            target_date=timezone.now().date(),
            actor=self.admin,
        )
        metrics = accounting_realtime_metrics()
        self.assertEqual(metrics['teacher_payroll_tiyin'], 400_000)

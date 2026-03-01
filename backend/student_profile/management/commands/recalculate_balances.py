"""
Management command to recalculate all student balances.
Usage: python manage.py recalculate_balances
"""

from django.core.management.base import BaseCommand
from django.db.models import Sum
from student_profile.accounting_models import StudentBalance
from student_profile.models import Payment


class Command(BaseCommand):
    help = 'Recalculate all student balances based on payments and fines'

    def add_arguments(self, parser):
        parser.add_argument(
            '--student',
            type=int,
            help='Recalculate balance for a specific student ID'
        )
        parser.add_argument(
            '--group',
            type=int,
            help='Recalculate balances for a specific group ID'
        )

    def handle(self, *args, **options):
        student_id = options.get('student')
        group_id = options.get('group')

        # Get balances to recalculate
        balances = StudentBalance.objects.all()

        if student_id:
            balances = balances.filter(student_id=student_id)
            self.stdout.write(f"Recalculating balances for student ID: {student_id}")
        elif group_id:
            balances = balances.filter(group_id=group_id)
            self.stdout.write(f"Recalculating balances for group ID: {group_id}")
        else:
            self.stdout.write("Recalculating ALL student balances...")

        total = balances.count()
        self.stdout.write(f"Found {total} balance(s) to recalculate\n")

        success_count = 0
        error_count = 0

        for balance in balances:
            try:
                # Recalculate paid amount from actual payments
                paid_payments = Payment.objects.filter(
                    by_user=balance.student,
                    group=balance.group,
                    status='paid'
                ).aggregate(total=Sum('amount'))

                balance.paid_amount = paid_payments['total'] or 0

                # Recalculate balance
                balance.calculate_balance()

                success_count += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ {balance.student.username} - {balance.group.name}: "
                        f"Paid {balance.paid_amount_in_sum} UZS, "
                        f"Balance {balance.balance_in_sum} UZS"
                    )
                )

            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Error recalculating balance for "
                        f"{balance.student.username} - {balance.group.name}: {e}"
                    )
                )

        # Summary
        self.stdout.write("\n" + "="*50)
        self.stdout.write(self.style.SUCCESS(f"Successfully recalculated: {success_count}"))

        if error_count > 0:
            self.stdout.write(self.style.ERROR(f"Errors: {error_count}"))

        self.stdout.write("="*50)

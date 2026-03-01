"""
Management command to calculate financial summaries for date range.
Usage: python manage.py calculate_financial_summary --date 2025-10-30
       python manage.py calculate_financial_summary --month 2025-10
       python manage.py calculate_financial_summary --date-from 2025-10-01 --date-to 2025-10-31
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from student_profile.accounting_models import FinancialSummary
from student_profile.models import Branch


class Command(BaseCommand):
    help = 'Calculate financial summaries for specified date range'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Calculate for specific date (YYYY-MM-DD)'
        )
        parser.add_argument(
            '--date-from',
            type=str,
            help='Start date (YYYY-MM-DD)'
        )
        parser.add_argument(
            '--date-to',
            type=str,
            help='End date (YYYY-MM-DD)'
        )
        parser.add_argument(
            '--month',
            type=str,
            help='Calculate for entire month (YYYY-MM)'
        )
        parser.add_argument(
            '--branch',
            type=int,
            help='Calculate for specific branch ID (default: all branches)'
        )
        parser.add_argument(
            '--today',
            action='store_true',
            help='Calculate for today'
        )
        parser.add_argument(
            '--yesterday',
            action='store_true',
            help='Calculate for yesterday'
        )

    def handle(self, *args, **options):
        branch_id = options.get('branch')
        branch = None

        if branch_id:
            try:
                branch = Branch.objects.get(id=branch_id)
                self.stdout.write(f"Calculating for branch: {branch.name}\n")
            except Branch.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Branch ID {branch_id} not found"))
                return

        # Determine date range
        dates = self._get_dates(options)

        if not dates:
            self.stdout.write(self.style.ERROR(
                "Please specify --date, --month, --date-from/--date-to, --today, or --yesterday"
            ))
            return

        self.stdout.write(f"Calculating financial summaries for {len(dates)} day(s)...\n")

        success_count = 0
        error_count = 0

        for date in dates:
            try:
                # Get or create summary
                summary, created = FinancialSummary.objects.get_or_create(
                    date=date,
                    branch=branch
                )

                # Calculate
                summary.calculate()

                action = "Created" if created else "Updated"
                success_count += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ {action} {date}: "
                        f"Revenue: {summary.total_payments_in_sum} UZS, "
                        f"Expenses: {summary.total_expenses / 100} UZS, "
                        f"Profit: {summary.net_profit_in_sum} UZS"
                    )
                )

            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"✗ Error calculating {date}: {e}")
                )

        # Summary
        self.stdout.write("\n" + "="*50)
        self.stdout.write(self.style.SUCCESS(f"Successfully calculated: {success_count}"))

        if error_count > 0:
            self.stdout.write(self.style.ERROR(f"Errors: {error_count}"))

        self.stdout.write("="*50)

    def _get_dates(self, options):
        """Determine which dates to calculate based on options"""
        dates = []

        # Today
        if options.get('today'):
            dates.append(timezone.now().date())

        # Yesterday
        elif options.get('yesterday'):
            dates.append(timezone.now().date() - timedelta(days=1))

        # Specific date
        elif options.get('date'):
            try:
                date = datetime.strptime(options['date'], '%Y-%m-%d').date()
                dates.append(date)
            except ValueError:
                self.stdout.write(self.style.ERROR('Invalid date format. Use YYYY-MM-DD'))
                return []

        # Month
        elif options.get('month'):
            try:
                year, month = map(int, options['month'].split('-'))
                # Get first and last day of month
                first_day = datetime(year, month, 1).date()
                if month == 12:
                    last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
                else:
                    last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)

                # Generate all dates in month
                current = first_day
                while current <= last_day:
                    dates.append(current)
                    current += timedelta(days=1)

            except ValueError:
                self.stdout.write(self.style.ERROR('Invalid month format. Use YYYY-MM'))
                return []

        # Date range
        elif options.get('date_from') and options.get('date_to'):
            try:
                date_from = datetime.strptime(options['date_from'], '%Y-%m-%d').date()
                date_to = datetime.strptime(options['date_to'], '%Y-%m-%d').date()

                current = date_from
                while current <= date_to:
                    dates.append(current)
                    current += timedelta(days=1)

            except ValueError:
                self.stdout.write(self.style.ERROR('Invalid date format. Use YYYY-MM-DD'))
                return []

        return dates

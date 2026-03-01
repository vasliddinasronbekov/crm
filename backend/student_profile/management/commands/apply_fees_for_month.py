from django.core.management.base import BaseCommand
from student_profile.tasks import apply_monthly_fees
from datetime import datetime

class Command(BaseCommand):
    help = 'Manually apply monthly course fees for a specific month and year.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='The year to apply fees for.')
        parser.add_argument('--month', type=int, help='The month to apply fees for.')

    def handle(self, *args, **options):
        year = options['year']
        month = options['month']

        if not year or not month:
            self.stdout.write(self.style.ERROR('Both --year and --month are required.'))
            return

        try:
            target_date = datetime(year, month, 1).date()
        except ValueError:
            self.stdout.write(self.style.ERROR('Invalid year or month.'))
            return

        self.stdout.write(f"Applying monthly fees for {month}/{year}...")

        # I will need to refactor the apply_monthly_fees task to accept a date.
        # For now, I am assuming it will be refactored.
        result = apply_monthly_fees(target_date=str(target_date))

        self.stdout.write(self.style.SUCCESS(f"Fees applied: {result.get('fees_applied_count', 0)}"))
        if result.get('errors'):
            self.stdout.write(self.style.WARNING(f"Errors: {result.get('errors')}"))

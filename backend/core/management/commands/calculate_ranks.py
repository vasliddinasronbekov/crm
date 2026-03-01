# /mnt/usb/edu-api-project/core/management/commands/calculate_ranks.py

from django.core.management.base import BaseCommand
from django.db.models import Avg, Window, F
from django.db.models.functions import Rank
from users.models import User

class Command(BaseCommand):
    help = 'Calculates and updates the rank for all students based on their average score.'

    def handle(self, *args, **options):
        self.stdout.write("Studentlar reytingini hisoblash boshlandi...")

        # O'rtacha baho bo'yicha kamayish tartibida reytingni hisoblaymiz
        # Bahosi yo'q studentlar reytingdan tashqarida qoladi
        students_to_update = User.objects.filter(
            is_teacher=False, is_staff=False
        ).annotate(
            avg_score=Avg('exam_scores__score')
        ).filter(
            avg_score__isnull=False
        ).annotate(
            # SQL Window funksiyasi yordamida rankni hisoblaymiz
            rank_calculated=Window(
                expression=Rank(),
                order_by=F('avg_score').desc()
            )
        )

        # Foydalanuvchilarni bittada, samarali yangilash
        users_to_bulk_update = []
        for student in students_to_update:
            student.rank = student.rank_calculated
            users_to_bulk_update.append(student)

        User.objects.bulk_update(users_to_bulk_update, ['rank'])

        self.stdout.write(self.style.SUCCESS(f"{len(users_to_bulk_update)} ta talabaning reytingi muvaffaqiyatli yangilandi."))
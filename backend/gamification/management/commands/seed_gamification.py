"""
Management command to seed initial gamification data
Usage: python manage.py seed_gamification
"""

from django.core.management.base import BaseCommand
from gamification.models import Badge, DailyChallenge, Achievement


class Command(BaseCommand):
    help = 'Seeds initial gamification data (badges, challenges, achievements)'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding gamification data...')

        # Create Badges
        badges_data = [
            # Milestone Badges
            {
                'name': 'First Steps',
                'name_uz': 'Birinchi Qadamlar',
                'name_ru': 'Первые Шаги',
                'description': 'Complete your first lesson',
                'description_uz': 'Birinchi darsni tugatish',
                'description_ru': 'Завершите свой первый урок',
                'badge_type': 'milestone',
                'rarity': 'common',
                'xp_reward': 50,
                'coins_reward': 5,
                'criteria': {'slug': 'first_lesson', 'requirement': 1}
            },
            {
                'name': 'Fast Learner',
                'name_uz': 'Tez O\'rganuvchi',
                'name_ru': 'Быстрый Ученик',
                'description': 'Complete 10 lessons',
                'description_uz': '10 ta darsni tugatish',
                'description_ru': 'Завершите 10 уроков',
                'badge_type': 'milestone',
                'rarity': 'uncommon',
                'xp_reward': 100,
                'coins_reward': 10,
                'criteria': {'slug': 'first_10_lessons', 'requirement': 10}
            },
            {
                'name': 'Dedicated Scholar',
                'name_uz': 'Sadoqatli Talaba',
                'name_ru': 'Преданный Ученик',
                'description': 'Complete 50 lessons',
                'description_uz': '50 ta darsni tugatish',
                'description_ru': 'Завершите 50 уроков',
                'badge_type': 'milestone',
                'rarity': 'rare',
                'xp_reward': 250,
                'coins_reward': 25,
                'criteria': {'slug': 'first_50_lessons', 'requirement': 50}
            },
            {
                'name': 'Century Learner',
                'name_uz': 'Asr O\'quvchisi',
                'name_ru': 'Столетний Ученик',
                'description': 'Complete 100 lessons',
                'description_uz': '100 ta darsni tugatish',
                'description_ru': 'Завершите 100 уроков',
                'badge_type': 'milestone',
                'rarity': 'epic',
                'xp_reward': 500,
                'coins_reward': 50,
                'criteria': {'slug': 'century_learner', 'requirement': 100}
            },
            # Achievement Badges
            {
                'name': 'Perfectionist',
                'name_uz': 'Mukammallik',
                'name_ru': 'Перфекционист',
                'description': 'Get 10 perfect quiz scores (100%)',
                'description_uz': '10 ta mukammal test natijasi (100%)',
                'description_ru': 'Получите 10 идеальных результатов (100%)',
                'badge_type': 'achievement',
                'rarity': 'rare',
                'xp_reward': 300,
                'coins_reward': 30,
                'criteria': {'slug': 'perfectionist', 'requirement': 10}
            },
            {
                'name': 'Course Completer',
                'name_uz': 'Kurs Yakunlovchi',
                'name_ru': 'Завершивший Курс',
                'description': 'Complete your first course',
                'description_uz': 'Birinchi kursni tugatish',
                'description_ru': 'Завершите свой первый курс',
                'badge_type': 'milestone',
                'rarity': 'uncommon',
                'xp_reward': 200,
                'coins_reward': 20,
                'criteria': {'slug': 'first_course_complete', 'requirement': 1}
            },
            {
                'name': 'Knowledge Seeker',
                'name_uz': 'Bilim Izlovchi',
                'name_ru': 'Искатель Знаний',
                'description': 'Complete 5 courses',
                'description_uz': '5 ta kursni tugatish',
                'description_ru': 'Завершите 5 курсов',
                'badge_type': 'milestone',
                'rarity': 'rare',
                'xp_reward': 400,
                'coins_reward': 40,
                'criteria': {'slug': 'knowledge_seeker', 'requirement': 5}
            },
            {
                'name': 'Learning Master',
                'name_uz': 'O\'quv Ustasi',
                'name_ru': 'Мастер Обучения',
                'description': 'Complete 10 courses',
                'description_uz': '10 ta kursni tugatish',
                'description_ru': 'Завершите 10 курсов',
                'badge_type': 'milestone',
                'rarity': 'epic',
                'xp_reward': 750,
                'coins_reward': 75,
                'criteria': {'slug': 'learning_master', 'requirement': 10}
            },
            # Streak Badges
            {
                'name': 'Week Warrior',
                'name_uz': 'Haftalik Jangchi',
                'name_ru': 'Недельный Воин',
                'description': 'Maintain a 7-day learning streak',
                'description_uz': '7 kunlik o\'quv jarayonini davom ettirish',
                'description_ru': 'Поддерживайте 7-дневную серию обучения',
                'badge_type': 'streak',
                'rarity': 'uncommon',
                'xp_reward': 150,
                'coins_reward': 15,
                'criteria': {'slug': 'week_warrior', 'requirement': 7}
            },
            {
                'name': 'Month Marathon',
                'name_uz': 'Oylik Marafon',
                'name_ru': 'Месячный Марафон',
                'description': 'Maintain a 30-day learning streak',
                'description_uz': '30 kunlik o\'quv jarayonini davom ettirish',
                'description_ru': 'Поддерживайте 30-дневную серию обучения',
                'badge_type': 'streak',
                'rarity': 'epic',
                'xp_reward': 600,
                'coins_reward': 60,
                'criteria': {'slug': 'month_marathon', 'requirement': 30}
            },
            {
                'name': 'Unstoppable',
                'name_uz': 'To\'xtovsiz',
                'name_ru': 'Неостановимый',
                'description': 'Maintain a 100-day learning streak',
                'description_uz': '100 kunlik o\'quv jarayonini davom ettirish',
                'description_ru': 'Поддерживайте 100-дневную серию обучения',
                'badge_type': 'streak',
                'rarity': 'legendary',
                'xp_reward': 1500,
                'coins_reward': 150,
                'criteria': {'slug': 'unstoppable', 'requirement': 100}
            },
        ]

        for badge_data in badges_data:
            badge, created = Badge.objects.get_or_create(
                name=badge_data['name'],
                defaults=badge_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created badge: {badge.name}'))

        # Create Daily Challenges
        challenges_data = [
            {
                'title': 'Complete 3 Lessons',
                'title_uz': '3 ta Darsni Tugatish',
                'title_ru': 'Завершите 3 Урока',
                'description': 'Complete at least 3 lessons today',
                'description_uz': 'Bugun kamida 3 ta darsni tugatish',
                'description_ru': 'Завершите как минимум 3 урока сегодня',
                'challenge_type': 'lessons',
                'target_value': 3,
                'xp_reward': 50,
                'coins_reward': 5,
                'difficulty': 'easy'
            },
            {
                'title': 'Study for 30 Minutes',
                'title_uz': '30 Daqiqa O\'qish',
                'title_ru': 'Изучайте 30 Минут',
                'description': 'Spend at least 30 minutes learning today',
                'description_uz': 'Bugun kamida 30 daqiqa o\'qing',
                'description_ru': 'Потратьте как минимум 30 минут на обучение сегодня',
                'challenge_type': 'study_time',
                'target_value': 30,
                'xp_reward': 60,
                'coins_reward': 6,
                'difficulty': 'medium'
            },
            {
                'title': 'Take 2 Quizzes',
                'title_uz': '2 ta Test Topshirish',
                'title_ru': 'Пройдите 2 Теста',
                'description': 'Complete at least 2 quizzes today',
                'description_uz': 'Bugun kamida 2 ta test topshiring',
                'description_ru': 'Пройдите как минимум 2 теста сегодня',
                'challenge_type': 'quiz',
                'target_value': 2,
                'xp_reward': 70,
                'coins_reward': 7,
                'difficulty': 'medium'
            },
            {
                'title': 'Get a Perfect Score',
                'title_uz': 'Mukammal Ball Oling',
                'title_ru': 'Получите Идеальный Балл',
                'description': 'Score 100% on any quiz today',
                'description_uz': 'Bugun biron bir testdan 100% ball oling',
                'description_ru': 'Наберите 100% на любом тесте сегодня',
                'challenge_type': 'perfect_score',
                'target_value': 1,
                'xp_reward': 100,
                'coins_reward': 10,
                'difficulty': 'hard'
            },
            {
                'title': 'Complete 5 Lessons',
                'title_uz': '5 ta Darsni Tugatish',
                'title_ru': 'Завершите 5 Уроков',
                'description': 'Complete at least 5 lessons today',
                'description_uz': 'Bugun kamida 5 ta darsni tugatish',
                'description_ru': 'Завершите как минимум 5 уроков сегодня',
                'challenge_type': 'lessons',
                'target_value': 5,
                'xp_reward': 80,
                'coins_reward': 8,
                'difficulty': 'medium'
            },
            {
                'title': 'Study for 1 Hour',
                'title_uz': '1 Soat O\'qish',
                'title_ru': 'Изучайте 1 Час',
                'description': 'Spend at least 1 hour learning today',
                'description_uz': 'Bugun kamida 1 soat o\'qing',
                'description_ru': 'Потратьте как минимум 1 час на обучение сегодня',
                'challenge_type': 'study_time',
                'target_value': 60,
                'xp_reward': 120,
                'coins_reward': 12,
                'difficulty': 'hard'
            },
        ]

        for challenge_data in challenges_data:
            challenge, created = DailyChallenge.objects.get_or_create(
                title=challenge_data['title'],
                defaults=challenge_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created challenge: {challenge.title}'))

        # Create Achievements
        achievements_data = [
            {
                'name': 'Quiz Master',
                'name_uz': 'Test Ustasi',
                'name_ru': 'Мастер Тестов',
                'description': 'Excel at taking quizzes',
                'description_uz': 'Testlarda ustunlik qilish',
                'description_ru': 'Преуспейте в прохождении тестов',
                'category': 'learning',
                'tiers': [
                    {'level': 1, 'requirement': 10, 'xp': 100, 'name': 'Bronze'},
                    {'level': 2, 'requirement': 50, 'xp': 250, 'name': 'Silver'},
                    {'level': 3, 'requirement': 100, 'xp': 500, 'name': 'Gold'},
                    {'level': 4, 'requirement': 250, 'xp': 1000, 'name': 'Platinum'},
                ]
            },
            {
                'name': 'Social Learner',
                'name_uz': 'Ijtimoiy O\'quvchi',
                'name_ru': 'Социальный Ученик',
                'description': 'Engage with the community',
                'description_uz': 'Jamiyat bilan muloqot qilish',
                'description_ru': 'Взаимодействуйте с сообществом',
                'category': 'social',
                'tiers': [
                    {'level': 1, 'requirement': 10, 'xp': 80, 'name': 'Friendly'},
                    {'level': 2, 'requirement': 50, 'xp': 200, 'name': 'Popular'},
                    {'level': 3, 'requirement': 100, 'xp': 400, 'name': 'Influencer'},
                ]
            },
            {
                'name': 'Competitive Spirit',
                'name_uz': 'Raqobat Ruhi',
                'name_ru': 'Соревновательный Дух',
                'description': 'Climb the leaderboards',
                'description_uz': 'Reyting jadvalida ko\'tarilish',
                'description_ru': 'Поднимайтесь по таблицам лидеров',
                'category': 'competitive',
                'tiers': [
                    {'level': 1, 'requirement': 10, 'xp': 100, 'name': 'Contender'},
                    {'level': 2, 'requirement': 5, 'xp': 250, 'name': 'Champion'},
                    {'level': 3, 'requirement': 1, 'xp': 500, 'name': 'Legend'},
                ]
            },
        ]

        for achievement_data in achievements_data:
            achievement, created = Achievement.objects.get_or_create(
                name=achievement_data['name'],
                defaults=achievement_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created achievement: {achievement.name}'))

        self.stdout.write(self.style.SUCCESS('\n✅ Gamification data seeded successfully!'))
        self.stdout.write(f'Total badges: {Badge.objects.count()}')
        self.stdout.write(f'Total challenges: {DailyChallenge.objects.count()}')
        self.stdout.write(f'Total achievements: {Achievement.objects.count()}')

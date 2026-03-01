"""
Management command to populate database with realistic sample data for testing.

Usage:
    python manage.py populate_sample_data --students 100 --days 30
    python manage.py populate_sample_data --clear  # Clear all sample data first
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from datetime import date, timedelta, datetime, time
import random
from decimal import Decimal

from users.models import User
from student_profile.models import (
    Branch, Course, Room, Group, Attendance, Event,
    ExamScore, Payment, PaymentType, Story, StudentCoins,
    Ticket, TicketChat, Expense, ExpenseType, Information,
    ShopProduct, ShopOrder
)
from task.models import Board, List, Task
from messaging.models import MessageTemplate, SmsHistory, AutomaticMessage
from crm.models import Source, LeadDepartment, SubDepartment, Lead


class Command(BaseCommand):
    help = 'Populate database with realistic sample data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--students',
            type=int,
            default=50,
            help='Number of students to create (default: 50)'
        )
        parser.add_argument(
            '--teachers',
            type=int,
            default=10,
            help='Number of teachers to create (default: 10)'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days of historical data (default: 30)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing sample data before generating new data'
        )

    def handle(self, *args, **options):
        num_students = options['students']
        num_teachers = options['teachers']
        num_days = options['days']
        clear_data = options['clear']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('SAMPLE DATA GENERATOR'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        if clear_data:
            self.clear_sample_data()

        self.stdout.write('\nGenerating sample data...\n')

        with transaction.atomic():
            # Create foundational data
            branches = self.create_branches()
            courses = self.create_courses()
            rooms = self.create_rooms(branches)
            payment_types = self.create_payment_types()
            expense_types = self.create_expense_types()
            shop_products = self.create_shop_products()

            # Create users
            teachers = self.create_teachers(num_teachers, branches)
            students = self.create_students(num_students, branches)

            # Create groups
            groups = self.create_groups(branches, courses, rooms, teachers)

            # Assign students to groups
            self.assign_students_to_groups(students, groups)

            # Create historical data
            self.create_attendance(students, groups, num_days)
            self.create_exam_scores(students, groups, num_days)
            self.create_payments(students, groups, payment_types, num_days)
            self.create_events(students, num_days)
            self.create_tasks(students, teachers, num_days)
            self.create_messages(students, num_days)
            self.create_stories(students, num_days)
            self.create_expenses(expense_types, teachers, num_days)
            self.create_student_coins(students, num_days)
            self.create_shop_orders(students, shop_products, num_days)
            self.create_tickets(students, num_days)
            self.create_information(teachers, num_days)

            # Create CRM data
            self.create_crm_data(branches, courses)

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('Sample data generation complete!'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.print_summary()

    def clear_sample_data(self):
        """Clear all sample data from database"""
        self.stdout.write(self.style.WARNING('\nClearing existing sample data...'))

        # Clear in reverse dependency order
        models_to_clear = [
            ShopOrder, StudentCoins, TicketChat, Ticket, Story,
            SmsHistory, Expense, Payment, ExamScore, Attendance,
            Task, List, Board, Event, Information,
            Lead, Group, Room, Course, Branch,
            ShopProduct, ExpenseType, PaymentType,
            Source, LeadDepartment, SubDepartment,
        ]

        for model in models_to_clear:
            count = model.objects.all().delete()[0]
            if count > 0:
                self.stdout.write(f'  Deleted {count} {model.__name__} records')

        # Delete sample users (keep superusers)
        User.objects.filter(is_superuser=False).delete()

        self.stdout.write(self.style.SUCCESS('Sample data cleared!\n'))

    def create_branches(self):
        """Create sample branches"""
        self.stdout.write('Creating branches...')
        branches = [
            Branch.objects.create(name='Main Campus', latitude='41.2995', longitude='69.2401'),
            Branch.objects.create(name='North Branch', latitude='41.3111', longitude='69.2797'),
            Branch.objects.create(name='South Branch', latitude='41.2856', longitude='69.2034'),
        ]
        self.stdout.write(self.style.SUCCESS(f'  Created {len(branches)} branches'))
        return branches

    def create_courses(self):
        """Create sample courses"""
        self.stdout.write('Creating courses...')
        courses = [
            Course.objects.create(name='Python Programming', price=150000000, duration_months=6),
            Course.objects.create(name='Web Development', price=180000000, duration_months=8),
            Course.objects.create(name='Data Science', price=200000000, duration_months=10),
            Course.objects.create(name='Mobile Development', price=170000000, duration_months=7),
            Course.objects.create(name='English Language', price=100000000, duration_months=12),
        ]
        self.stdout.write(self.style.SUCCESS(f'  Created {len(courses)} courses'))
        return courses

    def create_rooms(self, branches):
        """Create sample rooms"""
        self.stdout.write('Creating rooms...')
        rooms = []
        room_names = ['Room A', 'Room B', 'Room C', 'Lab 1', 'Lab 2']
        for branch in branches:
            for room_name in room_names:
                rooms.append(
                    Room.objects.create(
                        name=room_name,
                        capacity=random.randint(15, 30),
                        branch=branch
                    )
                )
        self.stdout.write(self.style.SUCCESS(f'  Created {len(rooms)} rooms'))
        return rooms

    def create_payment_types(self):
        """Create payment types"""
        self.stdout.write('Creating payment types...')
        types = []
        for name in ['Cash', 'Card', 'Bank Transfer', 'Payme', 'Click']:
            types.append(PaymentType.objects.create(name=name))
        self.stdout.write(self.style.SUCCESS(f'  Created {len(types)} payment types'))
        return types

    def create_expense_types(self):
        """Create expense types"""
        self.stdout.write('Creating expense types...')
        types = []
        for name in ['Rent', 'Salaries', 'Utilities', 'Equipment', 'Marketing', 'Other']:
            types.append(ExpenseType.objects.create(name=name))
        self.stdout.write(self.style.SUCCESS(f'  Created {len(types)} expense types'))
        return types

    def create_shop_products(self):
        """Create shop products"""
        self.stdout.write('Creating shop products...')
        products = [
            ShopProduct.objects.create(name='Notebook', price=500, quantity=100),
            ShopProduct.objects.create(name='Pen Set', price=300, quantity=150),
            ShopProduct.objects.create(name='Backpack', price=2000, quantity=50),
            ShopProduct.objects.create(name='Water Bottle', price=800, quantity=75),
            ShopProduct.objects.create(name='Headphones', price=5000, quantity=30),
        ]
        self.stdout.write(self.style.SUCCESS(f'  Created {len(products)} shop products'))
        return products

    def create_teachers(self, count, branches):
        """Create sample teachers"""
        self.stdout.write(f'Creating {count} teachers...')
        teachers = []
        first_names = ['Ali', 'Aziza', 'Bobur', 'Dilnoza', 'Farrux', 'Guli', 'Jamshid', 'Kamola', 'Sardor', 'Zilola']
        last_names = ['Karimov', 'Rahimova', 'Toshev', 'Usmonova', 'Yusupov', 'Nurova', 'Sharipov', 'Alimova']

        for i in range(count):
            teacher = User.objects.create_user(
                username=f'teacher{i+1}',
                password='teacher123',
                first_name=random.choice(first_names),
                last_name=random.choice(last_names),
                email=f'teacher{i+1}@eduvoice.uz',
                phone=f'+998{random.randint(900000000, 999999999)}',
                is_teacher=True,
                is_staff=True,
                branch=random.choice(branches),
                salary_percentage=random.randint(30, 50)
            )
            teachers.append(teacher)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(teachers)} teachers'))
        return teachers

    def create_students(self, count, branches):
        """Create sample students"""
        self.stdout.write(f'Creating {count} students...')
        students = []
        first_names = ['Amir', 'Aziz', 'Bekzod', 'Diyor', 'Eldor', 'Farhod', 'Ismoil', 'Javohir', 'Kamron', 'Laziz',
                       'Madina', 'Nilufar', 'Oysha', 'Parizod', 'Qizil', 'Ravshan', 'Sanobar', 'Temur', 'Umid', 'Zarina']
        last_names = ['Abdullayev', 'Boboev', 'Dehqonov', 'Ergashev', 'Fayzullayev', 'Hamidov', 'Ismoilov', 'Jalilov']

        for i in range(count):
            student = User.objects.create_user(
                username=f'student{i+1}',
                password='student123',
                first_name=random.choice(first_names),
                last_name=random.choice(last_names),
                email=f'student{i+1}@eduvoice.uz',
                phone=f'+998{random.randint(900000000, 999999999)}',
                is_teacher=False,
                is_staff=False,
                branch=random.choice(branches),
                date_joined=timezone.now() - timedelta(days=random.randint(0, 365))
            )
            students.append(student)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(students)} students'))
        return students

    def create_groups(self, branches, courses, rooms, teachers):
        """Create sample groups"""
        self.stdout.write('Creating groups...')
        groups = []
        days_options = ['Mon-Wed-Fri', 'Tue-Thu-Sat', 'Mon-Tue-Wed', 'Thu-Fri-Sat']

        for i, course in enumerate(courses):
            for j in range(3):  # 3 groups per course
                start_date = date.today() - timedelta(days=random.randint(30, 180))
                group = Group.objects.create(
                    name=f'{course.name} - Group {j+1}',
                    branch=random.choice(branches),
                    course=course,
                    room=random.choice(rooms),
                    main_teacher=random.choice(teachers),
                    start_day=start_date,
                    end_day=start_date + timedelta(days=course.duration_months * 30),
                    start_time=time(hour=random.choice([9, 14, 18])),
                    end_time=time(hour=random.choice([12, 17, 21])),
                    days=random.choice(days_options)
                )
                groups.append(group)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(groups)} groups'))
        return groups

    def assign_students_to_groups(self, students, groups):
        """Assign students to groups"""
        self.stdout.write('Assigning students to groups...')
        for student in students:
            # Assign to 1-2 groups
            num_groups = random.randint(1, 2)
            selected_groups = random.sample(groups, num_groups)
            for group in selected_groups:
                group.students.add(student)

        self.stdout.write(self.style.SUCCESS(f'  Assigned {len(students)} students to groups'))

    def create_attendance(self, students, groups, days):
        """Create attendance records"""
        self.stdout.write(f'Creating attendance records for {days} days...')
        count = 0
        for day_offset in range(days):
            current_date = date.today() - timedelta(days=day_offset)
            for group in groups:
                for student in group.students.all():
                    # 85% attendance rate
                    is_present = random.random() < 0.85
                    Attendance.objects.create(
                        student=student,
                        group=group,
                        date=current_date,
                        is_present=is_present
                    )
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} attendance records'))

    def create_exam_scores(self, students, groups, days):
        """Create exam scores"""
        self.stdout.write(f'Creating exam scores...')
        count = 0
        for day_offset in range(0, days, 7):  # Weekly exams
            exam_date = date.today() - timedelta(days=day_offset)
            for group in groups:
                for student in group.students.all():
                    if random.random() < 0.7:  # 70% of students take exam
                        ExamScore.objects.create(
                            student=student,
                            group=group,
                            score=random.randint(40, 100),
                            date=exam_date,
                            main_teacher=group.main_teacher
                        )
                        count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} exam scores'))

    def create_payments(self, students, groups, payment_types, days):
        """Create payment records"""
        self.stdout.write(f'Creating payment records...')
        count = 0
        for student in students:
            # Monthly payments
            for month_offset in range(days // 30):
                payment_date = date.today() - timedelta(days=month_offset * 30)
                for group in student.student_groups.all():
                    if random.random() < 0.8:  # 80% payment rate
                        Payment.objects.create(
                            by_user=student,
                            group=group,
                            amount=group.course.price,
                            date=payment_date,
                            payment_type=random.choice(payment_types),
                            status='paid' if random.random() < 0.9 else 'pending'
                        )
                        count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} payment records'))

    def create_events(self, students, days):
        """Create events"""
        self.stdout.write(f'Creating events...')
        events = []
        event_titles = ['Workshop: Web Development', 'Seminar: AI Basics', 'Hackathon 2024',
                       'Career Fair', 'Guest Lecture', 'Project Demo Day']

        for day_offset in range(0, days, 10):  # Event every 10 days
            event_date = timezone.now() - timedelta(days=day_offset)
            event = Event.objects.create(
                title=random.choice(event_titles),
                time=event_date
            )
            # Add random students
            event.students.set(random.sample(students, random.randint(10, 30)))
            events.append(event)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(events)} events'))

    def create_tasks(self, students, teachers, days):
        """Create tasks"""
        self.stdout.write(f'Creating tasks...')
        board = Board.objects.create(name='Student Tasks')
        board.teachers.add(teachers[0])
        task_list = List.objects.create(name='Assignments', board=board, order=1)

        count = 0
        task_titles = ['Complete homework', 'Read chapter 5', 'Prepare presentation',
                      'Submit project', 'Practice coding', 'Review notes']

        for student in students[:20]:  # Tasks for first 20 students
            for day_offset in range(0, days, 7):
                due_date_dt = timezone.now() - timedelta(days=day_offset) + timedelta(days=7)
                is_done = random.choice([True, False])
                task = Task.objects.create(
                    user=student,
                    list=task_list,
                    title=random.choice(task_titles),
                    description=f'Task for {student.get_full_name()}',
                    due_date=due_date_dt,
                    is_done=is_done,
                    completed_at=timezone.now() if is_done else None
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} tasks'))

    def create_messages(self, students, days):
        """Create message history"""
        self.stdout.write(f'Creating messages...')
        count = 0
        for day_offset in range(0, days, 3):  # Messages every 3 days
            sent_date = timezone.now() - timedelta(days=day_offset)
            for student in random.sample(students, min(10, len(students))):
                SmsHistory.objects.create(
                    recipient=student,
                    phone_number=student.phone,
                    message_text=f'Reminder: Class tomorrow at {random.choice([9, 14, 18])}:00',
                    status='sent',
                    sent_at=sent_date
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} messages'))

    def create_stories(self, students, days):
        """Create student stories"""
        self.stdout.write(f'Creating stories...')
        count = 0
        for student in random.sample(students, min(15, len(students))):
            for day_offset in range(0, days, 14):  # Story every 2 weeks
                Story.objects.create(
                    student=student,
                    caption=f'Achievement unlocked! 🎉',
                    created_at=timezone.now() - timedelta(days=day_offset)
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} stories'))

    def create_expenses(self, expense_types, teachers, days):
        """Create expenses"""
        self.stdout.write(f'Creating expenses...')
        count = 0
        for day_offset in range(0, days, 7):  # Weekly expenses
            expense_date = date.today() - timedelta(days=day_offset)
            for expense_type in random.sample(expense_types, 3):
                Expense.objects.create(
                    type=expense_type,
                    amount=random.randint(100000000, 1000000000),  # In tiyin
                    date=expense_date,
                    created_by=random.choice(teachers),
                    comment=f'{expense_type.name} for this week'
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} expenses'))

    def create_student_coins(self, students, days):
        """Create student coin transactions"""
        self.stdout.write(f'Creating student coins...')
        count = 0
        reasons = ['Excellent attendance', 'Top exam score', 'Completed assignment', 'Helped classmate']

        for student in students:
            for day_offset in range(0, days, 14):  # Every 2 weeks
                if random.random() < 0.6:
                    StudentCoins.objects.create(
                        student=student,
                        coin=random.randint(10, 100),
                        reason=random.choice(reasons),
                        created_at=timezone.now() - timedelta(days=day_offset)
                    )
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} coin transactions'))

    def create_shop_orders(self, students, products, days):
        """Create shop orders"""
        self.stdout.write(f'Creating shop orders...')
        count = 0
        for student in random.sample(students, min(20, len(students))):
            for day_offset in range(0, days, 20):  # Order every 20 days
                if random.random() < 0.5:
                    product = random.choice(products)
                    ShopOrder.objects.create(
                        student=student,
                        product=product,
                        price=product.price,
                        quantity=1,
                        created_at=timezone.now() - timedelta(days=day_offset)
                    )
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} shop orders'))

    def create_tickets(self, students, days):
        """Create support tickets"""
        self.stdout.write(f'Creating support tickets...')
        count = 0
        reasons = ['Technical issue', 'Payment problem', 'Schedule conflict', 'General inquiry']

        for student in random.sample(students, min(15, len(students))):
            if random.random() < 0.3:
                ticket = Ticket.objects.create(
                    student=student,
                    reason=random.choice(reasons),
                    text='I need help with this issue',
                    status=random.randint(1, 3),
                    created_at=timezone.now() - timedelta(days=random.randint(0, days))
                )
                # Add a few chat messages
                for i in range(random.randint(1, 3)):
                    TicketChat.objects.create(
                        ticket=ticket,
                        from_user=student,
                        message=f'Message {i+1} about the issue',
                        created_at=ticket.created_at + timedelta(hours=i)
                    )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} tickets'))

    def create_information(self, teachers, days):
        """Create information posts"""
        self.stdout.write(f'Creating information posts...')
        titles = ['Important Announcement', 'Schedule Change', 'Exam Dates', 'Holiday Notice', 'New Course Available']
        count = 0

        for day_offset in range(0, days, 10):
            Information.objects.create(
                title=random.choice(titles),
                text='This is an important announcement for all students and teachers.',
                for_teachers=random.choice([True, False]),
                for_students=True,
                author=random.choice(teachers),
                created_at=timezone.now() - timedelta(days=day_offset)
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} information posts'))

    def create_crm_data(self, branches, courses):
        """Create CRM data"""
        self.stdout.write('Creating CRM data...')

        # Sources
        sources = [
            Source.objects.create(name='Instagram'),
            Source.objects.create(name='Telegram'),
            Source.objects.create(name='Facebook'),
            Source.objects.create(name='Friend Referral'),
        ]

        # Departments
        dept = LeadDepartment.objects.create(name='Sales')
        subdept = SubDepartment.objects.create(name='Online Sales', department=dept)

        # Leads
        lead_names = ['Ali Karimov', 'Aziza Rahimova', 'Bobur Toshev', 'Dilnoza Usmonova',
                     'Farrux Yusupov', 'Guli Nurova', 'Jamshid Sharipov', 'Kamola Alimova']

        count = 0
        for i, name in enumerate(lead_names):
            Lead.objects.create(
                full_name=name,
                phone=f'+998{random.randint(900000000, 999999999)}',
                source=random.choice(sources),
                department=dept,
                sub_department=subdept,
                interested_course=random.choice(courses),
                branch=random.choice(branches),
                status=random.choice(['new', 'in_progress', 'converted', 'rejected']),
                created_at=timezone.now() - timedelta(days=random.randint(0, 30))
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} leads'))

    def print_summary(self):
        """Print summary of generated data"""
        self.stdout.write('\n' + self.style.SUCCESS('Data Summary:'))
        self.stdout.write(f'  Users: {User.objects.count()}')
        self.stdout.write(f'  Branches: {Branch.objects.count()}')
        self.stdout.write(f'  Courses: {Course.objects.count()}')
        self.stdout.write(f'  Groups: {Group.objects.count()}')
        self.stdout.write(f'  Attendance: {Attendance.objects.count()}')
        self.stdout.write(f'  Exam Scores: {ExamScore.objects.count()}')
        self.stdout.write(f'  Payments: {Payment.objects.count()}')
        self.stdout.write(f'  Tasks: {Task.objects.count()}')
        self.stdout.write(f'  Messages: {SmsHistory.objects.count()}')
        self.stdout.write(f'  Events: {Event.objects.count()}')
        self.stdout.write(f'  Leads: {Lead.objects.count()}')
        self.stdout.write('\n' + self.style.SUCCESS('You can now login with:'))
        self.stdout.write('  Username: teacher1, Password: teacher123 (or any teacher1-10)')
        self.stdout.write('  Username: student1, Password: student123 (or any student number)')

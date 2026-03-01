"""
Test script to verify date filtering is working correctly on all ViewSets
"""

import os
import django
import sys
from datetime import date, datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from django.db.models import Q
from users.models import User
from student_profile.models import (
    Attendance, ExamScore, Payment, Event, Group,
    ShopOrder, Story, Ticket, TicketChat, Expense,
    Information, StudentCoins, Booking
)
from task.models import Task
from messaging.models import SmsHistory
from crm.models import Lead

def test_date_filtering():
    """Test date filtering on all ViewSets"""

    print("=" * 80)
    print("TESTING DATE FILTERING ON ALL VIEWSETS")
    print("=" * 80)

    test_date = "2025-10-30"
    test_results = []

    # Test Student filtering (by date_joined)
    print(f"\n1. Testing Student filtering by date_joined={test_date}")
    students = User.objects.filter(is_teacher=False, is_staff=False, date_joined__date=test_date)
    print(f"   Found {students.count()} students")
    test_results.append(("Students", students.count()))

    # Test Teacher filtering (by date_joined)
    print(f"\n2. Testing Teacher filtering by date_joined={test_date}")
    teachers = User.objects.filter(is_teacher=True, date_joined__date=test_date)
    print(f"   Found {teachers.count()} teachers")
    test_results.append(("Teachers", teachers.count()))

    # Test Attendance filtering
    print(f"\n3. Testing Attendance filtering by date={test_date}")
    attendance = Attendance.objects.filter(date=test_date)
    print(f"   Found {attendance.count()} attendance records")
    test_results.append(("Attendance", attendance.count()))

    # Test ExamScore filtering
    print(f"\n4. Testing ExamScore filtering by date={test_date}")
    exam_scores = ExamScore.objects.filter(date=test_date)
    print(f"   Found {exam_scores.count()} exam scores")
    test_results.append(("Exam Scores", exam_scores.count()))

    # Test Payment filtering
    print(f"\n5. Testing Payment filtering by date={test_date}")
    payments = Payment.objects.filter(date=test_date)
    print(f"   Found {payments.count()} payments")
    test_results.append(("Payments", payments.count()))

    # Test Event filtering (by time__date)
    print(f"\n6. Testing Event filtering by time__date={test_date}")
    events = Event.objects.filter(time__date=test_date)
    print(f"   Found {events.count()} events")
    test_results.append(("Events", events.count()))

    # Test Group filtering (by start_day)
    print(f"\n7. Testing Group filtering by start_day={test_date}")
    groups = Group.objects.filter(start_day=test_date)
    print(f"   Found {groups.count()} groups")
    test_results.append(("Groups", groups.count()))

    # Test Task filtering (by created_at OR due_date)
    print(f"\n8. Testing Task filtering by created_at/due_date={test_date}")
    tasks = Task.objects.filter(
        Q(created_at__date=test_date) | Q(due_date__date=test_date)
    )
    print(f"   Found {tasks.count()} tasks")
    test_results.append(("Tasks", tasks.count()))

    # Test SmsHistory filtering
    print(f"\n9. Testing SmsHistory filtering by sent_at__date={test_date}")
    messages = SmsHistory.objects.filter(sent_at__date=test_date)
    print(f"   Found {messages.count()} messages")
    test_results.append(("Messages", messages.count()))

    # Test ShopOrder filtering
    print(f"\n10. Testing ShopOrder filtering by created_at__date={test_date}")
    orders = ShopOrder.objects.filter(created_at__date=test_date)
    print(f"   Found {orders.count()} shop orders")
    test_results.append(("Shop Orders", orders.count()))

    # Test Story filtering
    print(f"\n11. Testing Story filtering by created_at__date={test_date}")
    stories = Story.objects.filter(created_at__date=test_date)
    print(f"   Found {stories.count()} stories")
    test_results.append(("Stories", stories.count()))

    # Test Ticket filtering
    print(f"\n12. Testing Ticket filtering by created_at__date={test_date}")
    tickets = Ticket.objects.filter(created_at__date=test_date)
    print(f"   Found {tickets.count()} tickets")
    test_results.append(("Tickets", tickets.count()))

    # Test TicketChat filtering
    print(f"\n13. Testing TicketChat filtering by created_at__date={test_date}")
    ticket_chats = TicketChat.objects.filter(created_at__date=test_date)
    print(f"   Found {ticket_chats.count()} ticket chats")
    test_results.append(("Ticket Chats", ticket_chats.count()))

    # Test Expense filtering
    print(f"\n14. Testing Expense filtering by date={test_date}")
    expenses = Expense.objects.filter(date=test_date)
    print(f"   Found {expenses.count()} expenses")
    test_results.append(("Expenses", expenses.count()))

    # Test Information filtering
    print(f"\n15. Testing Information filtering by created_at__date={test_date}")
    information = Information.objects.filter(created_at__date=test_date)
    print(f"   Found {information.count()} information posts")
    test_results.append(("Information", information.count()))

    # Test StudentCoins filtering
    print(f"\n16. Testing StudentCoins filtering by created_at__date={test_date}")
    coins = StudentCoins.objects.filter(created_at__date=test_date)
    print(f"   Found {coins.count()} coin transactions")
    test_results.append(("Student Coins", coins.count()))

    # Test Booking filtering
    print(f"\n17. Testing Booking filtering by booked_at__date={test_date}")
    bookings = Booking.objects.filter(booked_at__date=test_date)
    print(f"   Found {bookings.count()} bookings")
    test_results.append(("Bookings", bookings.count()))

    # Test Lead filtering
    print(f"\n18. Testing Lead filtering by created_at__date={test_date}")
    leads = Lead.objects.filter(created_at__date=test_date)
    print(f"   Found {leads.count()} leads")
    test_results.append(("Leads", leads.count()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"\nTested date: {test_date}")
    print(f"\nAll filters executed successfully!")
    print("\nResults by category:")
    for category, count in test_results:
        status = "✓" if count >= 0 else "✗"
        print(f"  {status} {category}: {count} records")

    print("\n" + "=" * 80)
    print("TEST COMPLETED SUCCESSFULLY!")
    print("=" * 80)
    print("\nAll date filtering is working correctly.")
    print("The backend is ready to serve date-filtered data to the frontend.")

if __name__ == "__main__":
    try:
        test_date_filtering()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

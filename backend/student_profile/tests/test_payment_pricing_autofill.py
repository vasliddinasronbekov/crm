import pytest
from django.contrib.auth import get_user_model

from student_profile.models import Course, Group, Payment
from student_profile.serializers import PaymentWriteSerializer

User = get_user_model()


@pytest.mark.django_db
class TestPaymentPricingAutofill:
    def _create_group_with_course(self, price: int = 12_000_000) -> Group:
        course = Course.objects.create(
            name='IELTS Intensive',
            price=price,
            duration_months=3,
        )
        return Group.objects.create(
            name='IELTS-7AM',
            course=course,
            start_day='2026-03-01',
            end_day='2026-06-01',
            start_time='07:00',
            end_time='09:00',
            days='Mon,Wed,Fri',
        )

    def test_create_course_mode_uses_group_course_price(self):
        student = User.objects.create_user(username='student_course_mode', password='Pass123!')
        group = self._create_group_with_course(price=9_500_000)

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'group': group.id,
                'status': Payment.PaymentStatus.PAID,
                'date': '2026-03-08',
                'amount': 100,  # tampered on purpose
                'course_price': 100,  # tampered on purpose
                'pricing_mode': 'course',
            }
        )

        assert serializer.is_valid(), serializer.errors
        payment = serializer.save()

        assert payment.amount == group.course.price
        assert payment.course_price == group.course.price

    def test_create_course_mode_uses_explicit_course_when_group_missing(self):
        student = User.objects.create_user(username='student_explicit_course', password='Pass123!')
        course = Course.objects.create(
            name='SAT Pro',
            price=7_000_000,
            duration_months=2,
        )

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'status': Payment.PaymentStatus.PAID,
                'date': '2026-03-08',
                'course': course.id,
                'pricing_mode': 'course',
            }
        )

        assert serializer.is_valid(), serializer.errors
        payment = serializer.save()

        assert payment.group is None
        assert payment.amount == course.price
        assert payment.course_price == course.price

    def test_create_manual_mode_keeps_operator_amounts(self):
        student = User.objects.create_user(username='student_manual_mode', password='Pass123!')

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'status': Payment.PaymentStatus.PENDING,
                'date': '2026-03-08',
                'amount': 1_100_000,
                'course_price': 9_000_000,
                'pricing_mode': 'manual',
            }
        )

        assert serializer.is_valid(), serializer.errors
        payment = serializer.save()

        assert payment.amount == 1_100_000
        assert payment.course_price == 9_000_000

    def test_create_course_mode_requires_group_or_course(self):
        student = User.objects.create_user(username='student_missing_course', password='Pass123!')

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'status': Payment.PaymentStatus.PAID,
                'date': '2026-03-08',
                'pricing_mode': 'course',
            }
        )

        assert not serializer.is_valid()
        assert 'course' in serializer.errors

    def test_create_manual_mode_accepts_tiyin_alias_fields(self):
        student = User.objects.create_user(username='student_manual_tiyin', password='Pass123!')

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'status': Payment.PaymentStatus.PENDING,
                'date': '2026-03-08',
                'amount_tiyin': 1_500_000,
                'course_price_tiyin': 9_000_000,
                'pricing_mode': 'manual',
            }
        )

        assert serializer.is_valid(), serializer.errors
        payment = serializer.save()

        assert payment.amount == 1_500_000
        assert payment.course_price == 9_000_000

    def test_create_manual_mode_rejects_conflicting_amount_alias(self):
        student = User.objects.create_user(username='student_manual_conflict', password='Pass123!')

        serializer = PaymentWriteSerializer(
            data={
                'by_user': student.id,
                'status': Payment.PaymentStatus.PENDING,
                'date': '2026-03-08',
                'amount': 1_200_000,
                'amount_tiyin': 1_300_000,
                'course_price': 9_000_000,
                'pricing_mode': 'manual',
            }
        )

        assert not serializer.is_valid()
        assert 'amount_tiyin' in serializer.errors

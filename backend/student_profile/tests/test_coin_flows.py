from decimal import Decimal

from django.test import TestCase

from users.models import User
from student_profile.models import StudentCoins
from student_profile.sat_models import SATExam, SATAttempt
from student_profile.ielts_models import IELTSExam, IELTSSection, IELTSAttempt
from student_profile.services.coin_wallet import (
    InsufficientCoinsError,
    credit_student_coins,
    debit_student_coins,
    get_student_coin_balance,
)


class CoinFlowTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(username='coin_student', password='pass1234')
        StudentCoins.objects.create(student=self.student, coin=120, reason='Initial top-up')

    def test_wallet_debit_and_credit(self):
        debit_tx, balance_after_debit = debit_student_coins(self.student, 50, 'SAT purchase')
        self.assertEqual(debit_tx.coin, -50)
        self.assertEqual(balance_after_debit, 70)

        credit_tx, balance_after_credit = credit_student_coins(self.student, 10, 'SAT refund')
        self.assertEqual(credit_tx.coin, 10)
        self.assertEqual(balance_after_credit, 80)
        self.assertEqual(get_student_coin_balance(self.student), 80)

    def test_wallet_raises_on_insufficient_balance(self):
        with self.assertRaises(InsufficientCoinsError):
            debit_student_coins(self.student, 500, 'Too expensive')

    def test_sat_attempt_coin_flow(self):
        exam = SATExam.objects.create(
            title='SAT Practice 1',
            coin_cost=50,
            coin_refund=10,
            passing_score=1000,
        )
        attempt = SATAttempt.objects.create(student=self.student, exam=exam, status='payment_pending')

        attempt.deduct_coins()
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'in_progress')
        self.assertEqual(attempt.coins_paid, 50)
        self.assertEqual(get_student_coin_balance(self.student), 70)

        attempt.refund_eligible = True
        attempt.total_score = 1200
        attempt.save(update_fields=['refund_eligible', 'total_score'])
        attempt.refund_coins()
        attempt.refresh_from_db()
        self.assertEqual(attempt.coins_refunded, 10)
        self.assertEqual(get_student_coin_balance(self.student), 80)

    def test_ielts_attempt_coin_flow(self):
        exam = IELTSExam.objects.create(
            section=IELTSSection.READING,
            title='IELTS Reading',
            coin_cost=50,
            coin_refund=10,
            time_limit_minutes=60,
            passing_band_score=Decimal('5.0'),
        )
        attempt = IELTSAttempt.objects.create(
            student=self.student,
            exam=exam,
            attempt_number=1,
            status='payment_pending',
        )

        self.assertTrue(attempt.deduct_coins())
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'in_progress')
        self.assertEqual(attempt.coins_paid, 50)
        self.assertEqual(get_student_coin_balance(self.student), 70)

        attempt.band_score = Decimal('6.0')
        attempt.save(update_fields=['band_score'])
        self.assertTrue(attempt.refund_coins())
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'refunded')
        self.assertEqual(attempt.coins_refunded, 10)
        self.assertEqual(get_student_coin_balance(self.student), 80)

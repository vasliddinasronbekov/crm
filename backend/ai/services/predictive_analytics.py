"""
Predictive Analytics Service

Machine Learning models for:
- Student dropout risk prediction
- Performance forecasting
- Optimal study time recommendations
- Intervention triggers
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from django.db.models import Avg, Count, Q, F
from django.utils import timezone
from django.conf import settings

from student_profile.models import StudentProgress, Attendance, ExamScore, QuizAttempt
from gamification.models import UserLevel
from users.models import User


class PredictiveAnalytics:
    """
    ML-powered analytics for student success prediction

    Models:
    - Dropout Risk: Predict if student will drop out
    - Performance Forecast: Predict future exam scores
    - Study Time Optimizer: Recommend optimal study schedule
    """

    def __init__(self):
        self.models_path = Path(settings.BASE_DIR) / 'ai' / 'models'
        self.models_path.mkdir(parents=True, exist_ok=True)

        # ML models (loaded on demand)
        self.dropout_model = None
        self.performance_model = None

    def calculate_dropout_risk(self, student: User) -> Dict:
        """
        Calculate dropout risk for a student

        Features used:
        - Attendance rate
        - Assignment completion rate
        - Quiz performance
        - Learning streak
        - Time since last activity
        - Course progress

        Returns:
            Dict with risk score (0-100) and factors
        """

        features = self._extract_student_features(student)

        # Calculate risk score (0-100, higher = more risk)
        risk_score = 0
        risk_factors = []

        # 1. Attendance (20 points)
        if features['attendance_rate'] < 0.7:
            risk_score += 20
            risk_factors.append({
                'factor': 'Low Attendance',
                'value': f"{features['attendance_rate']*100:.0f}%",
                'severity': 'high'
            })
        elif features['attendance_rate'] < 0.85:
            risk_score += 10
            risk_factors.append({
                'factor': 'Moderate Attendance',
                'value': f"{features['attendance_rate']*100:.0f}%",
                'severity': 'medium'
            })

        # 2. Assignment completion (20 points)
        if features['assignment_completion_rate'] < 0.5:
            risk_score += 20
            risk_factors.append({
                'factor': 'Low Assignment Completion',
                'value': f"{features['assignment_completion_rate']*100:.0f}%",
                'severity': 'high'
            })
        elif features['assignment_completion_rate'] < 0.75:
            risk_score += 10
            risk_factors.append({
                'factor': 'Moderate Assignment Completion',
                'value': f"{features['assignment_completion_rate']*100:.0f}%",
                'severity': 'medium'
            })

        # 3. Quiz performance (15 points)
        if features['avg_quiz_score'] < 50:
            risk_score += 15
            risk_factors.append({
                'factor': 'Low Quiz Scores',
                'value': f"{features['avg_quiz_score']:.0f}%",
                'severity': 'high'
            })
        elif features['avg_quiz_score'] < 70:
            risk_score += 8
            risk_factors.append({
                'factor': 'Moderate Quiz Scores',
                'value': f"{features['avg_quiz_score']:.0f}%",
                'severity': 'medium'
            })

        # 4. Learning streak (15 points)
        if features['current_streak'] == 0:
            risk_score += 15
            risk_factors.append({
                'factor': 'No Active Learning Streak',
                'value': '0 days',
                'severity': 'high'
            })
        elif features['current_streak'] < 3:
            risk_score += 8
            risk_factors.append({
                'factor': 'Low Learning Streak',
                'value': f"{features['current_streak']} days",
                'severity': 'medium'
            })

        # 5. Days since last activity (15 points)
        if features['days_since_last_activity'] > 7:
            risk_score += 15
            risk_factors.append({
                'factor': 'Inactive for Extended Period',
                'value': f"{features['days_since_last_activity']} days",
                'severity': 'high'
            })
        elif features['days_since_last_activity'] > 3:
            risk_score += 8
            risk_factors.append({
                'factor': 'Recent Inactivity',
                'value': f"{features['days_since_last_activity']} days",
                'severity': 'medium'
            })

        # 6. Course progress (15 points)
        if features['course_completion_rate'] < 0.2:
            risk_score += 15
            risk_factors.append({
                'factor': 'Very Low Progress',
                'value': f"{features['course_completion_rate']*100:.0f}%",
                'severity': 'high'
            })
        elif features['course_completion_rate'] < 0.5:
            risk_score += 8
            risk_factors.append({
                'factor': 'Low Progress',
                'value': f"{features['course_completion_rate']*100:.0f}%",
                'severity': 'medium'
            })

        # Determine risk level
        if risk_score >= 60:
            risk_level = 'high'
            recommendation = 'Immediate intervention recommended'
        elif risk_score >= 30:
            risk_level = 'medium'
            recommendation = 'Monitor closely and provide support'
        else:
            risk_level = 'low'
            recommendation = 'Student is on track'

        return {
            'risk_score': min(risk_score, 100),
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'recommendation': recommendation,
            'features': features
        }

    def forecast_performance(self, student: User, days_ahead: int = 30) -> Dict:
        """
        Forecast student's future performance

        Args:
            student: Student user
            days_ahead: Number of days to forecast

        Returns:
            Dict with predicted scores and confidence
        """

        features = self._extract_student_features(student)

        # Simple trend-based forecast
        current_avg = features['avg_quiz_score']

        # Calculate trend from recent quizzes
        recent_quizzes = QuizAttempt.objects.filter(
            student=student,
            completed_at__isnull=False
        ).order_by('-completed_at')[:5]

        if recent_quizzes.count() >= 3:
            scores = [q.percentage_score for q in recent_quizzes]
            # Simple linear trend
            trend = (scores[0] - scores[-1]) / len(scores)
        else:
            trend = 0

        # Forecast
        predicted_score = current_avg + (trend * (days_ahead / 7))
        predicted_score = max(0, min(100, predicted_score))  # Clamp to 0-100

        # Confidence based on data availability
        confidence = min(1.0, recent_quizzes.count() / 10)

        return {
            'current_average': round(current_avg, 2),
            'predicted_score': round(predicted_score, 2),
            'trend': 'improving' if trend > 0 else 'declining' if trend < 0 else 'stable',
            'confidence': round(confidence * 100, 2),
            'forecast_date': (timezone.now() + timedelta(days=days_ahead)).date().isoformat(),
            'recommendation': self._get_performance_recommendation(predicted_score, trend)
        }

    def recommend_study_time(self, student: User) -> Dict:
        """
        Recommend optimal study schedule

        Args:
            student: Student user

        Returns:
            Dict with recommended schedule
        """

        features = self._extract_student_features(student)

        # Base recommendation on performance and completion rates
        if features['avg_quiz_score'] < 60:
            daily_minutes = 90
            focus_areas = ['Review fundamentals', 'Practice exercises', 'Seek help']
        elif features['avg_quiz_score'] < 80:
            daily_minutes = 60
            focus_areas = ['Continue practice', 'Challenge yourself', 'Review mistakes']
        else:
            daily_minutes = 45
            focus_areas = ['Maintain consistency', 'Explore advanced topics', 'Help others']

        # Adjust based on course progress
        if features['course_completion_rate'] < 0.5:
            daily_minutes += 15

        # Weekly schedule
        schedule = {
            'daily_minutes': daily_minutes,
            'weekly_hours': round((daily_minutes * 5) / 60, 1),  # 5 days/week
            'focus_areas': focus_areas,
            'suggested_times': self._suggest_study_times(student),
            'break_frequency': '10 minutes every hour',
            'priority_topics': self._get_priority_topics(student)
        }

        return schedule

    def get_intervention_triggers(self, student: User) -> List[Dict]:
        """
        Get list of triggered interventions for student

        Returns:
            List of intervention actions needed
        """

        features = self._extract_student_features(student)
        triggers = []

        # Trigger 1: Low attendance
        if features['attendance_rate'] < 0.75:
            triggers.append({
                'type': 'attendance',
                'severity': 'high' if features['attendance_rate'] < 0.6 else 'medium',
                'message': 'Student has low attendance',
                'action': 'Contact student to discuss attendance issues',
                'priority': 1
            })

        # Trigger 2: No recent activity
        if features['days_since_last_activity'] > 5:
            triggers.append({
                'type': 'inactivity',
                'severity': 'high',
                'message': f'No activity for {features["days_since_last_activity"]} days',
                'action': 'Send reminder and check-in message',
                'priority': 2
            })

        # Trigger 3: Failing quizzes
        if features['avg_quiz_score'] < 50:
            triggers.append({
                'type': 'performance',
                'severity': 'high',
                'message': 'Student is struggling with quizzes',
                'action': 'Schedule tutoring session',
                'priority': 1
            })

        # Trigger 4: Not completing assignments
        if features['assignment_completion_rate'] < 0.5:
            triggers.append({
                'type': 'assignments',
                'severity': 'medium',
                'message': 'Low assignment completion rate',
                'action': 'Provide assignment support',
                'priority': 3
            })

        # Sort by priority
        triggers.sort(key=lambda x: x['priority'])

        return triggers

    def _extract_student_features(self, student: User) -> Dict:
        """Extract ML features from student data"""

        features = {}

        # Attendance rate (last 30 days)
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        total_classes = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).count()

        attended = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago,
            is_present=True
        ).count()

        features['attendance_rate'] = attended / total_classes if total_classes > 0 else 1.0

        # Assignment completion rate
        from student_profile.models import AssignmentSubmission
        total_assignments = AssignmentSubmission.objects.filter(student=student).count()
        completed_assignments = AssignmentSubmission.objects.filter(
            student=student,
            status='graded'
        ).count()

        features['assignment_completion_rate'] = completed_assignments / total_assignments if total_assignments > 0 else 1.0

        # Average quiz score
        avg_score = QuizAttempt.objects.filter(
            student=student,
            completed_at__isnull=False
        ).aggregate(Avg('percentage_score'))['percentage_score__avg'] or 0

        features['avg_quiz_score'] = avg_score

        # Learning streak
        try:
            user_level = UserLevel.objects.get(user=student)
            features['current_streak'] = user_level.current_streak_days
            features['days_since_last_activity'] = (timezone.now().date() - user_level.last_activity_date).days if user_level.last_activity_date else 999
        except UserLevel.DoesNotExist:
            features['current_streak'] = 0
            features['days_since_last_activity'] = 999

        # Course completion rate
        total_lessons = StudentProgress.objects.filter(student=student, lesson__isnull=False).count()
        completed_lessons = StudentProgress.objects.filter(
            student=student,
            lesson__isnull=False,
            is_completed=True
        ).count()

        features['course_completion_rate'] = completed_lessons / total_lessons if total_lessons > 0 else 0

        return features

    def _get_performance_recommendation(self, predicted_score: float, trend: float) -> str:
        """Get recommendation based on predicted performance"""

        if predicted_score >= 80:
            return "Student is on track for excellent performance. Encourage continued engagement."
        elif predicted_score >= 60:
            if trend < 0:
                return "Declining trend detected. Provide additional support to reverse the decline."
            else:
                return "Good performance. Encourage more practice to reach excellence."
        else:
            return "At-risk student. Immediate intervention and additional support recommended."

    def _suggest_study_times(self, student: User) -> List[str]:
        """Suggest optimal study times"""

        # Generic suggestions (can be personalized based on historical data)
        return [
            "Morning (9 AM - 11 AM) - High focus period",
            "Afternoon (2 PM - 4 PM) - Review and practice",
            "Evening (7 PM - 9 PM) - Lighter topics"
        ]

    def _get_priority_topics(self, student: User) -> List[Dict]:
        """Get topics student should prioritize"""

        # Get quiz attempts with low scores
        weak_quizzes = QuizAttempt.objects.filter(
            student=student,
            percentage_score__lt=70,
            completed_at__isnull=False
        ).select_related('quiz', 'quiz__module').order_by('percentage_score')[:5]

        priority_topics = []
        for attempt in weak_quizzes:
            priority_topics.append({
                'topic': attempt.quiz.title,
                'score': attempt.percentage_score,
                'module': attempt.quiz.module.title if attempt.quiz.module else 'General',
                'priority': 'high' if attempt.percentage_score < 50 else 'medium'
            })

        return priority_topics


# Singleton instance
_predictive_analytics = None

def get_predictive_analytics() -> PredictiveAnalytics:
    """Get or create PredictiveAnalytics singleton"""
    global _predictive_analytics
    if _predictive_analytics is None:
        _predictive_analytics = PredictiveAnalytics()
    return _predictive_analytics

#!/usr/bin/env python3
"""
Test Script for Advanced AI Features
Tests RAG Q&A, Content Generation, and Predictive Analytics
"""

import os
import sys
import django
import requests
import json
from typing import Dict, Any

# Django setup
sys.path.append('/home/gradientvvv/untilIwin/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from django.contrib.auth import get_user_model
from student_profile.models import Course, CourseModule, Lesson, QuizAttempt
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

BASE_URL = "http://localhost:8008/api/v1/ai"


class Colors:
    """ANSI color codes"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_success(message: str):
    print(f"{Colors.GREEN}✓{Colors.END} {message}")


def print_error(message: str):
    print(f"{Colors.RED}✗{Colors.END} {message}")


def print_info(message: str):
    print(f"{Colors.BLUE}ℹ{Colors.END} {message}")


def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠{Colors.END} {message}")


def print_section(title: str):
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{title}{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")


def get_auth_token() -> str:
    """Get JWT token for test user"""
    # Try to get existing test user
    try:
        user = User.objects.get(email='test@example.com')
        print_info(f"Using existing test user: {user.email}")
    except User.DoesNotExist:
        # Create test user
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            is_staff=True,
            is_teacher=True
        )
        print_success(f"Created test user: {user.email}")

    # Generate token
    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    print_success("Generated JWT token")
    return token


def make_request(method: str, endpoint: str, token: str, data: Dict = None, params: Dict = None) -> Dict[str, Any]:
    """Make HTTP request to API"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, params=params)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")

        print_info(f"{method} {endpoint} -> {response.status_code}")

        if response.status_code >= 400:
            print_error(f"Error: {response.text[:200]}")
            return {'success': False, 'error': response.text}

        return {'success': True, 'data': response.json()}

    except Exception as e:
        print_error(f"Request failed: {e}")
        return {'success': False, 'error': str(e)}


def setup_test_data():
    """Create test course and lesson data"""
    print_section("Setting Up Test Data")

    # Get or create test course
    course, created = Course.objects.get_or_create(
        name="Test AI Course",
        defaults={
            'description': "A comprehensive course about artificial intelligence and machine learning. "
                          "Covers topics like neural networks, deep learning, natural language processing, "
                          "computer vision, and reinforcement learning.",
            'is_published': True,
            'language': 'en'
        }
    )
    if created:
        print_success(f"Created test course: {course.name}")
    else:
        print_info(f"Using existing course: {course.name}")

    # Get or create test module
    module, created = CourseModule.objects.get_or_create(
        course=course,
        title="Introduction to AI",
        defaults={
            'description': "Learn the fundamentals of artificial intelligence",
            'order': 1,
            'is_published': True
        }
    )
    if created:
        print_success(f"Created test module: {module.title}")
    else:
        print_info(f"Using existing module: {module.title}")

    # Get or create test lesson
    lesson, created = Lesson.objects.get_or_create(
        module=module,
        title="What is Machine Learning?",
        defaults={
            'description': "Introduction to machine learning concepts",
            'content': """
            Machine learning is a subset of artificial intelligence that enables systems to learn
            and improve from experience without being explicitly programmed.

            There are three main types of machine learning:
            1. Supervised Learning: The algorithm learns from labeled training data
            2. Unsupervised Learning: The algorithm finds patterns in unlabeled data
            3. Reinforcement Learning: The algorithm learns through trial and error

            Applications of machine learning include:
            - Image recognition and computer vision
            - Natural language processing
            - Recommendation systems
            - Fraud detection
            - Autonomous vehicles

            Key concepts in machine learning include:
            - Training data: The dataset used to train the model
            - Features: Input variables used for prediction
            - Labels: Output variables we want to predict
            - Model: The mathematical representation learned from data
            - Accuracy: How well the model performs on test data
            """,
            'order': 1,
            'is_published': True,
            'duration_minutes': 30
        }
    )
    if created:
        print_success(f"Created test lesson: {lesson.title}")
    else:
        print_info(f"Using existing lesson: {lesson.title}")

    return course, module, lesson


def test_rag_index(token: str, course_id: int):
    """Test: Index course content for RAG"""
    print_section("Test 1: Index Course Content for RAG")

    result = make_request('POST', '/rag/index/', token, data={'course_id': course_id})

    if result['success']:
        data = result['data']
        print_success(f"Successfully indexed {data.get('documents_indexed', 0)} documents")
        print(json.dumps(data, indent=2))
    else:
        print_error("Failed to index course content")

    return result['success']


def test_rag_ask_question(token: str, course_id: int):
    """Test: Ask a question using RAG"""
    print_section("Test 2: Ask Question Using RAG")

    questions = [
        "What is machine learning?",
        "What are the types of machine learning?",
        "What are some applications of machine learning?"
    ]

    success_count = 0
    for question in questions:
        print_info(f"Question: {question}")

        result = make_request('POST', '/rag/ask/', token, data={
            'question': question,
            'course_id': course_id,
            'language': 'en'
        })

        if result['success']:
            data = result['data']
            print_success("Got answer!")
            print(f"  Answer: {data.get('answer', '')[:200]}...")
            print(f"  Sources: {len(data.get('sources', []))} documents")
            success_count += 1
        else:
            print_error(f"Failed to get answer")

        print()

    return success_count == len(questions)


def test_generate_quiz(token: str, lesson_id: int):
    """Test: Generate quiz from lesson"""
    print_section("Test 3: Generate Quiz from Lesson")

    result = make_request('POST', '/content/generate-quiz/', token, data={
        'lesson_id': lesson_id,
        'num_questions': 5,
        'difficulty': 'medium',
        'language': 'en',
        'auto_save': False
    })

    if result['success']:
        data = result['data']
        print_success(f"Successfully generated quiz with {len(data.get('questions', []))} questions")
        print(f"  Quiz Title: {data.get('title', 'N/A')}")

        # Show first question
        if data.get('questions'):
            q = data['questions'][0]
            print(f"\n  Sample Question:")
            print(f"    Q: {q.get('question', '')}")
            for opt in q.get('options', []):
                correct = "✓" if opt.get('is_correct') else " "
                print(f"    [{correct}] {opt.get('text', '')}")
    else:
        print_warning("Quiz generation may fail without LLM configured")
        print_info("This is expected if OpenAI API key is not set")

    return result['success']


def test_generate_summary(token: str, lesson_id: int):
    """Test: Generate lesson summary"""
    print_section("Test 4: Generate Lesson Summary")

    result = make_request('POST', '/content/generate-summary/', token, data={
        'lesson_id': lesson_id,
        'max_length': 100,
        'language': 'en'
    })

    if result['success']:
        data = result['data']
        print_success("Successfully generated summary")
        print(f"  Lesson: {data.get('lesson_title', 'N/A')}")
        print(f"  Original Length: {data.get('original_length', 0)} words")
        print(f"  Summary Length: {data.get('summary_length', 0)} words")
        print(f"\n  Summary: {data.get('summary', '')[:200]}...")
    else:
        print_error("Failed to generate summary")

    return result['success']


def test_dropout_risk(token: str):
    """Test: Calculate dropout risk"""
    print_section("Test 5: Calculate Dropout Risk")

    result = make_request('GET', '/analytics/dropout-risk/', token)

    if result['success']:
        data = result['data']
        print_success(f"Dropout risk calculated for student: {data.get('student_name', 'N/A')}")
        print(f"  Risk Score: {data.get('risk_score', 0)}/100")
        print(f"  Risk Level: {data.get('risk_level', 'unknown').upper()}")
        print(f"  Risk Factors: {len(data.get('risk_factors', []))}")
        print(f"  Recommendation: {data.get('recommendation', 'N/A')}")

        # Show risk factors
        for factor in data.get('risk_factors', [])[:3]:
            severity_icon = "🔴" if factor.get('severity') == 'high' else "🟡"
            print(f"    {severity_icon} {factor.get('factor', '')}: {factor.get('value', '')}")
    else:
        print_error("Failed to calculate dropout risk")

    return result['success']


def test_performance_forecast(token: str):
    """Test: Forecast student performance"""
    print_section("Test 6: Forecast Student Performance")

    result = make_request('GET', '/analytics/performance-forecast/', token, params={'days_ahead': 30})

    if result['success']:
        data = result['data']
        print_success(f"Performance forecasted for: {data.get('student_name', 'N/A')}")
        print(f"  Current Average: {data.get('current_average', 0):.2f}%")
        print(f"  Predicted Score: {data.get('predicted_score', 0):.2f}%")
        print(f"  Trend: {data.get('trend', 'unknown').upper()}")
        print(f"  Confidence: {data.get('confidence', 0):.2f}%")
        print(f"  Forecast Date: {data.get('forecast_date', 'N/A')}")
        print(f"  Recommendation: {data.get('recommendation', 'N/A')}")
    else:
        print_error("Failed to forecast performance")

    return result['success']


def test_study_recommendations(token: str):
    """Test: Get study recommendations"""
    print_section("Test 7: Get Study Recommendations")

    result = make_request('GET', '/analytics/study-recommendations/', token)

    if result['success']:
        data = result['data']
        print_success(f"Study recommendations for: {data.get('student_name', 'N/A')}")
        print(f"  Daily Study Time: {data.get('daily_minutes', 0)} minutes")
        print(f"  Weekly Hours: {data.get('weekly_hours', 0)} hours")
        print(f"  Break Frequency: {data.get('break_frequency', 'N/A')}")

        print(f"\n  Focus Areas:")
        for area in data.get('focus_areas', []):
            print(f"    • {area}")

        print(f"\n  Suggested Study Times:")
        for time in data.get('suggested_times', []):
            print(f"    • {time}")

        print(f"\n  Priority Topics: {len(data.get('priority_topics', []))}")
    else:
        print_error("Failed to get study recommendations")

    return result['success']


def test_ai_dashboard(token: str):
    """Test: Get complete AI dashboard"""
    print_section("Test 8: Get Complete AI Dashboard")

    result = make_request('GET', '/dashboard/', token)

    if result['success']:
        data = result['data']
        print_success(f"AI Dashboard for: {data.get('student_name', 'N/A')}")

        # Dropout risk
        dropout = data.get('dropout_risk', {})
        print(f"\n  📊 Dropout Risk:")
        print(f"     Score: {dropout.get('score', 0)}/100")
        print(f"     Level: {dropout.get('level', 'unknown').upper()}")

        # Performance forecast
        perf = data.get('performance_forecast', {})
        print(f"\n  📈 Performance Forecast:")
        print(f"     Current: {perf.get('current', 0):.1f}%")
        print(f"     Predicted: {perf.get('predicted', 0):.1f}%")
        print(f"     Trend: {perf.get('trend', 'unknown').upper()}")

        # Study recommendations
        study = data.get('study_recommendations', {})
        print(f"\n  📚 Study Recommendations:")
        print(f"     Daily Minutes: {study.get('daily_minutes', 0)}")
        print(f"     Focus Areas: {len(study.get('focus_areas', []))}")
    else:
        print_error("Failed to get AI dashboard")

    return result['success']


def test_intervention_triggers(token: str, student_id: int):
    """Test: Get intervention triggers"""
    print_section("Test 9: Get Intervention Triggers")

    result = make_request('GET', f'/analytics/intervention-triggers/{student_id}/', token)

    if result['success']:
        data = result['data']
        print_success(f"Intervention triggers for: {data.get('student_name', 'N/A')}")
        print(f"  Requires Intervention: {data.get('requires_intervention', False)}")
        print(f"  Active Triggers: {len(data.get('triggers', []))}")

        for trigger in data.get('triggers', []):
            severity_icon = "🔴" if trigger.get('severity') == 'high' else "🟡"
            print(f"\n  {severity_icon} {trigger.get('type', '').upper()}")
            print(f"     Message: {trigger.get('message', '')}")
            print(f"     Action: {trigger.get('action', '')}")
            print(f"     Priority: {trigger.get('priority', 'N/A')}")
    else:
        print_error("Failed to get intervention triggers")

    return result['success']


def main():
    """Run all AI tests"""
    print_section("🤖 Advanced AI Features Test Suite")

    # Get auth token
    try:
        token = get_auth_token()
    except Exception as e:
        print_error(f"Failed to get auth token: {e}")
        return

    # Setup test data
    try:
        course, module, lesson = setup_test_data()
        test_user = User.objects.get(email='test@example.com')
    except Exception as e:
        print_error(f"Failed to setup test data: {e}")
        return

    # Run tests
    results = {
        'RAG Index': False,
        'RAG Q&A': False,
        'Generate Quiz': False,
        'Generate Summary': False,
        'Dropout Risk': False,
        'Performance Forecast': False,
        'Study Recommendations': False,
        'AI Dashboard': False,
        'Intervention Triggers': False
    }

    try:
        results['RAG Index'] = test_rag_index(token, course.id)
        results['RAG Q&A'] = test_rag_ask_question(token, course.id)
        results['Generate Quiz'] = test_generate_quiz(token, lesson.id)
        results['Generate Summary'] = test_generate_summary(token, lesson.id)
        results['Dropout Risk'] = test_dropout_risk(token)
        results['Performance Forecast'] = test_performance_forecast(token)
        results['Study Recommendations'] = test_study_recommendations(token)
        results['AI Dashboard'] = test_ai_dashboard(token)
        results['Intervention Triggers'] = test_intervention_triggers(token, test_user.id)

    except Exception as e:
        print_error(f"Test execution error: {e}")
        import traceback
        traceback.print_exc()

    # Print summary
    print_section("Test Results Summary")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, passed in results.items():
        if passed:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")

    print(f"\n{Colors.BOLD}Overall: {passed}/{total} tests passed{Colors.END}")

    if passed == total:
        print_success("🎉 All tests passed!")
    elif passed > 0:
        print_warning(f"⚠️  {total - passed} tests failed")
        print_info("Note: Some tests may fail without LLM/OpenAI API key configured")
    else:
        print_error("❌ All tests failed")

    print_info("\n📌 Important Notes:")
    print("   - RAG features require indexed content")
    print("   - Quiz/Summary generation works best with OpenAI API key")
    print("   - Analytics require student activity data")
    print("   - Install dependencies: pip install -r requirements.txt")


if __name__ == '__main__':
    main()

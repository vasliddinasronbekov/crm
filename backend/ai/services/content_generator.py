"""
Content Generator Service

Auto-generates:
- Quiz questions from lesson content
- Lesson summaries
- Practice problems
- Flashcards

Uses LLM (local or API) to generate educational content
"""

import json
import re
from typing import List, Dict, Optional
from django.conf import settings

# Local imports
from student_profile.models import Lesson, Quiz, Question, QuestionOption
from ai.language_detector import LanguageDetector


class ContentGenerator:
    """
    Generate educational content automatically

    Features:
    - Generate multiple choice questions
    - Generate summaries
    - Translate content
    - Create practice problems
    """

    def __init__(self):
        self.language_detector = LanguageDetector()
        self.llm = None
        self._use_openai = hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY

        if self._use_openai:
            try:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model="gpt-3.5-turbo",
                    temperature=0.7,
                    api_key=settings.OPENAI_API_KEY
                )
            except Exception as e:
                print(f"⚠️ OpenAI not available: {e}")
                self._use_openai = False

    def generate_quiz_questions(
        self,
        lesson: Lesson,
        num_questions: int = 5,
        difficulty: str = 'medium',
        language: Optional[str] = None
    ) -> List[Dict]:
        """
        Generate quiz questions from lesson content

        Args:
            lesson: Lesson object
            num_questions: Number of questions to generate
            difficulty: 'easy', 'medium', or 'hard'
            language: Target language (auto-detected if not provided)

        Returns:
            List of question dicts with options
        """

        # Detect language
        if not language:
            language = self.language_detector.detect(lesson.content or lesson.description or '')

        # Extract lesson content
        content = self._extract_lesson_content(lesson)

        if not content:
            return []

        # Generate using LLM if available
        if self.llm:
            return self._generate_questions_with_llm(content, num_questions, difficulty, language)
        else:
            return self._generate_questions_template(content, num_questions, difficulty, language)

    def _extract_lesson_content(self, lesson: Lesson) -> str:
        """Extract and clean lesson content"""
        content_parts = []

        if lesson.title:
            content_parts.append(f"Title: {lesson.title}")

        if lesson.description:
            content_parts.append(f"Description: {lesson.description}")

        if lesson.content:
            # Clean HTML tags if present
            clean_content = re.sub(r'<[^>]+>', ' ', lesson.content)
            content_parts.append(f"Content: {clean_content}")

        return "\n\n".join(content_parts)

    def _generate_questions_with_llm(
        self,
        content: str,
        num_questions: int,
        difficulty: str,
        language: str
    ) -> List[Dict]:
        """Generate questions using LLM"""

        difficulty_instructions = {
            'easy': 'Create straightforward questions that test basic understanding.',
            'medium': 'Create questions that require comprehension and application.',
            'hard': 'Create challenging questions that require analysis and critical thinking.'
        }

        language_names = {
            'en': 'English',
            'uz': 'Uzbek',
            'ru': 'Russian'
        }

        prompt = f"""Based on the following lesson content, generate {num_questions} multiple-choice questions.

Lesson Content:
{content[:2000]}  # Limit content length

Requirements:
- {difficulty_instructions.get(difficulty, '')}
- Each question should have 4 options (A, B, C, D)
- Only one correct answer per question
- Questions should be in {language_names.get(language, 'English')}
- Return as JSON array with this format:
[
  {{
    "question": "Question text",
    "options": [
      {{"text": "Option A", "is_correct": true}},
      {{"text": "Option B", "is_correct": false}},
      {{"text": "Option C", "is_correct": false}},
      {{"text": "Option D", "is_correct": false}}
    ],
    "explanation": "Why this answer is correct"
  }}
]

Generate questions now:"""

        try:
            response = self.llm.predict(prompt)

            # Extract JSON from response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
                return questions_data[:num_questions]

        except Exception as e:
            print(f"❌ LLM generation failed: {e}")

        return []

    def _generate_questions_template(
        self,
        content: str,
        num_questions: int,
        difficulty: str,
        language: str
    ) -> List[Dict]:
        """Fallback: Generate template-based questions"""

        # Simple template-based generation (for when LLM is not available)
        # Extract key sentences from content
        sentences = [s.strip() for s in content.split('.') if len(s.strip()) > 20]

        questions = []
        templates = [
            "What is the main topic of this lesson?",
            "Which statement is true about {topic}?",
            "What is the purpose of {concept}?",
            "How would you describe {term}?",
        ]

        for i, template in enumerate(templates[:num_questions]):
            if i < len(sentences):
                # Extract a keyword from sentence
                words = sentences[i].split()
                keyword = words[min(3, len(words)-1)] if len(words) > 3 else "this concept"

                question_text = template.format(topic=keyword, concept=keyword, term=keyword)

                questions.append({
                    'question': question_text,
                    'options': [
                        {'text': f'Option A (from content)', 'is_correct': True},
                        {'text': f'Option B', 'is_correct': False},
                        {'text': f'Option C', 'is_correct': False},
                        {'text': f'Option D', 'is_correct': False},
                    ],
                    'explanation': 'Based on lesson content'
                })

        return questions

    def create_quiz_from_lesson(
        self,
        lesson: Lesson,
        num_questions: int = 5,
        quiz_title: Optional[str] = None,
        auto_save: bool = False
    ) -> Dict:
        """
        Create a complete quiz from a lesson

        Args:
            lesson: Lesson to create quiz from
            num_questions: Number of questions
            quiz_title: Custom title (auto-generated if not provided)
            auto_save: Whether to save to database

        Returns:
            Dict with quiz data and questions
        """

        # Generate questions
        questions_data = self.generate_quiz_questions(lesson, num_questions)

        if not questions_data:
            return {'error': 'Could not generate questions'}

        # Create quiz title
        if not quiz_title:
            quiz_title = f"Quiz: {lesson.title}"

        quiz_data = {
            'title': quiz_title,
            'course': lesson.module.course if lesson.module else None,
            'module': lesson.module,
            'questions': questions_data,
            'lesson_source': lesson
        }

        # Save to database if requested
        if auto_save and quiz_data.get('course'):
            quiz = self._save_quiz_to_db(quiz_data)
            quiz_data['quiz_id'] = quiz.id

        return quiz_data

    def _save_quiz_to_db(self, quiz_data: Dict) -> Quiz:
        """Save generated quiz to database"""

        quiz = Quiz.objects.create(
            course=quiz_data['course'],
            module=quiz_data.get('module'),
            title=quiz_data['title'],
            time_limit_minutes=15,  # Default
            passing_score_percentage=70,
            max_attempts=3,
            is_published=False  # Keep as draft initially
        )

        # Create questions
        for i, q_data in enumerate(quiz_data['questions'], start=1):
            question = Question.objects.create(
                quiz=quiz,
                question_type='multiple_choice',
                text=q_data['question'],
                points=10,
                order=i,
                explanation=q_data.get('explanation', '')
            )

            # Create options
            for opt_data in q_data['options']:
                QuestionOption.objects.create(
                    question=question,
                    text=opt_data['text'],
                    is_correct=opt_data['is_correct']
                )

        return quiz

    def generate_summary(
        self,
        content: str,
        max_length: int = 200,
        language: Optional[str] = None
    ) -> str:
        """
        Generate a summary of the content

        Args:
            content: Text to summarize
            max_length: Maximum summary length in words
            language: Target language

        Returns:
            Summary text
        """

        if not language:
            language = self.language_detector.detect(content)

        if self.llm:
            return self._generate_summary_with_llm(content, max_length, language)
        else:
            return self._generate_summary_simple(content, max_length)

    def _generate_summary_with_llm(self, content: str, max_length: int, language: str) -> str:
        """Generate summary using LLM"""

        language_names = {'en': 'English', 'uz': 'Uzbek', 'ru': 'Russian'}

        prompt = f"""Summarize the following content in {language_names.get(language, 'English')}.
Make it concise (maximum {max_length} words) and capture the key points.

Content:
{content[:3000]}

Summary:"""

        try:
            summary = self.llm.predict(prompt)
            return summary.strip()
        except Exception as e:
            print(f"❌ Summary generation failed: {e}")
            return self._generate_summary_simple(content, max_length)

    def _generate_summary_simple(self, content: str, max_length: int) -> str:
        """Simple extractive summary (fallback)"""

        # Split into sentences
        sentences = [s.strip() + '.' for s in content.split('.') if len(s.strip()) > 20]

        # Take first few sentences up to max_length
        summary = []
        word_count = 0

        for sentence in sentences:
            words_in_sentence = len(sentence.split())
            if word_count + words_in_sentence <= max_length:
                summary.append(sentence)
                word_count += words_in_sentence
            else:
                break

        return ' '.join(summary) if summary else content[:max_length * 6]  # Rough char estimate

    def translate_content(
        self,
        text: str,
        target_language: str
    ) -> str:
        """
        Translate content to target language

        Args:
            text: Text to translate
            target_language: 'en', 'uz', or 'ru'

        Returns:
            Translated text
        """

        if not self.llm:
            return f"[Translation to {target_language} not available without LLM]"

        language_names = {'en': 'English', 'uz': 'Uzbek', 'ru': 'Russian'}

        prompt = f"""Translate the following text to {language_names.get(target_language, 'English')}.
Maintain the original meaning and educational tone.

Text to translate:
{text}

Translation:"""

        try:
            translation = self.llm.predict(prompt)
            return translation.strip()
        except Exception as e:
            print(f"❌ Translation failed: {e}")
            return text


# Singleton instance
_content_generator = None

def get_content_generator() -> ContentGenerator:
    """Get or create ContentGenerator singleton"""
    global _content_generator
    if _content_generator is None:
        _content_generator = ContentGenerator()
    return _content_generator

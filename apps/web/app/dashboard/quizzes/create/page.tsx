'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

interface QuestionOption {
  option_text: string
  is_correct: boolean
  order: number
}

interface Question {
  question_type: string
  question_text: string
  explanation: string
  points: number
  order: number
  is_required: boolean
  options: QuestionOption[]
}

interface Course {
  id: number
  name: string
}

export default function CreateQuizPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])

  // Quiz metadata
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [course, setCourse] = useState('')
  const [quizType, setQuizType] = useState('practice')
  const [timeLimit, setTimeLimit] = useState(15)
  const [passingScore, setPassingScore] = useState(70)
  const [maxAttempts, setMaxAttempts] = useState(0)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleAnswers, setShuffleAnswers] = useState(false)
  const [isPublished, setIsPublished] = useState(false)

  // Questions
  const [questions, setQuestions] = useState<Question[]>([{
    question_type: 'multiple_choice',
    question_text: '',
    explanation: '',
    points: 1,
    order: 1,
    is_required: true,
    options: [
      { option_text: '', is_correct: false, order: 1 },
      { option_text: '', is_correct: false, order: 2 }
    ]
  }])

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const response = await apiService.getCourses()
      setCourses(response.results || response)
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast.error('Failed to load courses')
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      question_type: 'multiple_choice',
      question_text: '',
      explanation: '',
      points: 1,
      order: questions.length + 1,
      is_required: true,
      options: [
        { option_text: '', is_correct: false, order: 1 },
        { option_text: '', is_correct: false, order: 2 }
      ]
    }
    setQuestions([...questions, newQuestion])
  }

  const deleteQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index)
    updatedQuestions.forEach((q, i) => q.order = i + 1)
    setQuestions(updatedQuestions)
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updatedQuestions = [...questions]
    ;[updatedQuestions[index], updatedQuestions[newIndex]] = [updatedQuestions[newIndex], updatedQuestions[index]]
    updatedQuestions.forEach((q, i) => q.order = i + 1)
    setQuestions(updatedQuestions)
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions]
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value }
    setQuestions(updatedQuestions)
  }

  const addOption = (questionIndex: number) => {
    const updatedQuestions = [...questions]
    const question = updatedQuestions[questionIndex]
    question.options.push({
      option_text: '',
      is_correct: false,
      order: question.options.length + 1
    })
    setQuestions(updatedQuestions)
  }

  const deleteOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions]
    const question = updatedQuestions[questionIndex]
    question.options = question.options.filter((_, i) => i !== optionIndex)
    question.options.forEach((opt, i) => opt.order = i + 1)
    setQuestions(updatedQuestions)
  }

  const updateOption = (questionIndex: number, optionIndex: number, field: keyof QuestionOption, value: any) => {
    const updatedQuestions = [...questions]
    const option = updatedQuestions[questionIndex].options[optionIndex]

    if (field === 'is_correct' && value === true) {
      // For multiple choice, only one answer can be correct
      updatedQuestions[questionIndex].options.forEach((opt, i) => {
        opt.is_correct = i === optionIndex
      })
    } else {
      updatedQuestions[questionIndex].options[optionIndex] = { ...option, [field]: value }
    }

    setQuestions(updatedQuestions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!title.trim()) {
      toast.warning('Please enter a quiz title')
      return
    }

    if (!course) {
      toast.warning('Please select a course')
      return
    }

    if (questions.length === 0) {
      toast.warning('Please add at least one question')
      return
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim()) {
        toast.warning(`Question ${i + 1}: Please enter question text`)
        return
      }

      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        if (q.options.length < 2) {
          toast.warning(`Question ${i + 1}: Please add at least 2 options`)
          return
        }

        if (!q.options.some(opt => opt.is_correct)) {
          toast.warning(`Question ${i + 1}: Please mark at least one correct answer`)
          return
        }

        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].option_text.trim()) {
            toast.warning(`Question ${i + 1}, Option ${j + 1}: Please enter option text`)
            return
          }
        }
      }
    }

    setLoading(true)

    try {
      const payload = {
        course: parseInt(course),
        title,
        description,
        quiz_type: quizType,
        time_limit_minutes: timeLimit,
        passing_score: passingScore,
        max_attempts: maxAttempts,
        show_correct_answers: showCorrectAnswers,
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        is_published: isPublished,
        questions: questions.map(q => ({
          ...q,
          options: q.question_type === 'multiple_choice' || q.question_type === 'true_false'
            ? q.options
            : []
        }))
      }

      await apiService.createQuizWithQuestions(payload)
      toast.success('Quiz created successfully!')
      router.push('/dashboard/quizzes')
    } catch (error: any) {
      console.error('Error creating quiz:', error)
      toast.error(error.response?.data?.error || 'Failed to create quiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Create New Quiz 📝</h1>
        <p className="text-text-secondary">Build a comprehensive quiz for your students</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quiz Metadata */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Quiz Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                placeholder="e.g., English Grammar - Beginner Level"
                required
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                rows={3}
                placeholder="Brief description of this quiz..."
              />
            </div>

            {/* Course */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Course *
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                required
              >
                <option value="">Select a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Quiz Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Quiz Type
              </label>
              <select
                value={quizType}
                onChange={(e) => setQuizType(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              >
                <option value="practice">Practice Quiz</option>
                <option value="graded">Graded Quiz</option>
                <option value="exam">Exam</option>
                <option value="survey">Survey</option>
              </select>
            </div>

            {/* Time Limit */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Time Limit (minutes)
              </label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                min="0"
              />
              <p className="text-xs text-text-secondary mt-1">0 = No time limit</p>
            </div>

            {/* Passing Score */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Passing Score (%)
              </label>
              <input
                type="number"
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                min="0"
                max="100"
              />
            </div>

            {/* Max Attempts */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Attempts
              </label>
              <input
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                min="0"
              />
              <p className="text-xs text-text-secondary mt-1">0 = Unlimited</p>
            </div>

            {/* Checkboxes */}
            <div className="col-span-2 space-y-3 pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={showCorrectAnswers}
                  onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Show correct answers after submission</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Shuffle questions</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={shuffleAnswers}
                  onChange={(e) => setShuffleAnswers(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Shuffle answer options</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Publish quiz (students can see it)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Question
            </button>
          </div>

          {questions.map((question, qIndex) => (
            <div key={qIndex} className="card border-l-4 border-l-primary">
              {/* Question Header */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">
                  Question {qIndex + 1}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, 'up')}
                    disabled={qIndex === 0}
                    className="p-2 text-text-secondary hover:text-text hover:bg-surface rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, 'down')}
                    disabled={qIndex === questions.length - 1}
                    className="p-2 text-text-secondary hover:text-text hover:bg-surface rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(qIndex)}
                    className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Question Type and Points */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Question Type
                    </label>
                    <select
                      value={question.question_type}
                      onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                      className="w-full px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True/False</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="essay">Essay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Points
                    </label>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                      min="1"
                    />
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Question Text *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                    className="w-full px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                    rows={2}
                    placeholder="Enter your question here..."
                    required
                  />
                </div>

                {/* Options (for multiple choice and true/false) */}
                {(question.question_type === 'multiple_choice' || question.question_type === 'true_false') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Answer Options
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex gap-2">
                          <input
                            type="radio"
                            checked={option.is_correct}
                            onChange={() => updateOption(qIndex, oIndex, 'is_correct', true)}
                            className="mt-3"
                          />
                          <input
                            type="text"
                            value={option.option_text}
                            onChange={(e) => updateOption(qIndex, oIndex, 'option_text', e.target.value)}
                            className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                            placeholder={`Option ${oIndex + 1}`}
                          />
                          {question.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => deleteOption(qIndex, oIndex)}
                              className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {question.question_type === 'multiple_choice' && (
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>
                )}

                {/* Explanation */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Explanation (shown after answering)
                  </label>
                  <textarea
                    value={question.explanation}
                    onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                    className="w-full px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                    rows={2}
                    placeholder="Explain the correct answer..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end sticky bottom-0 bg-background p-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push('/dashboard/quizzes')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  )
}

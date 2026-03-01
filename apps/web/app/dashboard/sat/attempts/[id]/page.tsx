'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface SATAnswer {
  id: number
  question: {
    id: number
    question_text: string
    question_type: string
    options: { [key: string]: string }
    correct_answer: string
    explanation?: string
    difficulty_level: string
  }
  answer_given: string
  is_correct: boolean
  time_spent_seconds: number
}

interface SATAttemptDetail {
  id: number
  student: {
    id: number
    username: string
    first_name: string
    last_name: string
  }
  exam: {
    id: number
    title: string
    is_official: boolean
    test_number?: number
  }
  status: string
  total_score: number | null
  reading_writing_score: number | null
  math_score: number | null
  rw_correct: number
  math_correct: number
  rw_total: number
  math_total: number
  coins_paid: number
  coins_refunded: number
  started_at: string
  completed_at: string | null
  refund_eligible: boolean
  ai_feedback?: any
  answers: SATAnswer[]
}

export default function SATAttemptDetailPage() {
  const router = useRouter()
  const params = useParams()
  const attemptId = parseInt(params.id as string)

  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<SATAttemptDetail | null>(null)
  const [selectedSection, setSelectedSection] = useState<'all' | 'rw' | 'math'>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false)

  useEffect(() => {
    loadAttemptDetails()
  }, [attemptId])

  const loadAttemptDetails = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/v1/student-profile/sat/attempts/${attemptId}/results/`)
      setAttempt(response.data)
    } catch (error: any) {
      console.error('Failed to load attempt details:', error)
      toast.error('Failed to load attempt details')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredAnswers = () => {
    if (!attempt) return []

    let filtered = [...attempt.answers]

    // Filter by section
    if (selectedSection === 'rw') {
      filtered = filtered.filter((a) =>
        ['craft_structure', 'information_ideas', 'expression_ideas', 'standard_english'].includes(
          a.question.question_type
        )
      )
    } else if (selectedSection === 'math') {
      filtered = filtered.filter((a) =>
        ['algebra', 'advanced_math', 'problem_solving', 'geometry'].includes(a.question.question_type)
      )
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter((a) => a.question.difficulty_level === selectedDifficulty)
    }

    // Filter by correctness
    if (showOnlyIncorrect) {
      filtered = filtered.filter((a) => !a.is_correct)
    }

    return filtered
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getScoreColor = (score: number | null, max: number) => {
    if (!score) return 'text-slate-400'
    const percentage = (score / max) * 100
    if (percentage >= 90) return 'text-green-400'
    if (percentage >= 75) return 'text-blue-400'
    if (percentage >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading attempt details...</p>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Attempt not found</p>
        <button
          onClick={() => router.push('/dashboard/sat/attempts')}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          Back to Attempts
        </button>
      </div>
    )
  }

  const filteredAnswers = getFilteredAnswers()
  const rwPercentage = attempt.rw_total > 0 ? (attempt.rw_correct / attempt.rw_total) * 100 : 0
  const mathPercentage = attempt.math_total > 0 ? (attempt.math_correct / attempt.math_total) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/sat/attempts')}
          className="text-slate-400 hover:text-white mb-2 flex items-center"
        >
          ← Back to Attempts
        </button>
        <h1 className="text-3xl font-bold text-white">SAT Attempt Details</h1>
        <p className="text-slate-400 mt-1">Detailed performance analysis and answers</p>
      </div>

      {/* Student & Exam Info */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Student Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Name:</span>
                <span className="text-white font-medium">
                  {attempt.student.first_name} {attempt.student.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Username:</span>
                <span className="text-white">@{attempt.student.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attempt ID:</span>
                <span className="text-white">#{attempt.id}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Exam Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Exam:</span>
                <span className="text-white font-medium">{attempt.exam.title}</span>
              </div>
              {attempt.exam.is_official && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                    Official Test #{attempt.exam.test_number}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Started:</span>
                <span className="text-white">{formatDate(attempt.started_at)}</span>
              </div>
              {attempt.completed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed:</span>
                  <span className="text-white">{formatDate(attempt.completed_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Score</h3>
          <p className={`text-4xl font-bold ${getScoreColor(attempt.total_score, 1600)}`}>
            {attempt.total_score || 0}
            <span className="text-2xl text-slate-500">/1600</span>
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Coins Paid:</span>
              <span className="text-red-400">-{attempt.coins_paid}</span>
            </div>
            {attempt.coins_refunded > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Coins Refunded:</span>
                <span className="text-green-400">+{attempt.coins_refunded}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-2">📖 Reading & Writing</h3>
          <p className={`text-4xl font-bold ${getScoreColor(attempt.reading_writing_score, 800)}`}>
            {attempt.reading_writing_score || 0}
            <span className="text-2xl text-slate-500">/800</span>
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Correct Answers:</span>
              <span className="text-white font-medium">
                {attempt.rw_correct}/{attempt.rw_total}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${rwPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1">{rwPercentage.toFixed(1)}% accuracy</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-2">🔢 Math</h3>
          <p className={`text-4xl font-bold ${getScoreColor(attempt.math_score, 800)}`}>
            {attempt.math_score || 0}
            <span className="text-2xl text-slate-500">/800</span>
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Correct Answers:</span>
              <span className="text-white font-medium">
                {attempt.math_correct}/{attempt.math_total}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${mathPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1">{mathPercentage.toFixed(1)}% accuracy</p>
          </div>
        </div>
      </div>

      {/* AI Feedback */}
      {attempt.ai_feedback && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">🤖 AI Performance Analysis</h2>
          <div className="space-y-4">
            {attempt.ai_feedback.overall_assessment && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Overall Assessment</h3>
                <p className="text-slate-400">{attempt.ai_feedback.overall_assessment}</p>
              </div>
            )}

            {attempt.ai_feedback.strengths && attempt.ai_feedback.strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-2">Strengths</h3>
                <ul className="list-disc list-inside space-y-1">
                  {attempt.ai_feedback.strengths.map((strength: string, index: number) => (
                    <li key={index} className="text-slate-400 text-sm">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {attempt.ai_feedback.weaknesses && attempt.ai_feedback.weaknesses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">Areas for Improvement</h3>
                <ul className="list-disc list-inside space-y-1">
                  {attempt.ai_feedback.weaknesses.map((weakness: string, index: number) => (
                    <li key={index} className="text-slate-400 text-sm">
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {attempt.ai_feedback.study_plan && attempt.ai_feedback.study_plan.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-blue-400 mb-2">Study Plan</h3>
                <ul className="list-disc list-inside space-y-1">
                  {attempt.ai_feedback.study_plan.map((tip: string, index: number) => (
                    <li key={index} className="text-slate-400 text-sm">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedSection('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedSection === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setSelectedSection('rw')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedSection === 'rw'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Reading & Writing
            </button>
            <button
              onClick={() => setSelectedSection('math')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedSection === 'math'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Math
            </button>
          </div>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value as any)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyIncorrect}
              onChange={(e) => setShowOnlyIncorrect(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm text-slate-300">Show only incorrect answers</span>
          </label>

          <div className="ml-auto text-sm text-slate-400">
            Showing {filteredAnswers.length} of {attempt.answers.length} answers
          </div>
        </div>
      </div>

      {/* Answers List */}
      <div className="space-y-4">
        {filteredAnswers.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-400">No answers match the selected filters</p>
          </div>
        ) : (
          filteredAnswers.map((answer, index) => (
            <div
              key={answer.id}
              className={`bg-slate-800 rounded-lg border p-6 ${
                answer.is_correct ? 'border-green-500/30' : 'border-red-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span
                    className={`text-2xl ${answer.is_correct ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {answer.is_correct ? '✓' : '✗'}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Question {index + 1}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        {answer.question.question_type.replace('_', ' ')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        {answer.question.difficulty_level}
                      </span>
                      <span className="text-xs text-slate-400">
                        Time: {formatTime(answer.time_spent_seconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-white font-mono text-sm whitespace-pre-wrap">
                  {answer.question.question_text}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(answer.question.options || {}).map(([key, value]) => (
                  <div
                    key={key}
                    className={`p-3 rounded text-sm ${
                      key === answer.question.correct_answer
                        ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                        : key === answer.answer_given && !answer.is_correct
                        ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                        : 'bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="font-bold">{key}.</span> {value}
                    {key === answer.answer_given && !answer.is_correct && (
                      <span className="ml-2 text-xs">(Your answer)</span>
                    )}
                    {key === answer.question.correct_answer && (
                      <span className="ml-2 text-xs">(Correct)</span>
                    )}
                  </div>
                ))}
              </div>

              {answer.question.explanation && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-purple-400 hover:text-purple-300 font-medium">
                    View Explanation
                  </summary>
                  <div className="mt-2 p-3 bg-slate-700/50 rounded text-slate-300 font-mono text-xs">
                    {answer.question.explanation}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

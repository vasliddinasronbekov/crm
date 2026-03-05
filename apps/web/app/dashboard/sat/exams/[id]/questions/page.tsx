'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'
import LoadingScreen from '@/components/LoadingScreen'

interface SATExam {
  id: number
  title: string
  rw_total_questions: number
  math_total_questions: number
  is_published: boolean
}

interface SATModule {
  id: number
  section: 'reading_writing' | 'math'
  module_number: 1 | 2
  difficulty_level: 'easy' | 'medium' | 'hard'
  total_questions: number
}

interface SATQuestion {
  id?: number
  module: number
  question_type: string
  question_text: string
  passage_text?: string
  options?: { [key: string]: string }
  correct_answer: any
  explanation?: string
  difficulty_level: 'easy' | 'medium' | 'hard'
  points: number
  order_index: number
  image_url?: string
  calculator_allowed?: boolean
}

interface SATQualityReport {
  summary: {
    is_publish_ready: boolean
    total_questions: number
    target_questions: number
    completion_percentage: number
  }
  blockers: string[]
  warnings: string[]
}

const RW_QUESTION_TYPES = [
  { value: 'craft_structure', label: 'Craft & Structure' },
  { value: 'information_ideas', label: 'Information & Ideas' },
  { value: 'expression_ideas', label: 'Expression of Ideas' },
  { value: 'standard_english', label: 'Standard English Conventions' },
]

const MATH_QUESTION_TYPES = [
  { value: 'algebra', label: 'Algebra' },
  { value: 'advanced_math', label: 'Advanced Math' },
  { value: 'problem_solving', label: 'Problem-Solving & Data Analysis' },
  { value: 'geometry', label: 'Geometry & Trigonometry' },
]

const OPTION_KEYS = ['A', 'B', 'C', 'D']

const toOptionMap = (options: unknown): { [key: string]: string } => {
  if (!Array.isArray(options)) {
    return { A: '', B: '', C: '', D: '' }
  }

  return OPTION_KEYS.reduce(
    (accumulator, key, index) => ({
      ...accumulator,
      [key]: String(options[index] ?? ''),
    }),
    {} as { [key: string]: string }
  )
}

const fromOptionMap = (options: { [key: string]: string } | undefined) =>
  OPTION_KEYS.map((key) => options?.[key]?.trim() || '').filter(Boolean)

export default function SATQuestionsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = parseInt(params.id as string)

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<SATExam | null>(null)
  const [modules, setModules] = useState<SATModule[]>([])
  const [questions, setQuestions] = useState<SATQuestion[]>([])
  const [qualityReport, setQualityReport] = useState<SATQualityReport | null>(null)
  const [selectedModule, setSelectedModule] = useState<number | null>(null)
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SATQuestion | null>(null)

  // Question form state
  const [questionForm, setQuestionForm] = useState<SATQuestion>({
    module: 0,
    question_type: '',
    question_text: '',
    passage_text: '',
    options: { A: '', B: '', C: '', D: '' },
    correct_answer: '',
    explanation: '',
    difficulty_level: 'medium',
    points: 1,
    order_index: 1,
    calculator_allowed: false,
  })

  useEffect(() => {
    loadExamData()
  }, [examId])

  useEffect(() => {
    if (selectedModule) {
      loadQuestions(selectedModule)
    }
  }, [selectedModule])

  const loadExamData = async () => {
    setLoading(true)
    try {
      const [examResponse, modulesResponse, qualityResponse] = await Promise.all([
        api.get(`/v1/student-profile/sat/exams/${examId}/`),
        api.get(`/v1/student-profile/sat/modules/?exam=${examId}`),
        api.getSATExamQualityReport(examId),
      ])

      setExam(examResponse)
      setQualityReport(qualityResponse)
      const modulesData = modulesResponse.results || modulesResponse || []
      setModules(
        modulesData.map((module: any) => ({
          id: module.id,
          section: module.section,
          module_number: module.module_number,
          difficulty_level: module.difficulty,
          total_questions: module.question_count,
        }))
      )

      if (modulesData.length > 0) {
        setSelectedModule(modulesData[0].id)
      }
    } catch (error: any) {
      console.error('Failed to load exam:', error)
      toast.error('Failed to load exam data')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestions = async (moduleId: number) => {
    try {
      const response = await api.get(`/v1/student-profile/sat/questions/?module=${moduleId}`)
      const rawQuestions = response.results || response || []
      setQuestions(
        rawQuestions.map((question: any) => ({
          id: question.id,
          module: question.module,
          question_type: question.section === 'reading_writing' ? question.rw_type : question.math_type,
          question_text: question.question_text,
          passage_text: question.passage_text || '',
          options: toOptionMap(question.options),
          correct_answer: question.correct_answer?.answer || '',
          explanation: question.explanation || '',
          difficulty_level: question.difficulty_level,
          points: Number(question.points || 1),
          order_index: question.question_number || question.order || 1,
          calculator_allowed: question.section === 'math' && question.answer_type === 'spr',
        }))
      )
    } catch (error: any) {
      console.error('Failed to load questions:', error)
      toast.error('Failed to load questions')
    }
  }

  const handleCreateQuestion = () => {
    const currentModule = modules.find((m) => m.id === selectedModule)
    if (!currentModule) return

    const nextOrderIndex = questions.length + 1
    const defaultQuestionType =
      currentModule.section === 'reading_writing' ? 'craft_structure' : 'algebra'

    setQuestionForm({
      module: selectedModule!,
      question_type: defaultQuestionType,
      question_text: '',
      passage_text: '',
      options: { A: '', B: '', C: '', D: '' },
      correct_answer: '',
      explanation: '',
      difficulty_level: currentModule.difficulty_level,
      points: 1,
      order_index: nextOrderIndex,
      calculator_allowed: currentModule.section === 'math',
    })
    setEditingQuestion(null)
    setIsCreatingQuestion(true)
  }

  const handleEditQuestion = (question: SATQuestion) => {
    setQuestionForm(question)
    setEditingQuestion(question)
    setIsCreatingQuestion(true)
  }

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text.trim()) {
      toast.error('Please enter question text')
      return
    }

    if (!questionForm.correct_answer) {
      toast.error('Please specify the correct answer')
      return
    }

    try {
      if (editingQuestion) {
        await api.patch(`/v1/student-profile/sat/questions/${editingQuestion.id}/`, buildQuestionPayload())
        toast.success('Question updated successfully!')
      } else {
        await api.post('/v1/student-profile/sat/questions/', buildQuestionPayload())
        toast.success('Question created successfully!')
      }

      setIsCreatingQuestion(false)
      setEditingQuestion(null)
      await Promise.all([loadQuestions(selectedModule!), loadExamData()])
    } catch (error: any) {
      console.error('Failed to save question:', error)
      toast.error(error?.response?.data?.detail || 'Failed to save question')
    }
  }

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      await api.delete(`/v1/student-profile/sat/questions/${questionId}/`)
      toast.success('Question deleted successfully!')
      await Promise.all([loadQuestions(selectedModule!), loadExamData()])
    } catch (error: any) {
      console.error('Failed to delete question:', error)
      toast.error('Failed to delete question')
    }
  }

  const handleFormChange = (field: keyof SATQuestion, value: any) => {
    setQuestionForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleOptionChange = (optionKey: string, value: string) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: { ...prev.options, [optionKey]: value },
    }))
  }

  const getCurrentModule = () => modules.find((m) => m.id === selectedModule)
  const buildQuestionPayload = () => {
    const currentModule = getCurrentModule()
    const answerType =
      currentModule?.section === 'math' && questionForm.calculator_allowed ? 'spr' : 'mcq'

    return {
      module: questionForm.module,
      question_number: questionForm.order_index,
      passage_text: questionForm.passage_text || '',
      question_text: questionForm.question_text,
      rw_type: currentModule?.section === 'reading_writing' ? questionForm.question_type : null,
      math_type: currentModule?.section === 'math' ? questionForm.question_type : null,
      answer_type: answerType,
      options: answerType === 'mcq' ? fromOptionMap(questionForm.options) : [],
      correct_answer: { answer: questionForm.correct_answer },
      explanation: questionForm.explanation || '',
      difficulty_level: questionForm.difficulty_level,
      points: questionForm.points,
      order: questionForm.order_index,
    }
  }

  const getQuestionTypes = () => {
    const currentModule = getCurrentModule()
    return currentModule?.section === 'reading_writing' ? RW_QUESTION_TYPES : MATH_QUESTION_TYPES
  }

  if (loading) {
    return <LoadingScreen message="Loading exam..." />
  }

if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Exam not found</p>
      </div>
    )
  }

  const currentModule = getCurrentModule()
  const moduleQuestionCount = questions.length
  const moduleQuestionTarget = currentModule?.total_questions || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard/sat/exams')}
            className="text-slate-400 hover:text-white mb-2 flex items-center"
          >
            ← Back to Exams
          </button>
          <h1 className="text-3xl font-bold text-white">{exam.title}</h1>
          <p className="text-slate-400 mt-1">Manage exam questions by module</p>
        </div>
        <button
          onClick={handleCreateQuestion}
          disabled={!selectedModule}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
        >
          + Add Question
        </button>
      </div>

      {/* Module Tabs */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setSelectedModule(module.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedModule === module.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {module.section === 'reading_writing' ? '📖 RW' : '🔢 Math'} - Module{' '}
              {module.module_number}
              <span className="ml-2 text-xs opacity-75">({module.difficulty_level})</span>
            </button>
          ))}
        </div>

        {currentModule && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-slate-400">
              <span className="font-medium text-white">{moduleQuestionCount}</span> of{' '}
              <span className="font-medium text-white">{moduleQuestionTarget}</span> questions added
            </div>
            <div
              className={`px-3 py-1 rounded ${
                moduleQuestionCount >= moduleQuestionTarget
                  ? 'bg-green-500/20 text-green-400'
                  : moduleQuestionCount > 0
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {moduleQuestionCount >= moduleQuestionTarget
                ? 'Complete'
                : `${moduleQuestionTarget - moduleQuestionCount} remaining`}
            </div>
          </div>
        )}
      </div>

      {qualityReport && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Exam Readiness</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {qualityReport.summary.total_questions}/{qualityReport.summary.target_questions}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  qualityReport.summary.is_publish_ready
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {qualityReport.summary.is_publish_ready ? 'Publish Ready' : 'Needs Fixes'}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: `${Math.min(qualityReport.summary.completion_percentage, 100)}%` }}
              />
            </div>
            <div className="mt-4 flex gap-3 text-sm">
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-red-300">
                {qualityReport.blockers.length} blockers
              </div>
              <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-300">
                {qualityReport.warnings.length} warnings
              </div>
              <button
                onClick={() => router.push(`/dashboard/sat/exams/${examId}`)}
                className="rounded-lg bg-slate-700 px-3 py-2 text-slate-200 transition-colors hover:bg-slate-600"
              >
                Open Full Insights
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium text-red-300">Top Blockers</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {qualityReport.blockers.length ? (
                    qualityReport.blockers.slice(0, 3).map((blocker) => (
                      <div key={blocker} className="rounded-lg bg-red-500/10 px-3 py-2">
                        {blocker}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">
                      No blockers detected.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-amber-300">Warnings</div>
                <div className="space-y-2 text-sm text-slate-300">
                  {qualityReport.warnings.length ? (
                    qualityReport.warnings.slice(0, 3).map((warning) => (
                      <div key={warning} className="rounded-lg bg-amber-500/10 px-3 py-2">
                        {warning}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-slate-700 px-3 py-2 text-slate-300">
                      No warnings right now.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Form Modal */}
      {isCreatingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {editingQuestion ? 'Edit Question' : 'Create New Question'}
                </h2>
                <button
                  onClick={() => setIsCreatingQuestion(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Question Type & Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Question Type *
                  </label>
                  <select
                    value={questionForm.question_type}
                    onChange={(e) => handleFormChange('question_type', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select type...</option>
                    {getQuestionTypes().map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={questionForm.difficulty_level}
                    onChange={(e) => handleFormChange('difficulty_level', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Passage Text (for RW questions) */}
              {currentModule?.section === 'reading_writing' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Passage Text (optional)
                  </label>
                  <textarea
                    value={questionForm.passage_text || ''}
                    onChange={(e) => handleFormChange('passage_text', e.target.value)}
                    placeholder="Enter reading passage if applicable..."
                    rows={4}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                </div>
              )}

              {/* Question Text */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Question Text * (supports LaTeX: use $...$ for inline, $$...$$ for display)
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => handleFormChange('question_text', e.target.value)}
                  placeholder="Enter question text... You can use LaTeX: $x^2 + y^2 = r^2$"
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
              </div>

              {!(currentModule?.section === 'math' && questionForm.calculator_allowed) && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Answer Options (supports LaTeX)
                  </label>
                  <div className="space-y-2">
                    {['A', 'B', 'C', 'D'].map((key) => (
                      <div key={key} className="flex items-center space-x-3">
                        <span className="text-white font-medium w-8">{key}.</span>
                        <input
                          type="text"
                          value={questionForm.options?.[key] || ''}
                          onChange={(e) => handleOptionChange(key, e.target.value)}
                          placeholder={`Option ${key}...`}
                          className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Correct Answer */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Correct Answer *
                </label>
                <select
                  value={questionForm.correct_answer}
                  onChange={(e) => handleFormChange('correct_answer', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select correct answer...</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Explanation (optional, supports LaTeX)
                </label>
                <textarea
                  value={questionForm.explanation || ''}
                  onChange={(e) => handleFormChange('explanation', e.target.value)}
                  placeholder="Explain why this is the correct answer..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
              </div>

              {/* Additional Options for Math */}
              {currentModule?.section === 'math' && (
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="calculator_allowed"
                    checked={questionForm.calculator_allowed}
                    onChange={(e) => handleFormChange('calculator_allowed', e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="calculator_allowed" className="text-sm font-medium text-slate-300">
                    Use student-produced response (grid-in)
                  </label>
                </div>
              )}

              {/* Order Index & Points */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Order Index
                  </label>
                  <input
                    type="number"
                    value={questionForm.order_index}
                    onChange={(e) => handleFormChange('order_index', parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Points
                  </label>
                  <input
                    type="number"
                    value={questionForm.points}
                    onChange={(e) => handleFormChange('points', parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsCreatingQuestion(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                {editingQuestion ? 'Update Question' : 'Create Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        {questions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-white mb-2">No questions yet</h3>
            <p className="text-slate-400 mb-6">
              Add questions to this module to complete the exam
            </p>
            <button
              onClick={handleCreateQuestion}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              + Add First Question
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {questions
              .sort((a, b) => a.order_index - b.order_index)
              .map((question, index) => (
                <div key={question.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-bold text-purple-400">Q{index + 1}</span>
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                          {question.question_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                          {question.difficulty_level}
                        </span>
                        {question.calculator_allowed && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                            Grid-in
                          </span>
                        )}
                      </div>

                      {question.passage_text && (
                        <div className="mb-3 p-3 bg-slate-700/50 rounded text-sm text-slate-300 border-l-4 border-purple-500">
                          <p className="font-mono text-xs line-clamp-2">
                            {question.passage_text}
                          </p>
                        </div>
                      )}

                      <p className="text-white mb-3 font-mono text-sm">{question.question_text}</p>

                      {question.calculator_allowed ? (
                        <div className="mb-3 rounded bg-slate-700/50 p-2 text-sm text-slate-300">
                          Correct response: <span className="font-semibold text-emerald-300">{question.correct_answer}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {Object.entries(question.options || {}).map(([key, value]) => (
                            <div
                              key={key}
                              className={`text-sm p-2 rounded ${
                                question.correct_answer === key
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                  : 'bg-slate-700/50 text-slate-300'
                              }`}
                            >
                              <span className="font-bold">{key}.</span> {value}
                            </div>
                          ))}
                        </div>
                      )}

                      {question.explanation && (
                        <details className="text-sm text-slate-400">
                          <summary className="cursor-pointer hover:text-slate-300">
                            Explanation
                          </summary>
                          <p className="mt-2 ml-4 font-mono text-xs">{question.explanation}</p>
                        </details>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditQuestion(question)}
                        className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id!)}
                        className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface SATExam {
  id?: number
  title: string
  description: string
  coin_cost: number
  coin_refund: number
  passing_score: number
  rw_total_questions: number
  rw_time_minutes: number
  math_total_questions: number
  math_time_minutes: number
  is_official: boolean
  test_number?: number
  is_published: boolean
}

interface SATModule {
  id?: number
  exam?: number
  section: 'reading_writing' | 'math'
  module_number: 1 | 2
  difficulty_level: 'easy' | 'medium' | 'hard'
  time_minutes: number
  order: number
}

export default function CreateSATExamPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get('id')
  const isEditMode = !!examId

  const [loading, setLoading] = useState(false)
  const [loadingExam, setLoadingExam] = useState(false)
  const [exam, setExam] = useState<SATExam>({
    title: '',
    description: '',
    coin_cost: 50,
    coin_refund: 10,
    passing_score: 1000,
    rw_total_questions: 54,
    rw_time_minutes: 64,
    math_total_questions: 44,
    math_time_minutes: 70,
    is_official: false,
    is_published: false,
  })

  const [modules, setModules] = useState<SATModule[]>([
    {
      section: 'reading_writing',
      module_number: 1,
      difficulty_level: 'medium',
      time_minutes: 32,
      order: 1,
    },
    {
      section: 'reading_writing',
      module_number: 2,
      difficulty_level: 'medium',
      time_minutes: 32,
      order: 2,
    },
    {
      section: 'math',
      module_number: 1,
      difficulty_level: 'medium',
      time_minutes: 35,
      order: 3,
    },
    {
      section: 'math',
      module_number: 2,
      difficulty_level: 'medium',
      time_minutes: 35,
      order: 4,
    },
  ])

  useEffect(() => {
    if (isEditMode) {
      loadExam()
    }
  }, [examId])

  const loadExam = async () => {
    setLoadingExam(true)
    try {
      const examData = await api.get(`/v1/student-profile/sat/exams/${examId}/`)
      setExam(examData)

      // Load modules if they exist
      if (examData.modules && examData.modules.length > 0) {
        setModules(
          examData.modules.map((module: any, index: number) => ({
            id: module.id,
            exam: module.exam,
            section: module.section,
            module_number: module.module_number,
            difficulty_level: module.difficulty,
            time_minutes: module.time_minutes,
            order: module.order ?? index + 1,
          }))
        )
      }
    } catch (error: any) {
      console.error('Failed to load exam:', error)
      toast.error(error?.response?.data?.detail || 'Failed to load exam')
    } finally {
      setLoadingExam(false)
    }
  }

  const handleExamChange = (field: keyof SATExam, value: any) => {
    setExam((prev) => ({ ...prev, [field]: value }))
  }

  const handleModuleChange = (index: number, field: keyof SATModule, value: any) => {
    setModules((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const validateForm = (): boolean => {
    if (!exam.title.trim()) {
      toast.error('Please enter exam title')
      return false
    }

    if (exam.coin_cost < 0) {
      toast.error('Coin cost must be 0 or greater')
      return false
    }

    if (exam.coin_refund < 0) {
      toast.error('Coin refund must be 0 or greater')
      return false
    }

    if (exam.passing_score < 400 || exam.passing_score > 1600) {
      toast.error('Passing score must be between 400 and 1600')
      return false
    }

    const rwModuleCount = modules.filter((m) => m.section === 'reading_writing').length
    const mathModuleCount = modules.filter((m) => m.section === 'math').length
    if (rwModuleCount !== 2 || mathModuleCount !== 2) {
      toast.error('SAT exams must contain exactly 2 Reading & Writing modules and 2 Math modules')
      return false
    }

    const invalidTiming = modules.some((module) => module.time_minutes <= 0)
    if (invalidTiming) {
      toast.error('Each module must have a time limit greater than 0 minutes')
      return false
    }

    return true
  }

  const handleSave = async (redirectToQuestions: boolean = false) => {
    if (!validateForm()) return

    setLoading(true)
    try {
      let savedExam: any

      if (isEditMode) {
        // Update existing exam
        savedExam = await api.patch(`/v1/student-profile/sat/exams/${examId}/`, exam)
        toast.success('SAT exam updated successfully!')
      } else {
        // Create new exam
        savedExam = await api.post('/v1/student-profile/sat/exams/', exam)
        toast.success('SAT exam created successfully!')
      }

      // Create/update modules
      for (const [index, examModule] of modules.entries()) {
        const moduleData = {
          exam: savedExam.id,
          section: examModule.section,
          module_number: examModule.module_number,
          difficulty: examModule.difficulty_level,
          time_minutes: examModule.time_minutes,
          order: examModule.order ?? index + 1,
        }

        if (examModule.id) {
          await api.patch(`/v1/student-profile/sat/modules/${examModule.id}/`, moduleData)
        } else {
          await api.post('/v1/student-profile/sat/modules/', moduleData)
        }
      }

      toast.success('Modules saved successfully!')

      if (redirectToQuestions) {
        router.push(`/dashboard/sat/exams/${savedExam.id}/questions`)
      } else {
        router.push('/dashboard/sat/exams')
      }
    } catch (error: any) {
      console.error('Failed to save exam:', error)
      toast.error(error?.response?.data?.detail || 'Failed to save exam')
    } finally {
      setLoading(false)
    }
  }

  if (loadingExam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading exam...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {isEditMode ? 'Edit SAT Exam' : 'Create SAT Exam'}
          </h1>
          <p className="text-slate-400 mt-1">
            {isEditMode
              ? 'Update exam details and module configuration'
              : 'Configure new SAT 2025 digital exam'}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/sat/exams')}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Details */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Basic Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Exam Title *
                </label>
                <input
                  type="text"
                  value={exam.title}
                  onChange={(e) => handleExamChange('title', e.target.value)}
                  placeholder="e.g., SAT Practice Test 1"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={exam.description}
                  onChange={(e) => handleExamChange('description', e.target.value)}
                  placeholder="Brief description of the exam..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="is_official"
                    checked={exam.is_official}
                    onChange={(e) => handleExamChange('is_official', e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="is_official" className="text-sm font-medium text-slate-300">
                    Official College Board Exam
                  </label>
                </div>

                {exam.is_official && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Test Number
                    </label>
                    <input
                      type="number"
                      value={exam.test_number || ''}
                      onChange={(e) => handleExamChange('test_number', parseInt(e.target.value) || undefined)}
                      placeholder="e.g., 1"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={exam.is_published}
                  onChange={(e) => handleExamChange('is_published', e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="is_published" className="text-sm font-medium text-slate-300">
                  Publish exam (make visible to students)
                </label>
              </div>
            </div>
          </div>

          {/* Exam Configuration */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Exam Configuration</h2>

            <div className="space-y-4">
              {/* Reading & Writing Section */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">📖 Reading & Writing Section</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Questions
                    </label>
                    <input
                      type="number"
                      value={exam.rw_total_questions}
                      onChange={(e) => handleExamChange('rw_total_questions', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={exam.rw_time_minutes}
                      onChange={(e) => handleExamChange('rw_time_minutes', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Math Section */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">🔢 Math Section</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Questions
                    </label>
                    <input
                      type="number"
                      value={exam.math_total_questions}
                      onChange={(e) => handleExamChange('math_total_questions', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={exam.math_time_minutes}
                      onChange={(e) => handleExamChange('math_time_minutes', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Scoring & Payment */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">💰 Coins & Scoring</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Coin Cost
                    </label>
                    <input
                      type="number"
                      value={exam.coin_cost}
                      onChange={(e) => handleExamChange('coin_cost', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Coin Refund
                    </label>
                    <input
                      type="number"
                      value={exam.coin_refund}
                      onChange={(e) => handleExamChange('coin_refund', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Passing Score
                    </label>
                    <input
                      type="number"
                      value={exam.passing_score}
                      onChange={(e) => handleExamChange('passing_score', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Students pay {exam.coin_cost} coins upfront. If they score ≥ {exam.passing_score}, they receive {exam.coin_refund} coins back.
                </p>
              </div>
            </div>
          </div>

          {/* Modules Configuration */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Module Configuration</h2>
            <p className="text-sm text-slate-400 mb-4">
              SAT 2025 is divided into modules. Each section has 2 modules, with Module 2 difficulty adapting based on Module 1 performance.
            </p>

            <div className="space-y-4">
              {modules.map((module, index) => (
                <div key={index} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-white">
                      {module.section === 'reading_writing' ? '📖 Reading & Writing' : '🔢 Math'} - Module {module.module_number}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300">
                      {module.difficulty_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Expected Questions
                      </label>
                      <input
                        type="number"
                        value={
                          module.section === 'reading_writing'
                            ? Math.floor(exam.rw_total_questions / 2)
                            : Math.floor(exam.math_total_questions / 2)
                        }
                        readOnly
                        className="w-full cursor-not-allowed px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Time (min)
                      </label>
                      <input
                        type="number"
                        value={module.time_minutes}
                        onChange={(e) => handleModuleChange(index, 'time_minutes', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={module.difficulty_level}
                      onChange={(e) => handleModuleChange(index, 'difficulty_level', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    Module 1 should stay medium difficulty. Module 2 can be tuned for the adaptive branch.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Actions */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleSave(false)}
                disabled={loading}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <span>{isEditMode ? 'Update Exam' : 'Create Exam'}</span>
                )}
              </button>

              {!isEditMode && (
                <button
                  onClick={() => handleSave(true)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  {isEditMode ? 'Save & Edit Questions' : 'Create & Add Questions'}
                </button>
              )}

              <button
                onClick={() => router.push('/dashboard/sat/exams')}
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Exam Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Questions:</span>
                <span className="text-white font-medium">
                  {exam.rw_total_questions + exam.math_total_questions}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Time:</span>
                <span className="text-white font-medium">
                  {Math.floor((exam.rw_time_minutes + exam.math_time_minutes) / 60)}h{' '}
                  {(exam.rw_time_minutes + exam.math_time_minutes) % 60}m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Max Score:</span>
                <span className="text-white font-medium">1600</span>
              </div>
              <div className="h-px bg-slate-700 my-2"></div>
              <div className="flex justify-between">
                <span className="text-slate-400">RW Questions:</span>
                <span className="text-purple-400 font-medium">{exam.rw_total_questions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Math Questions:</span>
                <span className="text-purple-400 font-medium">{exam.math_total_questions}</span>
              </div>
              <div className="h-px bg-slate-700 my-2"></div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cost:</span>
                <span className="text-yellow-400 font-medium">{exam.coin_cost} coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Refund:</span>
                <span className="text-green-400 font-medium">{exam.coin_refund} coins</span>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">SAT 2025 Format</h2>
            <div className="text-xs text-slate-400 space-y-2">
              <p>The digital SAT consists of:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>2 sections: Reading & Writing, Math</li>
                <li>Each section has 2 adaptive modules</li>
                <li>Module 2 difficulty adapts based on Module 1</li>
                <li>Total: 98 questions, 2h 14min</li>
                <li>Score range: 400-1600</li>
              </ul>
              <p className="mt-3 font-medium text-slate-300">Default Configuration:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>RW: 54 questions, 64 minutes</li>
                <li>Math: 44 questions, 70 minutes</li>
                <li>Each module: ~27-32 minutes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

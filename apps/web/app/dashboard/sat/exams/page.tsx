'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface SATExam {
  id: number
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
  is_published: boolean
  test_number: number | null
  created_at: string
  updated_at: string
}

export default function SATExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<SATExam[]>([])
  const [filteredExams, setFilteredExams] = useState<SATExam[]>([])
  const [loading, setLoading] = useState(true)
  const [publishedFilter, setPublishedFilter] = useState<string>('all')
  const [officialFilter, setOfficialFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadExams()
  }, [])

  useEffect(() => {
    filterExams()
  }, [exams, publishedFilter, officialFilter, searchQuery])

  const loadExams = async () => {
    try {
      setLoading(true)
      const data = await api.get('/v1/student-profile/sat/exams/')
      setExams(data.results || data || [])
    } catch (error: any) {
      console.error('Failed to load SAT exams:', error)
      toast.error(error?.response?.data?.message || 'Failed to load SAT exams')
    } finally {
      setLoading(false)
    }
  }

  const filterExams = () => {
    let filtered = [...exams]

    // Published filter
    if (publishedFilter !== 'all') {
      filtered = filtered.filter(exam =>
        publishedFilter === 'published' ? exam.is_published : !exam.is_published
      )
    }

    // Official filter
    if (officialFilter !== 'all') {
      filtered = filtered.filter(exam =>
        officialFilter === 'official' ? exam.is_official : !exam.is_official
      )
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(exam =>
        exam.title.toLowerCase().includes(query) ||
        exam.description.toLowerCase().includes(query) ||
        (exam.test_number && exam.test_number.toString().includes(query))
      )
    }

    setFilteredExams(filtered)
  }

  const handlePublishToggle = async (exam: SATExam) => {
    try {
      await api.patch(`/v1/student-profile/sat/exams/${exam.id}/`, {
        is_published: !exam.is_published
      })
      toast.success(`Exam ${exam.is_published ? 'unpublished' : 'published'} successfully`)
      loadExams()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update exam')
    }
  }

  const handleDelete = async (exam: SATExam) => {
    if (!confirm(`Are you sure you want to delete "${exam.title}"?`)) {
      return
    }

    try {
      await api.delete(`/v1/student-profile/sat/exams/${exam.id}/`)
      toast.success('Exam deleted successfully')
      loadExams()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete exam')
    }
  }

  const getQualityBadge = (exam: SATExam) => {
    const totalQuestions = exam.rw_total_questions + exam.math_total_questions
    if (totalQuestions === 98) {
      return <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">Complete</span>
    } else if (totalQuestions > 0) {
      return <span className="px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full">{totalQuestions}/98</span>
    }
    return <span className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-full">Empty</span>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SAT Exams</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage SAT 2025 digital format exams
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/sat/exams/create')}
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create SAT Exam
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Published Status
              </label>
              <select
                value={publishedFilter}
                onChange={(e) => setPublishedFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Exam Type
              </label>
              <select
                value={officialFilter}
                onChange={(e) => setOfficialFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="official">Official</option>
                <option value="practice">Practice</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('')
                  setPublishedFilter('all')
                  setOfficialFilter('all')
                }}
                className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Exams</div>
            <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{exams.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Published</div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {exams.filter(e => e.is_published).length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Official</div>
            <div className="mt-2 text-3xl font-bold text-purple-600">
              {exams.filter(e => e.is_official).length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Practice</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {exams.filter(e => !e.is_official).length}
            </div>
          </div>
        </div>

        {/* Exams List */}
        {filteredExams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No SAT exams found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new SAT exam.
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/dashboard/sat/exams/create')}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create SAT Exam
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {exam.title}
                        </h3>
                        {exam.is_official && (
                          <span className="px-2 py-1 text-xs font-semibold text-purple-700 bg-purple-100 dark:bg-purple-900 dark:text-purple-300 rounded-full">
                            Official {exam.test_number ? `#${exam.test_number}` : ''}
                          </span>
                        )}
                        {exam.is_published ? (
                          <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300 rounded-full">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                            Draft
                          </span>
                        )}
                        {getQualityBadge(exam)}
                      </div>

                      {exam.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{exam.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Reading & Writing:</span>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {exam.rw_total_questions} questions • {exam.rw_time_minutes} min
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Math:</span>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {exam.math_total_questions} questions • {exam.math_time_minutes} min
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                          <div className="font-semibold text-purple-600 dark:text-purple-400">
                            💰 {exam.coin_cost} coins
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Refund:</span>
                          <div className="font-semibold text-green-600 dark:text-green-400">
                            {exam.coin_refund} coins (≥{exam.passing_score})
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => router.push(`/dashboard/sat/exams/${exam.id}`)}
                        className="p-2 text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/sat/exams/create?id=${exam.id}`)}
                        className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePublishToggle(exam)}
                        className={`p-2 transition-colors ${
                          exam.is_published
                            ? 'text-green-600 hover:text-green-700 dark:text-green-400'
                            : 'text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400'
                        }`}
                        title={exam.is_published ? 'Unpublish' : 'Publish'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {exam.is_published ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(exam)}
                        className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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

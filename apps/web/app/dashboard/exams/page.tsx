'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface ExamDraft {
  id: number
  section: string
  title: string
  description: string
  status: string
  status_display: string
  created_by: number
  created_by_name: string
  ai_quality_score: number | null
  question_count: number
  can_submit_for_review: boolean
  can_submit_for_approval: boolean
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  ai_reviewing: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  ai_reviewed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  published: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
}

const QUALITY_SCORE_COLORS: Record<string, string> = {
  excellent: 'text-green-600',
  good: 'text-yellow-600',
  fair: 'text-orange-600',
  poor: 'text-red-600',
}

export default function ExamsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<ExamDraft[]>([])
  const [filteredDrafts, setFilteredDrafts] = useState<ExamDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getMyExamDrafts()
      setDrafts(data)
    } catch (error) {
      console.error('Failed to fetch exam drafts:', error)
      toast.error('Failed to load exam drafts')
    } finally {
      setLoading(false)
    }
  }, [])

  const filterDrafts = useCallback(() => {
    let filtered = [...drafts]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter)
    }

    // Section filter
    if (sectionFilter !== 'all') {
      filtered = filtered.filter((d) => d.section === sectionFilter)
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) || d.description.toLowerCase().includes(query)
      )
    }

    setFilteredDrafts(filtered)
  }, [drafts, searchQuery, sectionFilter, statusFilter])

  useEffect(() => {
    void fetchDrafts()
  }, [fetchDrafts])

  useEffect(() => {
    filterDrafts()
  }, [filterDrafts])

  const handleSubmitForReview = async (id: number) => {
    try {
      await api.submitExamDraftForReview(id)
      toast.success('Exam submitted for AI review!')
      fetchDrafts()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit for review')
    }
  }

  const handleSubmitForApproval = async (id: number) => {
    try {
      await api.submitExamDraftForApproval(id)
      toast.success('Exam submitted for approval!')
      fetchDrafts()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit for approval')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exam draft?')) return

    try {
      await api.deleteExamDraft(id)
      toast.success('Exam draft deleted')
      fetchDrafts()
    } catch (error) {
      toast.error('Failed to delete exam draft')
    }
  }

  const getQualityScoreLabel = (score: number | null) => {
    if (!score) return null
    if (score >= 86) return { label: 'Excellent', color: QUALITY_SCORE_COLORS.excellent }
    if (score >= 71) return { label: 'Good', color: QUALITY_SCORE_COLORS.good }
    if (score >= 51) return { label: 'Fair', color: QUALITY_SCORE_COLORS.fair }
    return { label: 'Needs Work', color: QUALITY_SCORE_COLORS.poor }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">IELTS Exam Drafts</h1>
          <p className="text-text-secondary">Manage and review your exam drafts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/exams/generate')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2"
          >
            <span>🤖</span>
            AI Generate
          </button>
          <button
            onClick={() => router.push('/dashboard/exams/create')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium flex items-center gap-2"
          >
            <span>+</span>
            Create Exam
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface p-4 rounded-lg border border-border mb-6">
        <div className="grid grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ai_reviewing">AI Reviewing</option>
              <option value="ai_reviewed">AI Reviewed</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Sections</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
              <option value="speaking">Speaking</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drafts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No exam drafts found</h3>
          <p className="text-text-secondary mb-4">
            {searchQuery || statusFilter !== 'all' || sectionFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first exam draft to get started'}
          </p>
          <button
            onClick={() => router.push('/dashboard/exams/create')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
          >
            Create Exam
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrafts.map((draft) => {
            const statusStyle = STATUS_COLORS[draft.status] || STATUS_COLORS.draft
            const qualityScore = getQualityScoreLabel(draft.ai_quality_score)

            return (
              <div
                key={draft.id}
                className="bg-white rounded-lg border border-border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-text-primary">{draft.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {draft.status_display}
                      </span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">
                        {draft.section}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mb-3">{draft.description}</p>
                    <div className="flex items-center gap-4 text-sm text-text-tertiary">
                      <span>📄 {draft.question_count} questions</span>
                      <span>•</span>
                      <span>Created {formatDate(draft.created_at)}</span>
                      {qualityScore && (
                        <>
                          <span>•</span>
                          <span className={`font-medium ${qualityScore.color}`}>
                            AI Score: {draft.ai_quality_score}/100 ({qualityScore.label})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => router.push(`/dashboard/exams/${draft.id}`)}
                      className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                    >
                      View
                    </button>

                    {draft.can_submit_for_review && (
                      <button
                        onClick={() => handleSubmitForReview(draft.id)}
                        className="px-4 py-2 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium"
                      >
                        Submit for AI Review
                      </button>
                    )}

                    {draft.can_submit_for_approval && (
                      <button
                        onClick={() => handleSubmitForApproval(draft.id)}
                        className="px-4 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium"
                      >
                        Submit for Approval
                      </button>
                    )}

                    {draft.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

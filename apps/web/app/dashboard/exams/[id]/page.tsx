'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'
import LoadingScreen from '@/components/LoadingScreen'

interface ExamDraft {
  id: number
  section: string
  title: string
  description: string
  instructions: string
  coin_cost: number
  coin_refund: number
  time_limit_minutes: number
  passing_band_score: number
  status: string
  status_display: string
  created_by: number
  created_by_info: any
  ai_suggestions: any
  ai_quality_score: number | null
  ai_reviewed_at: string | null
  reviewed_by: number | null
  reviewed_by_info: any
  reviewed_at: string | null
  review_comments: string
  questions: any[]
  created_at: string
}

interface ExamDraftQualityReport {
  summary: {
    is_content_ready: boolean
    question_count: number
    target_question_count: number
    completion_percentage: number
    status: string
    published_exam_id: number | null
  }
  blockers: string[]
  warnings: string[]
  workflow: {
    status: string
    ai_quality_score: number | null
    ai_reviewed_at: string | null
    reviewed_at: string | null
    published_at: string | null
  }
  coverage: {
    question_types: Array<{ key: string; count: number }>
    required_type_issues: string[]
  }
  data_quality: {
    missing_correct_answers: number
    missing_options: number
    missing_audio: number
    missing_speaking_prompts: number
    missing_passages: number
    duplicate_clusters: Array<{
      question_ids: number[]
      count: number
      preview: string
    }>
  }
  ai_review: {
    quality_score: number | null
    overall_assessment: string
    strengths: string[]
    improvements: string[]
    question_feedback: Array<{
      question_number: number
      feedback: string
      suggestion: string
    }>
  }
  analytics: {
    total_attempts: number
    completed_attempts: number
    pending_evaluation: number
    pass_rate: number
    average_band_score: number
    average_time_minutes: number
    hardest_questions: Array<{
      id: number
      order: number
      preview: string
      submissions: number
      accuracy_percentage: number
    }>
  }
}

export default function ExamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = parseInt(params.id as string)

  const [draft, setDraft] = useState<ExamDraft | null>(null)
  const [qualityReport, setQualityReport] = useState<ExamDraftQualityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'quality' | 'ai-review' | 'history'>('overview')
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDraft = useCallback(async () => {
    try {
      setLoading(true)
      const [data, qualityData] = await Promise.all([
        api.getExamDraft(id),
        api.getExamDraftQualityReport(id),
      ])
      setDraft(data)
      setQualityReport(qualityData)
    } catch (error) {
      console.error('Failed to fetch exam draft:', error)
      toast.error('Failed to load exam draft')
      router.push('/dashboard/exams')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    void fetchDraft()
  }, [fetchDraft])

  const handleApproveOrReject = async () => {
    if (!approvalAction) return

    if (approvalAction === 'reject' && !comments.trim()) {
      toast.error('Comments are required when rejecting')
      return
    }

    try {
      setSubmitting(true)
      await api.approveOrRejectExamDraft(id, approvalAction, comments)
      toast.success(
        approvalAction === 'approve' ? 'Exam approved and published!' : 'Exam rejected'
      )
      router.push('/dashboard/exams')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to process approval')
    } finally {
      setSubmitting(false)
      setApprovalAction(null)
      setComments('')
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading..." />
  }

if (!draft) {
    return null
  }

  const getQualityScoreColor = (score: number) => {
    if (score >= 86) return 'text-green-600 bg-green-50'
    if (score >= 71) return 'text-yellow-600 bg-yellow-50'
    if (score >= 51) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-2"
        >
          ← Back to Exams
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">{draft.title}</h1>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium capitalize">
                {draft.section}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {draft.status_display}
              </span>
              {draft.ai_quality_score && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getQualityScoreColor(
                    draft.ai_quality_score
                  )}`}
                >
                  AI Score: {draft.ai_quality_score}/100
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-6">
          {['overview', 'questions', 'quality', 'ai-review', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary-500 text-primary-500'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface p-6 rounded-lg border border-border">
              <h3 className="font-semibold text-text-primary mb-4">Basic Information</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-text-secondary">Created By</dt>
                  <dd className="font-medium text-text-primary">
                    {draft.created_by_info?.full_name || 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Description</dt>
                  <dd className="text-text-primary">{draft.description || 'No description'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Created At</dt>
                  <dd className="text-text-primary">
                    {new Date(draft.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-surface p-6 rounded-lg border border-border">
              <h3 className="font-semibold text-text-primary mb-4">Exam Settings</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Time Limit</dt>
                  <dd className="font-medium text-text-primary">
                    {draft.time_limit_minutes} minutes
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Questions</dt>
                  <dd className="font-medium text-text-primary">{draft.questions.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Coin Cost</dt>
                  <dd className="font-medium text-text-primary">{draft.coin_cost} coins</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Coin Refund</dt>
                  <dd className="font-medium text-text-primary">{draft.coin_refund} coins</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-text-secondary">Passing Score</dt>
                  <dd className="font-medium text-text-primary">
                    {draft.passing_band_score}/9.0
                  </dd>
                </div>
              </dl>
            </div>

            {draft.instructions && (
              <div className="col-span-2 bg-surface p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-text-primary mb-3">Instructions</h3>
                <p className="text-text-primary whitespace-pre-wrap">{draft.instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {draft.questions.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-lg border border-border">
                <p className="text-text-secondary">No questions added yet</p>
              </div>
            ) : (
              draft.questions.map((q, index) => (
                <div key={q.id} className="bg-surface p-6 rounded-lg border border-border">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {q.question_type}
                        </span>
                        <span className="text-xs text-text-tertiary">{q.points} points</span>
                      </div>
                      <p className="font-medium text-text-primary mb-2">{q.question_text}</p>
                      {q.passage_text && (
                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-text-secondary">
                          <strong>Passage:</strong> {q.passage_text.substring(0, 200)}...
                        </div>
                      )}
                      {q.options && q.options.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} className="text-sm text-text-secondary">
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Quality Tab */}
        {activeTab === 'quality' && qualityReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <QualityMetric
                label="Inventory"
                value={`${qualityReport.summary.question_count}/${qualityReport.summary.target_question_count}`}
                helper={`${qualityReport.summary.completion_percentage}% complete`}
              />
              <QualityMetric
                label="Blockers"
                value={qualityReport.blockers.length}
                helper={qualityReport.summary.is_content_ready ? 'Ready for workflow' : 'Needs content fixes'}
              />
              <QualityMetric
                label="AI Score"
                value={qualityReport.workflow.ai_quality_score ?? '—'}
                helper={qualityReport.workflow.ai_reviewed_at ? 'AI reviewed' : 'Awaiting AI review'}
              />
              <QualityMetric
                label="Live Attempts"
                value={qualityReport.analytics.total_attempts}
                helper={`${qualityReport.analytics.completed_attempts} completed`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <IssueCard
                title={`Blockers (${qualityReport.blockers.length})`}
                tone="danger"
                items={qualityReport.blockers.length ? qualityReport.blockers : ['No blocking issues detected.']}
              />
              <IssueCard
                title={`Warnings (${qualityReport.warnings.length})`}
                tone="warning"
                items={qualityReport.warnings.length ? qualityReport.warnings : ['No warnings detected.']}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="bg-surface p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-text-primary mb-4">Coverage & Data Quality</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {qualityReport.coverage.question_types.map((item) => (
                    <span key={item.key} className="px-3 py-1 rounded-full bg-primary-500/10 text-primary-600 text-xs font-medium">
                      {item.key.replaceAll('_', ' ')} · {item.count}
                    </span>
                  ))}
                </div>

                {qualityReport.coverage.required_type_issues.length ? (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="text-sm font-semibold text-red-700 mb-2">Required Type Gaps</div>
                    <ul className="space-y-2 text-sm text-red-600">
                      {qualityReport.coverage.required_type_issues.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <QualityMetric label="Missing answers" value={qualityReport.data_quality.missing_correct_answers} helper="Correct answer coverage" compact />
                  <QualityMetric label="Missing options" value={qualityReport.data_quality.missing_options} helper="MCQ option sets" compact />
                  <QualityMetric label="Missing audio" value={qualityReport.data_quality.missing_audio} helper="Listening assets" compact />
                  <QualityMetric label="Missing prompts" value={qualityReport.data_quality.missing_speaking_prompts} helper="Speaking prompts" compact />
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">Duplicate Questions</h4>
                  {qualityReport.data_quality.duplicate_clusters.length ? (
                    <div className="space-y-3">
                      {qualityReport.data_quality.duplicate_clusters.map((cluster) => (
                        <div key={cluster.question_ids.join('-')} className="rounded-lg border border-border p-3">
                          <div className="font-medium text-text-primary text-sm">{cluster.preview}</div>
                          <div className="text-xs text-text-secondary mt-1">
                            {cluster.count} copies • IDs: {cluster.question_ids.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">No duplicate question clusters detected.</p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-surface p-6 rounded-lg border border-border">
                  <h3 className="font-semibold text-text-primary mb-4">AI Review Signals</h3>
                  <p className="text-sm text-text-secondary mb-4">
                    {qualityReport.ai_review.overall_assessment || 'AI review feedback will appear here after the draft is submitted for review.'}
                  </p>

                  <div className="space-y-4">
                    <SimpleList title="Strengths" items={qualityReport.ai_review.strengths} emptyLabel="No strengths captured yet." />
                    <SimpleList title="Improvements" items={qualityReport.ai_review.improvements} emptyLabel="No improvement suggestions yet." />
                  </div>
                </div>

                <div className="bg-surface p-6 rounded-lg border border-border">
                  <h3 className="font-semibold text-text-primary mb-4">Published Exam Analytics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <QualityMetric label="Pass rate" value={`${qualityReport.analytics.pass_rate}%`} helper="Completed attempts" compact />
                    <QualityMetric label="Avg band" value={qualityReport.analytics.average_band_score || '—'} helper="Student outcome" compact />
                    <QualityMetric label="Pending eval" value={qualityReport.analytics.pending_evaluation} helper="Awaiting AI scoring" compact />
                    <QualityMetric label="Avg time" value={qualityReport.analytics.average_time_minutes ? `${qualityReport.analytics.average_time_minutes}m` : '—'} helper="Completion time" compact />
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-text-primary mb-2">Hardest Questions</h4>
                    {qualityReport.analytics.hardest_questions.length ? (
                      <div className="space-y-3">
                        {qualityReport.analytics.hardest_questions.map((question) => (
                          <div key={question.id} className="rounded-lg border border-border p-3">
                            <div className="font-medium text-text-primary text-sm">{question.preview}</div>
                            <div className="text-xs text-text-secondary mt-1">
                              Question {question.order} • {question.accuracy_percentage}% accuracy across {question.submissions} submissions
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">No published attempt data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Review Tab */}
        {activeTab === 'ai-review' && (
          <div>
            {draft.ai_suggestions && Object.keys(draft.ai_suggestions).length > 0 ? (
              <div className="space-y-6">
                {/* Overall Assessment */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3">
                    Overall Assessment
                  </h3>
                  <p className="text-purple-800">
                    {draft.ai_suggestions.overall_assessment || 'No assessment available'}
                  </p>
                </div>

                {/* Strengths */}
                {draft.ai_suggestions.strengths && draft.ai_suggestions.strengths.length > 0 && (
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Strengths</h3>
                    <ul className="space-y-2">
                      {draft.ai_suggestions.strengths.map((strength: string, i: number) => (
                        <li key={i} className="text-green-800 flex items-start gap-2">
                          <span>•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {draft.ai_suggestions.improvements &&
                  draft.ai_suggestions.improvements.length > 0 && (
                    <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                      <h3 className="text-lg font-semibold text-yellow-900 mb-3">
                        💡 Suggested Improvements
                      </h3>
                      <ul className="space-y-2">
                        {draft.ai_suggestions.improvements.map((improvement: string, i: number) => (
                          <li key={i} className="text-yellow-800 flex items-start gap-2">
                            <span>•</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Recommendations */}
                {draft.ai_suggestions.recommendations && (
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                      📋 Recommendations
                    </h3>
                    <p className="text-blue-800">{draft.ai_suggestions.recommendations}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-surface rounded-lg border border-border">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No AI Review Yet
                </h3>
                <p className="text-text-secondary">
                  Submit this exam for AI review to get quality feedback
                </p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-surface p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-text-secondary">
                  Created on {new Date(draft.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {draft.ai_reviewed_at && (
              <div className="bg-surface p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-text-secondary">
                    AI reviewed on {new Date(draft.ai_reviewed_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {draft.reviewed_at && (
              <div className="bg-surface p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-text-secondary">
                    Reviewed by {draft.reviewed_by_info?.full_name} on{' '}
                    {new Date(draft.reviewed_at).toLocaleString()}
                  </span>
                </div>
                {draft.review_comments && (
                  <p className="mt-2 text-sm text-text-primary pl-5">{draft.review_comments}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Section (only for pending_approval status) */}
      {draft.status === 'pending_approval' && (
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-4">Review & Approval</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-2">
                Decision <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setApprovalAction('approve')}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                    approvalAction === 'approve'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-green-600 text-green-600 hover:bg-green-50'
                  }`}
                >
                  ✅ Approve & Publish
                </button>
                <button
                  onClick={() => setApprovalAction('reject')}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                    approvalAction === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-red-600 text-red-600 hover:bg-red-50'
                  }`}
                >
                  ❌ Reject
                </button>
              </div>
            </div>

            {approvalAction && (
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">
                  Comments {approvalAction === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    approvalAction === 'approve'
                      ? 'Optional comments for approval...'
                      : 'Please provide feedback on why this exam is being rejected...'
                  }
                  rows={4}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {approvalAction && (
              <button
                onClick={handleApproveOrReject}
                disabled={submitting}
                className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 font-medium"
              >
                {submitting ? 'Processing...' : `Confirm ${approvalAction}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function QualityMetric({
  label,
  value,
  helper,
  compact = false,
}: {
  label: string
  value: string | number
  helper: string
  compact?: boolean
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface ${compact ? 'p-4' : 'p-5'}`}>
      <div className="text-sm text-text-secondary">{label}</div>
      <div className={`${compact ? 'text-xl' : 'text-3xl'} mt-2 font-bold text-text-primary`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-text-tertiary">{helper}</div>
    </div>
  )
}

function IssueCard({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'danger' | 'warning'
}) {
  const classes =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <div className={`rounded-lg border p-5 ${classes}`}>
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

function SimpleList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-text-primary mb-2">{title}</h4>
      {items.length ? (
        <ul className="space-y-2 text-sm text-text-secondary">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">{emptyLabel}</p>
      )}
    </div>
  )
}

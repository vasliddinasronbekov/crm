'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
} from 'lucide-react'

interface AssignmentSummary {
  id: number
  title: string
  max_points?: number
  max_score?: number
  due_date?: string
}

interface AssignmentSubmission {
  id: number
  assignment: number
  assignment_title?: string
  student_name?: string
  text_content?: string
  file?: string | null
  status?: 'draft' | 'submitted' | 'graded' | 'returned'
  status_display?: string
  attempt_number?: number
  points_earned?: number | null
  feedback?: string | null
  submitted_at?: string
  graded_at?: string | null
  is_late?: boolean
}

interface QueueSummary {
  assignment_id?: number | null
  assignment_title?: string | null
  max_points?: number | null
  total: number
  pending: number
  returned: number
  graded: number
  late: number
  average_score: number
}

interface RubricSuggestion {
  key: string
  label: string
  score_percent: number
  feedback_template: string
}

interface QueueResponse {
  summary: QueueSummary
  rubric_suggestions?: RubricSuggestion[]
  results: AssignmentSubmission[]
}

interface TimelineEvent {
  type: string
  label: string
  timestamp?: string
  actor?: string
  details?: string
}

interface TimelinePayload {
  submission_id: number
  assignment_id: number
  assignment_title: string
  student_name: string
  status: string
  status_display: string
  events: TimelineEvent[]
  snapshot?: {
    attempt_number?: number
    is_late?: boolean
    points_earned?: number | null
    max_points?: number
    feedback?: string
    graded_by_name?: string | null
  }
}

const DEFAULT_SUMMARY: QueueSummary = {
  total: 0,
  pending: 0,
  returned: 0,
  graded: 0,
  late: 0,
  average_score: 0,
}

export default function AssignmentSubmissionsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canGradeSubmission = permissionState.hasPermission('assignments.edit')
  const assignmentId = useMemo(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id
    const parsed = Number.parseInt(String(rawId || ''), 10)
    return Number.isFinite(parsed) ? parsed : NaN
  }, [params.id])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null)
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [queueSummary, setQueueSummary] = useState<QueueSummary>(DEFAULT_SUMMARY)
  const [rubricSuggestions, setRubricSuggestions] = useState<RubricSuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 320)
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'returned'>('all')
  const [lateFilter, setLateFilter] = useState<'all' | 'late' | 'on_time'>('all')
  const [includeGraded, setIncludeGraded] = useState(true)

  const [gradingTarget, setGradingTarget] = useState<AssignmentSubmission | null>(null)
  const [gradeForm, setGradeForm] = useState({
    points_earned: '',
    feedback: '',
    status: 'graded' as 'graded' | 'returned',
  })

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    grading_mode: 'score' as 'score' | 'rubric',
    points_earned: '',
    rubric_percent: '',
    rubric_label: '',
    feedback: '',
    status: 'graded' as 'graded' | 'returned',
  })

  const [timelineTarget, setTimelineTarget] = useState<AssignmentSubmission | null>(null)
  const [timelinePayload, setTimelinePayload] = useState<TimelinePayload | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const assignmentMaxPoints = useMemo(() => {
    const value = assignment?.max_points ?? assignment?.max_score ?? queueSummary.max_points ?? 100
    return Number.isFinite(Number(value)) ? Number(value) : 100
  }, [assignment?.max_points, assignment?.max_score, queueSummary.max_points])

  const loadData = useCallback(async () => {
    if (!Number.isFinite(assignmentId)) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const queueParams: Record<string, unknown> = {
        assignment_id: assignmentId,
        include_graded: includeGraded || statusFilter === 'graded',
      }

      if (statusFilter !== 'all') {
        queueParams.status = statusFilter
      }

      if (lateFilter !== 'all') {
        queueParams.is_late = lateFilter === 'late'
      }

      if (debouncedSearchTerm.trim()) {
        queueParams.search = debouncedSearchTerm.trim()
      }

      const [assignmentPayload, queuePayload] = await Promise.all([
        apiService.getAssignment(assignmentId),
        apiService.getAssignmentGradingQueue(queueParams),
      ])

      const parsedQueue = (queuePayload || {}) as QueueResponse
      const queueResults = Array.isArray(parsedQueue.results) ? parsedQueue.results : []

      setAssignment(assignmentPayload || null)
      setQueueSummary(parsedQueue.summary || DEFAULT_SUMMARY)
      setRubricSuggestions(Array.isArray(parsedQueue.rubric_suggestions) ? parsedQueue.rubric_suggestions : [])
      setSubmissions(queueResults)

      const visibleIds = new Set(queueResults.map((submission) => submission.id))
      setSelectedIds((previous) => previous.filter((id) => visibleIds.has(id)))
    } catch (error) {
      console.error('Failed to load assignment grading queue:', error)
      toast.error('Failed to load assignment grading queue')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, debouncedSearchTerm, includeGraded, lateFilter, statusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const hasSelection = selectedIds.length > 0
  const selectedCountLabel = hasSelection ? `${selectedIds.length} selected` : 'No selected submissions'

  const areAllVisibleSelected = submissions.length > 0 && selectedIds.length === submissions.length

  const toggleSelect = (submissionId: number) => {
    setSelectedIds((previous) => {
      if (previous.includes(submissionId)) {
        return previous.filter((id) => id !== submissionId)
      }
      return [...previous, submissionId]
    })
  }

  const toggleSelectAll = () => {
    if (areAllVisibleSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(submissions.map((submission) => submission.id))
  }

  const applyRubricToSingle = (rubric: RubricSuggestion) => {
    const points = ((assignmentMaxPoints * rubric.score_percent) / 100).toFixed(2)
    setGradeForm((previous) => ({
      ...previous,
      points_earned: points,
      feedback: previous.feedback || rubric.feedback_template,
      status: rubric.key === 'needs_revision' ? 'returned' : previous.status,
    }))
  }

  const applyRubricToBulk = (rubric: RubricSuggestion) => {
    setBulkForm((previous) => ({
      ...previous,
      grading_mode: 'rubric',
      rubric_percent: String(rubric.score_percent),
      rubric_label: rubric.label,
      feedback: previous.feedback || rubric.feedback_template,
      status: rubric.key === 'needs_revision' ? 'returned' : previous.status,
    }))
  }

  const openGradeModal = (submission: AssignmentSubmission) => {
    if (!canGradeSubmission) {
      toast.error('You do not have permission to grade submissions')
      return
    }

    setGradingTarget(submission)
    setGradeForm({
      points_earned:
        typeof submission.points_earned === 'number'
          ? submission.points_earned.toString()
          : '',
      feedback: submission.feedback || '',
      status: submission.status === 'returned' ? 'returned' : 'graded',
    })
  }

  const handleSaveGrade = async () => {
    if (!gradingTarget) return
    if (!canGradeSubmission) {
      toast.error('You do not have permission to grade submissions')
      return
    }

    const numericPoints = Number.parseFloat(gradeForm.points_earned)
    if (!Number.isFinite(numericPoints)) {
      toast.error('Enter a valid score')
      return
    }

    if (numericPoints < 0 || numericPoints > assignmentMaxPoints) {
      toast.error(`Score must be between 0 and ${assignmentMaxPoints}`)
      return
    }

    setIsSaving(true)
    try {
      await apiService.gradeSubmission(gradingTarget.id, {
        points_earned: numericPoints,
        feedback: gradeForm.feedback,
        status: gradeForm.status,
      })
      toast.success('Submission updated')
      setGradingTarget(null)
      await loadData()
    } catch (error) {
      console.error('Failed to update submission grade:', error)
      toast.error('Failed to save grade')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkGrade = async () => {
    if (!hasSelection) {
      toast.error('Select submissions first')
      return
    }
    if (!canGradeSubmission) {
      toast.error('You do not have permission to grade submissions')
      return
    }

    const payload: {
      submission_ids: number[]
      grading_mode: 'score' | 'rubric'
      points_earned?: number
      rubric_percent?: number
      rubric_label?: string
      feedback?: string
      status?: 'graded' | 'returned'
    } = {
      submission_ids: selectedIds,
      grading_mode: bulkForm.grading_mode,
      feedback: bulkForm.feedback,
      status: bulkForm.status,
      rubric_label: bulkForm.rubric_label || undefined,
    }

    if (bulkForm.grading_mode === 'score') {
      const numericPoints = Number.parseFloat(bulkForm.points_earned)
      if (!Number.isFinite(numericPoints)) {
        toast.error('Enter a valid bulk score')
        return
      }
      if (numericPoints < 0 || numericPoints > assignmentMaxPoints) {
        toast.error(`Score must be between 0 and ${assignmentMaxPoints}`)
        return
      }
      payload.points_earned = numericPoints
    } else {
      const numericPercent = Number.parseFloat(bulkForm.rubric_percent)
      if (!Number.isFinite(numericPercent)) {
        toast.error('Enter a valid rubric percent')
        return
      }
      if (numericPercent < 0 || numericPercent > 100) {
        toast.error('Rubric percent must be between 0 and 100')
        return
      }
      payload.rubric_percent = numericPercent
    }

    setIsSaving(true)
    try {
      const response = await apiService.bulkGradeSubmissions(payload)
      toast.success(`Updated ${response.updated_count || selectedIds.length} submissions`)
      setIsBulkModalOpen(false)
      setSelectedIds([])
      setBulkForm({
        grading_mode: 'score',
        points_earned: '',
        rubric_percent: '',
        rubric_label: '',
        feedback: '',
        status: 'graded',
      })
      await loadData()
    } catch (error) {
      console.error('Bulk grading failed:', error)
      toast.error('Bulk grading failed')
    } finally {
      setIsSaving(false)
    }
  }

  const openTimeline = async (submission: AssignmentSubmission) => {
    setTimelineTarget(submission)
    setTimelinePayload(null)
    setTimelineLoading(true)
    try {
      const payload = await apiService.getAssignmentSubmissionAuditTimeline(submission.id)
      setTimelinePayload(payload as TimelinePayload)
    } catch (error) {
      console.error('Failed to load audit timeline:', error)
      toast.error('Failed to load audit timeline')
    } finally {
      setTimelineLoading(false)
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <LoadingScreen message="Loading assignment grading queue..." />
      </ProtectedRoute>
    )
  }

  if (!Number.isFinite(assignmentId)) {
    return (
      <ProtectedRoute>
        <div className="p-8">
          <div className="card">
            <p className="text-lg font-semibold">Invalid assignment ID</p>
            <button
              onClick={() => router.replace('/dashboard/lms/assignments')}
              className="btn-primary mt-4"
            >
              Back to Assignments
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/dashboard/lms/assignments')}
              className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to assignments
            </button>
            <h1 className="text-3xl font-bold">Assignment Grading Queue</h1>
            <p className="text-text-secondary mt-1">
              {assignment?.title || queueSummary.assignment_title || `Assignment #${assignmentId}`}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-right text-sm text-text-secondary">
            <p className="font-medium text-text">Parity Guard Active</p>
            <p>Only users with assignments.edit can grade</p>
            {assignment?.due_date && <p className="mt-1">Due: {new Date(assignment.due_date).toLocaleString()}</p>}
            <p>Max points: {assignmentMaxPoints}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card">
            <p className="text-2xl font-bold">{queueSummary.total}</p>
            <p className="text-sm text-text-secondary">Queue Total</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-warning">{queueSummary.pending}</p>
            <p className="text-sm text-text-secondary">Pending</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-error">{queueSummary.returned}</p>
            <p className="text-sm text-text-secondary">Returned</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-success">{queueSummary.graded}</p>
            <p className="text-sm text-text-secondary">Graded</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold">{queueSummary.average_score.toFixed(2)}</p>
            <p className="text-sm text-text-secondary">Avg Score</p>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by student, assignment title, or answer text"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Graded</option>
              <option value="returned">Returned</option>
            </select>
            <select
              value={lateFilter}
              onChange={(event) => setLateFilter(event.target.value as typeof lateFilter)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All timings</option>
              <option value="late">Late only</option>
              <option value="on_time">On-time only</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={includeGraded}
                onChange={(event) => setIncludeGraded(event.target.checked)}
                className="h-4 w-4 rounded border-border bg-background"
              />
              Include graded submissions in queue
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-text-secondary hover:text-text"
              >
                {areAllVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {areAllVisibleSelected ? 'Clear visible' : 'Select visible'}
              </button>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-secondary">
                {selectedCountLabel}
              </div>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                disabled={!hasSelection || !canGradeSubmission}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                Bulk Grade
              </button>
            </div>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-lg font-semibold">No submissions in queue</p>
            <p className="text-text-secondary mt-1">
              Try changing your filters or enabling graded submissions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const isGraded = submission.status === 'graded' || Boolean(submission.graded_at)
              const isSelected = selectedIds.includes(submission.id)

              return (
                <div key={submission.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => toggleSelect(submission.id)}
                          className="inline-flex items-center justify-center text-text-secondary hover:text-text"
                          title={isSelected ? 'Deselect submission' : 'Select submission'}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </button>
                        <Users className="h-4 w-4 text-primary" />
                        <p className="font-semibold">
                          {submission.student_name || `Student #${submission.id}`}
                        </p>
                        {submission.is_late && (
                          <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs text-error">
                            Late
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            isGraded
                              ? 'bg-success/10 text-success'
                              : submission.status === 'returned'
                                ? 'bg-error/10 text-error'
                                : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {submission.status_display || submission.status || 'Submitted'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {submission.submitted_at
                            ? new Date(submission.submitted_at).toLocaleString()
                            : 'Unknown submission time'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {typeof submission.points_earned === 'number' ? submission.points_earned : '-'} / {assignmentMaxPoints}
                        </span>
                        <span>Attempt #{submission.attempt_number || 1}</span>
                      </div>

                      {submission.text_content && (
                        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-text-secondary">
                          {submission.text_content}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {submission.file && (
                          <a
                            href={submission.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            Open attachment
                          </a>
                        )}

                        {submission.feedback && (
                          <p className="inline-flex items-start gap-2 rounded-lg bg-background px-3 py-1.5 text-xs text-text-secondary">
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5" />
                            {submission.feedback}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void openTimeline(submission)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-text-secondary hover:text-text"
                      >
                        <History className="h-4 w-4" />
                        Timeline
                      </button>
                      <button
                        onClick={() => openGradeModal(submission)}
                        disabled={!canGradeSubmission}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {isGraded ? 'Regrade' : 'Grade'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {gradingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">Grade Submission</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {gradingTarget.student_name || `Submission #${gradingTarget.id}`}
            </p>

            {rubricSuggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Rubric presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {rubricSuggestions.map((rubric) => (
                    <button
                      key={rubric.key}
                      type="button"
                      onClick={() => applyRubricToSingle(rubric)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-secondary hover:text-text"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {rubric.label} ({rubric.score_percent}%)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Score</label>
                <input
                  type="number"
                  value={gradeForm.points_earned}
                  onChange={(event) => setGradeForm((prev) => ({ ...prev, points_earned: event.target.value }))}
                  min={0}
                  max={assignmentMaxPoints}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Decision</label>
                <select
                  value={gradeForm.status}
                  onChange={(event) => setGradeForm((prev) => ({ ...prev, status: event.target.value as 'graded' | 'returned' }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="graded">Graded</option>
                  <option value="returned">Returned for revision</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Feedback</label>
              <textarea
                value={gradeForm.feedback}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, feedback: event.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Add grading feedback..."
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setGradingTarget(null)}
                disabled={isSaving}
                className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveGrade()}
                disabled={isSaving}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Decision'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">Bulk Grade Submissions</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Apply one grading decision to {selectedIds.length} selected submissions.
            </p>

            {rubricSuggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Rubric presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {rubricSuggestions.map((rubric) => (
                    <button
                      key={rubric.key}
                      type="button"
                      onClick={() => applyRubricToBulk(rubric)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-secondary hover:text-text"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {rubric.label} ({rubric.score_percent}%)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Mode</label>
                <select
                  value={bulkForm.grading_mode}
                  onChange={(event) => setBulkForm((prev) => ({ ...prev, grading_mode: event.target.value as 'score' | 'rubric' }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="score">Fixed score</option>
                  <option value="rubric">Rubric percent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Decision</label>
                <select
                  value={bulkForm.status}
                  onChange={(event) => setBulkForm((prev) => ({ ...prev, status: event.target.value as 'graded' | 'returned' }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="graded">Graded</option>
                  <option value="returned">Returned for revision</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {bulkForm.grading_mode === 'score' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Score</label>
                  <input
                    type="number"
                    value={bulkForm.points_earned}
                    onChange={(event) => setBulkForm((prev) => ({ ...prev, points_earned: event.target.value }))}
                    min={0}
                    max={assignmentMaxPoints}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Rubric percent</label>
                  <input
                    type="number"
                    value={bulkForm.rubric_percent}
                    onChange={(event) => setBulkForm((prev) => ({ ...prev, rubric_percent: event.target.value }))}
                    min={0}
                    max={100}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Rubric label (optional)</label>
                <input
                  type="text"
                  value={bulkForm.rubric_label}
                  onChange={(event) => setBulkForm((prev) => ({ ...prev, rubric_label: event.target.value }))}
                  placeholder="e.g. Excellent"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Feedback</label>
              <textarea
                value={bulkForm.feedback}
                onChange={(event) => setBulkForm((prev) => ({ ...prev, feedback: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Feedback applied to all selected submissions..."
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isSaving}
                className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleBulkGrade()}
                disabled={isSaving || !hasSelection}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
                  </span>
                ) : (
                  'Apply to Selected'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {timelineTarget && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/70">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Audit timeline
                </p>
                <h2 className="text-xl font-bold mt-1">
                  {timelineTarget.student_name || `Submission #${timelineTarget.id}`}
                </h2>
              </div>
              <button
                onClick={() => {
                  setTimelineTarget(null)
                  setTimelinePayload(null)
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text-secondary hover:text-text"
              >
                Close
              </button>
            </div>

            {timelineLoading ? (
              <div className="mt-8 flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading timeline...
              </div>
            ) : timelinePayload ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-text-secondary">
                  <p className="font-medium text-text">Current snapshot</p>
                  <p className="mt-1">Status: {timelinePayload.status_display}</p>
                  <p>Score: {timelinePayload.snapshot?.points_earned ?? '-'} / {timelinePayload.snapshot?.max_points ?? assignmentMaxPoints}</p>
                  {timelinePayload.snapshot?.graded_by_name && (
                    <p>Graded by: {timelinePayload.snapshot.graded_by_name}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {timelinePayload.events.map((event, index) => (
                    <div key={`${event.type}-${index}`} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{event.label}</p>
                        <p className="text-xs text-text-secondary">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}
                        </p>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-wide text-text-secondary">
                        {event.actor || 'System'}
                      </p>
                      {event.details && <p className="mt-2 text-sm text-text-secondary whitespace-pre-wrap">{event.details}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 text-sm text-text-secondary">Timeline unavailable.</div>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

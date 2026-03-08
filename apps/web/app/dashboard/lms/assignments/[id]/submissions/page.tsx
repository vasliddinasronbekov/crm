'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'
import { ArrowLeft, CheckCircle2, Clock, FileText, Loader2, MessageSquare, Users } from 'lucide-react'

interface AssignmentSummary {
  id: number
  title: string
  max_score: number
  due_date?: string
  is_published?: boolean
}

interface AssignmentSubmission {
  id: number
  assignment: number
  assignment_title?: string
  student_name?: string
  text_content?: string
  file?: string | null
  status?: string
  status_display?: string
  attempt_number?: number
  points_earned?: number | null
  feedback?: string | null
  submitted_at?: string
  graded_at?: string | null
  is_late?: boolean
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
  const [gradingTarget, setGradingTarget] = useState<AssignmentSubmission | null>(null)
  const [gradeForm, setGradeForm] = useState({
    points_earned: '',
    feedback: '',
  })

  const loadData = useCallback(async () => {
    if (!Number.isFinite(assignmentId)) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [assignmentPayload, submissionsPayload] = await Promise.all([
        apiService.getAssignment(assignmentId),
        apiService.getAssignmentSubmissions({ assignment_id: assignmentId }),
      ])

      setAssignment(assignmentPayload || null)
      setSubmissions(submissionsPayload?.results || submissionsPayload || [])
    } catch (error) {
      console.error('Failed to load assignment submissions:', error)
      toast.error('Failed to load assignment submissions')
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const total = submissions.length
    const graded = submissions.filter((submission) => Boolean(submission.graded_at || submission.status === 'graded')).length
    const late = submissions.filter((submission) => Boolean(submission.is_late)).length
    const pending = total - graded

    return { total, graded, pending, late }
  }, [submissions])

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

    if (assignment?.max_score && numericPoints > assignment.max_score) {
      toast.error(`Score cannot exceed ${assignment.max_score}`)
      return
    }

    setIsSaving(true)
    try {
      await apiService.gradeSubmission(gradingTarget.id, {
        points_earned: numericPoints,
        feedback: gradeForm.feedback,
      })
      toast.success('Submission graded successfully')
      setGradingTarget(null)
      await loadData()
    } catch (error) {
      console.error('Failed to grade submission:', error)
      toast.error('Failed to save grade')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <LoadingScreen message="Loading assignment submissions..." />
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/dashboard/lms/assignments')}
              className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to assignments
            </button>
            <h1 className="text-3xl font-bold">Assignment Submissions</h1>
            <p className="text-text-secondary mt-1">
              {assignment?.title || `Assignment #${assignmentId}`}
            </p>
          </div>
          <div className="text-right text-sm text-text-secondary">
            {assignment?.due_date && (
              <p>Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
            )}
            {assignment?.max_score !== undefined && (
              <p>Max score: {assignment.max_score}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-text-secondary">Total Submissions</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-success">{stats.graded}</p>
            <p className="text-sm text-text-secondary">Graded</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
            <p className="text-sm text-text-secondary">Pending</p>
          </div>
          <div className="card">
            <p className="text-2xl font-bold text-error">{stats.late}</p>
            <p className="text-sm text-text-secondary">Late</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-lg font-semibold">No submissions yet</p>
            <p className="text-text-secondary mt-1">
              Student submissions for this assignment will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const isGraded = Boolean(submission.graded_at || submission.status === 'graded')
              return (
                <div key={submission.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <p className="font-semibold">
                          {submission.student_name || `Student #${submission.id}`}
                        </p>
                        {submission.is_late && (
                          <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs text-error">
                            Late
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${isGraded ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          {isGraded ? 'Graded' : 'Pending'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Unknown time'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {typeof submission.points_earned === 'number' ? submission.points_earned : '-'} / {assignment?.max_score ?? '-'}
                        </span>
                        <span>Attempt #{submission.attempt_number || 1}</span>
                      </div>

                      {submission.text_content && (
                        <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-3">
                          {submission.text_content}
                        </p>
                      )}

                      {submission.file && (
                        <a
                          href={submission.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          Open attached file
                        </a>
                      )}

                      {submission.feedback && (
                        <p className="inline-flex items-start gap-2 rounded-xl bg-background px-3 py-2 text-sm text-text-secondary">
                          <MessageSquare className="mt-0.5 h-4 w-4" />
                          {submission.feedback}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => openGradeModal(submission)}
                      disabled={!canGradeSubmission}
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGraded ? 'Regrade' : 'Grade'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {gradingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">Grade Submission</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {gradingTarget.student_name || `Submission #${gradingTarget.id}`}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Score</label>
                <input
                  type="number"
                  value={gradeForm.points_earned}
                  onChange={(event) => setGradeForm((prev) => ({ ...prev, points_earned: event.target.value }))}
                  min={0}
                  max={assignment?.max_score || undefined}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Feedback</label>
                <textarea
                  value={gradeForm.feedback}
                  onChange={(event) => setGradeForm((prev) => ({ ...prev, feedback: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Add grading feedback..."
                />
              </div>
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
                onClick={handleSaveGrade}
                disabled={isSaving}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Grade'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

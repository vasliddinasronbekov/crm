'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  PenSquare,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import PaginationControls from '@/components/PaginationControls'
import { useAuth } from '@/contexts/AuthContext'
import {
  QuizAnswerRow,
  useDuplicateQuiz,
  useGradeQuizAnswer,
  useQuiz,
  useQuizAnswers,
  useQuizAttempts,
  useQuizLeaderboard,
  useQuizQuestionAnalytics,
  useQuizQuestions,
  useQuizStatistics,
  useToggleQuizPublished,
} from '@/lib/hooks/useQuizzes'
import { usePermissions } from '@/lib/permissions'
import toast from '@/lib/toast'

function difficultyBadge(level: string): string {
  if (level === 'easy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (level === 'hard') return 'border-rose-500/30 bg-rose-500/10 text-rose-400'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
}

function scoreBadgeClass(status: string): string {
  if (status === 'graded') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (status === 'submitted') return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300'
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0m'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  if (seconds <= 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

function answerResponseLabel(answer: QuizAnswerRow): string {
  if (answer.selected_option_text) return answer.selected_option_text
  if (answer.text_answer && answer.text_answer.trim()) return answer.text_answer
  return 'No answer submitted'
}

export default function QuizDetailPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = Number(params?.id)
  const { user } = useAuth()
  const permissions = usePermissions(user)

  const canEdit = permissions.hasPermission('quizzes.edit')
  const canCreate = permissions.hasPermission('quizzes.create')

  const [attemptPage, setAttemptPage] = useState(1)
  const [attemptLimit, setAttemptLimit] = useState(10)
  const [attemptStatus, setAttemptStatus] = useState<'all' | 'submitted' | 'graded' | 'in_progress'>('all')
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null)
  const [gradeDrafts, setGradeDrafts] = useState<Record<number, { points: string; feedback: string }>>({})

  const { data: quiz, isLoading: isQuizLoading } = useQuiz(Number.isFinite(quizId) ? quizId : null)
  const { data: statistics, isLoading: isStatsLoading } = useQuizStatistics(Number.isFinite(quizId) ? quizId : null)
  const { data: questions, isLoading: isQuestionsLoading } = useQuizQuestions(Number.isFinite(quizId) ? quizId : null)
  const { data: leaderboard } = useQuizLeaderboard(Number.isFinite(quizId) ? quizId : null)
  const { data: questionAnalytics, isLoading: isAnalyticsLoading } = useQuizQuestionAnalytics(
    Number.isFinite(quizId) ? quizId : null,
  )

  const attemptFilters = useMemo(
    () => ({
      quiz_id: Number.isFinite(quizId) ? quizId : undefined,
      page: attemptPage,
      limit: attemptLimit,
      status: attemptStatus === 'all' ? undefined : attemptStatus,
    }),
    [attemptLimit, attemptPage, attemptStatus, quizId],
  )

  const { data: attemptsData, isLoading: isAttemptsLoading } = useQuizAttempts(attemptFilters)
  const attemptRows = useMemo(() => attemptsData?.results ?? [], [attemptsData?.results])

  useEffect(() => {
    if (!attemptRows.length) {
      setSelectedAttemptId(null)
      return
    }
    const existsInPage = selectedAttemptId && attemptRows.some((attempt) => attempt.id === selectedAttemptId)
    if (!existsInPage) {
      setSelectedAttemptId(attemptRows[0].id)
    }
  }, [attemptRows, selectedAttemptId])

  const selectedAttempt = useMemo(
    () => attemptRows.find((attempt) => attempt.id === selectedAttemptId) || null,
    [attemptRows, selectedAttemptId],
  )

  const answerFilters = useMemo(
    () => (selectedAttemptId ? { attempt_id: selectedAttemptId, limit: 250 } : null),
    [selectedAttemptId],
  )

  const { data: answersData, isLoading: isAnswersLoading } = useQuizAnswers(answerFilters)
  const answerRows = useMemo(() => answersData?.results ?? [], [answersData?.results])

  const duplicateMutation = useDuplicateQuiz()
  const togglePublishMutation = useToggleQuizPublished()
  const gradeAnswerMutation = useGradeQuizAnswer()

  const questionTypeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {}
    ;(questions || []).forEach((question) => {
      const key = question.question_type_display
      distribution[key] = (distribution[key] || 0) + 1
    })
    return Object.entries(distribution).sort((a, b) => b[1] - a[1])
  }, [questions])

  const pendingManualReviews = useMemo(
    () =>
      (questionAnalytics?.questions || []).reduce(
        (accumulator, question) => accumulator + question.pending_manual_reviews,
        0,
      ),
    [questionAnalytics?.questions],
  )

  const handleDuplicate = async () => {
    if (!quiz || !canCreate) return
    try {
      const duplicated = await duplicateMutation.mutateAsync(quiz.id)
      toast.success('Quiz duplicated.')
      router.push(`/dashboard/quizzes/${duplicated.id}`)
    } catch {
      // Toast handled in hook.
    }
  }

  const handleTogglePublish = async () => {
    if (!quiz || !canEdit) return
    try {
      await togglePublishMutation.mutateAsync({
        quizId: quiz.id,
        isPublished: !quiz.is_published,
      })
      toast.success(quiz.is_published ? 'Quiz moved to draft.' : 'Quiz published.')
    } catch {
      // Toast handled in hook.
    }
  }

  const updateGradeDraft = (answerId: number, patch: Partial<{ points: string; feedback: string }>) => {
    setGradeDrafts((previous) => ({
      ...previous,
      [answerId]: {
        points: previous[answerId]?.points ?? '',
        feedback: previous[answerId]?.feedback ?? '',
        ...patch,
      },
    }))
  }

  const resolveGradeDraft = (answer: QuizAnswerRow) =>
    gradeDrafts[answer.id] || {
      points: String(toNumber(answer.points_earned)),
      feedback: answer.feedback || '',
    }

  const handleGradeAnswer = async (answer: QuizAnswerRow) => {
    if (!canEdit) return

    const draft = resolveGradeDraft(answer)
    const points = Number.parseFloat(draft.points)
    if (!Number.isFinite(points)) {
      toast.warning('Points must be a valid number.')
      return
    }
    if (points < 0 || points > answer.question_points) {
      toast.warning(`Points must be between 0 and ${answer.question_points}.`)
      return
    }

    try {
      await gradeAnswerMutation.mutateAsync({
        answerId: answer.id,
        pointsAwarded: points,
        feedback: draft.feedback,
      })
      toast.success('Answer graded and attempt score recalculated.')
    } catch {
      // Toast handled in hook.
    }
  }

  if (isQuizLoading || !Number.isFinite(quizId)) {
    return <LoadingScreen message="Loading quiz workspace..." />
  }

  if (!quiz) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="rounded-2xl border border-error/40 bg-error/10 px-6 py-5 text-center">
          <p className="text-lg font-semibold text-error">Quiz not found</p>
          <button
            onClick={() => router.push('/dashboard/quizzes')}
            className="mt-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-border/50"
          >
            Back to quizzes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-border bg-surface/90 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                onClick={() => router.push('/dashboard/quizzes')}
                className="mb-3 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to quiz catalog
              </button>
              <h1 className="text-3xl font-bold">{quiz.title}</h1>
              <p className="mt-1 text-text-secondary">{quiz.description || 'No description provided.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-border px-2 py-0.5">{quiz.subject_display}</span>
                <span className={`rounded-full border px-2 py-0.5 ${difficultyBadge(quiz.difficulty_level)}`}>
                  {quiz.difficulty_level_display}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5">{quiz.quiz_type_display}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    quiz.is_published ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-300'
                  }`}
                >
                  {quiz.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                  Manual review queue: {pendingManualReviews}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <button
                  onClick={handleTogglePublish}
                  disabled={togglePublishMutation.isPending}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    {togglePublishMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {quiz.is_published ? 'Move to draft' : 'Publish quiz'}
                  </span>
                </button>
              )}
              {canCreate && (
                <button
                  onClick={handleDuplicate}
                  disabled={duplicateMutation.isPending}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    {duplicateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Duplicate
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Performance Snapshot
            </h2>

            {isStatsLoading ? (
              <div className="flex items-center py-10 text-text-secondary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading statistics...
              </div>
            ) : statistics ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-text-secondary">Attempts</p>
                  <p className="mt-1 text-2xl font-semibold">{statistics.total_attempts}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-text-secondary">Unique Takers</p>
                  <p className="mt-1 text-2xl font-semibold">{statistics.unique_takers}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-text-secondary">Pass Rate</p>
                  <p className="mt-1 text-2xl font-semibold">{statistics.pass_rate}%</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs text-text-secondary">Avg Score</p>
                  <p className="mt-1 text-2xl font-semibold">{statistics.average_score_percentage}%</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No statistics available yet.</p>
            )}

            <h3 className="mb-3 mt-6 font-semibold">Question Type Distribution</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {questionTypeDistribution.map(([label, count]) => (
                <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                  <p className="text-sm text-text-secondary">{label}</p>
                  <p className="text-xl font-semibold">{count}</p>
                </div>
              ))}
              {questionTypeDistribution.length === 0 && (
                <p className="text-sm text-text-secondary">No questions yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-primary" />
              Leaderboard
            </h2>
            <div className="space-y-2">
              {(leaderboard || []).slice(0, 8).map((entry, index) => (
                <div
                  key={`${entry.student_id}-${index}`}
                  className="rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                >
                  <p className="text-sm font-medium">
                    {index + 1}. {entry.student_name || `Student ${entry.student_id}`}
                  </p>
                  <p className="text-xs text-text-secondary">{entry.score.toFixed(1)}%</p>
                </div>
              ))}
              {(leaderboard || []).length === 0 && (
                <p className="text-sm text-text-secondary">No submitted attempts yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Attempt Review</h2>
              <select
                value={attemptStatus}
                onChange={(event) => {
                  setAttemptPage(1)
                  setAttemptStatus(event.target.value as 'all' | 'submitted' | 'graded' | 'in_progress')
                }}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="in_progress">In progress</option>
                <option value="submitted">Submitted</option>
                <option value="graded">Graded</option>
              </select>
            </div>

            {isAttemptsLoading ? (
              <div className="flex items-center py-10 text-text-secondary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading attempts...
              </div>
            ) : (
              <div className="space-y-2">
                {attemptRows.map((attempt) => (
                  <button
                    key={attempt.id}
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      selectedAttemptId === attempt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background/60 hover:bg-background/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{attempt.student_name || `Student #${attempt.student}`}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${scoreBadgeClass(attempt.status)}`}>
                        {attempt.status_display}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Score: {toNumber(attempt.percentage_score).toFixed(1)}% • Time: {formatDuration(attempt.time_taken_seconds)}
                    </p>
                  </button>
                ))}
                {!attemptRows.length && (
                  <p className="rounded-xl border border-border bg-background/50 px-3 py-6 text-center text-sm text-text-secondary">
                    No attempts match current filter.
                  </p>
                )}
              </div>
            )}

            {attemptsData && attemptsData.count > attemptLimit && (
              <div className="mt-4">
                <PaginationControls
                  totalItems={attemptsData.count}
                  itemsPerPage={attemptLimit}
                  currentPage={attemptPage}
                  onPageChange={setAttemptPage}
                  onItemsPerPageChange={setAttemptLimit}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-7">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <PenSquare className="h-5 w-5 text-primary" />
              Grading Workspace
            </h2>

            {!selectedAttempt ? (
              <p className="rounded-xl border border-border bg-background/60 px-4 py-8 text-center text-sm text-text-secondary">
                Select an attempt from the left panel to review answers and grade manual questions.
              </p>
            ) : isAnswersLoading ? (
              <div className="flex items-center py-10 text-text-secondary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading answers for attempt #{selectedAttempt.id}...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background/60 p-3 text-sm">
                  <p className="font-medium">
                    Attempt #{selectedAttempt.id} • {selectedAttempt.student_name || `Student #${selectedAttempt.student}`}
                  </p>
                  <p className="text-text-secondary">
                    Score {toNumber(selectedAttempt.percentage_score).toFixed(1)}% ({toNumber(selectedAttempt.points_earned).toFixed(2)} /{' '}
                    {toNumber(selectedAttempt.total_points).toFixed(2)}) • Status {selectedAttempt.status_display}
                  </p>
                </div>

                {!answerRows.length && (
                  <p className="rounded-xl border border-border bg-background/60 px-4 py-8 text-center text-sm text-text-secondary">
                    No answers captured for this attempt.
                  </p>
                )}

                {answerRows.map((answer) => {
                  const draft = resolveGradeDraft(answer)
                  const isManualQuestion = answer.question_type === 'essay' || answer.question_type === 'short_answer'

                  return (
                    <div key={answer.id} className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Q{answer.question_order}: {answer.question_text}
                        </p>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                          {answer.question_type.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-text-secondary">{answerResponseLabel(answer)}</p>

                      <div className="mt-2 text-xs text-text-secondary">
                        Current score: {toNumber(answer.points_earned).toFixed(2)} / {answer.question_points}
                        {answer.graded_by_name ? ` • Graded by ${answer.graded_by_name}` : ''}
                      </div>

                      {isManualQuestion && canEdit && (
                        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-secondary">Points Awarded</label>
                              <input
                                type="number"
                                min={0}
                                max={answer.question_points}
                                step="0.1"
                                value={draft.points}
                                onChange={(event) => updateGradeDraft(answer.id, { points: event.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-text-secondary">Feedback</label>
                              <textarea
                                rows={2}
                                value={draft.feedback}
                                onChange={(event) => updateGradeDraft(answer.id, { feedback: event.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                placeholder="Optional feedback for student"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleGradeAnswer(answer)}
                            disabled={gradeAnswerMutation.isPending}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {gradeAnswerMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Save grade
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <h2 className="mb-4 text-lg font-semibold">Per-question Analytics Drilldown</h2>

          {isAnalyticsLoading ? (
            <div className="flex items-center py-10 text-text-secondary">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading question analytics...
            </div>
          ) : (
            <div className="space-y-4">
              {(questionAnalytics?.questions || []).map((question) => (
                <div key={question.question_id} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      Q{question.order}: {question.question_text}
                    </p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                      {question.question_type_display}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <p className="text-text-secondary">Answered</p>
                      <p className="font-semibold">
                        {question.answered_count} / {questionAnalytics?.total_attempts || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <p className="text-text-secondary">Submission Rate</p>
                      <p className="font-semibold">{question.submission_rate.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <p className="text-text-secondary">Accuracy</p>
                      <p className="font-semibold">{question.accuracy_rate.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <p className="text-text-secondary">Avg Points</p>
                      <p className="font-semibold">
                        {question.average_points.toFixed(2)} / {question.points}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <p className="text-text-secondary">Manual Queue</p>
                      <p className="font-semibold">{question.pending_manual_reviews}</p>
                    </div>
                  </div>

                  {question.option_breakdown.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {question.option_breakdown.map((option) => {
                        const ratio = question.answered_count > 0 ? (option.count / question.answered_count) * 100 : 0
                        return (
                          <div key={`${question.question_id}-${option.option_id || 'none'}`}>
                            <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                              <span>{option.option_text}</span>
                              <span>
                                {option.count} ({ratio.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-border">
                              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(ratio, 100)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
              {(questionAnalytics?.questions || []).length === 0 && (
                <p className="rounded-xl border border-border bg-background/60 px-4 py-8 text-center text-sm text-text-secondary">
                  No question analytics available yet.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <h2 className="mb-4 text-lg font-semibold">Question Bank</h2>

          {isQuestionsLoading ? (
            <div className="flex items-center py-10 text-text-secondary">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading questions...
            </div>
          ) : (
            <div className="space-y-3">
              {(questions || []).map((question, index) => (
                <div key={question.id} className="rounded-xl border border-border/80 bg-background/60 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <span className="rounded-full border border-border px-2 py-0.5">Q{index + 1}</span>
                    <span>{question.question_type_display}</span>
                    <span>{question.points} points</span>
                  </div>
                  <p className="font-medium">{question.question_text}</p>
                  {question.options.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                      {question.options.map((option) => (
                        <li key={option.id} className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                          {option.option_text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {(questions || []).length === 0 && (
                <p className="text-sm text-text-secondary">This quiz does not have questions yet.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Clock3 className="h-4 w-4" />
            Created: {new Date(quiz.created_at).toLocaleString()} • Last updated: {new Date(quiz.updated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}

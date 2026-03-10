'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuth } from '@/contexts/AuthContext'
import {
  useDuplicateQuiz,
  useQuiz,
  useQuizLeaderboard,
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

export default function QuizDetailPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = Number(params?.id)
  const { user } = useAuth()
  const permissions = usePermissions(user)

  const canEdit = permissions.hasPermission('quizzes.edit')
  const canCreate = permissions.hasPermission('quizzes.create')

  const { data: quiz, isLoading: isQuizLoading } = useQuiz(Number.isFinite(quizId) ? quizId : null)
  const { data: statistics, isLoading: isStatsLoading } = useQuizStatistics(Number.isFinite(quizId) ? quizId : null)
  const { data: questions, isLoading: isQuestionsLoading } = useQuizQuestions(Number.isFinite(quizId) ? quizId : null)
  const { data: leaderboard } = useQuizLeaderboard(Number.isFinite(quizId) ? quizId : null)

  const duplicateMutation = useDuplicateQuiz()
  const togglePublishMutation = useToggleQuizPublished()

  const questionTypeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {}
    ;(questions || []).forEach((question) => {
      const key = question.question_type_display
      distribution[key] = (distribution[key] || 0) + 1
    })
    return Object.entries(distribution).sort((a, b) => b[1] - a[1])
  }, [questions])

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
              <p className="mt-1 text-text-secondary">
                {quiz.description || 'No description provided.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-border px-2 py-0.5">{quiz.subject_display}</span>
                <span className={`rounded-full border px-2 py-0.5 ${difficultyBadge(quiz.difficulty_level)}`}>
                  {quiz.difficulty_level_display}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5">{quiz.quiz_type_display}</span>
                <span className={`rounded-full border px-2 py-0.5 ${quiz.is_published ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-300'}`}>
                  {quiz.is_published ? 'Published' : 'Draft'}
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

            <h3 className="mt-6 mb-3 font-semibold">Question Type Distribution</h3>
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
                <div key={`${entry.student_id}-${index}`} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                  <p className="text-sm font-medium">{index + 1}. {entry.student_name || `Student ${entry.student_id}`}</p>
                  <p className="text-xs text-text-secondary">{entry.score.toFixed(1)}%</p>
                </div>
              ))}
              {(leaderboard || []).length === 0 && (
                <p className="text-sm text-text-secondary">No submitted attempts yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Question Bank
          </h2>

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

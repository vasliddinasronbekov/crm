'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Copy,
  Eye,
  FileQuestion,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import PaginationControls from '@/components/PaginationControls'
import { useAuth } from '@/contexts/AuthContext'
import {
  QuizRow,
  useDeleteQuiz,
  useDuplicateQuiz,
  useQuiz,
  useQuizDashboardSummary,
  useQuizQuestions,
  useQuizzes,
  useQuizStatistics,
  useToggleQuizPublished,
} from '@/lib/hooks/useQuizzes'
import { usePermissions } from '@/lib/permissions'
import toast from '@/lib/toast'

type PublishedFilter = 'all' | 'published' | 'draft'

const QUIZ_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'practice', label: 'Practice' },
  { value: 'graded', label: 'Graded' },
  { value: 'exam', label: 'Exam' },
  { value: 'survey', label: 'Survey' },
]

const SUBJECT_OPTIONS = [
  { value: '', label: 'All subjects' },
  { value: 'english', label: 'English' },
  { value: 'math', label: 'Mathematics' },
  { value: 'science', label: 'Science' },
  { value: 'general', label: 'General' },
]

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

function renderDifficultyBadge(level: string): string {
  if (level === 'easy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (level === 'hard') return 'border-rose-500/30 bg-rose-500/10 text-rose-400'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
}

function renderPublishBadge(isPublished: boolean): string {
  return isPublished
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
}

function QuizPreviewModal({
  quizId,
  onClose,
}: {
  quizId: number
  onClose: () => void
}) {
  const { data: quiz, isLoading: isLoadingQuiz } = useQuiz(quizId)
  const { data: statistics, isLoading: isLoadingStats } = useQuizStatistics(quizId)
  const { data: questions, isLoading: isLoadingQuestions } = useQuizQuestions(quizId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Quiz Workspace Preview</h2>
            <p className="text-sm text-text-secondary">
              {quiz ? `${quiz.title} • ${quiz.subject_display} • ${quiz.difficulty_level_display}` : 'Loading quiz...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-border/50 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {(isLoadingQuiz || isLoadingStats || isLoadingQuestions) && (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading quiz details...
            </div>
          )}

          {!isLoadingQuiz && !quiz && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              Unable to load quiz details.
            </div>
          )}

          {quiz && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <p className="text-xs text-text-secondary">Questions</p>
                  <p className="text-xl font-semibold">{quiz.question_count}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <p className="text-xs text-text-secondary">Total Points</p>
                  <p className="text-xl font-semibold">{quiz.total_points}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <p className="text-xs text-text-secondary">Time Limit</p>
                  <p className="text-xl font-semibold">
                    {quiz.time_limit_minutes > 0 ? `${quiz.time_limit_minutes}m` : 'Unlimited'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <p className="text-xs text-text-secondary">Passing Score</p>
                  <p className="text-xl font-semibold">{quiz.passing_score}%</p>
                </div>
              </div>

              {statistics && (
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <h3 className="mb-3 font-semibold">Attempt Analytics</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-text-secondary">Attempts</p>
                      <p className="font-semibold">{statistics.total_attempts}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Unique Takers</p>
                      <p className="font-semibold">{statistics.unique_takers}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Pass Rate</p>
                      <p className="font-semibold">{statistics.pass_rate}%</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Avg Score</p>
                      <p className="font-semibold">{statistics.average_score_percentage}%</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-background/50 p-4">
                <h3 className="mb-3 font-semibold">Question Bank Snapshot</h3>
                <div className="space-y-2">
                  {(questions || []).slice(0, 12).map((question, index) => (
                    <div key={question.id} className="rounded-lg border border-border/70 bg-surface px-3 py-2">
                      <p className="text-xs text-text-secondary">
                        Q{index + 1} • {question.question_type_display} • {question.points} pt
                      </p>
                      <p className="text-sm">{question.question_text}</p>
                    </div>
                  ))}
                  {(questions || []).length > 12 && (
                    <p className="text-xs text-text-secondary">
                      + {(questions || []).length - 12} more questions
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuizzesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissions = usePermissions(user)

  const canCreate = permissions.hasPermission('quizzes.create')
  const canEdit = permissions.hasPermission('quizzes.edit')
  const canDelete = permissions.hasPermission('quizzes.delete')

  const [search, setSearch] = useState('')
  const [quizType, setQuizType] = useState('')
  const [subject, setSubject] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [previewQuizId, setPreviewQuizId] = useState<number | null>(null)

  const listFilters = useMemo(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      quiz_type: quizType || undefined,
      subject: subject || undefined,
      difficulty_level: difficulty || undefined,
      is_published:
        publishedFilter === 'all'
          ? undefined
          : publishedFilter === 'published',
    }),
    [difficulty, limit, page, publishedFilter, quizType, search, subject],
  )

  const {
    data: quizzesData,
    isLoading: isLoadingQuizzes,
    isError: isQuizListError,
  } = useQuizzes(listFilters)

  const { data: summary, isLoading: isSummaryLoading } = useQuizDashboardSummary({
    search: search.trim() || undefined,
    quiz_type: quizType || undefined,
    subject: subject || undefined,
    difficulty_level: difficulty || undefined,
    is_published:
      publishedFilter === 'all'
        ? undefined
        : publishedFilter === 'published',
  })

  const togglePublishedMutation = useToggleQuizPublished()
  const duplicateQuizMutation = useDuplicateQuiz()
  const deleteQuizMutation = useDeleteQuiz()

  const quizRows: QuizRow[] = quizzesData?.results || []

  const handleTogglePublished = async (quiz: QuizRow) => {
    try {
      await togglePublishedMutation.mutateAsync({
        quizId: quiz.id,
        isPublished: !quiz.is_published,
      })
      toast.success(quiz.is_published ? 'Quiz moved to draft.' : 'Quiz published.')
    } catch {
      // Toast handled in mutation hook.
    }
  }

  const handleDuplicateQuiz = async (quizId: number) => {
    try {
      await duplicateQuizMutation.mutateAsync(quizId)
      toast.success('Quiz duplicated.')
    } catch {
      // Toast handled in mutation hook.
    }
  }

  const handleDeleteQuiz = async (quiz: QuizRow) => {
    const confirmed = window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteQuizMutation.mutateAsync(quiz.id)
      toast.success('Quiz deleted.')
    } catch {
      // Toast handled in mutation hook.
    }
  }

  if (isLoadingQuizzes && !quizzesData) {
    return <LoadingScreen message="Loading quiz operations..." />
  }

  if (isQuizListError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="rounded-2xl border border-error/40 bg-error/10 px-6 py-5 text-center">
          <p className="text-lg font-semibold text-error">Failed to load quizzes</p>
          <p className="mt-1 text-sm text-text-secondary">Please refresh and try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-border bg-surface/90 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                <Sparkles className="h-7 w-7 text-primary" />
                Quiz Operations Hub
              </h1>
              <p className="mt-1 text-text-secondary">
                Manage quiz catalog, monitor outcomes, and improve assessment quality from one workspace.
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/quizzes/create')}
              disabled={!canCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Quiz
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Total Quizzes</p>
              <p className="mt-2 text-2xl font-bold">{summary?.total_quizzes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Published</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                {summary?.published_quizzes ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Draft</p>
              <p className="mt-2 text-2xl font-bold">{summary?.draft_quizzes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Attempts</p>
              <p className="mt-2 text-2xl font-bold">{summary?.attempts_total ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Avg Score / Pass Rate</p>
              <p className="mt-2 text-sm font-semibold">
                {(summary?.average_score ?? 0).toFixed(1)}% • {(summary?.pass_rate ?? 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Filter className="h-5 w-5 text-primary" />
              Filters
            </h2>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  value={search}
                  onChange={(event) => {
                    setPage(1)
                    setSearch(event.target.value)
                  }}
                  placeholder="Search title / description"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <select
                value={quizType}
                onChange={(event) => {
                  setPage(1)
                  setQuizType(event.target.value)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {QUIZ_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={subject}
                onChange={(event) => {
                  setPage(1)
                  setSubject(event.target.value)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {SUBJECT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={difficulty}
                onChange={(event) => {
                  setPage(1)
                  setDifficulty(event.target.value)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={publishedFilter}
                onChange={(event) => {
                  setPage(1)
                  setPublishedFilter(event.target.value as PublishedFilter)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>

              <button
                onClick={() => {
                  setPage(1)
                  setSearch('')
                  setQuizType('')
                  setSubject('')
                  setDifficulty('')
                  setPublishedFilter('all')
                }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-border/50"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md xl:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-primary" />
                Top Active Quizzes
              </h2>
              {isSummaryLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  refreshing
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(summary?.top_quizzes || []).map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => setPreviewQuizId(quiz.id)}
                  className="rounded-xl border border-border/80 bg-background/50 p-4 text-left transition-colors hover:bg-background/80"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="line-clamp-1 font-semibold">{quiz.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${renderDifficultyBadge(quiz.difficulty_level)}`}>
                      {quiz.difficulty_level}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <span className="rounded-full border border-border px-2 py-0.5">{quiz.subject}</span>
                    <span>{quiz.question_count} questions</span>
                    <span>{quiz.attempts_total} attempts</span>
                    <span>{quiz.avg_score.toFixed(1)}% avg</span>
                  </div>
                </button>
              ))}
              {(summary?.top_quizzes || []).length === 0 && (
                <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-sm text-text-secondary">
                  No attempt data yet. Start publishing quizzes to see leaderboard insights.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/90 p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Quiz Catalog</h2>
            <span className="text-sm text-text-secondary">{quizzesData?.count || 0} quizzes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-border/80 text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-3">Quiz</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-3 py-3">Questions</th>
                  <th className="px-3 py-3">Attempts</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-text-secondary">
                      <FileQuestion className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No quizzes found for current filters.
                    </td>
                  </tr>
                )}

                {quizRows.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-border/40 hover:bg-background/40">
                    <td className="px-3 py-3">
                      <p className="font-medium">{quiz.title}</p>
                      <p className="text-xs text-text-secondary">
                        {quiz.quiz_type_display} • Passing {quiz.passing_score}%
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                        {quiz.subject_display}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${renderDifficultyBadge(quiz.difficulty_level)}`}>
                        {quiz.difficulty_level_display}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      <div>{quiz.question_count} q</div>
                      <div>{quiz.total_points} pts</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      <div>{quiz.attempts_total || 0} attempts</div>
                      <div>{Number(quiz.average_score || 0).toFixed(1)}% avg</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${renderPublishBadge(quiz.is_published)}`}>
                        {quiz.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewQuizId(quiz.id)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50"
                          title="Preview"
                        >
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </span>
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/quizzes/${quiz.id}`)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50"
                          title="Open workspace"
                        >
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            Open
                          </span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleTogglePublished(quiz)}
                            disabled={togglePublishedMutation.isPending}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={quiz.is_published ? 'Move to draft' : 'Publish'}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canCreate && (
                          <button
                            onClick={() => handleDuplicateQuiz(quiz.id)}
                            disabled={duplicateQuizMutation.isPending}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteQuiz(quiz)}
                            disabled={deleteQuizMutation.isPending}
                            className="rounded-lg border border-error/40 px-2.5 py-1.5 text-xs text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quizzesData && quizzesData.count > limit && (
            <div className="mt-4">
              <PaginationControls
                totalItems={quizzesData.count}
                itemsPerPage={limit}
                currentPage={page}
                onPageChange={setPage}
                onItemsPerPageChange={setLimit}
              />
            </div>
          )}
        </div>
      </div>

      {previewQuizId && (
        <QuizPreviewModal
          quizId={previewQuizId}
          onClose={() => setPreviewQuizId(null)}
        />
      )}
    </div>
  )
}

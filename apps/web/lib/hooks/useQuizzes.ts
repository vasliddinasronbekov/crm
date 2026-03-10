import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

export interface QuizSummaryStatItem {
  count: number
  [key: string]: string | number
}

export interface QuizDashboardSummary {
  total_quizzes: number
  published_quizzes: number
  draft_quizzes: number
  attempts_total: number
  pass_rate: number
  average_score: number
  by_subject: QuizSummaryStatItem[]
  by_difficulty: QuizSummaryStatItem[]
  by_type: QuizSummaryStatItem[]
  top_quizzes: Array<{
    id: number
    title: string
    quiz_type: string
    subject: string
    difficulty_level: string
    is_published: boolean
    question_count: number
    attempts_total: number
    avg_score: number
  }>
}

export interface QuizRow {
  id: number
  title: string
  description: string
  quiz_type: string
  quiz_type_display: string
  subject: string
  subject_display: string
  difficulty_level: string
  difficulty_level_display: string
  time_limit_minutes: number
  passing_score: number
  is_published: boolean
  question_count: number
  total_points: number
  attempts_total?: number
  attempts_passed?: number
  average_score?: number | null
  created_at: string
  updated_at: string
}

export interface QuizStatistics {
  quiz_id: number
  total_attempts: number
  unique_takers: number
  passed_attempts: number
  pass_rate: number
  average_score_percentage: number
  average_time_seconds: number
  average_time_minutes: number
}

export interface QuizLeaderboardEntry {
  student_id: number
  student_name: string
  score: number
  submitted_at: string
}

export interface QuizQuestion {
  id: number
  question_type: string
  question_type_display: string
  question_text: string
  explanation: string
  points: number
  order: number
  options: Array<{
    id: number
    option_text: string
  }>
}

export interface QuizAttemptRow {
  id: number
  quiz: number
  quiz_title: string
  student: number
  student_name: string
  attempt_number: number
  status: 'in_progress' | 'submitted' | 'graded'
  status_display: string
  started_at: string
  submitted_at: string | null
  time_taken_seconds: number
  total_points: number | string
  points_earned: number | string
  percentage_score: number | string
  passed: boolean
  created_at: string
  updated_at: string
}

export interface QuizAnswerRow {
  id: number
  attempt: number
  question: number
  question_text: string
  question_type: string
  question_order: number
  question_points: number
  selected_option: number | null
  selected_option_text: string | null
  text_answer: string
  is_correct: boolean
  points_earned: number | string
  feedback: string
  graded_by: number | null
  graded_by_name: string
  created_at: string
}

export interface QuizQuestionAnalytics {
  quiz_id: number
  total_attempts: number
  questions: Array<{
    question_id: number
    order: number
    question_text: string
    question_type: string
    question_type_display: string
    points: number
    answered_count: number
    correct_count: number
    submission_rate: number
    accuracy_rate: number
    average_points: number
    pending_manual_reviews: number
    manual_graded_count: number
    option_breakdown: Array<{
      option_id: number | null
      option_text: string
      count: number
    }>
  }>
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const quizKeys = {
  all: ['quizzes'] as const,
  list: (filters: Record<string, unknown>) => [...quizKeys.all, 'list', filters] as const,
  dashboardSummary: (filters: Record<string, unknown>) =>
    [...quizKeys.all, 'dashboard-summary', filters] as const,
  details: (id: number | null) => [...quizKeys.all, 'detail', id] as const,
  questions: (id: number | null) => [...quizKeys.all, 'questions', id] as const,
  statistics: (id: number | null) => [...quizKeys.all, 'statistics', id] as const,
  leaderboard: (id: number | null) => [...quizKeys.all, 'leaderboard', id] as const,
  questionAnalytics: (id: number | null) => [...quizKeys.all, 'question-analytics', id] as const,
  attempts: (filters: Record<string, unknown>) => [...quizKeys.all, 'attempts', filters] as const,
  answers: (filters: Record<string, unknown>) => [...quizKeys.all, 'answers', filters] as const,
}

export function useQuizzes(filters: Record<string, unknown>) {
  return useQuery<PaginatedResponse<QuizRow>, Error>({
    queryKey: quizKeys.list(filters),
    queryFn: async () => {
      const data = await apiService.getQuizzes(filters)
      if (Array.isArray(data)) {
        return {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        }
      }
      return data as PaginatedResponse<QuizRow>
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useQuizDashboardSummary(filters: Record<string, unknown>) {
  return useQuery<QuizDashboardSummary, Error>({
    queryKey: quizKeys.dashboardSummary(filters),
    queryFn: async () => {
      const data = await apiService.getQuizDashboardSummary(filters)
      return data as QuizDashboardSummary
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useQuiz(id: number | null) {
  return useQuery<QuizRow, Error>({
    queryKey: quizKeys.details(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Quiz id is required')
      }
      const data = await apiService.getQuiz(id)
      return data as QuizRow
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useQuizQuestions(id: number | null) {
  return useQuery<QuizQuestion[], Error>({
    queryKey: quizKeys.questions(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Quiz id is required')
      }
      const data = await apiService.getQuizQuestions(id)
      return data as QuizQuestion[]
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useQuizStatistics(id: number | null) {
  return useQuery<QuizStatistics, Error>({
    queryKey: quizKeys.statistics(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Quiz id is required')
      }
      const data = await apiService.getQuizStatistics(id)
      return data as QuizStatistics
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useQuizLeaderboard(id: number | null) {
  return useQuery<QuizLeaderboardEntry[], Error>({
    queryKey: quizKeys.leaderboard(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Quiz id is required')
      }
      const data = await apiService.getQuizLeaderboard(id)
      return data as QuizLeaderboardEntry[]
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useQuizQuestionAnalytics(id: number | null) {
  return useQuery<QuizQuestionAnalytics, Error>({
    queryKey: quizKeys.questionAnalytics(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Quiz id is required')
      }
      const data = await apiService.getQuizQuestionAnalytics(id)
      return data as QuizQuestionAnalytics
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  })
}

export function useQuizAttempts(filters: Record<string, unknown>) {
  return useQuery<PaginatedResponse<QuizAttemptRow>, Error>({
    queryKey: quizKeys.attempts(filters),
    queryFn: async () => {
      const data = await apiService.getQuizAttempts(filters)
      if (Array.isArray(data)) {
        return {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        }
      }
      return data as PaginatedResponse<QuizAttemptRow>
    },
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useQuizAnswers(filters: Record<string, unknown> | null) {
  return useQuery<PaginatedResponse<QuizAnswerRow>, Error>({
    queryKey: quizKeys.answers(filters || {}),
    queryFn: async () => {
      if (!filters) {
        return {
          count: 0,
          next: null,
          previous: null,
          results: [],
        }
      }
      const data = await apiService.getQuizAnswers(filters)
      if (Array.isArray(data)) {
        return {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        }
      }
      return data as PaginatedResponse<QuizAnswerRow>
    },
    enabled: Boolean(filters),
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quizId: number) => {
      await apiService.deleteQuiz(quizId)
      return quizId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.all })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to delete quiz')
    },
  })
}

export function useDuplicateQuiz() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quizId: number) => {
      const data = await apiService.duplicateQuiz(quizId)
      return data as QuizRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.all })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to duplicate quiz')
    },
  })
}

export function useToggleQuizPublished() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quizId, isPublished }: { quizId: number; isPublished: boolean }) => {
      const data = await apiService.updateQuiz(quizId, {
        is_published: isPublished,
      })
      return data as QuizRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.all })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update quiz status')
    },
  })
}

export function useGradeQuizAnswer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      answerId,
      pointsAwarded,
      feedback,
    }: {
      answerId: number
      pointsAwarded: number
      feedback?: string
    }) => {
      const data = await apiService.gradeQuizAnswer(answerId, {
        points_awarded: pointsAwarded,
        manual_feedback: feedback || '',
      })
      return data as QuizAnswerRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.all })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to grade answer')
    },
  })
}

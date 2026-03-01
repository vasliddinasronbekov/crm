/**
 * Quizzes API - Quiz taking and assessment endpoints
 * Backend endpoints: /api/v1/student-profile/quizzes/, quiz-attempts/, quiz-answers/
 */

import { apiClient } from './client'

export interface QuestionOption {
  id: number
  option_text: string
  is_correct: boolean
  order: number
}

export interface Question {
  id: number
  quiz: number
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank'
  question_type_display: string
  question_text: string
  explanation?: string
  points: number
  order: number
  is_required: boolean
  options: QuestionOption[]
}

export interface Quiz {
  id: number
  course: number
  module?: number
  lesson?: number
  module_title?: string
  title: string
  description?: string
  quiz_type: 'practice' | 'graded' | 'exam' | 'survey'
  quiz_type_display: string
  time_limit_minutes: number
  passing_score: number
  show_correct_answers: boolean
  shuffle_questions: boolean
  shuffle_answers: boolean
  max_attempts: number
  allow_review: boolean
  available_from: string
  available_until?: string
  is_published: boolean
  question_count: number
  total_points: number
  user_best_attempt?: {
    id: number
    percentage_score: number
    points_earned: number
    passed: boolean
    submitted_at: string
  }
  user_attempts_count: number
  created_at: string
  updated_at: string
}

export interface QuizAnswer {
  id: number
  attempt: number
  question: number
  question_text: string
  question_type: string
  selected_option?: number
  text_answer?: string
  is_correct: boolean
  points_earned: number
  feedback?: string
  correct_answer_text?: string
}

export interface QuizAttempt {
  id: number
  quiz: number
  quiz_title: string
  student: number
  student_name: string
  attempt_number: number
  status: 'in_progress' | 'submitted' | 'graded'
  status_display: string
  started_at: string
  submitted_at?: string
  time_taken_seconds: number
  total_points: number
  points_earned: number
  percentage_score: number
  passed: boolean
  answers: QuizAnswer[]
}

export interface QuizFilters {
  module_id?: number
  quiz_type?: 'practice' | 'graded' | 'exam' | 'survey'
}

export interface StartAttemptResponse {
  id: number
  quiz: number
  attempt_number: number
  status: string
  started_at: string
  total_points: number
}

export interface SubmitAnswerPayload {
  attempt: number
  question: number
  selected_option?: number
  text_answer?: string
}

export const quizzesApi = {
  /**
   * Get all quizzes
   * GET /api/v1/student-profile/quizzes/
   */
  getQuizzes: async (filters?: QuizFilters): Promise<Quiz[]> => {
    const params = new URLSearchParams()
    if (filters) {
      if (filters.module_id) params.append('module_id', filters.module_id.toString())
      if (filters.quiz_type) params.append('quiz_type', filters.quiz_type)
    }

    const queryString = params.toString()
    const url = queryString ? `/api/v1/student-profile/quizzes/?${queryString}` : '/api/v1/student-profile/quizzes/'

    const result = await apiClient.get(url)
    return Array.isArray(result) ? result : []
  },

  /**
   * Get quiz details
   * GET /api/v1/student-profile/quizzes/{id}/
   */
  getQuizDetail: async (quizId: number): Promise<Quiz> => {
    return await apiClient.get(`/api/v1/student-profile/quizzes/${quizId}/`)
  },

  /**
   * Get quiz questions
   * GET /api/v1/student-profile/quizzes/{id}/questions/
   */
  getQuizQuestions: async (quizId: number): Promise<Question[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/quizzes/${quizId}/questions/`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Start quiz attempt
   * POST /api/v1/student-profile/quizzes/{id}/start_attempt/
   */
  startAttempt: async (quizId: number): Promise<StartAttemptResponse> => {
    return await apiClient.post(`/api/v1/student-profile/quizzes/${quizId}/start_attempt/`)
  },

  /**
   * Get user's quiz attempts
   * GET /api/v1/student-profile/quiz-attempts/my_attempts/
   */
  getMyAttempts: async (quizId?: number): Promise<QuizAttempt[]> => {
    const params = quizId ? `?quiz_id=${quizId}` : ''
    const result = await apiClient.get(`/api/v1/student-profile/quiz-attempts/my_attempts/${params}`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Get attempt details
   * GET /api/v1/student-profile/quiz-attempts/{id}/
   */
  getAttemptDetail: async (attemptId: number): Promise<QuizAttempt> => {
    return await apiClient.get(`/api/v1/student-profile/quiz-attempts/${attemptId}/`)
  },

  /**
   * Submit answer to a question
   * POST /api/v1/student-profile/quiz-answers/
   */
  submitAnswer: async (payload: SubmitAnswerPayload): Promise<QuizAnswer> => {
    return await apiClient.post('/api/v1/student-profile/quiz-answers/', payload)
  },

  /**
   * Submit quiz attempt (finalize)
   * POST /api/v1/student-profile/quiz-attempts/{id}/submit/
   */
  submitAttempt: async (attemptId: number): Promise<QuizAttempt> => {
    return await apiClient.post(`/api/v1/student-profile/quiz-attempts/${attemptId}/submit/`)
  },

  /**
   * Get all answers for an attempt
   * GET /api/v1/student-profile/quiz-answers/?attempt_id={id}
   */
  getAttemptAnswers: async (attemptId: number): Promise<QuizAnswer[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/quiz-answers/?attempt_id=${attemptId}`)
    return Array.isArray(result) ? result : []
  },
}

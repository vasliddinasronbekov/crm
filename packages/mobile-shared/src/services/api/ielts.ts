/**
 * IELTS API Service
 * Handles all IELTS exam related API calls
 * Updated 2025-11-24: Using tested endpoints from API review
 * Tested with: student_akmal / test
 */

import { apiClient } from './client';

export interface IELTSExam {
  id: number;
  section: 'reading' | 'listening' | 'writing' | 'speaking';
  section_display: string;
  title: string;
  description: string;
  coin_cost: number;
  coin_refund: number;
  time_limit_minutes: number;
  passing_band_score: string;
  instructions: string;
  is_active: boolean;
  questions_count: number;
  created_at: string;
}

export interface IELTSQuestion {
  id: number;
  exam: number;
  question_type: string;
  question_type_display: string;
  order: number;
  passage_text: string;
  audio_file: string | null;
  question_text: string;
  options: string[];
  points: string;
  speaking_prompts: string[];
  time_limit_seconds: number;
}

export interface IELTSAttempt {
  id: number;
  student: number;
  student_name: string;
  exam: number;
  exam_details: IELTSExam;
  attempt_number: number;
  status: 'payment_pending' | 'in_progress' | 'submitted' | 'evaluating' | 'completed' | 'refunded';
  status_display: string;
  coins_paid: number;
  coins_refunded: number;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  time_taken_seconds: number;
  raw_score: string;
  band_score: string;
  ai_evaluation: any;
  ai_evaluated_at: string | null;
  strengths: string;
  weaknesses: string;
  recommendations: string;
  overall_feedback?: string;
  rubric_cards?: Array<{
    key: string;
    label: string;
    score: number;
    summary?: string;
  }>;
  strengths_list?: string[];
  weaknesses_list?: string[];
  recommendations_list?: string[];
  question_feedback?: Array<{
    question_id: number;
    question_text: string;
    feedback?: string;
    score?: any;
    word_count?: number;
    transcription?: string;
  }>;
  response_feedback?: Array<{
    label: string;
    question_id: number;
    band_score?: number;
    feedback?: string;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  is_pending_evaluation?: boolean;
  answers: IELTSAnswer[];
  can_refund: boolean;
  created_at: string;
}

export interface IELTSAnswer {
  id: number;
  attempt: number;
  question: number;
  question_details: IELTSQuestion;
  text_answer: string;
  selected_option: string;
  essay_content: string;
  word_count: number;
  audio_response: string | null;
  transcription: string;
  is_correct: boolean;
  points_earned: string;
  ai_score: any;
  ai_feedback: string;
  time_taken_seconds: number;
  created_at: string;
}

export interface CreateAttemptPayload {
  exam: number;
}

export interface SubmitAnswerPayload {
  question_id: number;
  text_answer?: string;
  selected_option?: string;
  essay_content?: string;
  audio_response?: File;
  time_taken_seconds?: number;
}

// Paginated response type
interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const ieltsApi = {
  /**
   * Get all active IELTS exams
   * TESTED ✅ - /api/v1/student-profile/ielts/exams/
   */
  getExams: async (): Promise<IELTSExam[]> => {
    const response = await apiClient.get('/api/v1/student-profile/ielts/exams/') as PaginatedResponse<IELTSExam>;
    return response.results || [];
  },

  /**
   * Get specific exam details
   * TESTED ✅ - /api/v1/student-profile/ielts/exams/{id}/
   */
  getExam: async (examId: number): Promise<IELTSExam> => {
    return await apiClient.get(`/api/v1/student-profile/ielts/exams/${examId}/`);
  },

  /**
   * Get questions for an exam
   */
  getExamQuestions: async (examId: number): Promise<IELTSQuestion[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/ielts/exams/${examId}/questions/`);
    return Array.isArray(result) ? result : [];
  },

  /**
   * Get user's attempts for a specific exam
   */
  getExamAttempts: async (examId: number): Promise<IELTSAttempt[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/ielts/exams/${examId}/my_attempts/`);
    return Array.isArray(result) ? result : [];
  },

  /**
   * Get all user's IELTS attempts
   * TESTED ✅ - /api/v1/student-profile/ielts/attempts/
   */
  getAllAttempts: async (): Promise<IELTSAttempt[]> => {
    const response = await apiClient.get('/api/v1/student-profile/ielts/attempts/') as PaginatedResponse<IELTSAttempt>;
    return response.results || [];
  },

  /**
   * Get specific attempt details
   */
  getAttempt: async (attemptId: number): Promise<IELTSAttempt> => {
    return await apiClient.get(`/api/v1/student-profile/ielts/attempts/${attemptId}/`);
  },

  /**
   * Create new attempt (pay coins and start exam)
   * TESTED ✅ - /api/v1/student-profile/ielts/attempts/
   */
  createAttempt: async (payload: CreateAttemptPayload): Promise<IELTSAttempt> => {
    return await apiClient.post('/api/v1/student-profile/ielts/attempts/', payload);
  },

  /**
   * Submit answer for a question
   * TESTED ✅ - /api/v1/student-profile/ielts/attempts/{id}/submit_answer/
   */
  submitAnswer: async (attemptId: number, payload: SubmitAnswerPayload): Promise<IELTSAnswer> => {
    // For audio uploads, we need to use FormData
    if (payload.audio_response) {
      const formData = new FormData();
      formData.append('question_id', payload.question_id.toString());
      if (payload.text_answer) formData.append('text_answer', payload.text_answer);
      if (payload.selected_option) formData.append('selected_option', payload.selected_option);
      if (payload.essay_content) formData.append('essay_content', payload.essay_content);
      if (payload.time_taken_seconds) formData.append('time_taken_seconds', payload.time_taken_seconds.toString());
      formData.append('audio_response', payload.audio_response);

      return await apiClient.post(
        `/api/v1/student-profile/ielts/attempts/${attemptId}/submit_answer/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    }

    return await apiClient.post(
      `/api/v1/student-profile/ielts/attempts/${attemptId}/submit_answer/`,
      payload
    );
  },

  /**
   * Complete IELTS attempt
   * TESTED ✅ - /api/v1/student-profile/ielts/attempts/{id}/complete/
   */
  completeAttempt: async (attemptId: number): Promise<IELTSAttempt> => {
    return await apiClient.post(`/api/v1/student-profile/ielts/attempts/${attemptId}/complete/`, {});
  },

  /**
   * Submit entire attempt for evaluation (deprecated - use completeAttempt)
   */
  submitAttempt: async (attemptId: number): Promise<IELTSAttempt> => {
    return await apiClient.post(`/api/v1/student-profile/ielts/attempts/${attemptId}/submit/`, {});
  },

  /**
   * Request coin refund for successful attempt
   */
  requestRefund: async (attemptId: number): Promise<{ detail: string; attempt: IELTSAttempt }> => {
    return await apiClient.post(`/api/v1/student-profile/ielts/attempts/${attemptId}/request_refund/`, {});
  },
};

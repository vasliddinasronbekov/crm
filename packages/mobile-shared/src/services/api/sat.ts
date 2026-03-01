/**
 * SAT 2025 Digital API Service
 * Handles all SAT exam related API calls for the 2025 Digital SAT format
 * Updated 2025-11-28: Matches backend SATExam, SATModule, SATQuestion models
 * Supports adaptive testing with 2 modules per section
 *
 * Format:
 * - Reading & Writing: 54 questions (2 modules × 27q, 32 min each)
 * - Math: 44 questions (2 modules × 22q, 35 min each)
 * - Total: 98 questions, 134 minutes
 * - Score: 400-1600 (200-800 per section)
 */

import { apiClient } from './client';

export interface SATExam {
  id: number;
  title: string;
  description: string;
  coin_cost: number;
  coin_refund: number;
  passing_score: number;
  rw_total_questions: number;
  rw_time_minutes: number;
  math_total_questions: number;
  math_time_minutes: number;
  is_official: boolean;
  is_published: boolean;
  test_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface SATModule {
  id: number;
  exam: number;
  section: 'reading_writing' | 'math';
  section_display: string;
  module_number: 1 | 2;
  difficulty: 'easy' | 'medium' | 'hard';
  time_minutes: number;
  order: number;
  question_count?: number;
}

export interface SATQuestion {
  id: number;
  module: number;
  question_number: number;
  passage_text?: string;
  question_text: string;
  // Reading & Writing types
  rw_type?: 'craft_structure' | 'information_ideas' | 'expression_ideas' | 'standard_conventions';
  rw_type_display?: string;
  // Math types
  math_type?: 'algebra' | 'advanced_math' | 'problem_solving' | 'geometry';
  math_type_display?: string;
  // Answer format
  answer_type: 'mcq' | 'spr';  // Multiple Choice or Student Produced Response
  options: string[];  // For MCQ only
  correct_answer: { answer: string };  // Hidden until completion
  explanation: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  points: string;  // Decimal as string
  order: number;
}

export interface SATTopicPerformance {
  correct: number;
  total: number;
  percentage: number;
}

export interface SATSectionFeedback {
  strengths?: string[];
  weaknesses?: string[];
  improvement_tips?: string[];
}

export interface SATScorePotential {
  current_score?: number;
  realistic_target?: number;
  target_breakdown?: {
    reading_writing?: number;
    math?: number;
  };
  time_estimate?: string;
}

export interface SATTopicDiagnostic {
  section: 'reading_writing' | 'math' | string;
  section_label?: string;
  topic: string;
  topic_label?: string;
  correct?: number;
  total?: number;
  missed?: number;
  accuracy?: number;
  performance_band?: 'strong' | 'developing' | 'needs_work' | 'critical' | string;
  recommended_action?: string;
  focus_minutes_per_day?: number;
  resource_title?: string;
  resource_type?: string;
  priority_rank?: number;
}

export interface SATPerformanceData {
  total_score?: number;
  reading_writing?: {
    score?: number;
    correct?: number;
    total?: number;
    by_type?: Record<string, SATTopicPerformance>;
  };
  math?: {
    score?: number;
    correct?: number;
    total?: number;
    by_type?: Record<string, SATTopicPerformance>;
  };
  time_management?: {
    total_time_seconds?: number;
    time_per_question_avg?: number;
    time_per_question_avg_seconds?: number;
    official_time_per_question_avg_seconds?: number;
    pacing_status?: 'fast' | 'on_track' | 'slow' | string;
  };
  topic_diagnostics?: SATTopicDiagnostic[];
}

export interface SATAIFeedback {
  error?: string;
  message?: string;
  overall_assessment?: string;
  reading_writing_feedback?: SATSectionFeedback;
  math_feedback?: SATSectionFeedback;
  score_potential?: SATScorePotential;
  priority_areas?: string[];
  study_plan?: string[];
  study_plan_structured?: Array<{
    phase?: string;
    title?: string;
    focus_areas?: string[];
    daily_minutes?: number;
    goal?: string;
  }>;
  recommended_resources?: string[];
  recommended_resources_structured?: Array<{
    title?: string;
    type?: string;
    section?: string;
    topic?: string;
    reason?: string;
    priority_rank?: number;
  }>;
  topic_diagnostics?: SATTopicDiagnostic[];
  performance_data?: SATPerformanceData;
}

export interface SATAttempt {
  id: number;
  student: number;
  student_name: string;
  exam: number;
  exam_details: SATExam;
  exam_detail?: SATExam;
  status: 'payment_pending' | 'in_progress' | 'completed' | 'evaluated';
  status_display: string;
  // Payment
  coins_paid: number;
  coins_refunded: number;
  refund_eligible: boolean;
  // Timing
  started_at: string | null;
  completed_at: string | null;
  time_taken_seconds: number;
  // Scores
  reading_writing_score: number;  // 200-800
  math_score: number;  // 200-800
  total_score: number;  // 400-1600
  // Raw counts
  rw_correct: number;  // Out of 54
  math_correct: number;  // Out of 44
  // Adaptive testing
  rw_module1_correct: number;
  rw_module2_difficulty: 'easy' | 'medium' | 'hard' | null;
  math_module1_correct: number;
  math_module2_difficulty: 'easy' | 'medium' | 'hard' | null;
  current_module_key: string;
  current_question_index: number;
  module_time_remaining_seconds: number;
  last_state_synced_at: string | null;
  // AI Feedback
  ai_feedback: SATAIFeedback | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  can_resume?: boolean;
  answers?: SATAnswer[];
}

export interface SATAnswer {
  id: number;
  attempt: number;
  question: number;
  question_number?: number;
  question_details?: SATQuestion;
  answer_given: { answer: string };
  is_correct: boolean;
  points_earned: string;  // Decimal as string
  time_spent_seconds: number;
  answered_at: string;
}

export interface SATExamDetail extends SATExam {
  modules: SATModule[];
}

export interface SATModuleDetail extends SATModule {
  questions: SATQuestion[];
}

export interface SATResults {
  attempt: SATAttempt;
  answers: SATAnswer[];
  performance_by_section: {
    reading_writing: {
      score: number;
      correct: number;
      total: number;
      percentage: number;
      by_type: {
        [key: string]: {
          correct: number;
          total: number;
          percentage: number;
        };
      };
    };
    math: {
      score: number;
      correct: number;
      total: number;
      percentage: number;
      by_type: {
        [key: string]: {
          correct: number;
          total: number;
          percentage: number;
        };
      };
    };
  };
  time_management: {
    total_time_seconds: number;
    avg_time_per_question: number;
  };
}

export interface SATStatistics {
  total_attempts: number;
  completed_attempts: number;
  average_scores: {
    total: number;
    reading_writing: number;
    math: number;
  };
  best_scores: {
    total: number;
    reading_writing: number;
    math: number;
  };
  attempts: SATAttempt[];
}

export interface CreateAttemptPayload {
  exam_id: number;
}

export interface SubmitAnswerPayload {
  question_id: number;
  answer_given: { answer: string };
  time_spent_seconds?: number;
}

export interface SyncSATStatePayload {
  current_module_key: string;
  current_question_index: number;
  module_time_remaining_seconds: number;
}

// Paginated response type
interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

const extractResults = <T>(payload: T[] | PaginatedResponse<T>): T[] =>
  Array.isArray(payload) ? payload : payload.results || [];

export const satApi = {
  /**
   * Get all available SAT exams
   * TESTED ✅ - /api/v1/student-profile/sat/exams/
   */
  getExams: async (): Promise<SATExam[]> => {
    const response = await apiClient.get('/api/v1/student-profile/sat/exams/') as SATExam[] | PaginatedResponse<SATExam>;
    return extractResults(response);
  },

  /**
   * Get specific SAT exam details with modules
   * TESTED ✅ - /api/v1/student-profile/sat/exams/{id}/
   */
  getExam: async (examId: number): Promise<SATExamDetail> => {
    return await apiClient.get(`/api/v1/student-profile/sat/exams/${examId}/`);
  },

  /**
   * Get all modules for an exam
   * TESTED ✅ - /api/v1/student-profile/sat/modules/?exam={id}
   */
  getExamModules: async (examId: number): Promise<SATModule[]> => {
    const response = await apiClient.get(`/api/v1/student-profile/sat/modules/?exam=${examId}`) as SATModule[] | PaginatedResponse<SATModule>;
    return extractResults(response);
  },

  /**
   * Get specific module with questions
   * TESTED ✅ - /api/v1/student-profile/sat/modules/{id}/
   */
  getModule: async (moduleId: number): Promise<SATModuleDetail> => {
    return await apiClient.get(`/api/v1/student-profile/sat/modules/${moduleId}/`);
  },

  /**
   * Get questions for a specific module
   * TESTED ✅ - /api/v1/student-profile/sat/questions/?module={id}
   */
  getModuleQuestions: async (moduleId: number): Promise<SATQuestion[]> => {
    const response = await apiClient.get(`/api/v1/student-profile/sat/questions/?module=${moduleId}`) as SATQuestion[] | PaginatedResponse<SATQuestion>;
    return extractResults(response);
  },

  /**
   * Get questions for entire exam (all modules)
   * TESTED ✅ - /api/v1/student-profile/sat/exams/{id}/questions/
   */
  getExamQuestions: async (examId: number): Promise<SATQuestion[]> => {
    return await apiClient.get(`/api/v1/student-profile/sat/exams/${examId}/questions/`);
  },

  /**
   * Get all my SAT attempts
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/my_attempts/
   */
  getMyAttempts: async (): Promise<SATAttempt[]> => {
    const response = await apiClient.get('/api/v1/student-profile/sat/attempts/my_attempts/') as SATAttempt[] | PaginatedResponse<SATAttempt>;
    return extractResults(response);
  },

  /**
   * Get specific attempt details
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/{id}/
   */
  getAttempt: async (attemptId: number): Promise<SATAttempt> => {
    return await apiClient.get(`/api/v1/student-profile/sat/attempts/${attemptId}/`);
  },

  /**
   * Create new SAT attempt (payment_pending status)
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/
   */
  createAttempt: async (payload: CreateAttemptPayload): Promise<SATAttempt> => {
    return await apiClient.post('/api/v1/student-profile/sat/attempts/', payload);
  },

  /**
   * Pay for SAT exam (deduct 50 coins, start exam)
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/{id}/pay/
   */
  payExam: async (attemptId: number): Promise<SATAttempt> => {
    return await apiClient.post(`/api/v1/student-profile/sat/attempts/${attemptId}/pay/`, {});
  },

  /**
   * Submit answer for a question
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/{id}/submit_answer/
   */
  submitAnswer: async (attemptId: number, payload: SubmitAnswerPayload): Promise<SATAnswer> => {
    return await apiClient.post(
      `/api/v1/student-profile/sat/attempts/${attemptId}/submit_answer/`,
      payload
    );
  },

  /**
   * Complete SAT attempt (calculate scores, trigger AI feedback)
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/{id}/complete/
   */
  completeAttempt: async (attemptId: number): Promise<SATAttempt> => {
    const response = await apiClient.post<{ attempt?: SATAttempt } | SATAttempt>(
      `/api/v1/student-profile/sat/attempts/${attemptId}/complete/`,
      {}
    )
    if ('attempt' in response) {
      if (!response.attempt) {
        throw new Error('SAT completion response did not include attempt data')
      }
      return response.attempt
    }
    return response as SATAttempt
  },

  syncState: async (attemptId: number, payload: SyncSATStatePayload): Promise<SATAttempt> => {
    return await apiClient.post(`/api/v1/student-profile/sat/attempts/${attemptId}/sync_state/`, payload);
  },

  /**
   * Get SAT attempt results with detailed breakdown
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/{id}/results/
   */
  getResults: async (attemptId: number): Promise<SATResults> => {
    return await apiClient.get(`/api/v1/student-profile/sat/attempts/${attemptId}/results/`);
  },

  /**
   * Get SAT statistics and performance analytics
   * TESTED ✅ - /api/v1/student-profile/sat/attempts/statistics/
   */
  getStatistics: async (): Promise<SATStatistics> => {
    return await apiClient.get('/api/v1/student-profile/sat/attempts/statistics/');
  },

  /**
   * Request coin refund for successful attempt (score >= passing_score)
   */
  requestRefund: async (attemptId: number): Promise<{ detail: string; attempt: SATAttempt }> => {
    return await apiClient.post(`/api/v1/student-profile/sat/attempts/${attemptId}/request_refund/`, {});
  },
};

/**
 * Common API Type Definitions
 * Shared types for API requests and responses
 */

// ============================================================================
// COMMON API TYPES
// ============================================================================

/**
 * Pagination response wrapper
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  offset?: number;
  limit?: number;
}

/**
 * Sorting parameters
 */
export interface SortParams {
  ordering?: string; // e.g., '-created_at' for descending
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
}

/**
 * Search parameters
 */
export interface SearchParams {
  search?: string;
}

/**
 * Common filter parameters
 */
export interface FilterParams {
  status?: string;
  type?: string;
  category?: string;
}

/**
 * Standard API error response
 */
export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
  non_field_errors?: string[];
}

/**
 * Success response
 */
export interface SuccessResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: string;
  url: string;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_at: string;
}

/**
 * Generic ID parameter
 */
export interface IdParam {
  id: number | string;
}

// ============================================================================
// QUERY KEY FACTORIES
// ============================================================================

/**
 * Query key factories for React Query
 */
export const queryKeys = {
  // Auth
  auth: ['auth'] as const,
  profile: () => [...queryKeys.auth, 'profile'] as const,

  // Student
  student: ['student'] as const,
  studentStats: () => [...queryKeys.student, 'statistics'] as const,
  studentBalance: () => [...queryKeys.student, 'balance'] as const,

  // LMS
  lms: ['lms'] as const,
  courses: (filters?: any) => [...queryKeys.lms, 'courses', filters] as const,
  course: (id: number) => [...queryKeys.lms, 'courses', id] as const,
  modules: (courseId?: number) => [...queryKeys.lms, 'modules', courseId] as const,
  lessons: (moduleId?: number) => [...queryKeys.lms, 'lessons', moduleId] as const,
  quizzes: (filters?: any) => [...queryKeys.lms, 'quizzes', filters] as const,
  quiz: (id: number) => [...queryKeys.lms, 'quizzes', id] as const,
  assignments: (filters?: any) => [...queryKeys.lms, 'assignments', filters] as const,
  assignment: (id: number) => [...queryKeys.lms, 'assignments', id] as const,
  progress: () => [...queryKeys.lms, 'progress'] as const,

  // Exams
  exams: ['exams'] as const,
  ieltsExams: () => [...queryKeys.exams, 'ielts'] as const,
  ieltsAttempts: () => [...queryKeys.exams, 'ielts', 'attempts'] as const,
  satExams: () => [...queryKeys.exams, 'sat'] as const,
  satAttempts: () => [...queryKeys.exams, 'sat', 'attempts'] as const,

  // Gamification
  gamification: ['gamification'] as const,
  gamificationProfile: () => [...queryKeys.gamification, 'profile'] as const,
  badges: () => [...queryKeys.gamification, 'badges'] as const,
  achievements: () => [...queryKeys.gamification, 'achievements'] as const,
  challenges: () => [...queryKeys.gamification, 'challenges'] as const,
  leaderboard: (type?: string) => [...queryKeys.gamification, 'leaderboard', type] as const,

  // Social
  social: ['social'] as const,
  forums: () => [...queryKeys.social, 'forums'] as const,
  forum: (id: number) => [...queryKeys.social, 'forums', id] as const,
  studyGroups: () => [...queryKeys.social, 'study-groups'] as const,
  studyGroup: (id: number) => [...queryKeys.social, 'study-groups', id] as const,
  feed: () => [...queryKeys.social, 'feed'] as const,
  conversations: () => [...queryKeys.social, 'conversations'] as const,

  // Shop
  shop: ['shop'] as const,
  products: () => [...queryKeys.shop, 'products'] as const,
  orders: () => [...queryKeys.shop, 'orders'] as const,
  coins: () => [...queryKeys.shop, 'coins'] as const,

  // Events & Attendance
  events: ['events'] as const,
  attendance: ['attendance'] as const,

  // Payments
  payments: ['payments'] as const,

  // Support
  support: ['support'] as const,
  tickets: () => [...queryKeys.support, 'tickets'] as const,
  ticket: (id: number) => [...queryKeys.support, 'tickets', id] as const,
};

// ============================================================================
// EXPORT TYPES
// ============================================================================

type QueryKeyFactory = typeof queryKeys;

export type QueryKey = {
  [K in keyof QueryKeyFactory]:
    QueryKeyFactory[K] extends (...args: any[]) => infer R
      ? R
      : QueryKeyFactory[K];
}[keyof QueryKeyFactory];

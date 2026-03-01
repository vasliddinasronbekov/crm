/**
 * LMS (Learning Management System) API Service
 * Handles all LMS-related API calls: courses, modules, lessons, quizzes, assignments
 */

import { apiClient } from './client';
import type {
  Course,
  CourseEnrollment,
  CourseModule,
  Lesson,
  LessonProgress,
  ModuleProgress,
  CourseProgress,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  QuizAnswer,
  Assignment,
  AssignmentSubmission,
  SubmittedFile,
  CourseAnnouncement,
  PaginatedResponse,
  PaginationParams,
  FilterParams,
  SortParams,
} from './sharedTypes';

// ============================================================================
// API ENDPOINTS
// ============================================================================

const ENDPOINTS = {
  // Courses
  COURSES: '/api/v1/student-profile/courses/',
  COURSE_DETAIL: (id: number) => `/api/v1/student-profile/courses/${id}/`,
  COURSE_ENROLL: (id: number) => `/api/v1/student-profile/courses/${id}/enroll/`,
  COURSE_PROGRESS: (id: number) => `/api/v1/lms/course-progress/${id}/`,
  COURSE_ANNOUNCEMENTS: (id: number) => `/api/v1/student-profile/courses/${id}/announcements/`,

  // Modules
  MODULES: '/api/v1/lms/modules/',
  MODULE_DETAIL: (id: number) => `/api/v1/lms/modules/${id}/`,
  MODULE_PROGRESS: (id: number) => `/api/v1/lms/module-progress/${id}/`,

  // Lessons
  LESSONS: '/api/v1/lms/lessons/',
  LESSON_DETAIL: (id: number) => `/api/v1/lms/lessons/${id}/`,
  LESSON_COMPLETE: (id: number) => `/api/v1/lms/lessons/${id}/complete/`,
  LESSON_PROGRESS: '/api/v1/lms/lesson-progress/',
  LESSON_PROGRESS_DETAIL: (id: number) => `/api/v1/lms/lesson-progress/${id}/`,

  // Quizzes
  QUIZZES: '/api/v1/lms/quizzes/',
  QUIZ_DETAIL: (id: number) => `/api/v1/lms/quizzes/${id}/`,
  QUIZ_QUESTIONS: (quizId: number) => `/api/v1/lms/quizzes/${quizId}/questions/`,
  QUIZ_ATTEMPTS: '/api/v1/lms/quiz-attempts/',
  QUIZ_ATTEMPT_DETAIL: (id: number) => `/api/v1/lms/quiz-attempts/${id}/`,
  QUIZ_SUBMIT_ANSWER: (attemptId: number) => `/api/v1/lms/quiz-attempts/${attemptId}/submit_answer/`,
  QUIZ_COMPLETE: (attemptId: number) => `/api/v1/lms/quiz-attempts/${attemptId}/complete/`,

  // Assignments
  ASSIGNMENTS: '/api/v1/lms/assignments/',
  ASSIGNMENT_DETAIL: (id: number) => `/api/v1/lms/assignments/${id}/`,
  ASSIGNMENT_SUBMISSIONS: '/api/v1/lms/assignment-submissions/',
  ASSIGNMENT_SUBMISSION_DETAIL: (id: number) => `/api/v1/lms/assignment-submissions/${id}/`,
  UPLOAD_FILE: '/api/v1/lms/upload-file/',
};

// ============================================================================
// COURSE SERVICE
// ============================================================================

export const courseService = {
  /**
   * Get list of courses
   * @tested ✅ Working
   */
  getCourses: async (
    params?: PaginationParams & FilterParams & SortParams
  ): Promise<PaginatedResponse<Course>> => {
    return apiClient.get(ENDPOINTS.COURSES, { params });
  },

  /**
   * Get course details
   * @tested ✅ Working
   */
  getCourseDetail: async (id: number): Promise<Course> => {
    return apiClient.get(ENDPOINTS.COURSE_DETAIL(id));
  },

  /**
   * Enroll in a course
   */
  enrollCourse: async (id: number): Promise<CourseEnrollment> => {
    return apiClient.post(ENDPOINTS.COURSE_ENROLL(id));
  },

  /**
   * Get course progress for student
   */
  getCourseProgress: async (id: number): Promise<CourseProgress> => {
    return apiClient.get(ENDPOINTS.COURSE_PROGRESS(id));
  },

  /**
   * Get course announcements
   */
  getCourseAnnouncements: async (
    id: number,
    params?: PaginationParams
  ): Promise<PaginatedResponse<CourseAnnouncement>> => {
    return apiClient.get(ENDPOINTS.COURSE_ANNOUNCEMENTS(id), { params });
  },
};

// ============================================================================
// MODULE SERVICE
// ============================================================================

export const moduleService = {
  /**
   * Get list of modules
   */
  getModules: async (
    params?: PaginationParams & { course?: number }
  ): Promise<PaginatedResponse<CourseModule>> => {
    return apiClient.get(ENDPOINTS.MODULES, { params });
  },

  /**
   * Get module details
   */
  getModuleDetail: async (id: number): Promise<CourseModule> => {
    return apiClient.get(ENDPOINTS.MODULE_DETAIL(id));
  },

  /**
   * Get module progress
   */
  getModuleProgress: async (id: number): Promise<ModuleProgress> => {
    return apiClient.get(ENDPOINTS.MODULE_PROGRESS(id));
  },
};

// ============================================================================
// LESSON SERVICE
// ============================================================================

export const lessonService = {
  /**
   * Get list of lessons
   */
  getLessons: async (
    params?: PaginationParams & {
      module?: number
      module_id?: number
      course?: number
      lesson_type?: string
    }
  ): Promise<PaginatedResponse<Lesson>> => {
    return apiClient.get(ENDPOINTS.LESSONS, { params });
  },

  /**
   * Get lesson details
   */
  getLessonDetail: async (id: number): Promise<Lesson> => {
    return apiClient.get(ENDPOINTS.LESSON_DETAIL(id));
  },

  /**
   * Mark lesson as complete
   */
  markLessonComplete: async (id: number): Promise<LessonProgress> => {
    return apiClient.post(ENDPOINTS.LESSON_COMPLETE(id));
  },

  /**
   * Get lesson progress
   */
  getLessonProgress: async (
    params?: PaginationParams & { lesson?: number; student?: number }
  ): Promise<PaginatedResponse<LessonProgress>> => {
    return apiClient.get(ENDPOINTS.LESSON_PROGRESS, { params });
  },

  /**
   * Update lesson progress
   */
  updateLessonProgress: async (
    id: number,
    data: Partial<LessonProgress>
  ): Promise<LessonProgress> => {
    return apiClient.patch(ENDPOINTS.LESSON_PROGRESS_DETAIL(id), data);
  },
};

// ============================================================================
// QUIZ SERVICE
// ============================================================================

export const quizService = {
  /**
   * Get list of quizzes
   * @tested ✅ Working
   */
  getQuizzes: async (
    params?: PaginationParams & { course?: number; module?: number }
  ): Promise<PaginatedResponse<Quiz>> => {
    return apiClient.get(ENDPOINTS.QUIZZES, { params });
  },

  /**
   * Get quiz details
   * @tested ✅ Working
   */
  getQuizDetail: async (id: number): Promise<Quiz> => {
    return apiClient.get(ENDPOINTS.QUIZ_DETAIL(id));
  },

  /**
   * Get quiz questions
   * @tested ✅ Working
   */
  getQuizQuestions: async (quizId: number): Promise<QuizQuestion[]> => {
    return apiClient.get(ENDPOINTS.QUIZ_QUESTIONS(quizId));
  },

  /**
   * Create a quiz attempt (start quiz)
   */
  createQuizAttempt: async (quizId: number): Promise<QuizAttempt> => {
    return apiClient.post(ENDPOINTS.QUIZ_ATTEMPTS, { quiz: quizId });
  },

  /**
   * Get quiz attempts
   * @tested ✅ Working
   */
  getQuizAttempts: async (
    params?: PaginationParams & { quiz?: number }
  ): Promise<PaginatedResponse<QuizAttempt>> => {
    return apiClient.get(ENDPOINTS.QUIZ_ATTEMPTS, { params });
  },

  /**
   * Get quiz attempt details
   */
  getQuizAttemptDetail: async (id: number): Promise<QuizAttempt> => {
    return apiClient.get(ENDPOINTS.QUIZ_ATTEMPT_DETAIL(id));
  },

  /**
   * Submit answer for a quiz question
   */
  submitQuizAnswer: async (attemptId: number, answer: Partial<QuizAnswer>): Promise<QuizAnswer> => {
    return apiClient.post(ENDPOINTS.QUIZ_SUBMIT_ANSWER(attemptId), answer);
  },

  /**
   * Complete quiz attempt
   */
  completeQuizAttempt: async (attemptId: number): Promise<QuizAttempt> => {
    return apiClient.post(ENDPOINTS.QUIZ_COMPLETE(attemptId));
  },
};

// ============================================================================
// ASSIGNMENT SERVICE
// ============================================================================

export const assignmentService = {
  /**
   * Get list of assignments
   * @tested ✅ Working
   */
  getAssignments: async (
    params?: PaginationParams & { course?: number; module?: number; status?: string }
  ): Promise<PaginatedResponse<Assignment>> => {
    return apiClient.get(ENDPOINTS.ASSIGNMENTS, { params });
  },

  /**
   * Get assignment details
   * @tested ✅ Working
   */
  getAssignmentDetail: async (id: number): Promise<Assignment> => {
    return apiClient.get(ENDPOINTS.ASSIGNMENT_DETAIL(id));
  },

  /**
   * Get assignment submissions
   * @tested ✅ Working
   */
  getAssignmentSubmissions: async (
    params?: PaginationParams & { assignment?: number }
  ): Promise<PaginatedResponse<AssignmentSubmission>> => {
    return apiClient.get(ENDPOINTS.ASSIGNMENT_SUBMISSIONS, { params });
  },

  /**
   * Get assignment submission details
   */
  getAssignmentSubmissionDetail: async (id: number): Promise<AssignmentSubmission> => {
    return apiClient.get(ENDPOINTS.ASSIGNMENT_SUBMISSION_DETAIL(id));
  },

  /**
   * Create assignment submission
   */
  createSubmission: async (
    data: Partial<AssignmentSubmission>
  ): Promise<AssignmentSubmission> => {
    return apiClient.post(ENDPOINTS.ASSIGNMENT_SUBMISSIONS, data);
  },

  /**
   * Update assignment submission
   */
  updateSubmission: async (
    id: number,
    data: Partial<AssignmentSubmission>
  ): Promise<AssignmentSubmission> => {
    return apiClient.patch(ENDPOINTS.ASSIGNMENT_SUBMISSION_DETAIL(id), data);
  },

  /**
   * Upload file for assignment
   */
  uploadFile: async (file: FormData): Promise<SubmittedFile> => {
    return apiClient.post(ENDPOINTS.UPLOAD_FILE, file, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Get my submissions for a specific assignment
   */
  getMySubmissions: async (assignmentId: number): Promise<AssignmentSubmission[]> => {
    const response = await apiClient.get<PaginatedResponse<AssignmentSubmission>>(
      ENDPOINTS.ASSIGNMENT_SUBMISSIONS,
      {
        params: { assignment: assignmentId },
      }
    );
    return response.results;
  },
};

// ============================================================================
// COMBINED LMS SERVICE
// ============================================================================

export const lmsService = {
  ...courseService,
  ...moduleService,
  ...lessonService,
  ...quizService,
  ...assignmentService,
};

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './sharedTypes';

// --- Course Hooks ---

export const useCourses = (params?: PaginationParams & FilterParams & SortParams) => {
  return useQuery({
    queryKey: queryKeys.courses(params),
    queryFn: () => courseService.getCourses(params),
  });
};

export const useCourseDetail = (id: number) => {
  return useQuery({
    queryKey: queryKeys.course(id),
    queryFn: () => courseService.getCourseDetail(id),
    enabled: !!id,
  });
};

export const useEnrollCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: courseService.enrollCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses() });
    },
  });
};

export const useCourseProgress = (id: number) => {
  return useQuery({
    queryKey: [...queryKeys.course(id), 'progress'],
    queryFn: () => courseService.getCourseProgress(id),
    enabled: !!id,
  });
};

// --- Module Hooks ---

export const useModules = (params?: PaginationParams & { course?: number }) => {
  return useQuery({
    queryKey: queryKeys.modules(params?.course),
    queryFn: () => moduleService.getModules(params),
  });
};

export const useModuleDetail = (id: number) => {
  return useQuery({
    queryKey: [...queryKeys.lms, 'modules', id],
    queryFn: () => moduleService.getModuleDetail(id),
    enabled: !!id,
  });
};

// --- Lesson Hooks ---

export const useLessons = (params?: PaginationParams & { module?: number }) => {
  return useQuery({
    queryKey: queryKeys.lessons(params?.module),
    queryFn: () => lessonService.getLessons(params),
  });
};

export const useLessonDetail = (id: number) => {
  return useQuery({
    queryKey: [...queryKeys.lms, 'lessons', id],
    queryFn: () => lessonService.getLessonDetail(id),
    enabled: !!id,
  });
};

export const useMarkLessonComplete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: lessonService.markLessonComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
    },
  });
};

// --- Quiz Hooks ---

export const useQuizzes = (params?: PaginationParams & { course?: number; module?: number }) => {
  return useQuery({
    queryKey: queryKeys.quizzes(params),
    queryFn: () => quizService.getQuizzes(params),
  });
};

export const useQuizDetail = (id: number) => {
  return useQuery({
    queryKey: queryKeys.quiz(id),
    queryFn: () => quizService.getQuizDetail(id),
    enabled: !!id,
  });
};

export const useQuizQuestions = (quizId: number) => {
  return useQuery({
    queryKey: [...queryKeys.quiz(quizId), 'questions'],
    queryFn: () => quizService.getQuizQuestions(quizId),
    enabled: !!quizId,
  });
};

export const useCreateQuizAttempt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quizService.createQuizAttempt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes() });
    },
  });
};

export const useSubmitQuizAnswer = () => {
  return useMutation({
    mutationFn: ({ attemptId, answer }: { attemptId: number; answer: Partial<QuizAnswer> }) =>
      quizService.submitQuizAnswer(attemptId, answer),
  });
};

export const useCompleteQuizAttempt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quizService.completeQuizAttempt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress() });
    },
  });
};

// --- Assignment Hooks ---

export const useAssignments = (
  params?: PaginationParams & { course?: number; module?: number; status?: string }
) => {
  return useQuery({
    queryKey: queryKeys.assignments(params),
    queryFn: () => assignmentService.getAssignments(params),
  });
};

export const useAssignmentDetail = (id: number) => {
  return useQuery({
    queryKey: queryKeys.assignment(id),
    queryFn: () => assignmentService.getAssignmentDetail(id),
    enabled: !!id,
  });
};

export const useAssignmentSubmissions = (params?: PaginationParams & { assignment?: number }) => {
  return useQuery({
    queryKey: [...queryKeys.assignments(), 'submissions', params],
    queryFn: () => assignmentService.getAssignmentSubmissions(params),
  });
};

export const useCreateSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignmentService.createSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments() });
    },
  });
};

export const useUpdateSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssignmentSubmission> }) =>
      assignmentService.updateSubmission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments() });
    },
  });
};

export const useUploadAssignmentFile = () => {
  return useMutation({
    mutationFn: assignmentService.uploadFile,
  });
};

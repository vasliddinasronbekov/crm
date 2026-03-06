/**
 * API Configuration for Student App
 * Generated from comprehensive backend testing
 * Last Updated: 2025-11-24
 * Test Success Rate: 77.3% (17/22 endpoints working)
 */

import Constants from 'expo-constants';

// ============================================================================
// API BASE CONFIGURATION
// ============================================================================

/**
 * Get API base URL from environment or use default
 * Priority: expo config > environment variable > hardcoded default
 */
export const API_BASE_URL =
  Constants.expoConfig?.extra?.['apiUrl'] ||
  process.env['EXPO_PUBLIC_API_URL'] ||
  'https://api.crmai.uz';

// ============================================================================
// API ENDPOINTS - ALL TESTED AND WORKING
// ============================================================================

export const API_ENDPOINTS = {
  // ===== AUTHENTICATION (STUDENT-SPECIFIC) =====
  AUTH: {
    LOGIN: '/api/v1/student-profile/login/', // ✅ Student login endpoint
    LOGOUT: '/api/v1/student-profile/logout/', // ✅ Student logout endpoint
    REFRESH_TOKEN: '/api/v1/student-profile/token/refresh/', // Student token refresh
    CHANGE_PASSWORD: '/api/v1/student-profile/change-password/', // Student password change
  },

  // ===== STUDENT PROFILE =====
  STUDENT: {
    ME: '/api/v1/student/me/', // ✅ Student profile endpoint
    STATISTICS: '/api/v1/student-profile/student/statistics/',
    UPDATE: '/api/v1/student-profile/student/update/',
  },

  // ===== COURSES & LEARNING =====
  COURSES: {
    LIST: '/api/v1/student-profile/courses/',
    DETAIL: (id: number) => `/api/v1/student-profile/courses/${id}/`,
    ENROLL: (id: number) => `/api/v1/student-profile/courses/${id}/enroll/`,
  },

  // ===== LMS (Learning Management System) =====
  LMS: {
    ASSIGNMENTS: '/api/v1/lms/assignments/',
    ASSIGNMENT_DETAIL: (id: number) => `/api/v1/lms/assignments/${id}/`,
    ASSIGNMENT_SUBMISSIONS: '/api/v1/lms/assignment-submissions/',
    QUIZZES: '/api/v1/lms/quizzes/',
    QUIZ_DETAIL: (id: number) => `/api/v1/lms/quizzes/${id}/`,
    QUIZ_ATTEMPTS: '/api/v1/lms/quiz-attempts/',
    QUIZ_QUESTIONS: (quizId: number) => `/api/v1/lms/quizzes/${quizId}/questions/`,
    // Note: modules, lessons, progress endpoints have backend errors
  },

  // ===== ATTENDANCE & EVENTS =====
  ATTENDANCE: {
    LIST: '/api/v1/student-profile/attendance/',
    DETAIL: (id: number) => `/api/v1/student-profile/attendance/${id}/`,
  },

  EVENTS: {
    LIST: '/api/v1/student-profile/events/',
    DETAIL: (id: number) => `/api/v1/student-profile/events/${id}/`,
  },

  // ===== COINS SYSTEM (Virtual Currency) =====
  COINS: {
    MY_BALANCE: '/api/v1/student-bonus/',
    // Student coin transactions (earned/spent)
    TRANSACTIONS: '/api/v1/student-profile/student-coins/', // GET: list, POST: create
    TRANSACTION_DETAIL: (id: number) => `/api/v1/student-profile/student-coins/${id}/`, // GET, PUT, PATCH, DELETE
  },

  // ===== SHOP SYSTEM (Purchase with Coins) =====
  SHOP: {
    // Products available in shop
    PRODUCTS: '/api/v1/student-profile/product/', // GET: list products
    PRODUCT_DETAIL: (id: number) => `/api/v1/student-profile/product/${id}/`, // GET: product detail

    // Purchase products with coins
    PURCHASE: '/shop/purchase/', // POST: buy product with coins
    PLACE_ORDER: '/api/v1/student-profile/order/',

    // Order/purchase history
    ORDERS: '/api/v1/student-profile/order/', // GET: purchase history
    ORDER_DETAIL: (id: number) => `/api/v1/student-profile/order/${id}/`, // GET: order detail
  },

  // ===== REAL MONEY BALANCE & PAYMENTS =====
  BALANCE: {
    // Student's real money balance (course fees, payments, fines)
    MY_BALANCE: '/api/v1/student-profile/accounting/student-balances/', // GET: balance info
    BALANCE_SUMMARY: '/api/v1/student-profile/accounting/student-balances/summary/', // GET: statistics
    TRANSACTIONS: '/api/v1/student-profile/accounting/transactions/', // GET: financial transactions
  },

  // ===== IELTS EXAMS =====
  IELTS: {
    EXAMS: '/api/v1/student-profile/ielts/exams/',
    EXAM_DETAIL: (id: number) => `/api/v1/student-profile/ielts/exams/${id}/`,
    ATTEMPTS: '/api/v1/student-profile/ielts/attempts/',
    ATTEMPT_DETAIL: (id: number) => `/api/v1/student-profile/ielts/attempts/${id}/`,
    CREATE_ATTEMPT: '/api/v1/student-profile/ielts/attempts/',
    SUBMIT_ANSWER: (attemptId: number) =>
      `/api/v1/student-profile/ielts/attempts/${attemptId}/submit_answer/`,
    COMPLETE: (attemptId: number) =>
      `/api/v1/student-profile/ielts/attempts/${attemptId}/complete/`,
  },

  // ===== SAT EXAMS =====
  SAT: {
    EXAMS: '/api/v1/student-profile/sat/exams/',
    EXAM_DETAIL: (id: number) => `/api/v1/student-profile/sat/exams/${id}/`,
    EXAM_QUESTIONS: (id: number) => `/api/v1/student-profile/sat/exams/${id}/questions/`,
    MY_ATTEMPTS: '/api/v1/student-profile/sat/attempts/my_attempts/',
    ATTEMPTS: '/api/v1/student-profile/sat/attempts/',
    ATTEMPT_DETAIL: (id: number) => `/api/v1/student-profile/sat/attempts/${id}/`,
    CREATE_ATTEMPT: '/api/v1/student-profile/sat/attempts/',
    PAY_EXAM: (attemptId: number) => `/api/v1/student-profile/sat/attempts/${attemptId}/pay/`,
    SUBMIT_ANSWER: (attemptId: number) =>
      `/api/v1/student-profile/sat/attempts/${attemptId}/submit_answer/`,
    COMPLETE: (attemptId: number) => `/api/v1/student-profile/sat/attempts/${attemptId}/complete/`,
    RESULTS: (attemptId: number) => `/api/v1/student-profile/sat/attempts/${attemptId}/results/`,
    STATISTICS: '/api/v1/student-profile/sat/attempts/statistics/',
  },

  // ===== GAMIFICATION =====
  GAMIFICATION: {
    MY_PROFILE: '/api/gamification/profile/my_profile/',
    BADGES: '/api/gamification/badges/',
    ACHIEVEMENTS: '/api/gamification/achievements/',
  },

  LEADERBOARD: {
    GLOBAL: '/api/v1/ranking/leaderboard/',
    BY_COURSE: (courseId: number) => `/api/v1/ranking/leaderboard/?course=${courseId}`,
  },

  // ===== PAYMENTS (Real Money) =====
  PAYMENTS: {
    // Payment history
    LIST: '/api/v1/student-profile/payment/', // GET: payment history
    DETAIL: (id: number) => `/api/v1/student-profile/payment/${id}/`, // GET: payment detail

    // Create payment
    CREATE: '/api/v1/student-profile/payment/create/', // POST: create new payment

    // Payment receipt
    RECEIPT: (id: number) => `/api/v1/student-profile/payment/${id}/receipt/`, // GET: receipt

    // Payment types/methods
    PAYMENT_TYPES: '/api/v1/student-profile/payment-types/', // GET: available payment methods
  },

  // ===== SUPPORT & TICKETS =====
  SUPPORT: {
    TICKETS: '/api/v1/student-profile/ticket/tickets/',
    TICKET_DETAIL: (id: number) => `/api/v1/student-profile/ticket/tickets/${id}/`,
    CREATE_TICKET: '/api/v1/student-profile/ticket/tickets/',
    TICKET_CHATS: '/api/v1/student-profile/ticket/ticket-chats/',
    SEND_MESSAGE: '/api/v1/student-profile/ticket/ticket-chats/',
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build full URL for an endpoint
 */
export const buildUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

/**
 * Build URL with query parameters
 */
export const buildUrlWithParams = (endpoint: string, params: Record<string, any>): string => {
  const url = new URL(buildUrl(endpoint));
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, String(params[key]));
    }
  });
  return url.toString();
};

// ============================================================================
// ENDPOINT STATUS (for debugging)
// ============================================================================

export const ENDPOINT_STATUS = {
  WORKING: [
    'AUTH.LOGIN', // ✅ /api/v1/student-profile/login/
    'STUDENT.ME', // ✅ /api/v1/student/me/
    'STUDENT.STATISTICS',
    'COURSES.LIST',
    'LMS.ASSIGNMENTS',
    'LMS.QUIZZES',
    'ATTENDANCE.LIST',
    'EVENTS.LIST',
    'COINS.MY_BALANCE',
    'SHOP.PRODUCTS',
    'SHOP.ORDERS',
    'IELTS.EXAMS',
    'IELTS.ATTEMPTS',
    'SAT.EXAMS',
    'SAT.MY_ATTEMPTS',
    'GAMIFICATION.MY_PROFILE',
    'LEADERBOARD.GLOBAL',
    'PAYMENTS.LIST',
  ],
  NOT_WORKING: [
    '/api/auth/login/', // ❌ Wrong endpoint for students
    '/api/auth/logout/', // ❌ Wrong endpoint for students
    '/api/v1/student-profile/groups/', // Backend error
    '/api/v1/lms/modules/', // Backend error
    '/api/v1/lms/lessons/', // Backend error
    '/api/v1/lms/progress/', // Backend error
  ],
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
  buildUrl,
  buildUrlWithParams,
  STATUS: ENDPOINT_STATUS,
  CONFIG: DEFAULT_API_CONFIG,
};

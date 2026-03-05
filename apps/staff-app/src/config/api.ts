import Constants from 'expo-constants';

// API Configuration
export const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.crmai.uz';

// API Endpoints - Fixed to match backend URLs (October 25, 2025)
export const ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login/',
  REFRESH_TOKEN: '/api/auth/token/refresh/',
  LOGOUT: '/api/auth/logout/',
  PROFILE: '/api/auth/profile/',
  CHANGE_PASSWORD: '/api/auth/change-password/',

  // Teacher Profile
  TEACHER_PROFILE: '/api/task/teachers/',
  USER_PROFILE: '/api/task/users/',

  // Groups & Students
  GROUPS: '/api/v1/mentor/group/',
  STUDENTS: '/api/users/students/',  // ✅ FIXED - was /v1/student/
  ATTENDANCE: '/api/v1/mentor/attendance/',

  // Exams & Scores
  EXAM_SCORES: '/api/v1/exam-detail/',

  // Courses
  COURSES: '/api/v1/course/',
  BRANCHES: '/api/v1/super_user/branch/',
  ROOMS: '/api/v1/room/',

  // Tasks
  BOARDS: '/api/task/boards/',
  LISTS: '/api/task/lists/',
  TASKS: '/api/task/tasks/',
  AUTO_TASKS: '/api/task/autotasks/',
  TASKS_BULK_CREATE: '/api/task/tasks-create/',

  // Salary & Payments
  SALARY: '/api/v1/mentor/salary/',
  TEACHER_SALARY: '/api/v1/teacher-salary/',

  // Information & Announcements
  INFORMATION: '/api/v1/information/',
  ANNOUNCEMENTS: '/api/v1/lms/announcements/',

  // LMS Content Management
  MODULES: '/api/v1/lms/modules/',
  LESSONS: '/api/v1/lms/lessons/',
  ASSIGNMENTS: '/api/v1/lms/assignments/',
  ASSIGNMENT_SUBMISSIONS: '/api/v1/lms/assignment-submissions/',
  QUIZZES: '/api/v1/lms/quizzes/',
  QUESTIONS: '/api/v1/lms/questions/',
  QUIZ_ATTEMPTS: '/api/v1/lms/quiz-attempts/',

  // CRM (if teacher has access)
  LEADS: '/api/v1/lead/',
  ACTIVITIES: '/api/v1/crm/activities/',
  PIPELINES: '/api/v1/crm/pipelines/',
  DEALS: '/api/v1/crm/deals/',

  // Analytics
  ANALYTICS: '/api/v1/super_user/analytics/',
  DASHBOARD_STATS: '/api/analytics/dashboard-stats/',
  REPORTS: '/api/analytics/reports/',

  // Additional Student Profile endpoints
  PAYMENT: '/api/v1/payment/',
  PAYMENT_TYPES: '/api/v1/payment-type/',
  EVENTS: '/api/v1/student-profile/events/',
};

export default {
  API_URL,
  ENDPOINTS,
};

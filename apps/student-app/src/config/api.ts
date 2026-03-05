import Constants from 'expo-constants';

// API Configuration
export const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.crmai.uz/api';

// API Endpoints
export const ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login/',
  REFRESH_TOKEN: '/auth/token/refresh/',

  // Student Profile
  STUDENT_PROFILE: '/v1/student',
  STUDENT_STATISTICS: '/v1/student-profile/student/statistics/',
  STUDENT_UPDATE: '/v1/student-profile/student/update/',

  // Courses & Groups
  COURSES: '/v1/course/',
  GROUPS: '/v1/mentor/group/',
  ATTENDANCE: '/v1/mentor/attendance/',

  // Exams & Scores
  EXAM_SCORES: '/v1/exam-detail/',

  // Assignments & Quizzes
  ASSIGNMENTS: '/v1/lms/assignments/',
  ASSIGNMENT_SUBMISSIONS: '/v1/lms/assignment-submissions/',
  QUIZZES: '/v1/lms/quizzes/',
  QUIZ_ATTEMPTS: '/v1/lms/quiz-attempts/',

  // LMS
  MODULES: '/v1/lms/modules/',
  LESSONS: '/v1/lms/lessons/',
  PROGRESS: '/v1/lms/progress/',
  NOTES: '/v1/lms/notes/',

  // Events & Announcements
  EVENTS: '/v1/student-profile/events/',
  INFORMATION: '/v1/information/',
  ANNOUNCEMENTS: '/v1/lms/announcements/',

  // Shop & Coins
  PRODUCTS: '/v1/student-profile/product/',
  ORDERS: '/v1/student-profile/order/',
  STUDENT_COINS: '/v1/student-bonus/',

  // Payments
  PAYMENTS: '/v1/payment/',
  CREATE_PAYMENT: '/v1/student-profile/payment/create/',

  // Support
  TICKETS: '/v1/student-profile/ticket/tickets/',
  TICKET_CHATS: '/v1/student-profile/ticket/ticket-chats/',

  // Leaderboard
  LEADERBOARD: '/v1/ranking/leaderboard/',

  // Stories
  STORIES: '/v1/student-profile/stories/',

  // SAT Exams
  SAT_EXAMS: '/v1/student-profile/sat/exams/',
  SAT_ATTEMPTS: '/v1/student-profile/sat/attempts/',
  SAT_ANSWERS: '/v1/student-profile/sat/answers/',
};

export default {
  API_URL,
  ENDPOINTS,
};

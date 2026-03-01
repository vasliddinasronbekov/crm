/**
 * API Services exports
 * Updated 2025-11-28: Fixed duplicate type exports
 */

export * from './client'
export * from './auth'
export * from './studentAuth'
export * from './courses'
export * from './assignments'
export * from './attendance'
export * from './events'
export * from './groups'

// Quizzes API
export * from './quizzes'

// Gamification API
export * from './gamification'

// Messaging API
export * from './messaging'

// IELTS API - Explicit exports to avoid conflicts
export {
  ieltsApi,
  type IELTSExam,
  type IELTSQuestion,
  type IELTSAttempt,
  type IELTSAnswer,
} from './ielts'

// SAT API - Explicit exports to avoid conflicts
export {
  satApi,
  type SATAIFeedback,
  type SATExam,
  type SATQuestion,
  type SATTopicDiagnostic,
  type SATTopicPerformance,
  type SATAttempt,
  type SATAnswer,
  type SATResults,
  type SATStatistics,
} from './sat'

// Coins API - Virtual currency system
export {
  coinsApi,
  type CoinTransaction,
  type CoinTransactionsResponse,
  type CreateCoinTransactionRequest,
} from './coins'

// Shop API - Purchase with coins
export {
  shopApi,
  type ShopProduct,
  type ShopProductsResponse,
  type ShopOrder,
  type ShopOrdersResponse,
  type PurchaseRequest,
  type PurchaseResponse,
} from './shop'

// Payments API - Real money payments
export {
  paymentsApi,
  type StudentBalance,
  type StudentBalanceResponse,
  type BalanceSummary,
  type Payment,
  type PaymentsResponse,
  type PaymentType,
  type PaymentTypesResponse,
  type AccountTransaction,
  type AccountTransactionsResponse,
  type PaymentStatus,
  type TransactionType,
  tiyinToSum,
  sumToTiyin,
  formatAmount,
} from './payments'

// LMS API - courses, modules, lessons, quizzes, assignments
export {
  courseService,
  moduleService,
  lessonService,
  quizService,
  assignmentService,
  lmsService,
  useCourses,
  useCourseDetail,
  useEnrollCourse,
  useCourseProgress,
  useModules,
  useModuleDetail,
  useLessons,
  useLessonDetail,
  useMarkLessonComplete,
  useQuizzes,
  useQuizDetail,
  useQuizQuestions,
  useCreateQuizAttempt,
  useSubmitQuizAnswer,
  useCompleteQuizAttempt,
  useAssignments,
  useAssignmentDetail,
  useAssignmentSubmissions,
  useCreateSubmission,
  useUpdateSubmission,
  useUploadAssignmentFile,
} from './lms'

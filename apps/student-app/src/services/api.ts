import { createApiClient, AuthApiClient } from '@/packages/api-client';
import storage from './storage'; // Mobile-specific storage
import { API_URL, ENDPOINTS } from '../config/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Mobile-specific token storage using SecureStore
const studentAppTokenStorage = {
  getAccessToken: () => storage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => storage.setItem(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => storage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => storage.setItem(REFRESH_TOKEN_KEY, token),
  clearTokens: () => {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// Create the core API client instance
const api = createApiClient({
  baseURL: API_URL,
  timeout: 30000,
  tokenStorage: studentAppTokenStorage,
  onTokenRefreshFailure: () => {
    // In a mobile app, you might dispatch an action to navigate to login
    console.warn('Token refresh failed, user needs to re-authenticate.');
    // Example: EventBus.emit('AUTH_FAILED');
  },
});

// Extend the AuthApiClient with student-app specific methods
class StudentApiService extends AuthApiClient {
  constructor() {
    super(api, studentAppTokenStorage); // Pass the shared api instance and token storage
  }

  // Student-specific methods
  async getProfile() {
    return this.api.get(ENDPOINTS.STUDENT_PROFILE + '/me/');
  }

  async updateProfile(data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address?: string;
    bio?: string;
    avatar?: any;
  }) {
    // If avatar is included, use FormData
    if (data.avatar) {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (data[key as keyof typeof data] !== undefined) {
          formData.append(key, data[key as keyof typeof data]);
        }
      });
      return this.api.put(ENDPOINTS.STUDENT_UPDATE, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
    return this.api.put(ENDPOINTS.STUDENT_UPDATE, data);
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.api.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  async getStatistics() {
    return this.api.get(ENDPOINTS.STUDENT_STATISTICS);
  }

  async getCourses() {
    return this.api.get(ENDPOINTS.COURSES);
  }

  async getCourseDetails(courseId: number) {
    return this.api.get(`${ENDPOINTS.COURSES}${courseId}/`);
  }

  async getCourseModules(courseId: number) {
    return this.api.get(`${ENDPOINTS.MODULES}?course=${courseId}`);
  }

  async enrollCourse(courseId: number) {
    return this.api.post(`${ENDPOINTS.COURSES}${courseId}/enroll/`);
  }

  async unenrollCourse(courseId: number) {
    return this.api.delete(`${ENDPOINTS.COURSES}${courseId}/unenroll/`);
  }

  async getCourseProgress(courseId: number) {
    return this.api.get(`${ENDPOINTS.PROGRESS}?course=${courseId}`);
  }

  async getGroups() {
    return this.api.get(ENDPOINTS.GROUPS);
  }

  // Assignments
  async getAssignments() {
    return this.api.get(ENDPOINTS.ASSIGNMENTS);
  }

  async getAssignmentDetails(assignmentId: number) {
    return this.api.get(`${ENDPOINTS.ASSIGNMENTS}${assignmentId}/`);
  }

  async getMyAssignmentSubmissions() {
    return this.api.get(ENDPOINTS.ASSIGNMENT_SUBMISSIONS);
  }

  async getAssignmentSubmission(assignmentId: number) {
    return this.api.get(`${ENDPOINTS.ASSIGNMENT_SUBMISSIONS}?assignment=${assignmentId}`);
  }

  async updateAssignmentSubmission(submissionId: number, content: string) {
    return this.api.patch(`${ENDPOINTS.ASSIGNMENT_SUBMISSIONS}${submissionId}/`, {
      content,
    });
  }

  async deleteAssignmentSubmission(submissionId: number) {
    return this.api.delete(`${ENDPOINTS.ASSIGNMENT_SUBMISSIONS}${submissionId}/`);
  }

  async getQuizzes() {
    return this.api.get(ENDPOINTS.QUIZZES);
  }

  async getLessons(moduleId: number) {
    return this.api.get(`${ENDPOINTS.LESSONS}?module=${moduleId}`);
  }

  async getEvents() {
    return this.api.get(ENDPOINTS.EVENTS);
  }

  async getLeaderboard() {
    return this.api.get(ENDPOINTS.LEADERBOARD);
  }

  async getStudentCoins() {
    return this.api.get(ENDPOINTS.STUDENT_COINS);
  }

  async getProducts() {
    return this.api.get(ENDPOINTS.PRODUCTS);
  }

  async purchaseProduct(productId: number, quantity: number) {
    return this.api.post(ENDPOINTS.ORDERS, { product: productId, quantity });
  }

  async submitAssignment(assignmentId: number, data: FormData) {
    return this.api.post(ENDPOINTS.ASSIGNMENT_SUBMISSIONS, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async startQuizAttempt(quizId: number) {
    return this.api.post(ENDPOINTS.QUIZ_ATTEMPTS, { quiz: quizId });
  }

  async getQuizAttempt(attemptId: number) {
    return this.api.get(`${ENDPOINTS.QUIZ_ATTEMPTS}${attemptId}/`);
  }

  async getQuizQuestions(quizId: number) {
    return this.api.get(`${ENDPOINTS.QUIZZES}${quizId}/questions/`);
  }

  async submitQuizAnswer(attemptId: number, questionId: number, answer: any) {
    return this.api.post(`${ENDPOINTS.QUIZ_ATTEMPTS}${attemptId}/submit_answer/`, {
      question: questionId,
      ...answer,
    });
  }

  async submitQuizAttempt(attemptId: number) {
    return this.api.post(`${ENDPOINTS.QUIZ_ATTEMPTS}${attemptId}/submit/`);
  }

  async getMyQuizAttempts(quizId?: number) {
    const endpoint = quizId
      ? `${ENDPOINTS.QUIZ_ATTEMPTS}?quiz=${quizId}`
      : ENDPOINTS.QUIZ_ATTEMPTS;
    return this.api.get(endpoint);
  }

  // Attendance
  async getMyAttendance() {
    return this.api.get(ENDPOINTS.ATTENDANCE);
  }

  async getAttendanceByDateRange(startDate: string, endDate: string) {
    return this.api.get(`${ENDPOINTS.ATTENDANCE}?start_date=${startDate}&end_date=${endDate}`);
  }

  // Payments
  async getPayments() {
    return this.api.get(ENDPOINTS.PAYMENTS);
  }

  async getPaymentDetails(paymentId: number) {
    return this.api.get(`${ENDPOINTS.PAYMENTS}${paymentId}/`);
  }

  async createPayment(amount: number, paymentType: string = 'tuition') {
    return this.api.post(ENDPOINTS.CREATE_PAYMENT, {
      amount,
      payment_type: paymentType,
    });
  }

  async getPaymentReceipt(paymentId: number) {
    return this.api.get(`${ENDPOINTS.PAYMENTS}${paymentId}/receipt/`);
  }

  // Coins & Shop
  async getMyCoins() {
    return this.api.get(ENDPOINTS.STUDENT_COINS);
  }

  async getCoinTransactions() {
    return this.api.get(`${ENDPOINTS.STUDENT_COINS}/transactions/`);
  }

  async getShopProducts() {
    return this.api.get(ENDPOINTS.PRODUCTS);
  }

  async getProductDetails(productId: number) {
    return this.api.get(`${ENDPOINTS.PRODUCTS}${productId}/`);
  }

  async purchaseProduct(productId: number, quantity: number = 1) {
    return this.api.post(ENDPOINTS.ORDERS, {
      product: productId,
      quantity,
    });
  }

  async getMyOrders() {
    return this.api.get(ENDPOINTS.ORDERS);
  }

  // Groups
  async getGroupDetails(groupId: number) {
    return this.api.get(`${ENDPOINTS.GROUPS}${groupId}/`);
  }

  async getGroupMembers(groupId: number) {
    return this.api.get(`${ENDPOINTS.GROUPS}${groupId}/members/`);
  }

  async createTicket(reason: string, text: string) {
    return this.api.post(ENDPOINTS.TICKETS, { reason, text });
  }

  async sendTicketMessage(ticketId: number, message: string, file?: any) {
    const formData = new FormData();
    formData.append('ticket', ticketId.toString());
    formData.append('message', message);
    if (file) {
      formData.append('file', file);
    }

    return this.api.post(ENDPOINTS.TICKET_CHATS, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Voice AI Methods
  async speechToText(audioUri: string) {
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'voice.m4a',
    } as any);

    return this.api.post('/v1/ai/stt/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async textToSpeech(text: string, language: string = 'uz') {
    const response = await this.api.post(
      '/v1/ai/tts/',
      { text, language },
      { responseType: 'blob' }
    );
    return response.data;
  }

  async processIntent(text: string) {
    return this.api.post('/v1/ai/intent/', { text });
  }

  async processVoiceCommand(audioUri: string): Promise<{
    status: string;
    intent: string;
    confidence: number;
    message: string;
    data?: any;
  }> {
    // Step 1: Convert speech to text
    const sttResult = await this.speechToText(audioUri);
    const text = sttResult.corrected || sttResult.raw;

    // Step 2: Process intent
    const intentResult = await this.processIntent(text);

    return {
      status: intentResult.result?.status || 'ok',
      intent: intentResult.nlu?.intent || 'unknown',
      confidence: intentResult.nlu?.confidence || 0,
      message: intentResult.result?.message || text,
      data: intentResult.result?.data,
    };
  }

  // SAT Exam Methods
  async getSATExams() {
    return this.api.get(ENDPOINTS.SAT_EXAMS);
  }

  async getSATExamDetails(examId: number) {
    return this.api.get(`${ENDPOINTS.SAT_EXAMS}${examId}/`);
  }

  async getSATExamQuestions(examId: number) {
    return this.api.get(`${ENDPOINTS.SAT_EXAMS}${examId}/questions/`);
  }

  async getMySATAttempts() {
    return this.api.get(`${ENDPOINTS.SAT_ATTEMPTS}my_attempts/`);
  }

  async getSATAttemptDetails(attemptId: number) {
    return this.api.get(`${ENDPOINTS.SAT_ATTEMPTS}${attemptId}/`);
  }

  async createSATAttempt(examId: number) {
    return this.api.post(ENDPOINTS.SAT_ATTEMPTS, { exam_id: examId });
  }

  async paySATExam(attemptId: number) {
    return this.api.post(`${ENDPOINTS.SAT_ATTEMPTS}${attemptId}/pay/`);
  }

  async submitSATAnswer(attemptId: number, questionId: number, answerGiven: any, timeSpent: number = 0) {
    return this.api.post(`${ENDPOINTS.SAT_ATTEMPTS}${attemptId}/submit_answer/`, {
      question_id: questionId,
      answer_given: answerGiven,
      time_spent_seconds: timeSpent,
    });
  }

  async completeSATAttempt(attemptId: number) {
    return this.api.post(`${ENDPOINTS.SAT_ATTEMPTS}${attemptId}/complete/`);
  }

  async getSATResults(attemptId: number) {
    return this.api.get(`${ENDPOINTS.SAT_ATTEMPTS}${attemptId}/results/`);
  }

  async getSATStatistics() {
    return this.api.get(`${ENDPOINTS.SAT_ATTEMPTS}statistics/`);
  }
}

export default new StudentApiService();
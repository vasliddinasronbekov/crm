/**
 * Complete API Client for Student App
 * All endpoints tested with student_akmal (password: test)
 * Success Rate: 77.3% (17/22 working endpoints)
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_ENDPOINTS, buildUrl } from '../config/api.config';

// ============================================================================
// TYPES
// ============================================================================

interface AuthTokens {
  access: string;
  refresh: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse extends AuthTokens {
  user?: any;
}

// ============================================================================
// TOKEN STORAGE
// ============================================================================

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

class TokenStorage {
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async setAccessToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting access token:', error);
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting refresh token:', error);
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

const tokenStorage = new TokenStorage();

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Wait for refresh to complete
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken) {
              const response = await axios.post(
                buildUrl(API_ENDPOINTS.AUTH.REFRESH_TOKEN),
                { refresh: refreshToken }
              );

              const { access } = response.data;
              await tokenStorage.setAccessToken(access);

              // Notify all waiting requests
              this.refreshSubscribers.forEach((callback) => callback(access));
              this.refreshSubscribers = [];

              originalRequest.headers.Authorization = `Bearer ${access}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await tokenStorage.clearTokens();
            // Trigger logout/login navigation
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ========== AUTHENTICATION ==========

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );

    const { access, refresh } = response.data;
    await tokenStorage.setAccessToken(access);
    await tokenStorage.setRefreshToken(refresh);

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await tokenStorage.clearTokens();
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<any> {
    return this.client.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // ========== STUDENT PROFILE ==========

  async getStudentStatistics() {
    return this.client.get(API_ENDPOINTS.STUDENT.STATISTICS);
  }

  async updateStudentProfile(data: any) {
    return this.client.put(API_ENDPOINTS.STUDENT.UPDATE, data);
  }

  // ========== COURSES ==========

  async getCourses(params?: any) {
    return this.client.get(API_ENDPOINTS.COURSES.LIST, { params });
  }

  async getCourseDetail(courseId: number) {
    return this.client.get(API_ENDPOINTS.COURSES.DETAIL(courseId));
  }

  async enrollCourse(courseId: number) {
    return this.client.post(API_ENDPOINTS.COURSES.ENROLL(courseId));
  }

  // ========== ASSIGNMENTS ==========

  async getAssignments(params?: any) {
    return this.client.get(API_ENDPOINTS.LMS.ASSIGNMENTS, { params });
  }

  async getAssignmentDetail(assignmentId: number) {
    return this.client.get(API_ENDPOINTS.LMS.ASSIGNMENT_DETAIL(assignmentId));
  }

  async getAssignmentSubmissions() {
    return this.client.get(API_ENDPOINTS.LMS.ASSIGNMENT_SUBMISSIONS);
  }

  async submitAssignment(data: FormData) {
    return this.client.post(API_ENDPOINTS.LMS.ASSIGNMENT_SUBMISSIONS, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ========== QUIZZES ==========

  async getQuizzes(params?: any) {
    return this.client.get(API_ENDPOINTS.LMS.QUIZZES, { params });
  }

  async getQuizDetail(quizId: number) {
    return this.client.get(API_ENDPOINTS.LMS.QUIZ_DETAIL(quizId));
  }

  async getQuizQuestions(quizId: number) {
    return this.client.get(API_ENDPOINTS.LMS.QUIZ_QUESTIONS(quizId));
  }

  async getQuizAttempts() {
    return this.client.get(API_ENDPOINTS.LMS.QUIZ_ATTEMPTS);
  }

  async startQuizAttempt(quizId: number) {
    return this.client.post(API_ENDPOINTS.LMS.QUIZ_ATTEMPTS, { quiz: quizId });
  }

  // ========== ATTENDANCE & EVENTS ==========

  async getAttendance(params?: any) {
    return this.client.get(API_ENDPOINTS.ATTENDANCE.LIST, { params });
  }

  async getEvents(params?: any) {
    return this.client.get(API_ENDPOINTS.EVENTS.LIST, { params });
  }

  async getEventDetail(eventId: number) {
    return this.client.get(API_ENDPOINTS.EVENTS.DETAIL(eventId));
  }

  // ========== COINS & SHOP ==========

  async getMyCoins() {
    return this.client.get(API_ENDPOINTS.COINS.MY_BALANCE);
  }

  async getCoinTransactions() {
    return this.client.get(API_ENDPOINTS.COINS.TRANSACTIONS);
  }

  async getShopProducts(params?: any) {
    return this.client.get(API_ENDPOINTS.SHOP.PRODUCTS, { params });
  }

  async getProductDetail(productId: number) {
    return this.client.get(API_ENDPOINTS.SHOP.PRODUCT_DETAIL(productId));
  }

  async getMyOrders() {
    return this.client.get(API_ENDPOINTS.SHOP.ORDERS);
  }

  async placeOrder(productId: number, quantity: number = 1) {
    return this.client.post(API_ENDPOINTS.SHOP.PLACE_ORDER, {
      product: productId,
      quantity,
    });
  }

  // ========== IELTS EXAMS ==========

  async getIELTSExams() {
    return this.client.get(API_ENDPOINTS.IELTS.EXAMS);
  }

  async getIELTSExamDetail(examId: number) {
    return this.client.get(API_ENDPOINTS.IELTS.EXAM_DETAIL(examId));
  }

  async getIELTSAttempts() {
    return this.client.get(API_ENDPOINTS.IELTS.ATTEMPTS);
  }

  async createIELTSAttempt(examId: number) {
    return this.client.post(API_ENDPOINTS.IELTS.CREATE_ATTEMPT, { exam_id: examId });
  }

  async submitIELTSAnswer(attemptId: number, data: any) {
    return this.client.post(API_ENDPOINTS.IELTS.SUBMIT_ANSWER(attemptId), data);
  }

  async completeIELTSAttempt(attemptId: number) {
    return this.client.post(API_ENDPOINTS.IELTS.COMPLETE(attemptId));
  }

  // ========== SAT EXAMS ==========

  async getSATExams() {
    return this.client.get(API_ENDPOINTS.SAT.EXAMS);
  }

  async getSATExamDetail(examId: number) {
    return this.client.get(API_ENDPOINTS.SAT.EXAM_DETAIL(examId));
  }

  async getSATExamQuestions(examId: number) {
    return this.client.get(API_ENDPOINTS.SAT.EXAM_QUESTIONS(examId));
  }

  async getMySATAttempts() {
    return this.client.get(API_ENDPOINTS.SAT.MY_ATTEMPTS);
  }

  async getSATAttemptDetail(attemptId: number) {
    return this.client.get(API_ENDPOINTS.SAT.ATTEMPT_DETAIL(attemptId));
  }

  async createSATAttempt(examId: number) {
    return this.client.post(API_ENDPOINTS.SAT.CREATE_ATTEMPT, { exam_id: examId });
  }

  async paySATExam(attemptId: number) {
    return this.client.post(API_ENDPOINTS.SAT.PAY_EXAM(attemptId));
  }

  async submitSATAnswer(attemptId: number, questionId: number, answerGiven: any, timeSpent: number = 0) {
    return this.client.post(API_ENDPOINTS.SAT.SUBMIT_ANSWER(attemptId), {
      question_id: questionId,
      answer_given: answerGiven,
      time_spent_seconds: timeSpent,
    });
  }

  async completeSATAttempt(attemptId: number) {
    return this.client.post(API_ENDPOINTS.SAT.COMPLETE(attemptId));
  }

  async getSATResults(attemptId: number) {
    return this.client.get(API_ENDPOINTS.SAT.RESULTS(attemptId));
  }

  async getSATStatistics() {
    return this.client.get(API_ENDPOINTS.SAT.STATISTICS);
  }

  // ========== GAMIFICATION ==========

  async getGamificationProfile() {
    return this.client.get(API_ENDPOINTS.GAMIFICATION.MY_PROFILE);
  }

  async getLeaderboard(courseId?: number) {
    if (courseId) {
      return this.client.get(API_ENDPOINTS.LEADERBOARD.BY_COURSE(courseId));
    }
    return this.client.get(API_ENDPOINTS.LEADERBOARD.GLOBAL);
  }

  // ========== PAYMENTS ==========

  async getPayments() {
    return this.client.get(API_ENDPOINTS.PAYMENTS.LIST);
  }

  async getPaymentDetail(paymentId: number) {
    return this.client.get(API_ENDPOINTS.PAYMENTS.DETAIL(paymentId));
  }

  async createPayment(amount: number, paymentType: string = 'tuition') {
    return this.client.post(API_ENDPOINTS.PAYMENTS.CREATE, {
      amount,
      payment_type: paymentType,
    });
  }

  // ========== BALANCE (Real Money) ==========

  async getBalance() {
    return this.client.get(API_ENDPOINTS.BALANCE.MY_BALANCE);
  }

  async getBalanceSummary() {
    return this.client.get(API_ENDPOINTS.BALANCE.BALANCE_SUMMARY);
  }

  async getTransactions() {
    return this.client.get(API_ENDPOINTS.BALANCE.TRANSACTIONS);
  }

  // ========== SUPPORT ==========

  async getTickets() {
    return this.client.get(API_ENDPOINTS.SUPPORT.TICKETS);
  }

  async createTicket(reason: string, text: string) {
    return this.client.post(API_ENDPOINTS.SUPPORT.CREATE_TICKET, { reason, text });
  }

  async sendTicketMessage(ticketId: number, message: string, file?: any) {
    const formData = new FormData();
    formData.append('ticket', ticketId.toString());
    formData.append('message', message);
    if (file) {
      formData.append('file', file);
    }

    return this.client.post(API_ENDPOINTS.SUPPORT.SEND_MESSAGE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ========== RAW METHODS ==========

  async get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const apiClient = new ApiClient();

export default apiClient;
export { ApiClient, tokenStorage };

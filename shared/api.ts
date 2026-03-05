/**
 * API Client Configuration
 * Shared across Mobile & Web apps
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.crmai.uz',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8008',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token)
apiClient.interceptors.request.use(
  async (config) => {
    // For React Native, use AsyncStorage
    // For Web, use localStorage
    let token: string | null = null;

    if (typeof window !== 'undefined') {
      // Web
      token = localStorage.getItem('access_token');
    } else {
      // Mobile - will be set in the app
      // This is just a placeholder
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (handle token refresh)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refresh_token')
          : null;

        if (refreshToken) {
          const response = await axios.post(
            `${API_CONFIG.BASE_URL}/api/auth/token/refresh/`,
            { refresh: refreshToken }
          );

          const { access } = response.data;

          // Save new token
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', access);
          }

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  auth: {
    login: '/api/auth/login/',
    studentLogin: '/api/v1/student-profile/login/',
    refresh: '/api/auth/token/refresh/',
    logout: '/api/auth/logout/',
  },

  // CRM
  crm: {
    leads: '/api/v1/lead/',
    sources: '/api/v1/source/',
    departments: '/api/v1/lead-department/',
    subDepartments: '/api/v1/sub-department/',
  },

  // LMS
  lms: {
    courses: '/api/v1/course/',
    groups: '/api/v1/mentor/group/',
    attendance: '/api/v1/mentor/attendance/',
    payments: '/api/v1/payment/',
    examScores: '/api/v1/exam-detail/',
    students: '/api/v1/student/',
  },

  // AI Services
  ai: {
    tts: '/api/v1/ai/tts/',
    stt: '/api/v1/ai/stt/',
    intent: '/api/v1/ai/intent/',
  },

  // Analytics
  analytics: {
    dashboard: '/api/v1/super_user/analytics/',
    leaderboard: '/api/v1/ranking/leaderboard/',
  },

  // Messaging
  messaging: {
    templates: '/api/v1/message-template/',
    smsHistory: '/api/v1/sms-history/',
    send: '/api/v1/send-message/',
  },
};

// API Service Functions
export const AuthAPI = {
  login: (username: string, password: string) =>
    apiClient.post(API_ENDPOINTS.auth.login, { username, password }),

  studentLogin: (username: string, password: string) =>
    apiClient.post(API_ENDPOINTS.auth.studentLogin, { username, password }),

  refreshToken: (refresh: string) =>
    apiClient.post(API_ENDPOINTS.auth.refresh, { refresh }),
};

export const CRMAPI = {
  getLeads: (params?: any) =>
    apiClient.get(API_ENDPOINTS.crm.leads, { params }),

  createLead: (data: any) =>
    apiClient.post(API_ENDPOINTS.crm.leads, data),

  updateLead: (id: number, data: any) =>
    apiClient.put(`${API_ENDPOINTS.crm.leads}${id}/`, data),

  deleteLead: (id: number) =>
    apiClient.delete(`${API_ENDPOINTS.crm.leads}${id}/`),

  getSources: () =>
    apiClient.get(API_ENDPOINTS.crm.sources),
};

export const LMSAPI = {
  getCourses: () =>
    apiClient.get(API_ENDPOINTS.lms.courses),

  getGroups: () =>
    apiClient.get(API_ENDPOINTS.lms.groups),

  getAttendance: (params?: any) =>
    apiClient.get(API_ENDPOINTS.lms.attendance, { params }),

  getPayments: (params?: any) =>
    apiClient.get(API_ENDPOINTS.lms.payments, { params }),

  getExamScores: (studentId?: number) =>
    apiClient.get(API_ENDPOINTS.lms.examScores, {
      params: studentId ? { student: studentId } : undefined
    }),
};

export const AIAPI = {
  textToSpeech: (text: string, language: string = 'uz') =>
    apiClient.post(API_ENDPOINTS.ai.tts, { text, language }, {
      responseType: 'arraybuffer'
    }),

  speechToText: (audioFile: File | Blob) => {
    const formData = new FormData();
    formData.append('file', audioFile);
    return apiClient.post(API_ENDPOINTS.ai.stt, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  recognizeIntent: (text: string) =>
    apiClient.post(API_ENDPOINTS.ai.intent, { text }),
};

// WebSocket helper
export class VoiceWebSocket {
  private ws: WebSocket | null = null;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  connect(onMessage: (data: any) => void, onError?: (error: any) => void) {
    this.ws = new WebSocket(`${API_CONFIG.WS_URL}/ws/voice/`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.ws?.send(JSON.stringify({
        type: 'auth',
        token: this.token
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}

export default apiClient;

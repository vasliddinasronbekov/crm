/**
 * API Service
 *
 * Handles all API calls to the EduVoice backend
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.crmai.uz/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        await AsyncStorage.setItem('access_token', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login/', { email, password });
    return response.data;
  },

  logout: async () => {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    await api.post('/auth/logout/', { refresh: refreshToken });
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/profile/');
    return response.data;
  },
};

// Student API
export const studentAPI = {
  getMyChildren: async () => {
    const response = await api.get('/v1/student/');
    return response.data;
  },

  getStudentDetails: async (studentId: number) => {
    const response = await api.get(`/v1/student/${studentId}/`);
    return response.data;
  },

  getStudentProgress: async (studentId: number) => {
    const response = await api.get(`/v1/lms/progress/?student=${studentId}`);
    return response.data;
  },

  getStudentAttendance: async (studentId: number) => {
    const response = await api.get(`/student-profile/attendance/?student=${studentId}`);
    return response.data;
  },

  getStudentGrades: async (studentId: number) => {
    const response = await api.get(`/student-profile/exam-scores/?student=${studentId}`);
    return response.data;
  },

  getStudentStatistics: async (studentId: number) => {
    const response = await api.get(`/v1/student-profile/student/statistics/?student_id=${studentId}`);
    return response.data;
  },
};

// Messaging API
export const messagingAPI = {
  getConversations: async () => {
    const response = await api.get('/social/conversations/');
    return response.data;
  },

  getMessages: async (conversationId: number) => {
    const response = await api.get(`/social/conversations/${conversationId}/messages/`);
    return response.data;
  },

  sendMessage: async (conversationId: number, content: string) => {
    const response = await api.post(`/social/conversations/${conversationId}/send_message/`, {
      content,
    });
    return response.data;
  },

  createConversation: async (participantIds: number[], title?: string) => {
    const response = await api.post('/social/conversations/', {
      participants: participantIds,
      conversation_type: 'direct',
      title,
    });
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async () => {
    const response = await api.get('/social/notifications/');
    return response.data;
  },

  markAsRead: async (notificationId: number) => {
    const response = await api.post(`/social/notifications/${notificationId}/mark_read/`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post('/social/notifications/mark_all_read/');
    return response.data;
  },
};

// Courses API
export const coursesAPI = {
  getCourses: async () => {
    const response = await api.get('/student-profile/courses/');
    return response.data;
  },

  getCourseDetails: async (courseId: number) => {
    const response = await api.get(`/student-profile/courses/${courseId}/`);
    return response.data;
  },

  getCourseModules: async (courseId: number) => {
    const response = await api.get(`/v1/lms/modules/?course=${courseId}`);
    return response.data;
  },
};

// Gamification API
export const gamificationAPI = {
  getUserLevel: async (userId: number) => {
    const response = await api.get(`/gamification/levels/?user=${userId}`);
    return response.data;
  },

  getUserBadges: async (userId: number) => {
    const response = await api.get(`/gamification/badges/?user=${userId}`);
    return response.data;
  },

  getLeaderboard: async () => {
    const response = await api.get('/gamification/leaderboard/');
    return response.data;
  },
};

export default api;

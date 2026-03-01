/**
 * Student Auth API - Student authentication endpoints
 * Updated 2025-11-29: Using STUDENT-SPECIFIC endpoints
 * Student login: /api/v1/student-profile/login/
 * Student profile: /api/v1/student/me/
 */

import { apiClient } from './client'
import { useAuthStore, User } from '../../stores/authStore'

// ============================================================================
// ENDPOINTS
// ============================================================================

const AUTH_ENDPOINTS = {
  LOGIN: '/api/v1/student-profile/login/',
  LOGOUT: '/api/v1/student-profile/logout/',
  REFRESH_TOKEN: '/api/v1/student-profile/token/refresh/',
  CHANGE_PASSWORD: '/api/v1/student-profile/change-password/',
}

const STUDENT_ENDPOINTS = {
  ME: '/api/v1/student/me/',
  STATISTICS: '/api/v1/student-profile/student/statistics/',
  UPDATE: '/api/v1/student-profile/student/update/',
}

// ============================================================================
// TYPES
// ============================================================================

interface StudentLoginRequest {
  username: string
  password: string
}

interface StudentLoginResponse {
  access: string
  refresh: string
  user?: {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
  }
}

interface StudentStatsResponse {
  total_courses: number
  completed_courses: number
  pending_assignments: number
  average_grade: number
  attendance_rate: number
  total_coins: number
}

export const studentAuthApi = {
  /**
   * Login student
   * ✅ Uses STUDENT-SPECIFIC endpoint: /api/v1/student-profile/login/
   */
  login: async (data: StudentLoginRequest): Promise<StudentLoginResponse> => {
    try {
      useAuthStore.getState().setLoading(true)

      // Using the STUDENT-SPECIFIC login endpoint
      const response = await apiClient.post<StudentLoginResponse>(
        AUTH_ENDPOINTS.LOGIN, // ✅ /api/v1/student-profile/login/
        data
      )

      // Map student data to User interface
      const user: User = {
        id: response.user?.id?.toString() || '0',
        email: response.user?.email || data.username,
        full_name: response.user?.first_name
          ? `${response.user.first_name} ${response.user.last_name || ''}`.trim()
          : data.username,
        role: 'student',
        avatar: undefined,
        phone: undefined,
      }

      // Store tokens and user
      useAuthStore.getState().setTokens(response.access, response.refresh)
      useAuthStore.getState().setUser(user)
      useAuthStore.getState().setLoading(false)

      return response
    } catch (error) {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setError('Login failed. Please check your credentials.')
      throw error
    }
  },

  /**
   * Logout student
   * ✅ Uses STUDENT-SPECIFIC endpoint: /api/v1/student-profile/logout/
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post(AUTH_ENDPOINTS.LOGOUT) // ✅ /api/v1/student-profile/logout/
    } catch (error) {
      // Ignore errors on logout - just clear local state
      console.error('Logout error:', error)
    } finally {
      useAuthStore.getState().logout()
    }
  },

  /**
   * Get student profile
   * ✅ Uses STUDENT-SPECIFIC endpoint: /api/v1/student/me/
   */
  getProfile: async (): Promise<any> => {
    const response = await apiClient.get<any>(
      STUDENT_ENDPOINTS.ME // ✅ /api/v1/student/me/
    )
    return response
  },

  /**
   * Get student statistics
   * ✅ Fallback if /api/v1/student/me/ doesn't work
   */
  getStatistics: async (): Promise<StudentStatsResponse> => {
    const response = await apiClient.get<StudentStatsResponse>(
      STUDENT_ENDPOINTS.STATISTICS
    )
    return response
  },

  /**
   * Update student profile
   * ✅ Uses /api/v1/student-profile/student/update/
   */
  updateProfile: async (data: any): Promise<any> => {
    const response = await apiClient.put(STUDENT_ENDPOINTS.UPDATE, data)
    return response
  },
}

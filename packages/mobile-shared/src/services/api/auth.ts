/**
 * Auth API - Authentication endpoints
 */

import { apiClient } from './client'
import { useAuthStore, User } from '../../stores/authStore'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  access: string
  refresh: string
  user: User
}

interface RegisterRequest {
  email: string
  password: string
  full_name: string
  role: 'student' | 'teacher' | 'parent'
}

export const authApi = {
  /**
   * Login user
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      useAuthStore.getState().setLoading(true)

      const response = await apiClient.post<LoginResponse>('/auth/login/', data)

      // Store tokens and user
      useAuthStore.getState().setTokens(response.access, response.refresh)
      useAuthStore.getState().setUser(response.user)
      useAuthStore.getState().setLoading(false)

      return response
    } catch (error) {
      useAuthStore.getState().setError('Login failed. Please check your credentials.')
      throw error
    }
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout/')
    } catch (error) {
      // Ignore errors on logout
      console.error('Logout error:', error)
    } finally {
      useAuthStore.getState().logout()
    }
  },

  /**
   * Register new user
   */
  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    try {
      useAuthStore.getState().setLoading(true)

      const response = await apiClient.post<LoginResponse>('/auth/register/', data)

      // Store tokens and user
      useAuthStore.getState().setTokens(response.access, response.refresh)
      useAuthStore.getState().setUser(response.user)
      useAuthStore.getState().setLoading(false)

      return response
    } catch (error) {
      useAuthStore.getState().setError('Registration failed. Please try again.')
      throw error
    }
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/profile/')
    useAuthStore.getState().setUser(response)
    return response
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<User>('/users/profile/', data)
    useAuthStore.getState().updateUser(response)
    return response
  },

  /**
   * Change password
   */
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    })
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post('/auth/password-reset/', { email })
  },

  /**
   * Confirm password reset
   */
  confirmPasswordReset: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/password-reset/confirm/', {
      token,
      new_password: newPassword,
    })
  },
}

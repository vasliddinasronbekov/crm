/**
 * API Client - Axios instance with interceptors
 * Handles authentication, token refresh, and error handling
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'
import { useAuthStore } from '../../stores/authStore'
import { API_CONFIG } from '../../config/api'

// API Base URL from config
export const API_BASE_URL = API_CONFIG.BASE_URL

// Create axios instance
const rawApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Add authentication token
rawApiClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState()

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle token refresh and errors
rawApiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Get refresh token
        const { refreshToken } = useAuthStore.getState()

        if (!refreshToken) {
          // No refresh token, logout user
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }

        // Attempt to refresh access token
        // TESTED ✅ - Uses /api/auth/token/refresh/
        const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
          refresh: refreshToken,
        })

        const { access } = response.data

        // Update tokens in store
        useAuthStore.getState().setTokens(access, refreshToken)

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`
        }

        return rawApiClient(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      }
    }

    // Handle other errors
    return Promise.reject(error)
  }
)

// Auto-retry failed requests (network errors, rate limits)
axiosRetry(rawApiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429 // Rate limit
    )
  },
})

type TypedApiClient = Pick<AxiosInstance, 'defaults' | 'interceptors'> & {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
}

export const apiClient: TypedApiClient = {
  defaults: rawApiClient.defaults,
  interceptors: rawApiClient.interceptors,
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    rawApiClient.get<T, T>(url, config),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    rawApiClient.post<T, T>(url, data, config),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    rawApiClient.put<T, T>(url, data, config),
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    rawApiClient.patch<T, T>(url, data, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    rawApiClient.delete<T, T>(url, config),
}

// Helper function to handle API errors
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string; message?: string }>

    if (axiosError.response?.data) {
      return (
        axiosError.response.data.detail ||
        axiosError.response.data.message ||
        'An error occurred'
      )
    }

    if (axiosError.message) {
      return axiosError.message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unknown error occurred'
}

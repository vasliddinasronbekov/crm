// ==========================================
// AUTHENTICATION HOOK
// Works for Web (Next.js) and Mobile (React Native)
// ==========================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiClient } from '@edu-platform/api-client'
import type { User, LoginResponse, ApiError } from '@edu-platform/types'
import {
  saveTokens,
  getAccessToken,
  getRefreshToken,
  getUserData,
  clearTokens,
} from './auth-storage'

interface AuthContextValue {
  user: Partial<User> | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<Partial<User> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth()
  }, [])

  async function initializeAuth() {
    try {
      setIsLoading(true)

      // Check if we have tokens
      const accessToken = await getAccessToken()
      const refreshToken = await getRefreshToken()

      if (!accessToken || !refreshToken) {
        setIsLoading(false)
        return
      }

      // Set tokens in API client
      apiClient.setTokens(accessToken, refreshToken)

      // Get stored user data
      const userData = await getUserData()
      if (userData) {
        setUser(userData)
      }

      // Optionally: Fetch fresh user data from API
      // const freshUserData = await apiClient.getCurrentUser()
      // setUser(freshUserData)
    } catch (err) {
      console.error('Auth initialization failed:', err)
      await clearTokens()
      apiClient.clearTokens()
    } finally {
      setIsLoading(false)
    }
  }

  async function login(username: string, password: string) {
    try {
      setIsLoading(true)
      setError(null)

      // Call API
      const response: LoginResponse = await apiClient.login(username, password)

      // Save tokens and user data
      await saveTokens(response)

      // Update state
      const userData: Partial<User> = {
        id: response.id,
        first_name: response.first_name,
        student_branch: response.student_branch,
        gender: response.gender as 'male' | 'female' | undefined,
        birthday: response.birthday,
        balance: response.balance,
      }
      setUser(userData)
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.detail || apiError.message || 'Login failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    try {
      setIsLoading(true)

      // Clear API client
      apiClient.logout()

      // Clear storage
      await clearTokens()

      // Clear state
      setUser(null)
      setError(null)
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function clearError() {
    setError(null)
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    error,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export type for external use
export type { AuthContextValue }

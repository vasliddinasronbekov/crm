// ==========================================
// AUTH STORAGE UTILITIES
// Works for both Web and Mobile
// ==========================================

import type { LoginResponse, User } from '@edu-platform/types'

const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user_data'

// Storage interface - can be implemented for web or mobile
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

// Web Storage (localStorage)
export class WebStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  }
}

// Default to web storage (will be overridden in mobile apps)
let storage: StorageAdapter = new WebStorage()

export function setStorageAdapter(adapter: StorageAdapter) {
  storage = adapter
}

// ----- TOKEN MANAGEMENT -----

export async function saveTokens(data: LoginResponse): Promise<void> {
  try {
    await storage.setItem(TOKEN_KEY, data.access)
    await storage.setItem(REFRESH_TOKEN_KEY, data.refresh)

    // Store user data
    const userData: Partial<User> = {
      id: data.id,
      first_name: data.first_name,
      student_branch: data.student_branch,
      gender: data.gender as 'male' | 'female' | undefined,
      birthday: data.birthday,
      balance: data.balance,
    }
    await storage.setItem(USER_KEY, JSON.stringify(userData))
  } catch (error) {
    console.error('Failed to save tokens:', error)
    throw error
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await storage.getItem(TOKEN_KEY)
  } catch (error) {
    console.error('Failed to get access token:', error)
    return null
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await storage.getItem(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.error('Failed to get refresh token:', error)
    return null
  }
}

export async function getUserData(): Promise<Partial<User> | null> {
  try {
    const data = await storage.getItem(USER_KEY)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to get user data:', error)
    return null
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await storage.removeItem(TOKEN_KEY)
    await storage.removeItem(REFRESH_TOKEN_KEY)
    await storage.removeItem(USER_KEY)
  } catch (error) {
    console.error('Failed to clear tokens:', error)
    throw error
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken()
  return token !== null
}

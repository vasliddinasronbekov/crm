/**
 * Comprehensive Error Handling Utilities
 */

import toast from 'react-hot-toast'

export interface ApiError {
  message: string
  detail?: string
  code?: string
  field?: string
  status?: number
}

/**
 * Extract error message from various error formats
 * @param error - Error object from API or other sources
 * @returns User-friendly error message
 */
export function extractErrorMessage(error: any): string {
  // Axios error response
  if (error.response?.data) {
    const data = error.response.data

    // Django REST Framework error format
    if (data.detail) {
      return data.detail
    }

    // Field-specific errors
    if (typeof data === 'object' && !Array.isArray(data)) {
      const firstKey = Object.keys(data)[0]
      if (firstKey && Array.isArray(data[firstKey])) {
        return `${firstKey}: ${data[firstKey][0]}`
      }
      if (firstKey && typeof data[firstKey] === 'string') {
        return `${firstKey}: ${data[firstKey]}`
      }
    }

    // Array of errors
    if (Array.isArray(data) && data.length > 0) {
      return data[0]
    }

    // String error
    if (typeof data === 'string') {
      return data
    }
  }

  // Standard error message
  if (error.message) {
    return error.message
  }

  // Network errors
  if (error.request && !error.response) {
    return 'Network error. Please check your connection.'
  }

  // Unknown error
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Handle API error with toast notification
 * @param error - Error object
 * @param defaultMessage - Fallback message
 * @returns Formatted error message
 */
export function handleApiError(error: any, defaultMessage?: string): string {
  const message = extractErrorMessage(error)
  const displayMessage = defaultMessage || message

  toast.error(displayMessage)
  console.error('API Error:', error)

  return message
}

/**
 * Handle form validation errors
 * @param error - Error object
 * @returns Object with field names as keys and error messages as values
 */
export function extractFieldErrors(error: any): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  if (error.response?.data && typeof error.response.data === 'object') {
    const data = error.response.data

    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) {
        fieldErrors[key] = data[key][0]
      } else if (typeof data[key] === 'string') {
        fieldErrors[key] = data[key]
      }
    })
  }

  return fieldErrors
}

/**
 * Check if error is authentication error
 * @param error - Error object
 * @returns True if 401 or 403 error
 */
export function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

/**
 * Check if error is validation error
 * @param error - Error object
 * @returns True if 400 error
 */
export function isValidationError(error: any): boolean {
  return error.response?.status === 400
}

/**
 * Check if error is not found error
 * @param error - Error object
 * @returns True if 404 error
 */
export function isNotFoundError(error: any): boolean {
  return error.response?.status === 404
}

/**
 * Check if error is server error
 * @param error - Error object
 * @returns True if 500+ error
 */
export function isServerError(error: any): boolean {
  return error.response?.status >= 500
}

/**
 * Get appropriate retry delay based on error
 * @param error - Error object
 * @param attempt - Current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(error: any, attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s
  const baseDelay = 1000
  const maxDelay = 10000

  // Rate limit errors should wait longer
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after']
    if (retryAfter) {
      return parseInt(retryAfter) * 1000
    }
    return 60000 // 1 minute
  }

  // Server errors use exponential backoff
  if (isServerError(error)) {
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  }

  // Default delay
  return baseDelay
}

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param shouldRetry - Function to determine if error is retryable
 * @returns Result of function or throws last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  shouldRetry: (error: any) => boolean = isServerError
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if error is not retryable
      if (!shouldRetry(error)) {
        throw error
      }

      // Don't wait after last attempt
      if (attempt < maxAttempts - 1) {
        const delay = getRetryDelay(error, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Safe async operation wrapper
 * @param fn - Async function to execute
 * @param onError - Error handler
 * @param onSuccess - Success handler
 * @returns Result or null on error
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: any) => void,
  onSuccess?: (result: T) => void
): Promise<T | null> {
  try {
    const result = await fn()
    onSuccess?.(result)
    return result
  } catch (error) {
    if (onError) {
      onError(error)
    } else {
      handleApiError(error)
    }
    return null
  }
}

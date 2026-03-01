/**
 * Comprehensive Error Handling Utilities
 */

import { AxiosError } from 'axios'
import toast from 'react-hot-toast'

export interface ApiError {
  message: string
  code?: string
  field?: string
  details?: Record<string, string[]>
}

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
  // Axios error
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>

    // Network error
    if (!axiosError.response) {
      return 'Network error. Please check your connection.'
    }

    const data = axiosError.response?.data

    // DRF validation errors
    if (data && typeof data === 'object') {
      // Single error message
      if (data.detail) return data.detail
      if (data.message) return data.message
      if (data.error) return data.error

      // Field-specific errors
      if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
        return data.non_field_errors[0]
      }

      // Extract first field error
      for (const key in data) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          return `${key}: ${data[key][0]}`
        }
        if (typeof data[key] === 'string') {
          return `${key}: ${data[key]}`
        }
      }
    }

    // HTTP status messages
    if (axiosError.response?.status === 401) {
      return 'Authentication failed. Please login again.'
    }
    if (axiosError.response?.status === 403) {
      return 'You do not have permission to perform this action.'
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found.'
    }
    if (axiosError.response?.status === 500) {
      return 'Server error. Please try again later.'
    }

    return `Request failed with status ${axiosError.response?.status}`
  }

  // Error object
  if (error instanceof Error) {
    return error.message
  }

  // String error
  if (typeof error === 'string') {
    return error
  }

  // Unknown error
  return 'An unexpected error occurred'
}

/**
 * Parse detailed error information
 */
export function parseApiError(error: unknown): ApiError {
  const message = extractErrorMessage(error)

  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>
    const data = axiosError.response?.data

    return {
      message,
      code: data?.code || axiosError.code,
      details: typeof data === 'object' ? data : undefined,
    }
  }

  return { message }
}

/**
 * Display error toast notification
 */
export function showErrorToast(error: unknown, title?: string) {
  const message = extractErrorMessage(error)
  toast.error(title ? `${title}: ${message}` : message, {
    duration: 5000,
    position: 'top-right',
  })
}

/**
 * Display success toast notification
 */
export function showSuccessToast(message: string) {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  })
}

/**
 * Display info toast notification
 */
export function showInfoToast(message: string) {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  })
}

/**
 * Display loading toast and return toast ID for updates
 */
export function showLoadingToast(message: string) {
  return toast.loading(message, {
    position: 'top-right',
  })
}

/**
 * Update existing toast
 */
export function updateToast(toastId: string, message: string, type: 'success' | 'error' | 'info') {
  if (type === 'success') {
    toast.success(message, { id: toastId })
  } else if (type === 'error') {
    toast.error(message, { id: toastId })
  } else {
    toast(message, { id: toastId })
  }
}

/**
 * Async operation wrapper with error handling and loading states
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options?: {
    loadingMessage?: string
    successMessage?: string
    errorTitle?: string
    onSuccess?: (data: T) => void
    onError?: (error: unknown) => void
    showLoading?: boolean
    showSuccess?: boolean
    showError?: boolean
  }
): Promise<T | null> {
  const {
    loadingMessage = 'Processing...',
    successMessage,
    errorTitle,
    onSuccess,
    onError,
    showLoading = false,
    showSuccess = true,
    showError = true,
  } = options || {}

  let toastId: string | undefined

  try {
    if (showLoading) {
      toastId = showLoadingToast(loadingMessage)
    }

    const result = await operation()

    if (toastId) {
      toast.dismiss(toastId)
    }

    if (showSuccess && successMessage) {
      showSuccessToast(successMessage)
    }

    onSuccess?.(result)
    return result
  } catch (error) {
    if (toastId) {
      toast.dismiss(toastId)
    }

    if (showError) {
      showErrorToast(error, errorTitle)
    }

    onError?.(error)
    throw error
  }
}

/**
 * Retry logic for failed operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Don't retry on client errors (4xx)
      if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status && axiosError.response.status < 500) {
          throw error
        }
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)))
      }
    }
  }

  throw lastError
}

/**
 * Error boundary helper for logging
 */
export function logError(error: unknown, context?: string) {
  const errorInfo = parseApiError(error)

  console.error('[Error]', {
    context,
    message: errorInfo.message,
    code: errorInfo.code,
    details: errorInfo.details,
    timestamp: new Date().toISOString(),
  })

  // In production, send to error tracking service (Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with error tracking service
  }
}

/**
 * Validation error helpers
 */
export function hasValidationError(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object' || !('isAxiosError' in error)) {
    return false
  }

  const axiosError = error as AxiosError<any>
  const data = axiosError.response?.data

  return data && typeof data === 'object' && field in data
}

export function getValidationError(error: unknown, field: string): string | null {
  if (!hasValidationError(error, field)) {
    return null
  }

  const axiosError = error as AxiosError<any>
  const data = axiosError.response?.data
  const fieldError = data[field]

  if (Array.isArray(fieldError) && fieldError.length > 0) {
    return fieldError[0]
  }

  if (typeof fieldError === 'string') {
    return fieldError
  }

  return null
}

export const ErrorHandler = {
  extract: extractErrorMessage,
  parse: parseApiError,
  showError: showErrorToast,
  showSuccess: showSuccessToast,
  showInfo: showInfoToast,
  showLoading: showLoadingToast,
  updateToast,
  withHandling: withErrorHandling,
  withRetry,
  log: logError,
  hasValidation: hasValidationError,
  getValidation: getValidationError,
}

export default ErrorHandler

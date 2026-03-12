import type { ReactNode } from 'react'
import toast from 'react-hot-toast'

/**
 * Toast utility for consistent notifications across the app
 * Uses react-hot-toast library with custom styling
 */

// Custom toast configuration
const toastConfig = {
  duration: 4000,
  position: 'top-right' as const,

  // Custom styling to match theme
  style: {
    borderRadius: '12px',
    background: '#fff',
    color: '#333',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },

  // Icon styling
  iconTheme: {
    primary: '#5B50ED',
    secondary: '#fff',
  },
}

/**
 * Success toast notification
 */
export const showSuccess = (message: string) => {
  return toast.success(message, {
    ...toastConfig,
    iconTheme: {
      primary: '#10B981',
      secondary: '#fff',
    },
  })
}

/**
 * Error toast notification
 */
export const showError = (message: string) => {
  return toast.error(message, {
    ...toastConfig,
    duration: 5000, // Errors stay a bit longer
    iconTheme: {
      primary: '#EF4444',
      secondary: '#fff',
    },
  })
}

/**
 * Info toast notification
 */
export const showInfo = (message: string) => {
  return toast(message, {
    ...toastConfig,
    icon: 'ℹ️',
  })
}

/**
 * Warning toast notification
 */
export const showWarning = (message: string) => {
  return toast(message, {
    ...toastConfig,
    icon: '⚠️',
    iconTheme: {
      primary: '#F59E0B',
      secondary: '#fff',
    },
  })
}

/**
 * Loading toast notification
 * Returns toast id for updating later
 */
export const showLoading = (message: string = 'Loading...') => {
  return toast.loading(message, toastConfig)
}

/**
 * Promise toast - shows loading, then success/error
 */
export const showPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: any) => string)
  }
) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    toastConfig
  )
}

/**
 * Update existing toast
 */
export const updateToast = (
  toastId: string,
  type: 'success' | 'error' | 'loading',
  message: string
) => {
  if (type === 'success') {
    toast.success(message, { id: toastId })
  } else if (type === 'error') {
    toast.error(message, { id: toastId })
  } else {
    toast.loading(message, { id: toastId })
  }
}

/**
 * Dismiss toast
 */
export const dismissToast = (toastId?: string) => {
  if (toastId) {
    toast.dismiss(toastId)
  } else {
    toast.dismiss()
  }
}

/**
 * Custom toast with custom content
 */
export const showCustom = (content: ReactNode) => {
  return toast.custom(content as any, toastConfig)
}

// Export the base toast for custom usage
export { toast }

// Default export for convenience
const toastHelpers = {
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
  loading: showLoading,
  promise: showPromise,
  update: updateToast,
  dismiss: dismissToast,
  custom: showCustom,
}

export default toastHelpers

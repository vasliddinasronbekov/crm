/**
 * Error Boundary Component
 * Catches and displays errors gracefully
 */

'use client'

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md w-full bg-surface rounded-2xl border border-border p-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-error/20 text-error mb-4">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-text-secondary mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
            >
              <RefreshCcw className="h-5 w-5" />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function ErrorDisplay({
  error,
  onRetry,
  title = 'Error',
}: {
  error: string | Error
  onRetry?: () => void
  title?: string
}) {
  const message = error instanceof Error ? error.message : error

  return (
    <div className="bg-error/10 border border-error/20 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-error mb-1">{title}</h3>
          <p className="text-sm text-text-secondary">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

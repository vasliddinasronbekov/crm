/**
 * Loading State Components
 * Reusable loading indicators
 */

'use client'

import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

export function LoadingSpinner({ size = 'md', className = '', text }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizes[size]} animate-spin text-primary`} />
      {text && <p className="text-sm text-text-secondary">{text}</p>}
    </div>
  )
}

export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}

export function FullPageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingSpinner size="xl" text={text} />
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-12 bg-surface/50 rounded-lg animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <div className="h-12 w-12 bg-background rounded-xl animate-pulse" />
          <div className="h-8 bg-background rounded-lg animate-pulse w-2/3" />
          <div className="h-4 bg-background rounded animate-pulse w-full" />
          <div className="h-4 bg-background rounded animate-pulse w-4/5" />
        </div>
      ))}
    </div>
  )
}

interface ButtonLoadingProps {
  loading: boolean
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export function ButtonLoading({
  loading,
  children,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
}: ButtonLoadingProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
  )
}

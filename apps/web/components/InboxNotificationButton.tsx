'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

/**
 * Inbox Notification Button
 * Displays unread notification count badge and navigates to inbox page
 */
export default function InboxNotificationButton() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const requestInFlight = useRef(false)

  const fetchUnreadCount = useCallback(async () => {
    if (requestInFlight.current) return
    requestInFlight.current = true
    try {
      const data = await api.getUnreadNotificationCount()
      setUnreadCount(data.count || 0)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error)
      setLoading(false)
    } finally {
      requestInFlight.current = false
    }
  }, [])

  // Fetch unread count on mount and every 30 seconds
  useEffect(() => {
    void fetchUnreadCount()

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void fetchUnreadCount()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  const handleClick = () => {
    router.push('/dashboard/inbox')
  }

  return (
    <button
      onClick={handleClick}
      className="glass-chip relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/40 hover:bg-primary/5 hover:border-primary/40 transition-all duration-200"
      title="Inbox"
    >
      {/* Bell Icon */}
      <svg
        className="w-5 h-5 text-text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge - show only if unread count > 0 */}
      {!loading && unreadCount > 0 && (
        <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full transform translate-x-1 -translate-y-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface Notification {
  id: number
  notification_type: string
  type_display: string
  title: string
  message: string
  exam_draft: number | null
  exam_title: string | null
  action_url: string
  action_label: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export default function InboxPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await api.getNotifications()
      // Handle both array and paginated response formats
      const notificationsList = Array.isArray(data) ? data : (data?.results || [])
      setNotifications(notificationsList)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationAsRead(id)
      setNotifications(
        (Array.isArray(notifications) ? notifications : []).map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      )
      toast.success('Notification marked as read')
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      toast.error('Failed to mark as read')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead()
      setNotifications(
        (Array.isArray(notifications) ? notifications : []).map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  // Filter notifications - ensure notifications is an array
  const filteredNotifications = (Array.isArray(notifications) ? notifications : []).filter((n) => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  // Get notification icon and color based on type
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'exam_submitted':
        return { icon: '📝', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' }
      case 'ai_review_complete':
        return { icon: '🤖', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' }
      case 'exam_approved':
        return { icon: '✅', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
      case 'exam_rejected':
        return { icon: '❌', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
      case 'exam_published':
        return { icon: '🎉', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' }
      case 'approval_request':
        return { icon: '👀', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' }
      default:
        return { icon: '📬', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMs / 3600000)
    const diffInDays = Math.floor(diffInMs / 86400000)

    if (diffInMins < 1) return 'Just now'
    if (diffInMins < 60) return `${diffInMins}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Inbox</h1>
        <p className="text-text-secondary">
          Manage your notifications for exam drafts and approvals
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            Unread ({notifications.filter((n) => !n.is_read).length})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'read'
                ? 'bg-primary-500 text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            Read
          </button>
        </div>

        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
          disabled={notifications.filter((n) => !n.is_read).length === 0}
        >
          Mark all as read
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No notifications</h3>
          <p className="text-text-secondary">
            {filter === 'unread'
              ? 'You have no unread notifications'
              : filter === 'read'
              ? 'You have no read notifications'
              : 'You have no notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const style = getNotificationStyle(notification.notification_type)
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  style.bgColor
                } ${style.borderColor} ${
                  !notification.is_read
                    ? 'shadow-md hover:shadow-lg'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0">{style.icon}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-text-primary">{notification.title}</h3>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mb-2">{notification.message}</p>
                    {notification.exam_title && (
                      <p className="text-xs text-text-tertiary mb-2">
                        Exam: {notification.exam_title}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-tertiary">
                        {formatDate(notification.created_at)}
                      </span>
                      {notification.action_url && (
                        <span className="text-xs font-medium text-primary-500">
                          {notification.action_label || 'View'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

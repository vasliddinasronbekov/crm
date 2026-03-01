/**
 * WebSocket Service - Real-time messaging with Socket.IO
 */

import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../../stores/authStore'

export const WS_BASE_URL = process.env.WS_URL || 'http://localhost:8008'

export type MessageCallback = (message: any) => void
export type NotificationCallback = (notification: any) => void

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private messageCallbacks: MessageCallback[] = []
  private notificationCallbacks: NotificationCallback[] = []

  /**
   * Connect to WebSocket server
   */
  connect() {
    const { accessToken } = useAuthStore.getState()

    if (!accessToken) {
      console.error('No access token available for WebSocket connection')
      return
    }

    this.socket = io(WS_BASE_URL, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.setupEventListeners()
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error: unknown) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        this.disconnect()
      }
    })

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts')
    })

    // Message events
    this.socket.on('new_message', (message: any) => {
      console.log('📩 New message received:', message)
      this.messageCallbacks.forEach((callback) => callback(message))
    })

    // Notification events
    this.socket.on('notification', (notification: any) => {
      console.log('🔔 New notification:', notification)
      this.notificationCallbacks.forEach((callback) => callback(notification))
    })

    // Typing indicator
    this.socket.on('user_typing', (data: any) => {
      console.log('⌨️ User typing:', data)
    })

    // Message read receipt
    this.socket.on('message_read', (data: any) => {
      console.log('✓✓ Message read:', data)
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      console.log('WebSocket disconnected manually')
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Join conversation room
   */
  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('join_conversation', { conversation_id: conversationId })
      console.log('Joined conversation:', conversationId)
    }
  }

  /**
   * Leave conversation room
   */
  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leave_conversation', { conversation_id: conversationId })
      console.log('Left conversation:', conversationId)
    }
  }

  /**
   * Send message
   */
  sendMessage(conversationId: string, content: string) {
    if (this.socket) {
      this.socket.emit('send_message', {
        conversation_id: conversationId,
        content,
      })
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId: string, isTyping: boolean) {
    if (this.socket) {
      this.socket.emit('typing', {
        conversation_id: conversationId,
        is_typing: isTyping,
      })
    }
  }

  /**
   * Mark messages as read
   */
  markAsRead(conversationId: string, messageIds: string[]) {
    if (this.socket) {
      this.socket.emit('mark_read', {
        conversation_id: conversationId,
        message_ids: messageIds,
      })
    }
  }

  /**
   * Subscribe to new messages
   */
  onMessage(callback: MessageCallback) {
    this.messageCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * Subscribe to notifications
   */
  onNotification(callback: NotificationCallback) {
    this.notificationCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      this.notificationCallbacks = this.notificationCallbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * Emit custom event
   */
  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data)
    }
  }

  /**
   * Listen to custom event
   */
  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  /**
   * Remove event listener
   */
  off(event: string) {
    if (this.socket) {
      this.socket.off(event)
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService()

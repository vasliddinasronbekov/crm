/**
 * Messaging API - Chat and conversations endpoints
 */

import { apiClient } from './client'

// Messaging-specific user type (different from auth User)
export interface MessageUser {
  id: string
  full_name: string
  avatar?: string
  role: 'student' | 'teacher' | 'parent' | 'admin'
}

export interface Conversation {
  id: string
  participants: MessageUser[]
  last_message?: Message
  unread_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation: string
  sender: string
  sender_name: string
  sender_avatar?: string
  content: string
  file_attachment?: string
  read_by: string[]
  created_at: string
}

export const messagingApi = {
  /**
   * Get all conversations
   */
  getConversations: async (): Promise<Conversation[]> => {
    const result = await apiClient.get('/messaging/conversations/')
    return Array.isArray(result) ? result : []
  },

  /**
   * Get conversation messages
   */
  getMessages: async (conversationId: string): Promise<Message[]> => {
    const result = await apiClient.get(`/messaging/conversations/${conversationId}/messages/`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Send message
   */
  sendMessage: async (
    conversationId: string,
    content: string,
    file?: File
  ): Promise<Message> => {
    const formData = new FormData()
    formData.append('content', content)
    if (file) {
      formData.append('file_attachment', file)
    }

    return await apiClient.post(
      `/messaging/conversations/${conversationId}/messages/`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
  },

  /**
   * Mark messages as read
   */
  markAsRead: async (conversationId: string): Promise<void> => {
    return await apiClient.post(`/messaging/conversations/${conversationId}/read/`)
  },

  /**
   * Create new conversation
   */
  createConversation: async (participantIds: string[]): Promise<Conversation> => {
    return await apiClient.post('/messaging/conversations/', {
      participants: participantIds,
    })
  },

  /**
   * Get available contacts (teachers)
   */
  getContacts: async (): Promise<MessageUser[]> => {
    const result = await apiClient.get('/messaging/contacts/')
    return Array.isArray(result) ? result : []
  },
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react'

import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import BranchScopeChip from '@/components/BranchScopeChip'
import LoadingScreen from '@/components/LoadingScreen'

type ConversationType = 'platform' | 'sms'

interface MessagingUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  photo?: string
}

interface MessagingMessage {
  id: number
  message_id?: string
  sender: MessagingUser | null
  sender_type: string
  message_type?: string
  content: string
  status?: string
  created_at: string
  sent_at?: string
  read_at?: string | null
  is_read?: boolean
  metadata?: Record<string, any>
}

interface MessagingConversation {
  id: number
  conversation_id?: string
  title: string
  conversation_type: ConversationType | string
  participants: MessagingUser[]
  last_message: MessagingMessage | null
  last_message_at?: string | null
  unread_count: number
  created_at?: string
  updated_at?: string
}

const parseListPayload = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.messages)) return payload.messages
  return []
}

const normalizeUser = (raw: any): MessagingUser => ({
  id: Number(raw?.id || 0),
  username: raw?.username || '',
  first_name: raw?.first_name || '',
  last_name: raw?.last_name || '',
  email: raw?.email || '',
  phone: raw?.phone || '',
  photo: raw?.photo || '',
})

const normalizeMessage = (raw: any): MessagingMessage => ({
  id: Number(raw?.id || 0),
  message_id: raw?.message_id,
  sender: raw?.sender ? normalizeUser(raw.sender) : null,
  sender_type: raw?.sender_type || 'user',
  message_type: raw?.message_type || 'text',
  content: raw?.content || '',
  status: raw?.status,
  created_at: raw?.created_at || raw?.sent_at || new Date().toISOString(),
  sent_at: raw?.sent_at,
  read_at: raw?.read_at,
  is_read: Boolean(raw?.is_read),
  metadata: raw?.metadata || {},
})

const normalizeConversation = (raw: any): MessagingConversation => ({
  id: Number(raw?.id || 0),
  conversation_id: raw?.conversation_id,
  title: raw?.title || '',
  conversation_type: (raw?.conversation_type || 'platform') as ConversationType | string,
  participants: parseListPayload<MessagingUser>(raw?.participants).map((participant) =>
    normalizeUser(participant),
  ),
  last_message: raw?.last_message ? normalizeMessage(raw.last_message) : null,
  last_message_at: raw?.last_message_at || raw?.updated_at || null,
  unread_count: Number(raw?.unread_count || 0),
  created_at: raw?.created_at,
  updated_at: raw?.updated_at,
})

const getUserDisplayName = (user: MessagingUser | null | undefined): string => {
  if (!user) return 'Unknown user'
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.username || 'Unknown user'
}

const getInitials = (user: MessagingUser | null | undefined): string => {
  if (!user) return 'NA'
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
  if (initials) return initials
  return (user.username || 'NA').slice(0, 2).toUpperCase()
}

export default function MessagingPage() {
  const { user: currentUser } = useAuth()
  const { activeBranchId, branches } = useBranchContext()
  const branchScopeKey = activeBranchId ?? 'all'
  const activeBranchName = useMemo(
    () => (activeBranchId === null ? 'All branches' : branches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`),
    [activeBranchId, branches],
  )

  const [conversations, setConversations] = useState<MessagingConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessagingMessage[]>([])

  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [messageInput, setMessageInput] = useState('')

  const [conversationSearch, setConversationSearch] = useState('')
  const debouncedConversationSearch = useDebouncedValue(conversationSearch, 260)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [newConversationType, setNewConversationType] = useState<ConversationType>('platform')
  const [newConversationTitle, setNewConversationTitle] = useState('')
  const [newConversationMessage, setNewConversationMessage] = useState('')
  const [users, setUsers] = useState<MessagingUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const debouncedUserSearch = useDebouncedValue(userSearch, 260)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const branchScopeRef = useRef<string>(String(branchScopeKey))

  useEffect(() => {
    branchScopeRef.current = String(branchScopeKey)
  }, [branchScopeKey])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [conversations, activeConversationId],
  )

  const filteredConversations = useMemo(() => {
    const query = debouncedConversationSearch.trim().toLowerCase()
    if (!query) return conversations

    return conversations.filter((conversation) => {
      const participantsText = conversation.participants
        .map((participant) => `${getUserDisplayName(participant)} ${participant.username}`)
        .join(' ')
        .toLowerCase()

      const messageText = (conversation.last_message?.content || '').toLowerCase()
      return (
        conversation.title.toLowerCase().includes(query) ||
        participantsText.includes(query) ||
        messageText.includes(query)
      )
    })
  }, [conversations, debouncedConversationSearch])

  const filteredUsers = useMemo(() => {
    const query = debouncedUserSearch.trim().toLowerCase()
    if (!query) return users

    return users.filter((user) => {
      const fullName = getUserDisplayName(user).toLowerCase()
      return (
        fullName.includes(query) ||
        user.username.toLowerCase().includes(query) ||
        (user.phone || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query)
      )
    })
  }, [users, debouncedUserSearch])

  const loadConversations = useCallback(
    async (preserveSelection: boolean = true) => {
      const requestScope = String(branchScopeKey)
      try {
        const payload = await apiService.getConversations()
        const normalized = parseListPayload<any>(payload).map(normalizeConversation)

        if (branchScopeRef.current !== requestScope) {
          return
        }

        setConversations(normalized)

        setActiveConversationId((previous) => {
          if (preserveSelection && previous && normalized.some((item) => item.id === previous)) {
            return previous
          }
          return normalized[0]?.id || null
        })
      } catch (error) {
        if (branchScopeRef.current !== requestScope) {
          return
        }
        console.error('Failed to load conversations:', error)
        toast.error('Failed to load conversations.')
      }
    },
    [branchScopeKey],
  )

  const loadUsers = useCallback(async () => {
    const requestScope = String(branchScopeKey)
    try {
      const [studentsPayload, teachersPayload] = await Promise.all([
        apiService.getStudents({ page: 1, limit: 1000 }),
        apiService.getTeachers({ page: 1, limit: 1000 }),
      ])

      const merged = [...parseListPayload<any>(studentsPayload), ...parseListPayload<any>(teachersPayload)]
      const dedupe = new Map<number, MessagingUser>()
      merged.forEach((rawUser) => {
        const normalizedUser = normalizeUser(rawUser)
        if (!normalizedUser.id || normalizedUser.id === currentUser?.id) return
        if (!dedupe.has(normalizedUser.id)) {
          dedupe.set(normalizedUser.id, normalizedUser)
        }
      })

      if (branchScopeRef.current !== requestScope) {
        return
      }

      setUsers(Array.from(dedupe.values()))
    } catch (error) {
      if (branchScopeRef.current !== requestScope) {
        return
      }
      console.error('Failed to load users:', error)
      toast.error('Failed to load users.')
    }
  }, [branchScopeKey, currentUser?.id])

  const loadMessages = useCallback(async (conversationId: number) => {
    const requestScope = String(branchScopeKey)
    setIsLoadingMessages(true)
    try {
      const payload = await apiService.getConversationMessages(conversationId, { page: 1, limit: 200 })
      const normalizedMessages = parseListPayload<any>(payload).map(normalizeMessage)

      if (branchScopeRef.current !== requestScope) {
        return
      }

      setMessages(normalizedMessages)
      await apiService.markConversationRead(conversationId)
    } catch (error) {
      if (branchScopeRef.current !== requestScope) {
        return
      }
      console.error('Failed to load messages:', error)
      toast.error('Failed to load messages.')
    } finally {
      if (branchScopeRef.current === requestScope) {
        setIsLoadingMessages(false)
      }
    }
  }, [branchScopeKey])

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoadingConversations(true)
      await Promise.all([loadConversations(false), loadUsers()])
      setIsLoadingConversations(false)
    }
    void bootstrap()
  }, [loadConversations, loadUsers])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    void loadMessages(activeConversationId)
  }, [activeConversationId, loadMessages])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadConversations(true)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [loadConversations])

  useEffect(() => {
    if (!activeConversationId) return
    const interval = window.setInterval(() => {
      void loadMessages(activeConversationId)
    }, 7000)
    return () => window.clearInterval(interval)
  }, [activeConversationId, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const resetCreateModalState = () => {
    setIsCreateModalOpen(false)
    setNewConversationType('platform')
    setNewConversationTitle('')
    setNewConversationMessage('')
    setSelectedUserIds([])
    setUserSearch('')
  }

  const handleCreateConversation = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one user.')
      return
    }

    setIsCreatingConversation(true)
    try {
      const createdConversation = await apiService.createConversation({
        title: newConversationTitle.trim() || undefined,
        conversation_type: newConversationType,
        participant_ids: selectedUserIds,
      })

      const createdConversationId = Number(createdConversation?.id)
      if (!createdConversationId) {
        throw new Error('Conversation id missing from response')
      }

      if (newConversationMessage.trim()) {
        if (newConversationType === 'sms') {
          await apiService.sendSmsInConversation(createdConversationId, newConversationMessage.trim())
        } else {
          await apiService.sendConversationMessage(createdConversationId, {
            content: newConversationMessage.trim(),
            message_type: 'text',
          })
        }
      }

      await loadConversations(false)
      setActiveConversationId(createdConversationId)
      await loadMessages(createdConversationId)
      resetCreateModalState()
      toast.success('Conversation created successfully.')
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error('Failed to create conversation.')
    } finally {
      setIsCreatingConversation(false)
    }
  }

  const handleSendMessage = async () => {
    if (!activeConversation || !messageInput.trim() || isSendingMessage) return

    const outgoingMessage = messageInput.trim()
    setIsSendingMessage(true)
    try {
      let createdMessage: any = null

      if (activeConversation.conversation_type === 'sms') {
        createdMessage = await apiService.sendSmsInConversation(activeConversation.id, outgoingMessage)
      } else {
        createdMessage = await apiService.sendConversationMessage(activeConversation.id, {
          content: outgoingMessage,
          message_type: 'text',
        })
      }

      if (createdMessage) {
        const normalized = normalizeMessage(createdMessage)
        setMessages((previous) => [...previous, normalized])
      } else {
        await loadMessages(activeConversation.id)
      }

      setMessageInput('')
      await loadConversations(true)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message.')
    } finally {
      setIsSendingMessage(false)
    }
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    )
  }

  const getConversationTitle = (conversation: MessagingConversation): string => {
    if (conversation.title) return conversation.title
    const others = conversation.participants.filter((participant) => participant.id !== currentUser?.id)
    if (!others.length) return 'Self chat'
    return others.map((participant) => getUserDisplayName(participant)).join(', ')
  }

  const formatConversationTime = (conversation: MessagingConversation): string => {
    const dateSource =
      conversation.last_message_at || conversation.last_message?.created_at || conversation.updated_at
    if (!dateSource) return ''

    const timestamp = new Date(dateSource)
    if (Number.isNaN(timestamp.getTime())) return ''

    const now = new Date()
    const isToday =
      timestamp.getDate() === now.getDate() &&
      timestamp.getMonth() === now.getMonth() &&
      timestamp.getFullYear() === now.getFullYear()
    if (isToday) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const isCurrentUserMessage = (message: MessagingMessage): boolean =>
    message.sender?.id === currentUser?.id || (message.sender_type === 'user' && !message.sender)

  if (isLoadingConversations) {
    return <LoadingScreen message="Loading..." />
  }

  return (
    <div className="p-6 h-[calc(100vh-6rem)]">
      <div className="h-full rounded-2xl border border-border bg-surface overflow-hidden grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`border-r border-border flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Messaging Hub</h1>
              <p className="text-xs text-text-secondary mt-1">Main communication center</p>
              <BranchScopeChip scopeName={activeBranchName} className="mt-2" />
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId
              return (
                <button
                  key={conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border/40 hover:bg-background transition-colors ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
                      {conversation.participants.length > 2 ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        getInitials(
                          conversation.participants.find((participant) => participant.id !== currentUser?.id) ||
                            conversation.participants[0],
                        )
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{getConversationTitle(conversation)}</p>
                        <p className="text-xs text-text-secondary">{formatConversationTime(conversation)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-text-secondary truncate">
                          {conversation.last_message?.content || 'No messages yet'}
                        </p>
                        {conversation.unread_count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white min-w-5 text-center">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {filteredConversations.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-text-secondary p-6 text-center">
                <MessageSquare className="h-10 w-10 mb-3 opacity-60" />
                <p className="text-sm font-medium">No conversations found</p>
                <p className="text-xs mt-1">Create a new conversation to start messaging.</p>
              </div>
            )}
          </div>
        </aside>

        <main className={`flex-col ${activeConversation ? 'flex' : 'hidden md:flex'}`}>
          {activeConversation ? (
            <>
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    className="md:hidden h-9 w-9 rounded-full border border-border flex items-center justify-center"
                    onClick={() => setActiveConversationId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-semibold truncate">{getConversationTitle(activeConversation)}</h2>
                    <p className="text-xs text-text-secondary">
                      {activeConversation.conversation_type === 'sms'
                        ? 'SMS conversation'
                        : `${activeConversation.participants.length} participant(s)`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void loadMessages(activeConversation.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-background"
                >
                  Refresh
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/40">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const fromCurrentUser = isCurrentUserMessage(message)
                      return (
                        <div
                          key={`${message.id}-${message.message_id || ''}`}
                          className={`mb-3 flex ${fromCurrentUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[75%] ${fromCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div
                              className={`px-3 py-2 rounded-2xl text-sm ${
                                fromCurrentUser
                                  ? 'bg-primary text-white rounded-br-md'
                                  : 'bg-surface border border-border rounded-bl-md'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            <div className="mt-1 text-[11px] text-text-secondary">
                              {new Date(message.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                        <MessageSquare className="h-10 w-10 mb-3 opacity-60" />
                        <p className="text-sm font-medium">No messages yet</p>
                        <p className="text-xs mt-1">Send the first message to start this conversation.</p>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              <footer className="p-3 border-t border-border">
                <div className="flex items-end gap-2">
                  <textarea
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void handleSendMessage()
                      }
                    }}
                    rows={2}
                    placeholder="Type message... (Enter to send, Shift+Enter for new line)"
                    className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => void handleSendMessage()}
                    disabled={!messageInput.trim() || isSendingMessage}
                    className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary p-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Select a conversation</h3>
              <p className="text-sm mt-2 max-w-sm">
                This page is the central messaging point for the platform. Start with an existing chat or create a new one.
              </p>
            </div>
          )}
        </main>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">New Conversation</h3>
                <p className="text-xs text-text-secondary mt-1">Select recipients and start messaging</p>
              </div>
              <button
                onClick={resetCreateModalState}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewConversationType('platform')}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    newConversationType === 'platform'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border hover:bg-background'
                  }`}
                >
                  Platform Chat
                </button>
                <button
                  onClick={() => setNewConversationType('sms')}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    newConversationType === 'sms'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border hover:bg-background'
                  }`}
                >
                  SMS
                </button>
              </div>

              <input
                value={newConversationTitle}
                onChange={(event) => setNewConversationTitle(event.target.value)}
                placeholder="Conversation title (optional)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
              />

              <textarea
                value={newConversationMessage}
                onChange={(event) => setNewConversationMessage(event.target.value)}
                placeholder="Optional first message..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary resize-none"
              />

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search users by name, username, phone..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 text-left border-b border-border/40 last:border-b-0 ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-surface'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                        {getInitials(user)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{getUserDisplayName(user)}</p>
                        <p className="text-xs text-text-secondary truncate">
                          @{user.username}
                          {user.phone ? ` • ${user.phone}` : ''}
                        </p>
                      </div>
                    </button>
                  )
                })}

                {filteredUsers.length === 0 && (
                  <div className="p-4 text-sm text-text-secondary text-center">
                    No users found for this search.
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-secondary">
                {selectedUserIds.length} user(s) selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetCreateModalState}
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateConversation()}
                  disabled={isCreatingConversation || selectedUserIds.length === 0}
                  className="px-3 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
                >
                  {isCreatingConversation ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

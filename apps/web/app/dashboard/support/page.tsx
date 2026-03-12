'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import { MessageCircle, Search, X, Send, Clock, CheckCircle, AlertCircle, User, MessageSquare, ArrowLeft } from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'

interface Ticket {
  id: number
  subject: string
  description: string
  status: 'active' | 'solved' | 'to_admin'
  student: number
  student_name?: string
  assigned_to: number | null
  assigned_to_name?: string
  created_at: string
  updated_at: string
}

interface TicketChat {
  id: number
  ticket: number
  sender: number
  sender_name?: string
  message: string
  created_at: string
}

interface Staff {
  id: number
  first_name: string
  last_name: string
  username: string
}

export default function SupportPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // States
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [ticketChats, setTicketChats] = useState<TicketChat[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [newMessage, setNewMessage] = useState('')
  const [assignTo, setAssignTo] = useState<number | null>(null)

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadTickets = useCallback(async () => {
    try {
      const data = await apiService.getTickets()
      setTickets(data.results || data)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }, [])

  const loadStaff = useCallback(async () => {
    try {
      const data = await apiService.getTeachers()
      setStaff(data.results || data)
    } catch (error) {
      console.error('Failed to load staff:', error)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([loadTickets(), loadStaff()])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [loadStaff, loadTickets])

  // Load data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!user.is_staff && !user.is_superuser) {
        router.push('/dashboard')
        toast.error('Access denied')
      } else {
        void loadData()
      }
    }
  }, [authLoading, loadData, router, user])

  const loadTicketChats = async (ticketId: number) => {
    try {
      const data = await apiService.getTicketChats(ticketId)
      setTicketChats(data.results || data)
    } catch (error) {
      console.error('Failed to load chats:', error)
      toast.error('Failed to load conversation')
    }
  }

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setAssignTo(ticket.assigned_to)
    await loadTicketChats(ticket.id)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !newMessage.trim()) return

    try {
      await apiService.createTicketChat({
        ticket: selectedTicket.id,
        message: newMessage
      })
      setNewMessage('')
      await loadTicketChats(selectedTicket.id)
      toast.success('Message sent')
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    }
  }

  const handleUpdateStatus = async (status: 'active' | 'solved' | 'to_admin') => {
    if (!selectedTicket) return

    try {
      await apiService.updateTicket(selectedTicket.id, { status })
      toast.success('Status updated')
      await loadTickets()
      setSelectedTicket({ ...selectedTicket, status })
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleAssignTicket = async () => {
    if (!selectedTicket || assignTo === null) return

    try {
      await apiService.updateTicket(selectedTicket.id, { assigned_to: assignTo })
      toast.success('Ticket assigned')
      await loadTickets()
      setSelectedTicket({ ...selectedTicket, assigned_to: assignTo })
    } catch (error) {
      console.error('Failed to assign ticket:', error)
      toast.error('Failed to assign ticket')
    }
  }

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Statistics
  const stats = {
    total: tickets.length,
    active: tickets.filter(t => t.status === 'active').length,
    solved: tickets.filter(t => t.status === 'solved').length,
    toAdmin: tickets.filter(t => t.status === 'to_admin').length
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-warning/20 text-warning'
      case 'solved':
        return 'bg-success/20 text-success'
      case 'to_admin':
        return 'bg-info/20 text-info'
      default:
        return 'bg-text-secondary/20 text-text-secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4" />
      case 'solved':
        return <CheckCircle className="h-4 w-4" />
      case 'to_admin':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  if (authLoading || loading) {
    return <LoadingScreen message="Loading support tickets..." />
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" />
            Support Tickets
          </h1>
          <p className="text-text-secondary">Manage student support requests and conversations</p>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="p-6 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
            <MessageCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-text-secondary">Total Tickets</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-text-secondary">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{stats.solved}</p>
              <p className="text-xs text-text-secondary">Solved</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
            <AlertCircle className="h-8 w-8 text-info" />
            <div>
              <p className="text-2xl font-bold">{stats.toAdmin}</p>
              <p className="text-xs text-text-secondary">To Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full p-6">
          <div className="flex gap-6 h-full">
            {/* Tickets List */}
            <div className={`bg-surface rounded-2xl border border-border overflow-hidden flex flex-col ${selectedTicket ? 'w-1/3' : 'w-full'}`}>
              {/* Filters */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="solved">Solved</option>
                  <option value="to_admin">To Admin</option>
                </select>
              </div>

              {/* Tickets */}
              <div className="flex-1 overflow-y-auto">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-4 border-b border-border cursor-pointer hover:bg-background transition-colors ${
                      selectedTicket?.id === ticket.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm line-clamp-1">{ticket.subject}</h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${getStatusColor(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 mb-2">{ticket.description}</p>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.student_name || `Student #${ticket.student}`}
                      </span>
                      <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {filteredTickets.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center py-12">
                      <MessageCircle className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                      <p className="text-text-secondary">No tickets found</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Detail & Chat */}
            {selectedTicket && (
              <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
                {/* Ticket Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={() => setSelectedTicket(null)}
                          className="p-1 hover:bg-background rounded-lg transition-colors md:hidden"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
                      </div>
                      <p className="text-sm text-text-secondary mb-3">{selectedTicket.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-text-secondary">
                          <User className="h-4 w-4" />
                          {selectedTicket.student_name || `Student #${selectedTicket.student}`}
                        </span>
                        <span className="text-text-secondary">
                          Created: {new Date(selectedTicket.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleUpdateStatus('active')}
                      disabled={selectedTicket.status === 'active'}
                      className="px-3 py-2 bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Clock className="h-4 w-4" />
                      Set Active
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('solved')}
                      disabled={selectedTicket.status === 'solved'}
                      className="px-3 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark Solved
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('to_admin')}
                      disabled={selectedTicket.status === 'to_admin'}
                      className="px-3 py-2 bg-info/10 text-info rounded-lg hover:bg-info/20 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <AlertCircle className="h-4 w-4" />
                      To Admin
                    </button>
                    <div className="flex gap-2 ml-auto">
                      <select
                        value={assignTo || ''}
                        onChange={(e) => setAssignTo(parseInt(e.target.value) || null)}
                        className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      >
                        <option value="">Assign to...</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignTicket}
                        disabled={!assignTo}
                        className="px-3 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {ticketChats.map((chat) => {
                    const isOwnMessage = chat.sender === user?.id

                    return (
                      <div
                        key={chat.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                          <div className={`rounded-2xl p-3 ${
                            isOwnMessage
                              ? 'bg-primary text-background'
                              : 'bg-background border border-border'
                          }`}>
                            <p className="text-sm">{chat.message}</p>
                          </div>
                          <div className={`flex items-center gap-2 mt-1 text-xs text-text-secondary ${
                            isOwnMessage ? 'justify-end' : 'justify-start'
                          }`}>
                            <span>{chat.sender_name || 'Unknown'}</span>
                            <span>•</span>
                            <span>{new Date(chat.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {ticketChats.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 text-text-secondary/50 mx-auto mb-2" />
                        <p className="text-text-secondary text-sm">No messages yet</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="h-5 w-5" />
                      Send
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

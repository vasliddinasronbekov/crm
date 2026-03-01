'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import {
  Mail, Send, CheckCircle, XCircle, Clock, AlertCircle,
  Search, Filter, Calendar, BarChart3, TrendingUp, Eye,
  Download, RefreshCw, User, FileText, Activity
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'

interface EmailLog {
  id: number
  recipient_email: string
  recipient_name?: string
  subject: string
  campaign?: any
  template?: any
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  sent_at: string
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  bounce_reason?: string
  error_message?: string
  metadata?: any
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const data = await apiService.getEmailLogs()
      setLogs(data.results || data || [])
    } catch (error) {
      console.error('Failed to load email logs:', error)
      toast.error('Failed to load email logs')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      log.recipient_email.toLowerCase().includes(query) ||
      log.subject.toLowerCase().includes(query) ||
      log.recipient_name?.toLowerCase().includes(query)

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
    delivered: logs.filter(l => l.status === 'delivered').length,
    opened: logs.filter(l => l.status === 'opened' || l.opened_at).length,
    clicked: logs.filter(l => l.status === 'clicked' || l.clicked_at).length,
    bounced: logs.filter(l => l.status === 'bounced').length,
    failed: logs.filter(l => l.status === 'failed').length,
    openRate: 0,
    clickRate: 0
  }

  stats.openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0
  stats.clickRate = stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Send className="h-4 w-4 text-info" />
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'opened':
        return <Eye className="h-4 w-4 text-primary" />
      case 'clicked':
        return <Activity className="h-4 w-4 text-purple-500" />
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-warning" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-error" />
      default:
        return <Clock className="h-4 w-4 text-text-secondary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-info/10 text-info border-info/20'
      case 'delivered':
        return 'bg-success/10 text-success border-success/20'
      case 'opened':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'clicked':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      case 'bounced':
        return 'bg-warning/10 text-warning border-warning/20'
      case 'failed':
        return 'bg-error/10 text-error border-error/20'
      default:
        return 'bg-surface border-border'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading email logs...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <Mail className="h-8 w-8 text-primary" />
                  Email Delivery Logs
                </h1>
                <p className="text-text-secondary">Track email delivery status and campaign performance</p>
              </div>
              <button
                onClick={loadLogs}
                className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 flex items-center gap-2 font-medium"
              >
                <RefreshCw className="h-5 w-5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-text-secondary" />
              </div>
              <p className="text-2xl font-bold mb-1">{stats.total}</p>
              <p className="text-xs text-text-secondary">Total Sent</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-bold mb-1">{stats.delivered}</p>
              <p className="text-xs text-text-secondary">Delivered</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold mb-1">{stats.opened}</p>
              <p className="text-xs text-text-secondary">Opened</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold mb-1">{stats.clicked}</p>
              <p className="text-xs text-text-secondary">Clicked</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-bold mb-1">{stats.bounced}</p>
              <p className="text-xs text-text-secondary">Bounced</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-bold mb-1">{Math.round(stats.openRate)}%</p>
              <p className="text-xs text-text-secondary">Open Rate</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold mb-1">{Math.round(stats.clickRate)}%</p>
              <p className="text-xs text-text-secondary">Click Rate</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full md:w-auto relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search by email or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-primary text-background'
                        : 'bg-background border border-border hover:bg-border/50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-secondary">Recipient</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Subject</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Campaign</th>
                    <th className="text-center p-4 font-medium text-text-secondary">Status</th>
                    <th className="text-center p-4 font-medium text-text-secondary">Sent</th>
                    <th className="text-center p-4 font-medium text-text-secondary">Delivered</th>
                    <th className="text-center p-4 font-medium text-text-secondary">Opened</th>
                    <th className="text-right p-4 font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-background transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-sm">{log.recipient_email}</p>
                          {log.recipient_name && (
                            <p className="text-xs text-text-secondary">{log.recipient_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm max-w-xs truncate">{log.subject}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-text-secondary">
                          {log.campaign?.name || log.template?.name || '-'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                            {getStatusIcon(log.status)}
                            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-xs text-text-secondary">
                          {new Date(log.sent_at).toLocaleString()}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        {log.delivered_at ? (
                          <p className="text-xs text-text-secondary">
                            {new Date(log.delivered_at).toLocaleString()}
                          </p>
                        ) : (
                          <span className="text-xs text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {log.opened_at ? (
                          <div>
                            <p className="text-xs text-text-secondary">
                              {new Date(log.opened_at).toLocaleString()}
                            </p>
                            {log.clicked_at && (
                              <p className="text-xs text-purple-500 font-medium">Clicked</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <Mail className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary text-lg mb-2">No email logs found</p>
                <p className="text-sm text-text-secondary">
                  {searchQuery ? 'Try adjusting your search' : 'No emails have been sent yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
                <h2 className="text-xl font-bold">Email Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-background rounded-lg"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-background p-4 rounded-xl">
                  <p className="text-sm text-text-secondary mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${getStatusColor(selectedLog.status)}`}>
                      {getStatusIcon(selectedLog.status)}
                      {selectedLog.status.charAt(0).toUpperCase() + selectedLog.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Recipient</p>
                    <p className="font-medium">{selectedLog.recipient_email}</p>
                    {selectedLog.recipient_name && (
                      <p className="text-sm text-text-secondary">{selectedLog.recipient_name}</p>
                    )}
                  </div>

                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Sent At</p>
                    <p className="font-medium">{new Date(selectedLog.sent_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-background p-4 rounded-xl">
                  <p className="text-sm text-text-secondary mb-2">Subject</p>
                  <p className="font-medium">{selectedLog.subject}</p>
                </div>

                {selectedLog.campaign && (
                  <div className="bg-background p-4 rounded-xl">
                    <p className="text-sm text-text-secondary mb-2">Campaign</p>
                    <p className="font-medium">{selectedLog.campaign.name}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  {selectedLog.delivered_at && (
                    <div className="bg-background p-4 rounded-xl">
                      <p className="text-sm text-text-secondary mb-2">Delivered</p>
                      <p className="text-xs">{new Date(selectedLog.delivered_at).toLocaleString()}</p>
                    </div>
                  )}

                  {selectedLog.opened_at && (
                    <div className="bg-background p-4 rounded-xl">
                      <p className="text-sm text-text-secondary mb-2">Opened</p>
                      <p className="text-xs">{new Date(selectedLog.opened_at).toLocaleString()}</p>
                    </div>
                  )}

                  {selectedLog.clicked_at && (
                    <div className="bg-background p-4 rounded-xl">
                      <p className="text-sm text-text-secondary mb-2">Clicked</p>
                      <p className="text-xs">{new Date(selectedLog.clicked_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {(selectedLog.bounce_reason || selectedLog.error_message) && (
                  <div className="bg-error/10 border border-error/20 p-4 rounded-xl">
                    <p className="text-sm font-medium text-error mb-2">Error Details</p>
                    <p className="text-sm text-text-secondary">
                      {selectedLog.bounce_reason || selectedLog.error_message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

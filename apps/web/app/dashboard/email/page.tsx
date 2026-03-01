'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Mail, Plus, Search, Edit, Trash2, X, Send, Clock, CheckCircle, XCircle, FileText, Users, TrendingUp } from 'lucide-react'

interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
  created_at: string
}

interface EmailCampaign {
  id: number
  name: string
  template: number
  template_name?: string
  recipients: number[]
  scheduled_at: string | null
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  created_at: string
}

interface EmailLog {
  id: number
  campaign: number
  campaign_name?: string
  recipient: number
  recipient_email?: string
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
  error_message: string | null
}

interface Student {
  id: number
  first_name: string
  last_name: string
  email: string
}

export default function EmailMarketingPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // States
  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns' | 'logs'>('templates')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null)

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: ''
  })
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    template: 0,
    recipients: [] as number[],
    scheduled_at: ''
  })

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Load data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!user.is_staff && !user.is_superuser) {
        router.push('/dashboard')
        toast.error('Access denied')
      } else {
        loadData()
      }
    }
  }, [user, authLoading, router])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadTemplates(),
        loadCampaigns(),
        loadLogs(),
        loadStudents()
      ])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const data = await apiService.getEmailTemplates()
      setTemplates(data.results || data)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const loadCampaigns = async () => {
    try {
      const data = await apiService.getEmailCampaigns()
      setCampaigns(data.results || data)
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const data = await apiService.getEmailLogs()
      setLogs(data.results || data)
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents()
      setStudents(data.results || data)
    } catch (error) {
      console.error('Failed to load students:', error)
    }
  }

  // Template CRUD
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.createEmailTemplate(templateForm)
      toast.success('Template created successfully')
      setShowTemplateModal(false)
      resetTemplateForm()
      loadTemplates()
    } catch (error) {
      console.error('Failed to create template:', error)
      toast.error('Failed to create template')
    }
  }

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTemplate) return

    try {
      await apiService.updateEmailTemplate(editingTemplate.id, templateForm)
      toast.success('Template updated successfully')
      setShowTemplateModal(false)
      setEditingTemplate(null)
      resetTemplateForm()
      loadTemplates()
    } catch (error) {
      console.error('Failed to update template:', error)
      toast.error('Failed to update template')
    }
  }

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await apiService.deleteEmailTemplate(id)
      toast.success('Template deleted successfully')
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
      toast.error('Failed to delete template')
    }
  }

  // Campaign CRUD
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.createEmailCampaign(campaignForm)
      toast.success('Campaign created successfully')
      setShowCampaignModal(false)
      resetCampaignForm()
      loadCampaigns()
    } catch (error) {
      console.error('Failed to create campaign:', error)
      toast.error('Failed to create campaign')
    }
  }

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCampaign) return

    try {
      await apiService.updateEmailCampaign(editingCampaign.id, campaignForm)
      toast.success('Campaign updated successfully')
      setShowCampaignModal(false)
      setEditingCampaign(null)
      resetCampaignForm()
      loadCampaigns()
    } catch (error) {
      console.error('Failed to update campaign:', error)
      toast.error('Failed to update campaign')
    }
  }

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return

    try {
      await apiService.deleteEmailCampaign(id)
      toast.success('Campaign deleted successfully')
      loadCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      toast.error('Failed to delete campaign')
    }
  }

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', subject: '', body: '' })
  }

  const resetCampaignForm = () => {
    setCampaignForm({ name: '', template: 0, recipients: [], scheduled_at: '' })
  }

  const openTemplateEditModal = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body
    })
    setShowTemplateModal(true)
  }

  const openCampaignEditModal = (campaign: EmailCampaign) => {
    setEditingCampaign(campaign)
    setCampaignForm({
      name: campaign.name,
      template: campaign.template,
      recipients: campaign.recipients || [],
      scheduled_at: campaign.scheduled_at || ''
    })
    setShowCampaignModal(true)
  }

  const toggleRecipient = (studentId: number) => {
    setCampaignForm(prev => ({
      ...prev,
      recipients: prev.recipients.includes(studentId)
        ? prev.recipients.filter(id => id !== studentId)
        : [...prev.recipients, studentId]
    }))
  }

  // Statistics
  const stats = {
    templates: templates.length,
    campaigns: campaigns.length,
    sent: logs.filter(l => l.status === 'sent').length,
    pending: logs.filter(l => l.status === 'pending').length,
    failed: logs.filter(l => l.status === 'failed').length
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'scheduled':
        return 'bg-success/20 text-success'
      case 'pending':
      case 'draft':
        return 'bg-warning/20 text-warning'
      case 'failed':
        return 'bg-error/20 text-error'
      default:
        return 'bg-text-secondary/20 text-text-secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
      case 'scheduled':
        return <Clock className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      default:
        return <Mail className="h-4 w-4" />
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading email marketing...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            Email Marketing
          </h1>
          <p className="text-text-secondary">Create templates, manage campaigns, and track email delivery</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Templates</p>
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.templates}</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Campaigns</p>
              <Send className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">{stats.campaigns}</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Sent</p>
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">{stats.sent}</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Pending</p>
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Failed</p>
              <XCircle className="h-5 w-5 text-error" />
            </div>
            <p className="text-3xl font-bold">{stats.failed}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'templates'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'campaigns'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Send className="h-4 w-4 inline mr-2" />
            Campaigns
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <TrendingUp className="h-4 w-4 inline mr-2" />
            Delivery Logs
          </button>
        </div>

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  resetTemplateForm()
                  setShowTemplateModal(true)
                }}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Create Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates
                .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.subject.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((template) => (
                  <div key={template.id} className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="flex gap-2">
                        <button
                          onClick={() => openTemplateEditModal(template)}
                          className="p-2 hover:bg-background rounded-lg transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-2 hover:bg-error/20 text-error rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{template.name}</h3>
                    <p className="text-sm text-text-secondary mb-2">
                      <strong>Subject:</strong> {template.subject}
                    </p>
                    <p className="text-sm text-text-secondary line-clamp-3">{template.body}</p>
                    <p className="text-xs text-text-secondary mt-4">
                      Created: {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
            </div>

            {templates.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary">No templates found</p>
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={() => {
                  setEditingCampaign(null)
                  resetCampaignForm()
                  setShowCampaignModal(true)
                }}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Create Campaign
              </button>
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="text-left p-4 font-medium text-text-secondary">Name</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Template</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Recipients</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Status</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Scheduled</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns
                      .filter(c => statusFilter === 'all' || c.status === statusFilter)
                      .map((campaign) => (
                        <tr key={campaign.id} className="border-b border-border hover:bg-background transition-colors">
                          <td className="p-4 font-medium">{campaign.name}</td>
                          <td className="p-4">{campaign.template_name || `Template #${campaign.template}`}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-info" />
                              <span>{campaign.recipients?.length || 0}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(campaign.status)}`}>
                              {getStatusIcon(campaign.status)}
                              {campaign.status}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-text-secondary">
                            {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : '-'}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openCampaignEditModal(campaign)}
                                className="p-2 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="p-2 hover:bg-error/20 text-error rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {campaigns.length === 0 && (
                <div className="text-center py-12">
                  <Send className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                  <p className="text-text-secondary">No campaigns found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div>
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="text-left p-4 font-medium text-text-secondary">Campaign</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Recipient</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Status</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Sent At</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-background transition-colors">
                        <td className="p-4">{log.campaign_name || `Campaign #${log.campaign}`}</td>
                        <td className="p-4">{log.recipient_email || `Recipient #${log.recipient}`}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(log.status)}`}>
                            {getStatusIcon(log.status)}
                            {log.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-text-secondary">
                          {log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}
                        </td>
                        <td className="p-4 text-sm text-error">
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {logs.length === 0 && (
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                  <p className="text-text-secondary">No delivery logs found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => {
                  setShowTemplateModal(false)
                  setEditingTemplate(null)
                  resetTemplateForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Welcome Email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Subject</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Email subject line..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Body</label>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={8}
                  placeholder="Write your email content here..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false)
                    setEditingTemplate(null)
                    resetTemplateForm()
                  }}
                  className="flex-1 px-6 py-3 bg-background border border-border text-text-primary rounded-xl hover:bg-border/50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">
                {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
              </h2>
              <button
                onClick={() => {
                  setShowCampaignModal(false)
                  setEditingCampaign(null)
                  resetCampaignForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingCampaign ? handleUpdateCampaign : handleCreateCampaign} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Summer Newsletter"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Template</label>
                <select
                  value={campaignForm.template}
                  onChange={(e) => setCampaignForm({ ...campaignForm, template: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Choose a template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipients ({campaignForm.recipients.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto bg-background border border-border rounded-xl p-4 space-y-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 hover:bg-surface rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={campaignForm.recipients.includes(student.id)}
                        onChange={() => toggleRecipient(student.id)}
                        className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-sm">
                        {student.first_name} {student.last_name} ({student.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Schedule Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={campaignForm.scheduled_at}
                  onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-secondary mt-1">Leave empty to send immediately</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCampaignModal(false)
                    setEditingCampaign(null)
                    resetCampaignForm()
                  }}
                  className="flex-1 px-6 py-3 bg-background border border-border text-text-primary rounded-xl hover:bg-border/50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium"
                >
                  {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

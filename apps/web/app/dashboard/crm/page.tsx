'use client'

import { useState } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { Search, Plus, Edit, Trash2 } from 'lucide-react'
import toast from '@/lib/toast'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
import LoadingScreen from '@/components/LoadingScreen'
  useLeads,
  useDeals,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  Lead,
  LeadFilters,
  Deal,
} from '@/lib/hooks/useCRM'

export default function CRMPage() {
  const { formatCurrency } = useSettings()
  // React Query hooks
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(5)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    page,
    limit,
    search: debouncedSearchQuery,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  } as LeadFilters)
  const { data: dealsData } = useDeals()
  const deals = dealsData?.results || []
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()

  const isLoading = leadsLoading

  // Local UI state
  const [isAddingLead, setIsAddingLead] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [newLead, setNewLead] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: 'Website',
    status: 'new',
  })

  const leads = leadsData?.results || []
  const totalLeads = leadsData?.count || 0
  const totalPages = Math.ceil(totalLeads / limit)

  const handleAddLead = async () => {
    if (!newLead.first_name || !newLead.last_name || !newLead.phone) {
      toast.warning('Please fill in all required fields')
      return
    }

    createLead.mutate(newLead, {
      onSuccess: () => {
        setIsAddingLead(false)
        setNewLead({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          source: 'Website',
          status: 'new',
        })
      },
    })
  }

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
  }

  const handleSaveEdit = async () => {
    if (!editingLead) return

    updateLead.mutate(
      {
        id: editingLead.id,
        data: {
          first_name: editingLead.first_name,
          last_name: editingLead.last_name,
          email: editingLead.email,
          phone: editingLead.phone,
          source: editingLead.source,
          status: editingLead.status,
        },
      },
      {
        onSuccess: () => {
          setEditingLead(null)
        },
      }
    )
  }

  const handleDelete = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to delete lead "${lead.first_name} ${lead.last_name}"?`)) {
      return
    }
    deleteLead.mutate(lead.id)
  }

  // Note: These stats would require a separate, non-paginated API endpoint for full accuracy.
  // For now, they will only reflect the counts on the current page.
  const getLeadsByStatus = (status: string) => {
    if (status === 'all') return leads.length
    return leads.filter((lead: Lead) => lead.status.toLowerCase() === status.toLowerCase()).length
  }

  const PaginationControls = () => (
    <div className="flex justify-center items-center gap-4 mt-8">
      <button
        onClick={() => setPage(p => Math.max(p - 1, 1))}
        disabled={page <= 1}
        className="btn-secondary"
      >
        Previous
      </button>
      <span className="text-text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
        disabled={page >= totalPages}
        className="btn-secondary"
      >
        Next
      </button>
    </div>
  );

  if (isLoading && page === 1) {
    return <LoadingScreen message="Loading CRM data..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">CRM Dashboard 👥</h1>
        <p className="text-text-secondary">Manage leads, contacts, and customer relationships</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search leads (backend)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Add Button */}
        <button
          onClick={() => setIsAddingLead(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Lead
        </button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-value">{getLeadsByStatus('new')}</div>
          <div className="stat-label">New Leads (on page)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{getLeadsByStatus('in_progress')}</div>
          <div className="stat-label">In Progress (on page)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{getLeadsByStatus('converted')}</div>
          <div className="stat-label">Converted (on page)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{getLeadsByStatus('rejected')}</div>
          <div className="stat-label">Rejected (on page)</div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex gap-2">
          {['all', 'new', 'in_progress', 'converted', 'rejected'].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter)
                setPage(1)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-primary text-background'
                  : 'bg-surface text-text-secondary hover:bg-border'
              }`}
            >
              {filter === 'in_progress' ? 'In Progress' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Leads ({totalLeads})</h2>
        <div className="space-y-4">
          {leads.length > 0 ? (
            leads.map((lead: Lead) => (
              <div key={lead.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {lead.first_name?.[0] || 'U'}
                      {lead.last_name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="text-sm text-text-secondary">{lead.email}</p>
                      {lead.phone && (
                        <p className="text-sm text-text-secondary">{lead.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg">
                      {lead.source || 'Direct'}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg ${
                        lead.status.toLowerCase() === 'new'
                          ? 'bg-primary/10 text-primary'
                          : lead.status.toLowerCase() === 'in_progress'
                          ? 'bg-warning/10 text-warning'
                          : lead.status.toLowerCase() === 'converted'
                          ? 'bg-success/10 text-success'
                          : 'bg-error/10 text-error'
                      }`}
                    >
                      {lead.status === 'in_progress' ? 'In Progress' : lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                    </span>
                    <span className="text-text-secondary text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead)}
                        disabled={deleteLead.isPending}
                        className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card text-center py-12">
              <p className="text-text-secondary text-lg mb-2">No leads found</p>
              <p className="text-text-secondary text-sm">
                {statusFilter !== 'all'
                  ? `No leads with status "${statusFilter}"`
                  : 'Start adding leads to track your pipeline'}
              </p>
            </div>
          )}
        </div>
        {totalPages > 1 && <PaginationControls />}
      </div>

      {/* Sales Pipeline */}
      {deals.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Active Deals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {deals.slice(0, 3).map((deal: Deal) => (
              <div key={deal.id} className="card">
                <h3 className="text-lg font-semibold mb-3">{deal.name || 'Unnamed Deal'}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Stage</span>
                    <span className="font-semibold">{deal.stage || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Value</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(deal.amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Probability</span>
                    <span className="font-semibold">{deal.probability || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {isAddingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Add New Lead</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">First Name *</label>
                <input
                  type="text"
                  value={newLead.first_name}
                  onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Name *</label>
                <input
                  type="text"
                  value={newLead.last_name}
                  onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone *</label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="+998901234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="lead@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Source</label>
                <select
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Direct Call">Direct Call</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={newLead.status}
                  onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="converted">Converted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleAddLead} className="btn-primary flex-1">
                  Create Lead
                </button>
                <button
                  onClick={() => {
                    setIsAddingLead(false)
                    setNewLead({
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      source: 'Website',
                      status: 'new',
                    })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Edit Lead</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">First Name</label>
                <input
                  type="text"
                  value={editingLead.first_name}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, first_name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Name</label>
                <input
                  type="text"
                  value={editingLead.last_name}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, last_name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={editingLead.phone || ''}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, phone: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editingLead.email}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, email: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Source</label>
                <select
                  value={editingLead.source}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, source: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Direct Call">Direct Call</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={editingLead.status}
                  onChange={(e) =>
                    setEditingLead({ ...editingLead, status: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="converted">Converted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleSaveEdit} className="btn-primary flex-1">
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingLead(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Clock3,
  Edit,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'

import BranchScopeChip from '@/components/BranchScopeChip'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  Deal,
  Lead,
  LeadFilters,
  LeadStageStatus,
  useCreateLead,
  useCRMInsights,
  useDeals,
  useDeleteLead,
  useLeads,
  useTransitionLeadStage,
  useUpdateLead,
} from '@/lib/hooks/useCRM'
import { usePermissions } from '@/lib/permissions'
import toast from '@/lib/toast'

type LeadStatusFilter = 'all' | 'new' | 'in_progress' | 'converted' | 'rejected'

const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
]

const PERIOD_OPTIONS = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 180 days' },
]

const statusClassMap: Record<string, string> = {
  new: 'bg-primary/10 text-primary',
  in_progress: 'bg-warning/10 text-warning',
  converted: 'bg-success/10 text-success',
  rejected: 'bg-error/10 text-error',
}

const LEAD_STAGE_ORDER: LeadStageStatus[] = [
  'new',
  'in_progress',
  'converted',
  'rejected',
]

function formatStatusLabel(status: string): string {
  if (status === 'in_progress') return 'In Progress'
  if (!status) return 'Unknown'
  return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getDealValue(deal: Deal): number {
  const value = (deal.value ?? deal.amount ?? 0) as number
  return Number.isFinite(value) ? Number(value) : 0
}

function getDealStageLabel(deal: Deal): string {
  if (deal.stage_name) return deal.stage_name
  if (typeof deal.stage === 'string') return deal.stage
  return 'Unassigned'
}

export default function CRMPage() {
  const { formatCurrency } = useSettings()
  const { user } = useAuth()
  const { activeBranchId, branches, isGlobalScope } = useBranchContext()
  const permissions = usePermissions(user)
  const activeBranchName = useMemo(() => {
    if (activeBranchId === null) {
      return isGlobalScope ? 'All branches' : 'Your branch scope'
    }
    return branches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`
  }, [activeBranchId, branches, isGlobalScope])

  const canViewCRM = permissions.hasAnyPermission(['crm.view', 'leads.view'])
  const canCreateLead = permissions.hasAnyPermission(['crm.create', 'leads.create'])
  const canEditLead = permissions.hasAnyPermission(['crm.edit', 'leads.edit'])
  const canDeleteLead = permissions.hasAnyPermission(['crm.delete', 'leads.delete'])
  const canManageLeads = canCreateLead || canEditLead || canDeleteLead

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [periodDays, setPeriodDays] = useState(30)
  const [draggingLeadId, setDraggingLeadId] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStageStatus | null>(null)
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

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

  const {
    data: leadsData,
    isLoading: leadsLoading,
    isFetching: leadsFetching,
    refetch: refetchLeads,
  } = useLeads({
    page,
    limit,
    search: debouncedSearchQuery,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  } as LeadFilters)
  const {
    data: boardLeadsData,
    isLoading: boardLeadsLoading,
    isFetching: boardLeadsFetching,
    refetch: refetchBoardLeads,
  } = useLeads({
    page: 1,
    limit: 120,
    search: debouncedSearchQuery,
  } as LeadFilters)
  const { data: dealsData } = useDeals({ limit: 50 })
  const {
    data: insights,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
    refetch: refetchInsights,
  } = useCRMInsights(periodDays)

  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const transitionLeadStage = useTransitionLeadStage()

  const leads = useMemo(() => leadsData?.results || [], [leadsData?.results])
  const boardLeads = useMemo(
    () => boardLeadsData?.results || [],
    [boardLeadsData?.results],
  )
  const deals = useMemo(() => dealsData?.results || [], [dealsData?.results])
  const totalLeads = leadsData?.count || 0
  const totalPages = Math.max(1, Math.ceil(totalLeads / limit))

  const isInitialLoading =
    (leadsLoading && page === 1) || insightsLoading || boardLeadsLoading
  const isRefreshing = leadsFetching || insightsFetching || boardLeadsFetching

  const leadCounts = useMemo(() => {
    if (insights?.leads) {
      return {
        all: insights.leads.total,
        new: insights.leads.new,
        in_progress: insights.leads.in_progress,
        converted: insights.leads.converted,
        rejected: insights.leads.rejected,
      }
    }

    const counts = {
      all: leads.length,
      new: 0,
      in_progress: 0,
      converted: 0,
      rejected: 0,
    }
    leads.forEach((lead) => {
      const key = lead.status.toLowerCase() as keyof typeof counts
      if (counts[key] !== undefined) counts[key] += 1
    })
    return counts
  }, [insights?.leads, leads])

  const maxStageValue = useMemo(() => {
    if (!insights?.stage_breakdown?.length) return 1
    return Math.max(
      ...insights.stage_breakdown.map((stage) => stage.pipeline_value || 0),
      1,
    )
  }, [insights?.stage_breakdown])

  const topOpenDeals = useMemo(() => {
    return [...deals]
      .filter((deal) => !deal.closed_at)
      .sort((a, b) => getDealValue(b) - getDealValue(a))
      .slice(0, 6)
  }, [deals])

  const stageLeads = useMemo(() => {
    const byStage: Record<LeadStageStatus, Lead[]> = {
      new: [],
      in_progress: [],
      converted: [],
      rejected: [],
    }

    boardLeads.forEach((lead) => {
      const leadStatus = lead.status as LeadStageStatus
      if (LEAD_STAGE_ORDER.includes(leadStatus)) {
        byStage[leadStatus].push(lead)
      }
    })

    return byStage
  }, [boardLeads])

  const handleRefresh = async () => {
    await Promise.all([refetchInsights(), refetchLeads(), refetchBoardLeads()])
    toast.success('CRM dashboard refreshed')
  }

  const resetNewLeadForm = () => {
    setNewLead({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      source: 'Website',
      status: 'new',
    })
  }

  const handleAddLead = () => {
    if (!canCreateLead) {
      toast.error('You do not have permission to create leads.')
      return
    }
    if (!newLead.first_name || !newLead.last_name || !newLead.phone) {
      toast.warning('Please fill in first name, last name, and phone.')
      return
    }

    createLead.mutate(newLead, {
      onSuccess: () => {
        setIsAddingLead(false)
        resetNewLeadForm()
      },
    })
  }

  const handleSaveEdit = () => {
    if (!editingLead) return
    if (!canEditLead) {
      toast.error('You do not have permission to edit leads.')
      return
    }

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
        onSuccess: () => setEditingLead(null),
      },
    )
  }

  const handleDelete = (lead: Lead) => {
    if (!canDeleteLead) {
      toast.error('You do not have permission to delete leads.')
      return
    }
    if (!confirm(`Delete lead "${lead.first_name} ${lead.last_name}"?`)) {
      return
    }
    deleteLead.mutate(lead.id)
  }

  const handleLeadStageDrop = (targetStatus: LeadStageStatus) => {
    if (draggingLeadId === null) return

    const draggedLead = boardLeads.find((lead) => lead.id === draggingLeadId)
    setDragOverStage(null)
    setDraggingLeadId(null)

    if (!draggedLead) return
    if (draggedLead.status === targetStatus) return

    if (!canEditLead) {
      toast.error('You do not have permission to move leads between stages.')
      return
    }

    transitionLeadStage.mutate({
      leadId: draggedLead.id,
      status: targetStatus,
    })
  }

  if (!canViewCRM) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-surface border border-border rounded-2xl p-10 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-warning mb-3" />
            <h1 className="text-2xl font-semibold mb-2">CRM Access Required</h1>
            <p className="text-text-secondary">
              Your role does not currently include CRM view permissions.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isInitialLoading) {
    return <LoadingScreen message="Loading CRM intelligence..." />
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              CRM Revenue Intelligence
            </h1>
            <p className="text-text-secondary mt-1">
              Lead funnel, pipeline health, and action priorities in one operating view.
            </p>
            <BranchScopeChip scopeName={activeBranchName} className="mt-3" />
            {!canManageLeads && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                <AlertTriangle className="h-4 w-4" />
                Read-only mode: you can view CRM data but cannot modify leads.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleRefresh()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/crm/pipelines"
              className="btn-secondary flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              Pipelines
            </Link>
            <button
              onClick={() => setIsAddingLead(true)}
              disabled={!canCreateLead}
              className={`flex items-center gap-2 ${
                canCreateLead ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'
              }`}
              title={!canCreateLead ? 'You do not have permission to create leads' : undefined}
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search lead by name, email, or phone..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setPage(1)
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as LeadStatusFilter)
                  setPage(1)
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors appearance-none"
              >
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value))
                  setPage(1)
                }}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <select
                value={periodDays}
                onChange={(event) => setPeriodDays(Number(event.target.value))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Total Leads</p>
            <p className="text-3xl font-bold">{leadCounts.all}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Conversion Rate</p>
            <p className="text-3xl font-bold">{insights?.leads.conversion_rate ?? 0}%</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Open Deals</p>
            <p className="text-3xl font-bold">{insights?.deals.open ?? 0}</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Pipeline Value</p>
            <p className="text-2xl font-bold">
              {formatCurrency(insights?.deals.pipeline_value ?? 0)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Weighted Forecast</p>
            <p className="text-2xl font-bold">
              {formatCurrency(insights?.deals.weighted_forecast ?? 0)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary mb-2">Overdue Tasks</p>
            <p className={`text-3xl font-bold ${(insights?.activities.overdue_tasks || 0) > 0 ? 'text-warning' : ''}`}>
              {insights?.activities.overdue_tasks ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Lead Funnel
            </h2>
            <div className="space-y-3">
              {LEAD_STATUS_OPTIONS.filter((item) => item.value !== 'all').map((item) => {
                const value = leadCounts[item.value]
                const denominator = Math.max(1, leadCounts.all)
                const width = Math.min(100, Math.round((value / denominator) * 100))
                return (
                  <div key={item.value}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-info" />
              Source Performance
            </h2>
            <div className="space-y-3">
              {(insights?.source_breakdown || []).slice(0, 6).map((source) => {
                const width = Math.min(
                  100,
                  Math.round((source.lead_count / Math.max(1, leadCounts.all)) * 100),
                )
                return (
                  <div key={source.source_name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-text-secondary truncate">{source.source_name}</span>
                      <span className="font-medium">{source.lead_count}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-info rounded-full" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
              {!insights?.source_breakdown?.length && (
                <p className="text-sm text-text-secondary">No source data available.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Pipeline Stage Momentum
            </h2>
            <div className="space-y-4">
              {(insights?.stage_breakdown || []).slice(0, 6).map((stage) => (
                <div key={`${stage.stage_id}-${stage.stage_name}`}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{stage.stage_name}</span>
                    <span className="text-text-secondary">{stage.deal_count} deals</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((stage.pipeline_value / maxStageValue) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatCurrency(stage.pipeline_value)} value • {formatCurrency(stage.weighted_value)} weighted
                  </div>
                </div>
              ))}
              {!insights?.stage_breakdown?.length && (
                <p className="text-sm text-text-secondary">No pipeline stage data available.</p>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-warning" />
              Follow-up Command Center
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-text-secondary">Overdue</p>
                <p className="text-xl font-bold text-warning">
                  {insights?.activities.overdue_tasks ?? 0}
                </p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-text-secondary">Due Today</p>
                <p className="text-xl font-bold">{insights?.activities.due_today_tasks ?? 0}</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-text-secondary">7d Completed</p>
                <p className="text-xl font-bold text-success">
                  {insights?.activities.completed_tasks_last_7d ?? 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {(insights?.recommendations || []).slice(0, 3).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Lead Stage Board</h2>
              <p className="text-sm text-text-secondary">
                Drag and drop leads across stages. Every transition is logged automatically.
              </p>
            </div>
            {!canEditLead && (
              <span className="inline-flex items-center rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning">
                Read-only board
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {LEAD_STATUS_OPTIONS.filter((item) => item.value !== 'all').map((stage) => {
              const stageValue = stage.value as LeadStageStatus
              const leadsInStage = stageLeads[stageValue] || []
              const isDropTarget = dragOverStage === stageValue

              return (
                <div
                  key={stage.value}
                  onDragOver={(event) => {
                    if (!canEditLead) return
                    event.preventDefault()
                    setDragOverStage(stageValue)
                  }}
                  onDragLeave={() => {
                    if (dragOverStage === stageValue) {
                      setDragOverStage(null)
                    }
                  }}
                  onDrop={(event) => {
                    if (!canEditLead) return
                    event.preventDefault()
                    handleLeadStageDrop(stageValue)
                  }}
                  className={`rounded-xl border p-3 transition-colors ${
                    isDropTarget
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{stage.label}</span>
                    <span className="rounded-md bg-surface px-2 py-1 text-xs text-text-secondary">
                      {leadsInStage.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {leadsInStage.map((lead) => (
                      <div
                        key={lead.id}
                        draggable={canEditLead}
                        onDragStart={() => setDraggingLeadId(lead.id)}
                        onDragEnd={() => {
                          setDraggingLeadId(null)
                          setDragOverStage(null)
                        }}
                        className={`rounded-lg border border-border bg-surface p-3 ${
                          canEditLead ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } ${
                          draggingLeadId === lead.id ? 'opacity-60 border-primary' : ''
                        }`}
                      >
                        <p className="text-sm font-medium">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 truncate">
                          {lead.source || 'Direct'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {lead.phone || lead.email || '-'}
                        </p>
                      </div>
                    ))}

                    {leadsInStage.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-text-secondary text-center">
                        No leads in this stage
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Lead Operating Table ({totalLeads})</h2>
            <div className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3">Lead</th>
                  <th className="text-left py-3 px-3">Contact</th>
                  <th className="text-left py-3 px-3">Source</th>
                  <th className="text-left py-3 px-3">Status</th>
                  <th className="text-left py-3 px-3">Created</th>
                  <th className="text-right py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.length > 0 ? (
                  leads.map((lead) => {
                    const statusKey = lead.status.toLowerCase()
                    return (
                      <tr key={lead.id} className="border-b border-border/50 hover:bg-background/40">
                        <td className="py-3 px-3">
                          <div className="font-medium">
                            {lead.first_name} {lead.last_name}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm text-text-secondary">
                          <div>{lead.phone || '-'}</div>
                          <div>{lead.email || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-sm">{lead.source || 'Direct'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusClassMap[statusKey] || 'bg-background text-text-secondary'}`}>
                            {formatStatusLabel(lead.status)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm text-text-secondary">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingLead(lead)}
                              disabled={!canEditLead}
                              className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!canEditLead ? 'You do not have permission to edit leads' : 'Edit lead'}
                            >
                              <Edit className="h-4 w-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDelete(lead)}
                              disabled={!canDeleteLead || deleteLead.isPending}
                              className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!canDeleteLead ? 'You do not have permission to delete leads' : 'Delete lead'}
                            >
                              <Trash2 className="h-4 w-4 text-error" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-secondary">
                      No leads found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
                disabled={page <= 1}
                className="btn-secondary"
              >
                Previous
              </button>
              <span className="text-text-secondary text-sm">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((previous) => Math.min(previous + 1, totalPages))}
                disabled={page >= totalPages}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Active Deals Snapshot
            </h2>
            <div className="space-y-3">
              {topOpenDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="rounded-xl border border-border bg-background p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">{deal.name || 'Unnamed deal'}</p>
                    <p className="text-xs text-text-secondary">
                      Stage: {getDealStageLabel(deal)} • Probability: {deal.probability || 0}%
                    </p>
                  </div>
                  <p className="font-semibold text-primary">
                    {formatCurrency(getDealValue(deal))}
                  </p>
                </div>
              ))}
              {topOpenDeals.length === 0 && (
                <p className="text-sm text-text-secondary">No active deals available.</p>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              Recent CRM Activity
            </h2>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {(insights?.recent_activities || []).map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {activity.subject}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-lg ${activity.completed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {activity.completed ? 'Done' : 'Open'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {activity.lead_name} • {formatStatusLabel(activity.activity_type)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {!insights?.recent_activities?.length && (
                <p className="text-sm text-text-secondary">No recent activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAddingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-semibold mb-4">Add New Lead</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input
                    type="text"
                    value={newLead.first_name}
                    onChange={(event) => setNewLead({ ...newLead, first_name: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={newLead.last_name}
                    onChange={(event) => setNewLead({ ...newLead, last_name: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone *</label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(event) => setNewLead({ ...newLead, phone: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="+998901234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(event) => setNewLead({ ...newLead, email: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Source</label>
                  <select
                    value={newLead.source}
                    onChange={(event) => setNewLead({ ...newLead, source: event.target.value })}
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
                    onChange={(event) => setNewLead({ ...newLead, status: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="converted">Converted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddLead}
                  disabled={createLead.isPending}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {createLead.isPending ? 'Creating...' : 'Create Lead'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingLead(false)
                    resetNewLeadForm()
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

      {editingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-semibold mb-4">Edit Lead</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    value={editingLead.first_name}
                    onChange={(event) => setEditingLead({ ...editingLead, first_name: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    value={editingLead.last_name}
                    onChange={(event) => setEditingLead({ ...editingLead, last_name: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={editingLead.phone || ''}
                  onChange={(event) => setEditingLead({ ...editingLead, phone: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editingLead.email}
                  onChange={(event) => setEditingLead({ ...editingLead, email: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Source</label>
                  <select
                    value={editingLead.source}
                    onChange={(event) => setEditingLead({ ...editingLead, source: event.target.value })}
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
                    onChange={(event) => setEditingLead({ ...editingLead, status: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="converted">Converted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={updateLead.isPending}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {updateLead.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingLead(null)} className="btn-secondary flex-1">
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

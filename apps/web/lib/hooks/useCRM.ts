import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { PaginatedResponse } from '@/lib/types'

// CRM interfaces
export interface Lead {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  source: string
  status: string
  created_at: string
}

export interface LeadFormData {
  first_name: string
  last_name: string
  email: string
  phone?: string
  source: string
  status: string
}

export interface Deal {
  id: number
  name: string
  stage?: string | number
  stage_name?: string
  pipeline_name?: string
  amount?: number
  value?: number
  weighted_value?: number
  probability?: number
  won?: boolean
  closed_at?: string | null
  lead_id?: number
  created_at: string
  expected_close_date?: string | null
}

export interface CRMStageBreakdown {
  stage_id: number | null
  stage_name: string
  deal_count: number
  pipeline_value: number
  weighted_value: number
}

export interface CRMSourceBreakdown {
  source_name: string
  lead_count: number
}

export interface CRMOwnerBreakdown {
  user_id: number | null
  username: string
  lead_count: number
}

export interface CRMRecentActivity {
  id: number
  lead_id: number
  lead_name: string
  activity_type: string
  subject: string
  created_by: string
  completed: boolean
  due_date: string | null
  created_at: string
}

export interface CRMInsights {
  period_days: number
  generated_at: string
  leads: {
    total: number
    new: number
    in_progress: number
    converted: number
    rejected: number
    conversion_rate: number
    created_in_period: number
    converted_in_period: number
  }
  deals: {
    total: number
    open: number
    won: number
    lost: number
    stale_open: number
    pipeline_value: number
    weighted_forecast: number
    win_rate: number
  }
  activities: {
    overdue_tasks: number
    due_today_tasks: number
    completed_tasks_last_7d: number
  }
  stage_breakdown: CRMStageBreakdown[]
  source_breakdown: CRMSourceBreakdown[]
  owner_breakdown: CRMOwnerBreakdown[]
  recent_activities: CRMRecentActivity[]
  recommendations: string[]
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export type LeadStageStatus = 'new' | 'in_progress' | 'converted' | 'rejected'

interface TransitionLeadStageVariables {
  leadId: number
  status: LeadStageStatus
  note?: string
}

// Query keys factory for consistent cache management
export const crmKeys = {
  all: ['crm'] as const,
  insights: (periodDays: number) => [...crmKeys.all, 'insights', periodDays] as const,
  leads: () => [...crmKeys.all, 'leads'] as const,
  leadsList: (filters?: Record<string, any>) => [...crmKeys.leads(), filters] as const,
  leadDetail: (id: number | string) => [...crmKeys.leads(), id] as const,
  deals: () => [...crmKeys.all, 'deals'] as const,
  dealsList: (filters?: Record<string, any>) => [...crmKeys.deals(), filters] as const,
}

/**
 * Hook to fetch all leads with automatic caching
 * @param filters - Optional filters for leads list
 */
export function useLeads(filters: LeadFilters = {}) {
  return useQuery<PaginatedResponse<Lead>>({
    queryKey: crmKeys.leadsList(filters),
    queryFn: async () => {
      const response = await apiService.getLeads(filters);
      // Return the PaginatedResponse object directly
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all deals with automatic caching
 * @param filters - Optional filters for deals list
 */
export function useDeals(filters?: Record<string, any>) {
  return useQuery<PaginatedResponse<Deal>>({
    queryKey: crmKeys.dealsList(filters),
    queryFn: async () => {
      const response = await apiService.getDeals(filters).catch(() => ({ results: [], count: 0, next: null, previous: null }))
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCRMInsights(periodDays: number = 30) {
  return useQuery<CRMInsights>({
    queryKey: crmKeys.insights(periodDays),
    queryFn: async () => {
      const response = await apiService.getCRMInsights({ period_days: periodDays })
      return response as CRMInsights
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to create a new lead with optimistic updates
 */
export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await apiService.createLead(data)
      return response as Lead
    },
    onSuccess: (newLead) => {
      // Invalidate leads list to refetch
      queryClient.invalidateQueries({ queryKey: crmKeys.leads() })
      queryClient.invalidateQueries({ queryKey: [...crmKeys.all, 'insights'] })

      // Optionally, optimistically add to the cache
      queryClient.setQueryData<Lead[]>(crmKeys.leadsList(), (old) => {
        if (!old) return [newLead]
        return [...old, newLead]
      })

      toast.success('Lead created successfully')
    },
    onError: (error: any) => {
      console.error('Failed to create lead:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create lead'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<LeadFormData>
    }) => {
      const response = await apiService.updateLead(id, data)
      return response as Lead
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: crmKeys.leadDetail(id) })
      await queryClient.cancelQueries({ queryKey: crmKeys.leads() })

      // Snapshot previous values for rollback
      const previousLead = queryClient.getQueryData(crmKeys.leadDetail(id))
      const previousList = queryClient.getQueryData(crmKeys.leadsList())

      // Optimistically update the cache
      queryClient.setQueryData<Lead[]>(crmKeys.leadsList(), (old) => {
        if (!old) return old
        return old.map((lead: Lead) =>
          lead.id === id ? { ...lead, ...data } : lead
        )
      })

      return { previousLead, previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(crmKeys.leadsList(), context.previousList)
      }

      console.error('Failed to update lead:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update lead'
      toast.error(message)
    },
    onSuccess: (updatedLead, variables) => {
      // Update cache with server response
      queryClient.setQueryData<Lead[]>(crmKeys.leadsList(), (old) => {
        if (!old) return old
        return old.map((lead: Lead) =>
          lead.id === variables.id ? { ...lead, ...updatedLead } : lead
        )
      })

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: crmKeys.leads() })
      queryClient.invalidateQueries({ queryKey: [...crmKeys.all, 'insights'] })

      toast.success('Lead updated successfully')
    },
  })
}

/**
 * Hook to delete/reject a lead with optimistic updates
 */
export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      // Try to delete, if not available update status to "rejected"
      try {
        await apiService.deleteLead(id)
      } catch (deleteError) {
        // If delete not available, mark as rejected
        const lead = queryClient.getQueryData<Lead[]>(crmKeys.leadsList())?.find((l: Lead) => l.id === id)
        if (lead) {
          await apiService.updateLead(id, {
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone: lead.phone,
            email: lead.email,
            source: lead.source,
            status: 'rejected'
          })
        }
      }
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: crmKeys.leads() })

      // Snapshot
      const previousList = queryClient.getQueryData(crmKeys.leadsList())

      // Optimistically remove from list
      queryClient.setQueryData<Lead[]>(crmKeys.leadsList(), (old) => {
        if (!old) return old
        return old.filter((lead: Lead) => lead.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(crmKeys.leadsList(), context.previousList)
      }

      console.error('Failed to delete lead:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to delete lead'
      toast.error(message)
    },
    onSuccess: () => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: crmKeys.leads() })
      queryClient.invalidateQueries({ queryKey: [...crmKeys.all, 'insights'] })

      toast.success('Lead deleted successfully')
    },
  })
}

function formatLeadStageStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function applyLeadStageTransitionToPaginatedData(
  data: PaginatedResponse<Lead> | undefined,
  {
    leadId,
    status,
    filters,
  }: {
    leadId: number
    status: LeadStageStatus
    filters?: LeadFilters
  },
): PaginatedResponse<Lead> | undefined {
  if (!data || !Array.isArray(data.results)) return data

  const leadExists = data.results.some((lead) => lead.id === leadId)
  if (!leadExists) return data

  const nextResults = data.results.map((lead) =>
    lead.id === leadId ? { ...lead, status } : lead,
  )

  if (filters?.status && filters.status !== status) {
    return {
      ...data,
      count: Math.max(0, (data.count ?? nextResults.length) - 1),
      results: nextResults.filter((lead) => lead.id !== leadId),
    }
  }

  return {
    ...data,
    results: nextResults,
  }
}

export function useTransitionLeadStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId, status, note }: TransitionLeadStageVariables) => {
      const response = await apiService.transitionLeadStage(leadId, { status, note })
      return response as Lead
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads() })
      await queryClient.cancelQueries({ queryKey: [...crmKeys.all, 'insights'] })

      const previousLeadQueries = queryClient.getQueriesData<PaginatedResponse<Lead>>({
        queryKey: crmKeys.leads(),
      })
      const previousInsightsQueries = queryClient.getQueriesData({
        queryKey: [...crmKeys.all, 'insights'],
      })

      previousLeadQueries.forEach(([queryKey, queryData]) => {
        if (!queryData) return

        const filters =
          Array.isArray(queryKey) && queryKey.length >= 3
            ? (queryKey[2] as LeadFilters | undefined)
            : undefined

        queryClient.setQueryData<PaginatedResponse<Lead>>(
          queryKey,
          applyLeadStageTransitionToPaginatedData(queryData, {
            leadId: variables.leadId,
            status: variables.status,
            filters,
          }),
        )
      })

      return { previousLeadQueries, previousInsightsQueries }
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousLeadQueries) {
        context.previousLeadQueries.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData)
        })
      }
      if (context?.previousInsightsQueries) {
        context.previousInsightsQueries.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData)
        })
      }

      console.error('Failed to transition lead stage:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.status?.[0] ||
        error.response?.data?.message ||
        'Failed to move lead stage'
      toast.error(message)
    },
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads() })
      queryClient.invalidateQueries({ queryKey: [...crmKeys.all, 'insights'] })
      toast.success(`Lead moved to ${formatLeadStageStatus(updatedLead.status)}`)
    },
  })
}

/**
 * Hook to prefetch CRM data
 * Useful for improving perceived performance
 */
export function usePrefetchCRM() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery<PaginatedResponse<Lead>>({
      queryKey: crmKeys.leadsList(),
      queryFn: async () => {
        const response = await apiService.getLeads().catch(() => ({ results: [], count: 0 }))
        return response
      },
      staleTime: 1 * 60 * 1000,
    })

    queryClient.prefetchQuery<PaginatedResponse<Deal>>({
      queryKey: crmKeys.dealsList(),
      queryFn: async () => {
        const response = await apiService.getDeals().catch(() => ({ results: [], count: 0 }))
        return response
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

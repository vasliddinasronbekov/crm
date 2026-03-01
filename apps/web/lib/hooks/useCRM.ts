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
  stage: string
  amount: number
  probability: number
  lead_id?: number
  created_at: string
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// Query keys factory for consistent cache management
export const crmKeys = {
  all: ['crm'] as const,
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
      const response = await apiService.getDeals().catch(() => ({ results: [], count: 0, next: null, previous: null }))
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
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

      toast.success('Lead deleted successfully')
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { PaginatedResponse } from '@/lib/types'

// Group interfaces
export interface Group {
  id: number
  name: string
  course_name?: string
  course: {
    id: number
    name: string
    price?: number
    duration_months?: number
  }
  students: any[]
  start_day: string
  end_day: string
  start_time: string
  end_time: string
  days: string
  room_name?: string
  room?: {
    id: number
    name: string
    capacity?: number
  }
  branch_name?: string
  student_count?: number
  main_teacher_name?: string
  assistant_teacher_name?: string
  main_teacher?: {
    id: number
    username: string
    first_name?: string
    last_name?: string
  }
  assistant_teacher?: {
    id: number
    username: string
    first_name?: string
    last_name?: string
  }
}

export interface OngoingGroup extends Group {
  is_ongoing: boolean
  minutes_since_start: number
  minutes_until_end: number
  as_of: string
}

export interface OngoingGroupsResponse {
  count: number
  as_of: string
  results: OngoingGroup[]
}

export interface GroupFormData {
  name: string
  course: string | number
  days: string
  start_time: string
  end_time: string
  start_day?: string
  end_day?: string
}

export interface GroupFilters {
  page?: number;
  limit?: number;
  search?: string;
}

// Query keys factory for consistent cache management
export const groupsKeys = {
  all: ['groups'] as const,
  lists: () => [...groupsKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...groupsKeys.lists(), filters] as const,
  details: () => [...groupsKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...groupsKeys.details(), id] as const,
  ongoing: () => [...groupsKeys.all, 'ongoing'] as const,
}

/**
 * Hook to fetch all groups with automatic caching
 * @param filters - Optional filters for groups list
 */
export function useGroups(filters: GroupFilters = {}) {
  return useQuery<PaginatedResponse<Group>>({
    queryKey: groupsKeys.list(filters),
    queryFn: async () => {
      // The API is expected to return an object like { count: number, results: Group[] }
      const response = await apiService.getGroups(filters);
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single group by ID
 * @param id - Group ID
 */
export function useGroup(id: number | string | null) {
  return useQuery({
    queryKey: groupsKeys.detail(id!),
    queryFn: async () => {
      const response = await apiService.getGroup(Number(id))
      return response
    },
    enabled: !!id, // Only run if id exists
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch currently ongoing groups based on backend schedule logic.
 */
export function useOngoingGroups({
  refetchIntervalMs = 60_000,
  enabled = true,
}: {
  refetchIntervalMs?: number
  enabled?: boolean
} = {}) {
  return useQuery<OngoingGroupsResponse>({
    queryKey: groupsKeys.ongoing(),
    queryFn: async () => {
      const response = await apiService.getOngoingGroups()
      return response
    },
    staleTime: 30 * 1000,
    refetchInterval: refetchIntervalMs,
    enabled,
  })
}

/**
 * Hook to create a new group with optimistic updates
 */
export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: GroupFormData) => {
      const response = await apiService.createGroup(data)
      return response
    },
    onSuccess: (newGroup) => {
      // Invalidate groups list to refetch with new data
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })

      // Optionally, optimistically add to the cache
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (old) => {
        if (!old) return [newGroup]
        return [...old, newGroup]
      })

      toast.success('Group created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create group:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create group'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing group with optimistic updates
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<GroupFormData>
    }) => {
      const response = await apiService.updateGroup(id, data)
      return response
    },
    // Optimistic update - update cache immediately before request completes
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: groupsKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: groupsKeys.lists() })

      // Snapshot previous values for rollback
      const previousGroup = queryClient.getQueryData(groupsKeys.detail(id))
      const previousList = queryClient.getQueryData(groupsKeys.list())

      // Note: We skip optimistic updates here because GroupFormData and Group
      // have incompatible course field types. The cache will update on success.

      return { previousGroup, previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousGroup) {
        queryClient.setQueryData(
          groupsKeys.detail(variables.id),
          context.previousGroup
        )
      }
      if (context?.previousList) {
        queryClient.setQueryData(groupsKeys.list(), context.previousList)
      }

      console.error('Failed to update group:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update group'
      toast.error(message)
    },
    onSuccess: (updatedGroup, variables) => {
      // Update cache with server response
      queryClient.setQueryData(groupsKeys.detail(variables.id), updatedGroup)

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })

      toast.success('Group updated successfully!')
    },
  })
}

/**
 * Hook to delete a group with optimistic updates
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deleteGroup(id)
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: groupsKeys.lists() })

      // Snapshot
      const previousList = queryClient.getQueryData(groupsKeys.list())

      // Optimistically remove from list
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (old) => {
        if (!old) return old
        return old.filter((group) => group.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(groupsKeys.list(), context.previousList)
      }

      console.error('Failed to delete group:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to delete group'
      toast.error(message)
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: groupsKeys.detail(deletedId) })

      // Invalidate list
      queryClient.invalidateQueries({ queryKey: groupsKeys.lists() })

      toast.success('Group deleted successfully!')
    },
  })
}

/**
 * Hook to prefetch groups data
 * Useful for improving perceived performance
 */
export function usePrefetchGroups() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery<PaginatedResponse<Group>>({
      queryKey: groupsKeys.list(),
      queryFn: async () => {
        const response = await apiService.getGroups()
        return response
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

// Teacher interfaces
export interface Teacher {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  photo?: string
  is_staff: boolean
}

export interface TeacherFormData {
  username: string
  password?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  is_staff?: boolean
}

// Query keys factory for consistent cache management
export const teachersKeys = {
  all: ['teachers'] as const,
  lists: () => [...teachersKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...teachersKeys.lists(), filters] as const,
  details: () => [...teachersKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...teachersKeys.details(), id] as const,
}

/**
 * Hook to fetch all teachers with automatic caching
 * @param filters - Optional filters for teachers list
 */
export function useTeachers({ page = 1, limit = 10, search = "", ...restFilters } = {}) {
  // Faqat kerakli filtrlarni yuboramiz. 
  // Agar is_staff=true bo'sh ro'yxat qaytarayotgan bo'lsa, uni olib tashlaymiz
  const filters = { 
    page, 
    limit, 
    search,
    // Agar is_staff shart bo'lmasa, bu qatorni o'chiring:
    // is_staff: restFilters.is_staff 
  };

  return useQuery({
    queryKey: teachersKeys.list(filters),
    queryFn: async () => {
      const data = await apiService.getTeachers(filters);
      return data; // Return the full response object
    },
    // Bu yerda select ishlatish ham xatolikni kamaytiradi
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}


/**
 * Hook to fetch a single teacher by ID
 * @param id - Teacher ID
 */
export function useTeacher(id: number | string | null) {
  return useQuery({
    queryKey: teachersKeys.detail(id!),
    queryFn: async () => {
      const response = await apiService.getTeacher(Number(id))
      return response
    },
    enabled: !!id, // Only run if id exists
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to create a new teacher with optimistic updates
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TeacherFormData) => {
      const response = await apiService.createTeacher(data)
      return response
    },
    onSuccess: (newTeacher) => {
      // Invalidate teachers list to refetch with new data
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() })

      // Optionally, optimistically add to the cache
      queryClient.setQueryData<Teacher[]>(teachersKeys.list(), (old) => {
        if (!old) return [newTeacher]
        return [...old, newTeacher]
      })

      toast.success('Teacher created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create teacher:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create teacher'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing teacher
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<TeacherFormData>
    }) => {
      const response = await apiService.updateTeacher(id, data)
      return response
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: teachersKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: teachersKeys.lists() })

      // Snapshot previous values for rollback
      const previousTeacher = queryClient.getQueryData(teachersKeys.detail(id))
      const previousList = queryClient.getQueryData(teachersKeys.list())

      // Note: Skipping optimistic updates to avoid type compatibility issues
      // Cache will update on success

      return { previousTeacher, previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousTeacher) {
        queryClient.setQueryData(
          teachersKeys.detail(variables.id),
          context.previousTeacher
        )
      }
      if (context?.previousList) {
        queryClient.setQueryData(teachersKeys.list(), context.previousList)
      }

      console.error('Failed to update teacher:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update teacher'
      toast.error(message)
    },
    onSuccess: (updatedTeacher, variables) => {
      // Update cache with server response
      queryClient.setQueryData(teachersKeys.detail(variables.id), updatedTeacher)

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() })

      toast.success('Teacher updated successfully!')
    },
  })
}

/**
 * Hook to delete/deactivate a teacher with optimistic updates
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      // Teachers are deactivated, not deleted
      await apiService.updateTeacher(id, { is_active: false })
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: teachersKeys.lists() })

      // Snapshot
      const previousList = queryClient.getQueryData(teachersKeys.list())

      // Optimistically remove from list
      queryClient.setQueryData<Teacher[]>(teachersKeys.list(), (old) => {
        if (!old) return old
        return old.filter((teacher: Teacher) => teacher.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(teachersKeys.list(), context.previousList)
      }

      console.error('Failed to deactivate teacher:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to deactivate teacher'
      toast.error(message)
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: teachersKeys.detail(deletedId) })

      // Invalidate list
      queryClient.invalidateQueries({ queryKey: teachersKeys.lists() })

      toast.success('Teacher deactivated successfully')
    },
  })
}

/**
 * Hook to prefetch teachers data
 * Useful for improving perceived performance
 */
export function usePrefetchTeachers() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: teachersKeys.list(),
      queryFn: async () => {
        const response = await apiService.getTeachers()
        return response.results || response || []
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

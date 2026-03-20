import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

// Student interface
export interface Student {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  photo?: string
  date_joined?: string
  address?: string
  birth_date?: string
  parent_phone?: string
  parent_email?: string
  notes?: string
  branch_ids?: number[]
  primary_branch_id?: number | null
  branch_names?: string[]
}

export interface StudentFormData {
  username: string
  password?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  birth_date?: string
  parent_phone?: string
  parent_email?: string
  notes?: string
  branch_ids?: number[]
  primary_branch_id?: number | null
}

// Query keys factory for consistent cache management
export const studentsKeys = {
  all: ['students'] as const,
  lists: () => [...studentsKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...studentsKeys.lists(), filters] as const,
  details: () => [...studentsKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...studentsKeys.details(), id] as const,
}

/**
 * Hook to fetch all students with automatic caching
 * @param filters - Optional filters for students list
 */
export function useStudents({ page = 1, limit = 10, scopeKey = "default", ...restFilters }: { page?: number, limit?: number, scopeKey?: string | number | null, [key: string]: any } = {}) {
  const requestFilters = { page, limit, ...restFilters };
  const cacheFilters = {
    ...requestFilters,
    scopeKey: scopeKey ?? "all",
  };

  return useQuery({
    queryKey: studentsKeys.list(cacheFilters),
    queryFn: async () => {
      const response = await apiService.getStudents(requestFilters);
      // Return the array of students, handling both paginated and non-paginated responses
      return response
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single student by ID
 * @param id - Student ID
 */
export function useStudent(id: number | string | null, { scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const resolvedScopeKey = scopeKey ?? "all"

  return useQuery({
    queryKey: [...studentsKeys.detail(id!), resolvedScopeKey],
    queryFn: async () => {
      const response = await apiService.getStudent(Number(id))
      return response
    },
    enabled: !!id, // Only run if id exists
    staleTime: 5 * 60 * 1000, // 5 minutes - student detail changes less frequently
  })
}

/**
 * Hook to create a new student with optimistic updates
 */
export function useCreateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: StudentFormData) => {
      const response = await apiService.createStudent(data)
      return response
    },
    onSuccess: (newStudent) => {
      // Invalidate students list to refetch with new data
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() })

      // Optionally, optimistically add to the cache
      queryClient.setQueryData<Student[]>(studentsKeys.list(), (old) => {
        if (!old) return [newStudent]
        return [...old, newStudent]
      })

      toast.success('Student created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create student:', error)
      const message = error.response?.data?.detail ||
                     error.response?.data?.message ||
                     'Failed to create student'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing student with optimistic updates
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: StudentFormData }) => {
      const response = await apiService.updateStudent(id, data)
      return response
    },
    // Optimistic update - update cache immediately before request completes
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: studentsKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: studentsKeys.lists() })

      // Snapshot previous values for rollback
      const previousStudent = queryClient.getQueryData(studentsKeys.detail(id))
      const previousList = queryClient.getQueryData(studentsKeys.list())

      // Optimistically update student detail
      queryClient.setQueryData<Student>(studentsKeys.detail(id), (old) => {
        if (!old) return old
        return { ...old, ...data }
      })

      // Optimistically update in list
      queryClient.setQueryData<Student[]>(studentsKeys.list(), (old) => {
        if (!old) return old
        return old.map((student) =>
          student.id === id ? { ...student, ...data } : student
        )
      })

      return { previousStudent, previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousStudent) {
        queryClient.setQueryData(studentsKeys.detail(variables.id), context.previousStudent)
      }
      if (context?.previousList) {
        queryClient.setQueryData(studentsKeys.list(), context.previousList)
      }

      console.error('Failed to update student:', error)
      const message = error.response?.data?.detail ||
                     error.response?.data?.message ||
                     'Failed to update student'
      toast.error(message)
    },
    onSuccess: (updatedStudent, variables) => {
      // Update cache with server response
      queryClient.setQueryData(studentsKeys.detail(variables.id), updatedStudent)

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() })

      toast.success('Student updated successfully!')
    },
  })
}

/**
 * Hook to delete a student
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deleteStudent(id)
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: studentsKeys.lists() })

      // Snapshot
      const previousList = queryClient.getQueryData(studentsKeys.list())

      // Optimistically remove from list
      queryClient.setQueryData<Student[]>(studentsKeys.list(), (old) => {
        if (!old) return old
        return old.filter((student) => student.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(studentsKeys.list(), context.previousList)
      }

      console.error('Failed to delete student:', error)
      const message = error.response?.data?.detail ||
                     error.response?.data?.message ||
                     'Failed to delete student'
      toast.error(message)
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: studentsKeys.detail(deletedId) })

      // Invalidate list
      queryClient.invalidateQueries({ queryKey: studentsKeys.lists() })

      toast.success('Student deleted successfully!')
    },
  })
}

/**
 * Hook to prefetch students data
 * Useful for improving perceived performance
 */
export function usePrefetchStudents() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: studentsKeys.list(),
      queryFn: async () => {
        const response = await apiService.getStudents()
        return response.results || response || []
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

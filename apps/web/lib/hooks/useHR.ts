import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { PaginatedResponse } from '@/lib/types'

// HR interfaces
export interface Teacher {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
}

export interface TeacherSalary {
  id: number
  teacher: number
  teacher_name?: string
  amount: string
  month: string
  status: 'calculated' | 'paid' | 'rejected'
  comment?: string
  created_at: string
}

export interface TeacherSalaryFilters {
  page?: number;
  limit?: number;
  month?: string;
  status?: string;
}

export interface Group {
  id: number
  name: string
  course: {
    id: number
    name: string
  }
}

export interface GroupSalary {
  id: number
  mentor: number
  mentor_name?: string
  group: number
  group_name?: string
  amount: string
  month: string
  created_at: string
}

export interface TeacherSalaryFormData {
  teacher: number
  amount: number
  month: string
  status: 'calculated' | 'paid' | 'rejected'
  comment?: string
}

export interface GroupSalaryFormData {
  mentor: number
  group: number
  amount: number
  month: string
}

// Query keys factory
export const hrKeys = {
  all: ['hr'] as const,
  teachers: () => [...hrKeys.all, 'teachers'] as const,
  teacherSalaries: (filters?: Record<string, any>) => [...hrKeys.all, 'teacher-salaries', filters] as const,
  groupSalaries: (filters?: Record<string, any>) => [...hrKeys.all, 'group-salaries', filters] as const,
  groups: () => [...hrKeys.all, 'groups'] as const,
}

/**
 * Hook to fetch teachers
 */
export function useTeachers({ scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const resolvedScopeKey = scopeKey ?? "all"
  return useQuery({
    queryKey: [...hrKeys.teachers(), resolvedScopeKey],
    queryFn: async () => {
      const data = await apiService.getTeachers()
      return (data.results || data || []) as Teacher[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (rarely changes)
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch groups
 */
export function useGroups({ scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const resolvedScopeKey = scopeKey ?? "all"
  return useQuery({
    queryKey: [...hrKeys.groups(), resolvedScopeKey],
    queryFn: async () => {
      const data = await apiService.getGroups()
      return (data.results || data || []) as Group[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch teacher salaries with optional filters
 */
export function useTeacherSalaries(filters: {
  page?: number
  limit?: number
  month?: string
  status?: string
}, { scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const resolvedScopeKey = scopeKey ?? "all"
  return useQuery({
    queryKey: [...hrKeys.teacherSalaries(filters), resolvedScopeKey],
    queryFn: async () => {
      const params: any = { ...filters }
      if (filters.status === 'all') {
        delete params.status
      }
      const data = await apiService.getTeacherSalaries(params)
      return data
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch group salaries with optional filters
 */
export function useGroupSalaries(filters?: { month?: string }, { scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const resolvedScopeKey = scopeKey ?? "all"
  return useQuery({
    queryKey: [...hrKeys.groupSalaries(filters), resolvedScopeKey],
    queryFn: async () => {
      const params: any = {}
      if (filters?.month) {
        params.month = filters.month
      }
      const data = await apiService.getGroupSalaries(params)
      return (data.results || data || []) as GroupSalary[]
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to create a new teacher salary record
 */
export function useCreateTeacherSalary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TeacherSalaryFormData) => {
      const response = await apiService.createTeacherSalary(data)
      return response as TeacherSalary
    },
    onSuccess: () => {
      // Invalidate all teacher salary queries
      queryClient.invalidateQueries({ queryKey: hrKeys.all })
      toast.success('Salary record created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create salary:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create salary'
      toast.error(message)
    },
  })
}

/**
 * Hook to create a new group salary record
 */
export function useCreateGroupSalary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: GroupSalaryFormData) => {
      const response = await apiService.createGroupSalary(data)
      return response as GroupSalary
    },
    onSuccess: () => {
      // Invalidate all HR queries
      queryClient.invalidateQueries({ queryKey: hrKeys.all })
      toast.success('Group salary created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create group salary:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create group salary'
      toast.error(message)
    },
  })
}

/**
 * Hook to update teacher salary status
 */
export function useUpdateTeacherSalaryStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'calculated' | 'paid' | 'rejected' }) => {
      const response = await apiService.updateTeacherSalary(id, { status })
      return response as TeacherSalary
    },
    onMutate: async ({ id, status }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: hrKeys.all })

      // Snapshot previous values
      const previousSalaries = queryClient.getQueryData(hrKeys.teacherSalaries())

      // Optimistically update
      queryClient.setQueriesData({ queryKey: hrKeys.teacherSalaries() }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return old.map((salary: TeacherSalary) =>
            salary.id === id ? { ...salary, status } : salary
          )
        }
        return old
      })

      return { previousSalaries }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousSalaries) {
        queryClient.setQueryData(hrKeys.teacherSalaries(), context.previousSalaries)
      }

      console.error('Failed to update status:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update status'
      toast.error(message)
    },
    onSuccess: (data, variables) => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: hrKeys.all })
      toast.success(`Salary marked as ${variables.status}`)
    },
  })
}

/**
 * Hook to delete a teacher salary record
 */
export function useDeleteTeacherSalary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deleteTeacherSalary(id)
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: hrKeys.all })

      // Snapshot previous values
      const previousSalaries = queryClient.getQueryData(hrKeys.teacherSalaries())

      // Optimistically remove from list
      queryClient.setQueriesData({ queryKey: hrKeys.teacherSalaries() }, (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return old.filter((salary: TeacherSalary) => salary.id !== id)
        }
        return old
      })

      return { previousSalaries }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousSalaries) {
        queryClient.setQueryData(hrKeys.teacherSalaries(), context.previousSalaries)
      }

      console.error('Failed to delete salary:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to delete salary'
      toast.error(message)
    },
    onSuccess: () => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: hrKeys.all })
      toast.success('Salary deleted successfully')
    },
  })
}

/**
 * Helper hook to enrich salaries with teacher and group names
 */
export function useEnrichedTeacherSalaries(filters: {
  page?: number
  limit?: number
  month?: string
  status?: string
}, { scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const { data: teachers = [] } = useTeachers({ scopeKey })
  const { data, ...salariesQuery } = useTeacherSalaries(filters, { scopeKey })

  const salaries = data?.results || []
  const count = data?.count || 0

  const enrichedSalaries = salaries.map((salary: TeacherSalary) => {
    const teacher = teachers.find((t) => t.id === salary.teacher)
    return {
      ...salary,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown',
    }
  })

  return { data: { results: enrichedSalaries, count }, ...salariesQuery }
}

/**
 * Helper hook to enrich group salaries with teacher and group names
 */
export function useEnrichedGroupSalaries(filters?: { month?: string }, { scopeKey = "default" }: { scopeKey?: string | number | null } = {}) {
  const { data: teachers = [] } = useTeachers({ scopeKey })
  const { data: groups = [] } = useGroups({ scopeKey })
  const { data: groupSalaries = [], ...groupSalariesQuery } = useGroupSalaries(filters, { scopeKey })

  const enrichedGroupSalaries = groupSalaries.map((gs) => {
    const teacher = teachers.find((t) => t.id === gs.mentor)
    const group = groups.find((g) => g.id === gs.group)
    return {
      ...gs,
      mentor_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown',
      group_name: group ? group.name : 'Unknown',
    }
  })

  return { data: enrichedGroupSalaries, ...groupSalariesQuery }
}

/**
 * Helper hook to calculate salary statistics
 */
export function useSalaryStats(salaries: TeacherSalary[]) {
  const totalSalaries = salaries.reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0)
  const paidSalaries = salaries
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0)
  const pendingSalaries = totalSalaries - paidSalaries

  return {
    totalSalaries,
    paidSalaries,
    pendingSalaries,
  }
}

/**
 * Hook to prefetch HR data
 */
export function usePrefetchHR() {
  const queryClient = useQueryClient()

  return () => {
    // Prefetch teachers
    queryClient.prefetchQuery({
      queryKey: hrKeys.teachers(),
      queryFn: async () => {
        const data = await apiService.getTeachers()
        return (data.results || data || []) as Teacher[]
      },
      staleTime: 5 * 60 * 1000,
    })

    // Prefetch groups
    queryClient.prefetchQuery({
      queryKey: hrKeys.groups(),
      queryFn: async () => {
        const data = await apiService.getGroups()
        return (data.results || data || []) as Group[]
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}

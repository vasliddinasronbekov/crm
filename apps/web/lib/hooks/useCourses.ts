import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { PaginatedResponse } from '@/lib/types'

// Course interface
export interface Course {
  id: number
  name: string
  description: string
  price: number
  duration_weeks: number
  level: string
  is_active: boolean
  created_at: string
}

export interface CourseFormData {
  name: string
  description: string
  price: number
  duration_weeks: number
  level: string
  is_active?: boolean
}

export interface CourseFilters {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  is_active?: 'true' | 'false'; // Or boolean if API expects boolean
}

// Query keys factory
export const coursesKeys = {
  all: ['courses'] as const,
  lists: () => [...coursesKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...coursesKeys.lists(), filters] as const,
  details: () => [...coursesKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...coursesKeys.details(), id] as const,
}

/**
 * Hook to fetch all courses with automatic caching
 * @param filters - Optional filters for courses list
 */
export function useCourses(filters: CourseFilters = {}) {
  return useQuery<PaginatedResponse<Course>>({
    queryKey: coursesKeys.list(filters),
    queryFn: async () => {
      const response = await apiService.getCourses(filters);
      // Return the array of courses, handling both paginated and non-paginated responses
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - courses don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch a single course by ID
 * @param id - Course ID
 */
export function useCourse(id: number | string | null) {
  return useQuery({
    queryKey: coursesKeys.detail(id!),
    queryFn: async () => {
      const response = await apiService.getCourse(Number(id))
      return response
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to create a new course with optimistic updates
 * Note: Price is stored in tiyin (cents), multiply by 100 when sending to API
 */
export function useCreateCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CourseFormData) => {
      // Convert price to tiyin (multiply by 100)
      const courseData = {
        ...data,
        price: Math.round(data.price * 100),
      }
      const response = await apiService.createCourse(courseData)
      return response
    },
    onSuccess: (newCourse) => {
      // Invalidate courses list to refetch with new data
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() })

      // Optionally, optimistically add to the cache
      queryClient.setQueryData<Course[]>(coursesKeys.list(), (old) => {
        if (!old) return [newCourse]
        return [...old, newCourse]
      })

      toast.success('Course created successfully!')
    },
    onError: (error: any) => {
      console.error('Failed to create course:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create course'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing course
 * Note: Price is stored in tiyin (cents), multiply by 100 when sending to API
 */
export function useUpdateCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<CourseFormData>
    }) => {
      // Convert price to tiyin if provided
      const courseData = {
        ...data,
        ...(data.price !== undefined && { price: Math.round(data.price * 100) }),
      }
      const response = await apiService.updateCourse(id, courseData)
      return response
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: coursesKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: coursesKeys.lists() })

      // Snapshot previous values for rollback
      const previousCourse = queryClient.getQueryData(coursesKeys.detail(id))
      const previousList = queryClient.getQueryData(coursesKeys.list())

      // Note: Skipping optimistic updates to avoid complexity
      // Cache will update on success

      return { previousCourse, previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousCourse) {
        queryClient.setQueryData(
          coursesKeys.detail(variables.id),
          context.previousCourse
        )
      }
      if (context?.previousList) {
        queryClient.setQueryData(coursesKeys.list(), context.previousList)
      }

      console.error('Failed to update course:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update course'
      toast.error(message)
    },
    onSuccess: (updatedCourse, variables) => {
      // Update cache with server response
      queryClient.setQueryData(coursesKeys.detail(variables.id), updatedCourse)

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() })

      toast.success('Course updated successfully!')
    },
  })
}

/**
 * Hook to delete a course with optimistic updates
 */
export function useDeleteCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deleteCourse(id)
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: coursesKeys.lists() })

      // Snapshot
      const previousList = queryClient.getQueryData(coursesKeys.list())

      // Optimistically remove from list
      queryClient.setQueryData<Course[]>(coursesKeys.list(), (old) => {
        if (!old) return old
        return old.filter((course: Course) => course.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(coursesKeys.list(), context.previousList)
      }

      console.error('Failed to delete course:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to delete course'
      toast.error(message)
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: coursesKeys.detail(deletedId) })

      // Invalidate list
      queryClient.invalidateQueries({ queryKey: coursesKeys.lists() })

      toast.success('Course deleted successfully!')
    },
  })
}

/**
 * Hook to prefetch courses data
 * Useful for improving perceived performance
 */
export function usePrefetchCourses() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: coursesKeys.list(),
      queryFn: async () => {
        const response = await apiService.getCourses()
        return response
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}

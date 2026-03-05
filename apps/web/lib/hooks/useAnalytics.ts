import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Analytics interfaces
export interface DashboardStats {
  total_students: number
  total_teachers: number
  total_groups: number
  active_courses: number
  pending_tasks: number
}

export interface AnalyticsData {
  general: {
    total_active_students: number
    total_groups: number
    active_leads: number
  }
  this_month: {
    new_students: number
    income: number
    expense: number
    net_profit: number
    new_leads: number
    converted_leads: number
    lead_conversion_rate: string
  }
  kpis?: {
    total_students: number
    total_teachers: number
    total_groups: number
    total_courses: number
    total_branches: number
    active_students_30d: number
    attendance_rate_30d: number
    excused_rate_30d: number
    unexcused_rate_30d: number
    avg_exam_score_30d: number
    exam_pass_rate_30d: number
    monthly_income: number
    monthly_expense: number
    monthly_net_profit: number
    arpu_minor: number
    student_teacher_ratio: number
    groups_per_teacher: number
    avg_group_size: number
    outstanding_balance: number
    pending_payment_amount: number
    at_risk_students_30d: number
    lms_completion_rate: number
    avg_watch_minutes: number
  }
  trends?: Array<{
    key: string
    label: string
    new_students: number
    income: number
    expense: number
    net_profit: number
    new_leads: number
    converted_leads: number
    attendance_rate: number
    avg_exam_score: number
  }>
  distribution?: {
    lead_status: Array<{ key: string; label: string; count: number }>
    payment_status: Array<{ key: string; label: string; count: number; amount: number }>
    students_by_branch: Array<{ name: string; students: number }>
    students_by_gender: Array<{ key: string; label: string; count: number }>
    top_courses: Array<{ course: string; students: number }>
    attendance_status_this_month: Array<{ key: string; count: number }>
  }
  operations?: {
    today_attendance: {
      present: number
      excused: number
      unexcused: number
      total: number
    }
    active_group_sessions_today: number
    pending_payment_count: number
    failed_payment_count: number
    paid_payment_count: number
    failed_payment_amount: number
    unpaid_teacher_count: number
    unpaid_teacher_amount: number
    open_tickets: number
    overdue_pending_payments: number
  }
  report_generated_at: string
}

export interface Report {
  id: string
  type: string
  title: string
  generated_at: string
  period: string
  summary: {
    [key: string]: any
  }
  data?: any[]
  charts?: any[]
}

// Query keys factory for consistent cache management
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboardStats: () => [...analyticsKeys.all, 'dashboard-stats'] as const,
  analytics: () => [...analyticsKeys.all, 'data'] as const,
  reports: () => [...analyticsKeys.all, 'reports'] as const,
  reportsList: (filters: { page?: number; limit?: number; [key: string]: any } = {}) =>
    [...analyticsKeys.reports(), filters] as const,
}

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: analyticsKeys.dashboardStats(),
    queryFn: async () => {
      const data = await apiService.getDashboardStats()
      return data as DashboardStats
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch analytics data
 */
export function useAnalytics() {
  return useQuery({
    queryKey: analyticsKeys.analytics(),
    queryFn: async () => {
      const data = await apiService.getAnalytics()
      return data as AnalyticsData
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch reports list
 */
export function useReports(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<Report>, Error>({
    queryKey: analyticsKeys.reportsList(filters),
    queryFn: async () => {
      const data = await apiService.getReports(filters)
      return data as PaginatedResponse<Report>
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to generate a new report
 */
export function useGenerateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reportType,
      options,
    }: {
      reportType: string
      options: { period: string, start_date?: string, end_date?: string }
    }) => {
      const report = await apiService.generateReport(reportType, options)
      return report as Report
    },
    onSuccess: (newReport) => {
      // Optimistically add to reports list
      queryClient.setQueryData<Report[]>(analyticsKeys.reportsList(), (old) => {
        if (!old) return [newReport]
        return [newReport, ...old]
      })

      // Invalidate reports list to refetch
      queryClient.invalidateQueries({ queryKey: analyticsKeys.reports() })

      toast.success('Report generated successfully')
    },
    onError: (error: any) => {
      console.error('Failed to generate report:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to generate report'
      toast.error(message)
    },
  })
}

/**
 * Hook to refresh all analytics data
 */
export function useRefreshAnalytics() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
  }
}

/**
 * Hook to prefetch analytics data
 * Useful for improving perceived performance
 */
export function usePrefetchAnalytics() {
  const queryClient = useQueryClient()

  return () => {
    // Prefetch all analytics queries
    queryClient.prefetchQuery({
      queryKey: analyticsKeys.dashboardStats(),
      queryFn: async () => {
        const data = await apiService.getDashboardStats()
        return data as DashboardStats
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: analyticsKeys.analytics(),
      queryFn: async () => {
        const data = await apiService.getAnalytics()
        return data as AnalyticsData
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: analyticsKeys.reportsList(),
      queryFn: async () => {
        const data = await apiService.getReports()
        return (data.results || []) as Report[]
      },
      staleTime: 1 * 60 * 1000,
    })
  }
}

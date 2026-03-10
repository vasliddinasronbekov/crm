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
  report_id?: string
  type: string
  report_type?: string
  title: string
  description?: string
  generated_at: string
  updated_at?: string
  period: string
  start_date?: string
  end_date?: string
  status?: 'generating' | 'completed' | 'failed' | string
  generated_by?: number | null
  generated_by_name?: string
  summary: {
    [key: string]: any
  }
  data?: any[]
  charts?: any[]
  error_message?: string
  pdf_file?: string | null
  csv_file?: string | null
}

export interface ScheduledReport {
  id: number
  report_type: string
  frequency: 'daily' | 'weekly' | 'monthly'
  day_of_week?: string | null
  time: string
  recipients: string
  recipients_list?: string[]
  enabled: boolean
  created_by?: number | null
  created_by_name?: string
  created_at: string
  updated_at: string
  last_run?: string | null
  next_run?: string | null
  parameters?: Record<string, any>
  status_display?: string
}

export interface ReportGeneration {
  id: number
  scheduled_report?: number | null
  scheduled_report_info?: {
    id: number
    type: string
    frequency: string
  } | null
  report_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  started_at: string
  completed_at?: string | null
  duration?: number | null
  file_path?: string
  file_url?: string
  error_message?: string
  parameters?: Record<string, any>
  result_data?: Record<string, any>
}

// Query keys factory for consistent cache management
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboardStats: () => [...analyticsKeys.all, 'dashboard-stats'] as const,
  analytics: () => [...analyticsKeys.all, 'data'] as const,
  reports: () => [...analyticsKeys.all, 'reports'] as const,
  reportsList: (filters: { page?: number; limit?: number; [key: string]: any } = {}) =>
    [...analyticsKeys.reports(), filters] as const,
  scheduledReports: (filters: { page?: number; limit?: number; [key: string]: any } = {}) =>
    [...analyticsKeys.reports(), 'scheduled', filters] as const,
  reportGenerations: (filters: { page?: number; limit?: number; [key: string]: any } = {}) =>
    [...analyticsKeys.reports(), 'generations', filters] as const,
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
 * Hook to fetch single report detail
 */
export function useReport(reportId: string | null) {
  return useQuery<Report, Error>({
    queryKey: [...analyticsKeys.reports(), 'detail', reportId],
    queryFn: async () => {
      if (!reportId) {
        throw new Error('reportId is required')
      }
      const data = await apiService.getReport(reportId)
      return data as Report
    },
    enabled: Boolean(reportId),
    staleTime: 60 * 1000,
  })
}

/**
 * Hook to fetch scheduled reports
 */
export function useScheduledReports(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<ScheduledReport>, Error>({
    queryKey: analyticsKeys.scheduledReports(filters),
    queryFn: async () => {
      const data = await apiService.getScheduledReports(filters)
      return data as PaginatedResponse<ScheduledReport>
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch report generation history
 */
export function useReportGenerations(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<ReportGeneration>, Error>({
    queryKey: analyticsKeys.reportGenerations(filters),
    queryFn: async () => {
      const data = await apiService.getReportGenerations(filters)
      return data as PaginatedResponse<ReportGeneration>
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useCreateScheduledReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      report_type: string
      frequency: 'daily' | 'weekly' | 'monthly'
      day_of_week?: string | null
      time: string
      recipients: string
      enabled?: boolean
      parameters?: Record<string, any>
    }) => {
      const data = await apiService.createScheduledReport(payload)
      return data as ScheduledReport
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.reports(), 'scheduled'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to create scheduled report'
      toast.error(message)
    },
  })
}

export function useToggleScheduledReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const data = await apiService.toggleScheduledReport(id)
      return data as ScheduledReport
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.reports(), 'scheduled'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update scheduled report'
      toast.error(message)
    },
  })
}

export function useDeleteScheduledReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deleteScheduledReport(id)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.reports(), 'scheduled'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to delete scheduled report'
      toast.error(message)
    },
  })
}

export function useRunScheduledReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const data = await apiService.runScheduledReportNow(id)
      return data as { message?: string; generation_id?: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.reports(), 'generations'] })
      queryClient.invalidateQueries({ queryKey: analyticsKeys.reports() })
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.reports(), 'scheduled'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to trigger report generation'
      toast.error(message)
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.reports() })
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
        return data as PaginatedResponse<Report>
      },
      staleTime: 1 * 60 * 1000,
    })
  }
}

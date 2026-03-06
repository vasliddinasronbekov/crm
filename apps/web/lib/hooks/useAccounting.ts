import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import {
  useStudentBalances,
  useTeacherEarnings,
  useStudentFines,
  useFinancialSummaries,
  useCreateStudentFine,
  useUpdateStudentFine,
  useDeleteStudentFine,
  financeKeys,
  type StudentBalance,
  type TeacherEarning,
  type StudentFine,
  type FinancialSummary,
} from './useFinance'

// Re-export Finance hooks for convenience
export {
  useStudentBalances,
  useTeacherEarnings,
  useStudentFines,
  useFinancialSummaries,
  useCreateStudentFine,
  useUpdateStudentFine,
  useDeleteStudentFine,
  financeKeys,
  type StudentBalance,
  type TeacherEarning,
  type StudentFine,
  type FinancialSummary,
}

// Accounting-specific interfaces for extended functionality
export interface StudentBalanceExtended {
  id: number
  student: any
  group: any
  total_fee: number
  total_fee_sum?: number | string
  paid_amount: number
  paid_amount_sum?: number | string
  fine_amount: number
  balance: number
  balance_coins?: number
  balance_sum?: number | string
  is_fully_paid: boolean
  last_payment_date?: string
  payment_percentage?: number
}

export interface TeacherEarningExtended {
  id: number
  teacher: any
  payment: any
  group: any
  payment_amount: number
  payment_amount_sum?: number | string
  percentage_applied: number
  amount: number
  amount_sum?: number | string
  is_paid_to_teacher: boolean
  paid_date?: string
  date: string
}

export interface StudentFineExtended {
  id: number
  student: any
  fine_type: any
  group: any
  amount: number
  amount_sum?: number | string
  reason: string
  description: string
  is_paid: boolean
  paid_date?: string
  applied_date: string
  is_automatic: boolean
}

export interface FinancialSummaryExtended {
  id: number
  date: string
  total_payments: number
  total_payments_sum?: number | string
  payment_count: number
  total_expenses: number
  total_expenses_sum?: number | string
  expense_count: number
  total_teacher_earnings: number
  total_teacher_earnings_sum?: number | string
  teacher_earnings_paid: number
  teacher_earnings_paid_sum?: number | string
  total_fines: number
  total_fines_sum?: number | string
  fines_paid: number
  fines_paid_sum?: number | string
  gross_revenue: number
  gross_revenue_sum?: number | string
  net_profit: number
  net_profit_sum?: number | string
}

export interface AccountingActivityLogEntry {
  id: number
  action_type: string
  actor_username?: string
  student_username?: string
  group_name?: string
  message: string
  amount_tiyin?: number | null
  balance_after_tiyin?: number | null
  metadata?: Record<string, any>
  created_at: string
}

export interface AccountingRealtimeDashboard {
  total_income_tiyin: number
  total_debt_tiyin: number
  raw_debt_tiyin: number
  total_balance_tiyin: number
  net_profit_tiyin: number
  teacher_payroll_tiyin: number
  total_income_sum: number
  total_debt_sum: number
  net_profit_sum: number
  teacher_payroll_sum: number
  recent_logs: AccountingActivityLogEntry[]
}

/**
 * Hook to mark a teacher earning as paid
 */
export function useMarkEarningPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, paid_date }: { id: number; paid_date: string }) => {
      const response = await apiService.markTeacherEarningPaid(id, { paid_date })
      return response
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['finance', 'teacher-earnings'] })

      // Snapshot previous values
      const previousEarnings = queryClient.getQueryData(['finance', 'teacher-earnings'])

      // Optimistically update
      queryClient.setQueryData(['finance', 'teacher-earnings'], (old: any) => {
        if (!old) return old
        return old.map((earning: TeacherEarningExtended) =>
          earning.id === id
            ? { ...earning, is_paid_to_teacher: true, paid_date: new Date().toISOString().split('T')[0] }
            : earning
        )
      })

      return { previousEarnings }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousEarnings) {
        queryClient.setQueryData(['finance', 'teacher-earnings'], context.previousEarnings)
      }

      console.error('Failed to mark earning as paid:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to mark as paid'
      toast.error(message)
    },
    onSuccess: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['finance', 'teacher-earnings'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'financial-summaries'] })

      toast.success('Earning marked as paid')
    },
  })
}

/**
 * Hook to mark a student fine as paid
 */
export function useMarkFinePaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, paid_date }: { id: number; paid_date: string }) => {
      const response = await apiService.markFinePaid(id, { paid_date })
      return response
    },
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['finance', 'student-fines'] })

      // Snapshot previous values
      const previousFines = queryClient.getQueryData(['finance', 'student-fines'])

      // Optimistically update
      queryClient.setQueryData(['finance', 'student-fines'], (old: any) => {
        if (!old) return old
        return old.map((fine: StudentFineExtended) =>
          fine.id === id
            ? { ...fine, is_paid: true, paid_date: new Date().toISOString().split('T')[0] }
            : fine
        )
      })

      return { previousFines }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousFines) {
        queryClient.setQueryData(['finance', 'student-fines'], context.previousFines)
      }

      console.error('Failed to mark fine as paid:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to mark fine as paid'
      toast.error(message)
    },
    onSuccess: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['finance', 'student-fines'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'financial-summaries'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'student-balances'] })

      toast.success('Fine marked as paid')
    },
  })
}

/**
 * Helper hook to calculate accounting summary statistics
 */
export function useAccountingSummaryStats() {
  const { data: balancesData } = useStudentBalances()
  const balances = balancesData?.results || []
  const { data: earningsData } = useTeacherEarnings()
  const earnings = earningsData?.results || []
  const { data: finesData } = useStudentFines()
  const fines = finesData?.results || []

  const stats = {
    totalDebt: balances.reduce((sum: number, b: StudentBalance) => sum + (b.balance > 0 ? b.balance : 0), 0),
    totalCollected: balances.reduce((sum: number, b: StudentBalance) => sum + b.paid_amount, 0),
    unpaidEarnings: earnings
      .filter((e: TeacherEarning) => !e.is_paid_to_teacher)
      .reduce((sum: number, e: TeacherEarning) => sum + e.amount, 0),
    unpaidFines: fines
      .filter((f: StudentFine) => !f.is_paid)
      .reduce((sum: number, f: StudentFine) => sum + f.amount, 0),
  }

  return stats
}

export function useRealtimeAccountingDashboard(limit: number = 20) {
  return useQuery<AccountingRealtimeDashboard>({
    queryKey: ['accounting', 'realtime-dashboard', limit],
    queryFn: async () => {
      const data = await apiService.getAccountingRealtimeDashboard({ limit })
      return data
    },
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from 'react-hot-toast'

// General Paginated Response Interface
export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Finance interfaces
export interface FinancialSummary {
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

export interface Payment {
  id: number
  amount: number
  status: string
  date: string
  by_user?: {
    first_name: string
    last_name?: string
    username?: string
  }
}

export interface StudentBalance {
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

export interface TeacherEarning {
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

export interface StudentFine {
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

export interface PaymentStats {
  total: number
  paid: number
  pending: number
  failed: number
  totalRevenue: number
  pendingAmount: number
}

export interface AccountingStats {
  totalStudentBalance: number
  totalTeacherEarnings: number
  totalFines: number
  paidEarnings: number
  pendingEarnings: number
}

// Query keys factory for consistent cache management
export const financeKeys = {
  all: ['finance'] as const,
  financialSummaries: () => [...financeKeys.all, 'financial-summaries'] as const,
  payments: () => [...financeKeys.all, 'payments'] as const,
  studentBalances: () => [...financeKeys.all, 'student-balances'] as const,
  teacherEarnings: () => [...financeKeys.all, 'teacher-earnings'] as const,
  studentFines: () => [...financeKeys.all, 'student-fines'] as const,
}

/**
 * Hook to fetch financial summaries
 */
export function useFinancialSummaries() {
  return useQuery<PaginatedResponse<FinancialSummary>>({
    queryKey: financeKeys.financialSummaries(),
    queryFn: async () => {
      const data = await apiService.getFinancialSummaries();
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch payments
 */
export function usePayments() {
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: financeKeys.payments(),
    queryFn: async () => {
      const data = await apiService.getPayments();
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch student balances
 */
export function useStudentBalances(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<StudentBalance>>({
    queryKey: [...financeKeys.studentBalances(), filters],
    queryFn: async () => {
      const data = await apiService.getStudentBalances(filters);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch teacher earnings
 */
export function useTeacherEarnings(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<TeacherEarning>>({
    queryKey: [...financeKeys.teacherEarnings(), filters],
    queryFn: async () => {
      const data = await apiService.getTeacherEarnings(filters);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch student fines
 */
export function useStudentFines(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery<PaginatedResponse<StudentFine>>({
    queryKey: [...financeKeys.studentFines(), filters],
    queryFn: async () => {
      const data = await apiService.getStudentFines(filters);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new student fine
 */
export function useCreateStudentFine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => apiService.createStudentFine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.studentFines() })
      toast.success('Fine created successfully')
    },
    onError: (error: any) => {
      console.error('Failed to create fine:', error)
      const message = error.response?.data?.detail || 'Failed to create fine'
      toast.error(message)
    },
  })
}

/**
 * Hook to update a student fine
 */
export function useUpdateStudentFine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiService.updateStudentFine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.studentFines() })
      toast.success('Fine updated successfully')
    },
    onError: (error: any) => {
      console.error('Failed to update fine:', error)
      const message = error.response?.data?.detail || 'Failed to update fine'
      toast.error(message)
    },
  })
}

/**
 * Hook to delete a student fine
 */
export function useDeleteStudentFine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiService.deleteStudentFine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.studentFines() })
      toast.success('Fine deleted successfully')
    },
    onError: (error: any) => {
      console.error('Failed to delete fine:', error)
      const message = error.response?.data?.detail || 'Failed to delete fine'
      toast.error(message)
    },
  })
}

/**
 * Hook to create a new payment
 */
export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => apiService.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.payments() })
      queryClient.invalidateQueries({ queryKey: financeKeys.studentBalances() })
      toast.success('Payment created successfully')
    },
    onError: (error: any) => {
      console.error('Failed to create payment:', error)
      const message = error.response?.data?.detail || 'Failed to create payment'
      toast.error(message)
    },
  })
}

/**
 * Hook to create a new expense
 */
export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => apiService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all }) // Invalidate all finance data
      toast.success('Expense created successfully')
    },
    onError: (error: any) => {
      console.error('Failed to create expense:', error)
      const message = error.response?.data?.detail || 'Failed to create expense'
      toast.error(message)
    },
  })
}

/**
 * Helper hook to calculate payment stats from payments data
 */
export function usePaymentStats() {
  const { data: paymentsData } = usePayments()
  const payments = paymentsData?.results || []

  const stats: PaymentStats = {
    total: payments.length,
    paid: payments.filter((p: Payment) => p.status === 'paid').length,
    pending: payments.filter((p: Payment) => p.status === 'pending').length,
    failed: payments.filter((p: Payment) => p.status === 'failed').length,
    totalRevenue: payments
      .filter((p: Payment) => p.status === 'paid')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0),
    pendingAmount: payments
      .filter((p: Payment) => p.status === 'pending')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0),
  }

  return stats
}

/**
 * Helper hook to calculate accounting stats from balances, earnings, and fines
 */
export function useAccountingStats() {
  const { data: studentBalancesData } = useStudentBalances()
  const studentBalances = studentBalancesData?.results || []
  const { data: teacherEarningsData } = useTeacherEarnings()
  const teacherEarnings = teacherEarningsData?.results || []
  const { data: studentFinesData } = useStudentFines()
  const studentFines = studentFinesData?.results || []

  const stats: AccountingStats = {
    totalStudentBalance: studentBalances.reduce(
      (sum: number, b: StudentBalance) => sum + b.balance,
      0
    ),
    totalTeacherEarnings: teacherEarnings.reduce(
      (sum: number, e: TeacherEarning) => sum + e.amount,
      0
    ),
    totalFines: studentFines.reduce(
      (sum: number, f: StudentFine) => sum + f.amount,
      0
    ),
    paidEarnings: teacherEarnings
      .filter((e: TeacherEarning) => e.is_paid_to_teacher)
      .reduce((sum: number, e: TeacherEarning) => sum + e.amount, 0),
    pendingEarnings: teacherEarnings
      .filter((e: TeacherEarning) => !e.is_paid_to_teacher)
      .reduce((sum: number, e: TeacherEarning) => sum + e.amount, 0),
  }

  return stats
}

/**
 * Hook to refresh all finance data
 */
export function useRefreshFinance() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: financeKeys.all })
  }
}

/**
 * Hook to prefetch finance data
 * Useful for improving perceived performance
 */
export function usePrefetchFinance() {
  const queryClient = useQueryClient()

  return () => {
    // Prefetch all finance queries
    queryClient.prefetchQuery({
      queryKey: financeKeys.financialSummaries(),
      queryFn: async () => {
        const data = await apiService.getFinancialSummaries()
        return (data.results || data || []) as FinancialSummary[]
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: financeKeys.payments(),
      queryFn: async () => {
        const data = await apiService.getPayments()
        return (data.results || data || []) as Payment[]
      },
      staleTime: 1 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: financeKeys.studentBalances(),
      queryFn: async () => {
        const data = await apiService.getStudentBalances().catch(() => ({ results: [] }))
        return (data.results || data || []) as StudentBalance[]
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: financeKeys.teacherEarnings(),
      queryFn: async () => {
        const data = await apiService.getTeacherEarnings().catch(() => ({ results: [] }))
        return (data.results || data || []) as TeacherEarning[]
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: financeKeys.studentFines(),
      queryFn: async () => {
        const data = await apiService.getStudentFines().catch(() => ({ results: [] }))
        return (data.results || data || []) as StudentFine[]
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

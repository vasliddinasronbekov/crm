import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from '@/lib/toast'

// Payment interfaces
export interface Payment {
  id: number
  date: string
  by_user: {
    id: number
    username: string
    first_name: string
    last_name: string
  }
  status: 'pending' | 'paid' | 'failed'
  group?: {
    id: number
    name: string
  }
  teacher?: {
    id: number
    username: string
    first_name: string
    last_name: string
  }
  amount: number
  payment_type?: {
    id: number
    name: string
  }
  detail?: string
  course_price: number
  transaction_id?: string
  student_full_name?: string
  payment_type_name?: string
  group_name?: string
  branch_name?: string
  course_service_name?: string
  is_cash_payment?: boolean
  has_cash_receipt?: boolean
  cash_receipt?: {
    id: number
    receipt_number: string
    receipt_token: string
    issued_at: string
    payment_method: string
    paid_amount: number
    remaining_balance: number
    note?: string
  }
}

export interface PaymentFormData {
  by_user: string
  amount: number
  course_price: number
  status: 'pending' | 'paid' | 'failed'
  group?: string
  course?: string
  pricing_mode?: 'course' | 'manual'
  detail?: string
  date: string
  payment_type?: string
  teacher?: string
}

export interface PaymentStats {
  totalRevenue: number
  pendingAmount: number
  failedAmount: number
  averagePayment: number
}

export interface PaymentTrend {
  month: string
  amount: number
}

export interface CashReceiptPayload {
  id: number
  payment_id: number
  transaction_id: string
  receipt_number: string
  receipt_token: string
  issued_at: string
  issued_at_display: string
  education_center_name: string
  logo_url?: string
  branch: string
  cashier_full_name: string
  student_full_name: string
  group_name: string
  course_service_name: string
  payment_method: string
  paid_amount: number
  remaining_balance: number
  note?: string
  verification_url: string
  qr_payload_json: string
  qr_code_image: string
}

export interface PaymentTypeOption {
  id: number
  name: string
  code?: string | null
  is_active?: boolean
  display_order?: number
}

export interface PaymentCourseOption {
  id: number
  name?: string
  price?: number
}

export interface PaymentAuditTrailEntry {
  id: number
  payment_id_snapshot: number
  transaction_id_snapshot: string
  event_type: 'created' | 'updated' | 'deleted'
  changed_by_user?: number | null
  changed_by_user_name?: string
  changed_by_display?: string
  amount_before?: number | null
  amount_after?: number | null
  course_price_before?: number | null
  course_price_after?: number | null
  status_before?: string
  status_after?: string
  changed_fields: string[]
  previous_snapshot: Record<string, any>
  new_snapshot: Record<string, any>
  metadata: Record<string, any>
  source: string
  request_method?: string
  request_path?: string
  ip_address?: string
  created_at: string
}

export interface PaymentReconciliationIssue {
  payment_id: number
  date: string
  student_name: string
  group_name: string
  payment_method_code: string
  payment_method_name: string
  status: 'pending' | 'paid' | 'failed'
  amount: number
  transaction_id: string
  issues: string[]
  can_sync_external: boolean
}

export interface PaymentReconciliationOverview {
  summary: {
    checked_count: number
    mismatch_count: number
    syncable_count: number
    counts_by_issue: Record<string, number>
    counts_by_method: Record<string, number>
  }
  results: PaymentReconciliationIssue[]
}

export interface PaymentReconciliationSyncResult {
  payment_id: number
  result: 'updated' | 'no_change' | 'skipped' | 'unknown_provider_state' | 'not_found_or_forbidden' | 'error'
  previous_status?: string
  next_status?: string
  provider_status?: string
  reason?: string
}

export interface PaymentStudentContext {
  id: number
  full_name: string
  groups: Array<{
    id: number
    name: string
    branch?: string
    course?: string
    is_active?: boolean
  }>
  payments: {
    total_paid: number
    pending_amount: number
    payment_count: number
    last_payment_date?: string
    last_payment_amount?: number
  }
  account?: {
    status?: string
    balance?: number
    balance_tiyin?: number
  }
}

const normalizePaymentMethod = (value?: string | null): string =>
  (value || '').trim().toLowerCase()

export const isCashPaymentTypeName = (name?: string | null): boolean => {
  const normalized = normalizePaymentMethod(name)
  return ['cash', 'naqd', 'наличные', 'нал'].includes(normalized)
}

export const isCashPaymentType = (paymentType?: PaymentTypeOption | null): boolean => {
  if (!paymentType) return false
  if (normalizePaymentMethod(paymentType.code) === 'cash') return true
  return isCashPaymentTypeName(paymentType.name)
}

const parseListPayload = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

const fetchAllPaginated = async <T,>(fetchPage: (page: number) => Promise<any>): Promise<T[]> => {
  const collected: T[] = []
  let page = 1

  while (page <= 200) {
    const payload = await fetchPage(page)
    collected.push(...parseListPayload<T>(payload))
    if (!payload?.next) break
    page += 1
  }

  return collected
}

// Query keys factory for consistent cache management
export const paymentsKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentsKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...paymentsKeys.lists(), filters] as const,
  details: () => [...paymentsKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...paymentsKeys.details(), id] as const,
  students: () => ['students'] as const,
  groups: () => ['groups'] as const,
  courses: () => ['courses'] as const,
  paymentTypes: () => ['payment-types'] as const,
  teachers: () => ['teachers'] as const,
  studentContext: (studentId: number) => [...paymentsKeys.all, 'student-context', studentId] as const,
  reconciliationOverview: (params?: Record<string, any>) =>
    [...paymentsKeys.all, 'reconciliation-overview', params || {}] as const,
  reconciliationSync: () => [...paymentsKeys.all, 'reconciliation-sync'] as const,
  auditTrail: (paymentId: number, limit: number) =>
    [...paymentsKeys.all, 'audit-trail', paymentId, limit] as const,
}

/**
 * Hook to fetch all payments with automatic caching
 */
export function usePaymentsList({ page = 1, limit = 10, ...restFilters }: { page?: number, limit?: number, [key: string]: any } = {}) {
  const filters = { page, page_size: limit, ...restFilters };
  return useQuery({
    queryKey: paymentsKeys.list(filters),
    queryFn: async () => {
      const data = await apiService.getPayments(filters);
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch students for payment form
 */
export function usePaymentStudents() {
  return useQuery({
    queryKey: paymentsKeys.students(),
    queryFn: async () => fetchAllPaginated((page) => apiService.getStudents({ page })),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch groups for payment filtering
 */
export function usePaymentGroups() {
  return useQuery({
    queryKey: paymentsKeys.groups(),
    queryFn: async () => fetchAllPaginated((page) => apiService.getGroups({ page })),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch courses for payment pricing/autofill.
 */
export function usePaymentCourses() {
  return useQuery({
    queryKey: paymentsKeys.courses(),
    queryFn: async () => fetchAllPaginated((page) => apiService.getCourses({ page })),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Hook to fetch payment types
 */
export function usePaymentTypes() {
  return useQuery({
    queryKey: paymentsKeys.paymentTypes(),
    queryFn: async () => {
      const data = await apiService.getPaymentTypes()
      return data.results || data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (rarely changes)
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch teachers for payment form
 */
export function usePaymentTeachers() {
  return useQuery({
    queryKey: paymentsKeys.teachers(),
    queryFn: async () => fetchAllPaginated((page) => apiService.getTeachers({ page })),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function usePaymentAuditTrail(paymentId?: number, limit = 100) {
  return useQuery({
    queryKey: paymentsKeys.auditTrail(paymentId || 0, limit),
    queryFn: async () => {
      if (!paymentId) return { count: 0, results: [] as PaymentAuditTrailEntry[] }
      const data = await apiService.getPaymentAuditTrail(paymentId, { limit })
      return {
        count: Number(data?.count || 0),
        results: Array.isArray(data?.results) ? (data.results as PaymentAuditTrailEntry[]) : [],
      }
    },
    enabled: Boolean(paymentId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function usePaymentStudentContext(studentId?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentsKeys.studentContext(studentId || 0),
    queryFn: async () => {
      if (!studentId) return null

      const payload = await apiService.getStudentDetail(studentId)
      return {
        id: Number(payload?.id || studentId),
        full_name: String(payload?.full_name || payload?.username || ''),
        groups: Array.isArray(payload?.groups)
          ? payload.groups.map((group: any) => ({
              id: Number(group?.id || 0),
              name: String(group?.name || ''),
              branch: group?.branch || '',
              course: group?.course || '',
              is_active: Boolean(group?.is_active),
            }))
          : [],
        payments: {
          total_paid: Number(payload?.payments?.total_paid || 0),
          pending_amount: Number(payload?.payments?.pending_amount || 0),
          payment_count: Number(payload?.payments?.payment_count || 0),
          last_payment_date: payload?.payments?.last_payment_date || undefined,
          last_payment_amount:
            payload?.payments?.last_payment_amount !== undefined
              ? Number(payload?.payments?.last_payment_amount || 0)
              : undefined,
        },
        account: payload?.account
          ? {
              status: payload.account.status,
              balance: Number(payload.account.balance || 0),
              balance_tiyin: Number(payload.account.balance_tiyin || 0),
            }
          : undefined,
      } as PaymentStudentContext
    },
    enabled: Boolean(studentId) && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function usePaymentReconciliationOverview(params?: {
  limit?: number
  stale_pending_days?: number
  methods?: string
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentsKeys.reconciliationOverview(params),
    queryFn: async () => {
      const data = await apiService.getPaymentReconciliationOverview(params)
      return {
        summary: {
          checked_count: Number(data?.summary?.checked_count || 0),
          mismatch_count: Number(data?.summary?.mismatch_count || 0),
          syncable_count: Number(data?.summary?.syncable_count || 0),
          counts_by_issue: data?.summary?.counts_by_issue || {},
          counts_by_method: data?.summary?.counts_by_method || {},
        },
        results: Array.isArray(data?.results)
          ? (data.results as PaymentReconciliationIssue[])
          : [],
      } as PaymentReconciliationOverview
    },
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useSyncPaymentReconciliation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { payment_ids: number[]; dry_run?: boolean }) => {
      const response = await apiService.syncPaymentReconciliation(payload)
      return response as {
        dry_run: boolean
        requested_count: number
        results: PaymentReconciliationSyncResult[]
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all })
      const updatedCount = response.results.filter((item) => item.result === 'updated').length
      if (updatedCount > 0) {
        toast.success(`Reconciliation synced ${updatedCount} payment(s)`)
      } else {
        toast.success('Reconciliation sync completed')
      }
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to run reconciliation sync'
      toast.error(message)
    },
  })
}

/**
 * Hook to create a new payment with optimistic updates
 */
export function useCreatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await apiService.createPayment({
        ...data,
        amount: Math.round(data.amount * 100), // Convert to tiyin
        course_price: Math.round(data.course_price * 100),
      })
      return response as Payment
    },
    onSuccess: (newPayment) => {
      // Invalidate payments list to refetch
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all })

      // Optimistically add to cache
      queryClient.setQueryData<Payment[]>(paymentsKeys.list(), (old) => {
        if (!old) return [newPayment]
        return [...old, newPayment]
      })

      toast.success('Payment created successfully')
    },
    onError: (error: any) => {
      console.error('Failed to create payment:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create payment'
      toast.error(message)
    },
  })
}

/**
 * Hook to update an existing payment
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: {
        status?: 'pending' | 'paid' | 'failed'
        amount?: number
        detail?: string
      }
    }) => {
      const response = await apiService.updatePayment(id, {
        ...data,
        amount: data.amount ? Math.round(data.amount * 100) : undefined,
      })
      return response as Payment
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: paymentsKeys.all })

      // Snapshot previous values
      const previousList = queryClient.getQueryData(paymentsKeys.list())

      // Optimistically update the cache
      queryClient.setQueryData<Payment[]>(paymentsKeys.list(), (old) => {
        if (!old) return old
        return old.map((payment: Payment) =>
          payment.id === id ? { ...payment, ...data } : payment
        )
      })

      return { previousList }
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(paymentsKeys.list(), context.previousList)
      }

      console.error('Failed to update payment:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update payment'
      toast.error(message)
    },
    onSuccess: (updatedPayment, variables) => {
      // Update cache with server response
      queryClient.setQueryData<Payment[]>(paymentsKeys.list(), (old) => {
        if (!old) return old
        return old.map((payment: Payment) =>
          payment.id === variables.id ? { ...payment, ...updatedPayment } : payment
        )
      })

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all })

      toast.success('Payment updated successfully')
    },
  })
}

/**
 * Hook to delete a payment with optimistic updates
 */
export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await apiService.deletePayment(id)
      return id
    },
    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: paymentsKeys.all })

      // Snapshot previous values
      const previousList = queryClient.getQueryData(paymentsKeys.list())

      // Optimistically remove from list
      queryClient.setQueryData<Payment[]>(paymentsKeys.list(), (old) => {
        if (!old) return old
        return old.filter((payment: Payment) => payment.id !== id)
      })

      return { previousList }
    },
    onError: (error: any, id, context) => {
      // Rollback on error
      if (context?.previousList) {
        queryClient.setQueryData(paymentsKeys.list(), context.previousList)
      }

      console.error('Failed to delete payment:', error)
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to delete payment'
      toast.error(message)
    },
    onSuccess: () => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all })

      toast.success('Payment deleted successfully')
    },
  })
}

/**
 * Hook to send a payment reminder
 */
export function useSendPaymentReminder() {
  return useMutation({
    mutationFn: (id: number) => apiService.sendPaymentReminder(id),
    onSuccess: () => {
      toast.success('Payment reminder sent')
    },
    onError: (error: any) => {
      console.error('Failed to send reminder:', error)
      toast.error('Failed to send reminder')
    },
  })
}

/**
 * Hook to send bulk payment reminders
 */
export function useSendBulkPaymentReminders() {
  return useMutation({
    mutationFn: (paymentIds: number[]) => apiService.sendBulkPaymentReminders(paymentIds),
    onSuccess: (data: any, variables) => {
      toast.success(`Sent ${variables.length} payment reminders`)
    },
    onError: (error: any) => {
      console.error('Failed to send bulk reminders:', error)
      toast.error('Failed to send bulk reminders')
    },
  })
}

/**
 * Hook to save auto-reminder settings
 */
export function useSaveAutoReminderSettings() {
  return useMutation({
    mutationFn: (settings: any) => apiService.saveAutoReminderSettings(settings),
    onSuccess: () => {
      toast.success('Auto-reminder settings saved')
    },
    onError: (error: any) => {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save auto-reminder settings')
    },
  })
}


/**
 * Helper hook to calculate payment statistics
 */
export function usePaymentStats(payments: Payment[] = []) {
  const stats: PaymentStats = {
    totalRevenue: payments
      .filter((p: Payment) => p.status === 'paid')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0),
    pendingAmount: payments
      .filter((p: Payment) => p.status === 'pending')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0),
    failedAmount: payments
      .filter((p: Payment) => p.status === 'failed')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0),
    averagePayment:
      payments.length > 0
        ? payments.reduce((sum: number, p: Payment) => sum + p.amount, 0) / payments.length
        : 0,
  };

  return stats;
}

/**
 * Helper hook to calculate payment trends by month
 */
export function usePaymentTrends(payments: Payment[] = []) {
  const trends: { [key: string]: number } = {};
  payments.forEach((payment: Payment) => {
    if (payment.status === 'paid') {
      const month = new Date(payment.date).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
      trends[month] = (trends[month] || 0) + payment.amount;
    }
  });

  const paymentTrends: PaymentTrend[] = Object.entries(trends).map(([month, amount]) => ({
    month,
    amount,
  }));

  return paymentTrends;
}

/**
 * Hook to prefetch payment-related data
 * Useful for improving perceived performance
 */
export function usePrefetchPayments() {
  const queryClient = useQueryClient()

  return () => {
    // Prefetch all payment-related queries
    queryClient.prefetchQuery({
      queryKey: paymentsKeys.list(),
      queryFn: async () => {
        const data = await apiService.getPayments()
        return (data.results || data || []) as Payment[]
      },
      staleTime: 1 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: paymentsKeys.students(),
      queryFn: async () => {
        const data = await apiService.getStudents()
        return data.results || data || []
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: paymentsKeys.groups(),
      queryFn: async () => {
        const data = await apiService.getGroups()
        return data.results || data || []
      },
      staleTime: 2 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: paymentsKeys.paymentTypes(),
      queryFn: async () => {
        const data = await apiService.getPaymentTypes()
        return data.results || data || []
      },
      staleTime: 5 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: paymentsKeys.teachers(),
      queryFn: async () => {
        const data = await apiService.getTeachers()
        return data.results || data || []
      },
      staleTime: 2 * 60 * 1000,
    })
  }
}

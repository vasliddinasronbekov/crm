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
}

export interface PaymentFormData {
  by_user: string
  amount: number
  course_price: number
  status: 'pending' | 'paid' | 'failed'
  group?: string
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
  paymentTypes: () => ['payment-types'] as const,
  teachers: () => ['teachers'] as const,
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

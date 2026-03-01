import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/api'
import toast from 'react-hot-toast'

export interface Expense {
  id: number
  expense_type: number
  expense_type_name?: string
  amount: number
  date: string
  description: string
}

export interface ExpenseType {
  id: number
  name: string
  description: string
}

export const expensesKeys = {
  all: ['expenses'] as const,
  lists: () => [...expensesKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...expensesKeys.lists(), filters] as const,
  types: () => [...expensesKeys.all, 'types'] as const,
}

export function useExpenses(filters: { page?: number; limit?: number; [key: string]: any } = {}) {
  return useQuery({
    queryKey: expensesKeys.list(filters),
    queryFn: async () => {
      const data = await apiService.getExpenses(filters)
      return data
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

export function useExpenseTypes() {
  return useQuery({
    queryKey: expensesKeys.types(),
    queryFn: async () => {
      const data = await apiService.getExpenseTypes()
      return data.results || data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Expense, 'id' | 'expense_type_name'>) => apiService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.lists() })
      toast.success('Expense created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create expense')
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Expense, 'id' | 'expense_type_name'>> }) =>
      apiService.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.lists() })
      toast.success('Expense updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update expense')
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.lists() })
      toast.success('Expense deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete expense')
    },
  })
}

export function useCreateExpenseType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ExpenseType, 'id'>) => apiService.createExpenseType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.types() })
      toast.success('Expense type created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create expense type')
    },
  })
}
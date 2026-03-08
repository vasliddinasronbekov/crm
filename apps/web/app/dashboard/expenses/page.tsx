'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useRouter } from 'next/navigation'
import { Receipt, Plus, Search, Edit, Trash2, X, DollarSign, Tag, TrendingUp } from 'lucide-react'
import {
  useExpenses,
  useExpenseTypes,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCreateExpenseType,
  type Expense,
  type ExpenseType
} from '@/lib/hooks/useExpenses'

export default function ExpensesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { currency, formatCurrencyFromMinor, toSelectedCurrency, fromSelectedCurrency } = useSettings()
  const router = useRouter()

  // UI state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const [monthFilter, setMonthFilter] = useState('')

  // React Query hooks
  const { data: expensesData, isLoading: isLoadingExpenses } = useExpenses({
    page,
    limit,
    search: debouncedSearchTerm,
    month: monthFilter,
  })
  const { data: expenseTypes = [], isLoading: isLoadingTypes } = useExpenseTypes()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const createExpenseType = useCreateExpenseType()

  const loading = isLoadingExpenses || isLoadingTypes
  const expenses = expensesData?.results || []
  const totalExpenses = expensesData?.count || 0
  const totalPages = Math.ceil(totalExpenses / limit)

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const [expenseForm, setExpenseForm] = useState({
    expense_type: 0,
    amount: 0,
    date: '',
    description: ''
  })

  const [typeForm, setTypeForm] = useState({
    name: '',
    description: ''
  })

  // Auth check
  if (!authLoading && !user) {
    router.push('/login')
    return null
  }

  if (!authLoading && user && !user.is_staff && !user.is_superuser) {
    router.push('/dashboard')
    return null
  }

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    createExpense.mutate({
      ...expenseForm,
      amount: Math.round(fromSelectedCurrency(expenseForm.amount) * 100),
    }, {
      onSuccess: () => {
        setShowExpenseModal(false)
        resetExpenseForm()
      }
    })
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return

    updateExpense.mutate({
      id: editingExpense.id,
      data: {
        ...expenseForm,
        amount: Math.round(fromSelectedCurrency(expenseForm.amount) * 100),
      },
    }, {
      onSuccess: () => {
        setShowExpenseModal(false)
        setEditingExpense(null)
        resetExpenseForm()
      }
    })
  }

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure?')) return
    deleteExpense.mutate(id)
  }

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault()
    createExpenseType.mutate(typeForm, {
      onSuccess: () => {
        setShowTypeModal(false)
        resetTypeForm()
      }
    })
  }

  const resetExpenseForm = () => {
    setExpenseForm({ expense_type: 0, amount: 0, date: '', description: '' })
  }

  const resetTypeForm = () => {
    setTypeForm({ name: '', description: '' })
  }

  const stats = {
    total: expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0),
    count: expenses.length,
    avgExpense: expenses.length > 0 ? expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0) / expenses.length : 0,
    types: expenseTypes.length
  }

  const PaginationControls = () => (
    <div className="flex justify-between items-center mt-6 p-4">
      <div className="text-sm text-text-secondary">
        Showing {expenses.length} of {totalExpenses} expenses
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page <= 1}
          className="btn-secondary"
        >
          Previous
        </button>
        <span className="text-text-secondary text-sm">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages}
          className="btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );

  if (authLoading || (loading && page === 1)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" />
            Expenses Management
          </h1>
          <p className="text-text-secondary">Track and manage school expenses</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total (Page)</p>
              <DollarSign className="h-5 w-5 text-error" />
            </div>
            <p className="text-3xl font-bold">{formatCurrencyFromMinor(stats.total)}</p>
            <p className="text-xs text-text-secondary mt-1">{stats.count} expenses on page</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Count</p>
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{totalExpenses}</p>
            <p className="text-xs text-text-secondary mt-1">Total records</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Avg Expense (Page)</p>
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">{formatCurrencyFromMinor(stats.avgExpense)}</p>
            <p className="text-xs text-text-secondary mt-1">Per record on page</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Categories</p>
              <Tag className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">{stats.types}</p>
            <p className="text-xs text-text-secondary mt-1">Expense types</p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value)
                  setPage(1)
                }}
                className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => setShowTypeModal(true)}
                className="px-4 py-2 bg-info/10 text-info rounded-xl hover:bg-info/20 transition-colors flex items-center gap-2 font-medium"
              >
                <Tag className="h-5 w-5" />
                Add Type
              </button>
              <button
                onClick={() => {
                  setEditingExpense(null)
                  resetExpenseForm()
                  setShowExpenseModal(true)
                }}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Add Expense
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left p-4 font-medium text-text-secondary">Date</th>
                  <th className="text-left p-4 font-medium text-text-secondary">Type</th>
                  <th className="text-left p-4 font-medium text-text-secondary">Description</th>
                  <th className="text-left p-4 font-medium text-text-secondary">Amount</th>
                  <th className="text-left p-4 font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense: Expense) => (
                  <tr key={expense.id} className="border-b border-border hover:bg-background transition-colors">
                    <td className="p-4">{new Date(expense.date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-info/20 text-info">
                        {expense.expense_type_name || `Type #${expense.expense_type}`}
                      </span>
                    </td>
                    <td className="p-4">{expense.description}</td>
                    <td className="p-4">
                      <span className="font-bold text-error">{formatCurrencyFromMinor(expense.amount)}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingExpense(expense)
                            setExpenseForm({
                              expense_type: expense.expense_type,
                              amount: toSelectedCurrency(expense.amount / 100),
                              date: expense.date,
                              description: expense.description
                            })
                            setShowExpenseModal(true)
                          }}
                          className="p-2 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-2 hover:bg-error/20 text-error rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {expenses.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
              <p className="text-text-secondary">No expenses found</p>
            </div>
          )}
          {totalPages > 1 && <PaginationControls />}
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => { setShowExpenseModal(false); setEditingExpense(null); resetExpenseForm() }} className="p-2 hover:bg-background rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Expense Type</label>
                  <select
                    value={expenseForm.expense_type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select type...</option>
                    {expenseTypes.map((type: ExpenseType) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseForm.amount || ''}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowExpenseModal(false); setEditingExpense(null); resetExpenseForm() }} className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium">
                  {editingExpense ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Expense Type</h2>
              <button onClick={() => { setShowTypeModal(false); resetTypeForm() }} className="p-2 hover:bg-background rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateType} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type Name</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Utilities"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowTypeModal(false); resetTypeForm() }} className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 font-medium">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

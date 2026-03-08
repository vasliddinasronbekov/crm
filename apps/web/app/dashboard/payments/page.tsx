'use client'

import { useState } from 'react'
import { Search, Plus, Edit, Trash2, DollarSign, Calendar, User, CreditCard, Download, X, CheckCircle, XCircle, Clock, Bell, Send, Settings, Printer } from 'lucide-react'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import apiService from '@/lib/api'
import {
  usePaymentsList,
  usePaymentStudents,
  usePaymentGroups,
  usePaymentTypes,
  usePaymentTeachers,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  useSendPaymentReminder,
  useSendBulkPaymentReminders,
  useSaveAutoReminderSettings,
  usePaymentStats,
  usePaymentTrends,
  isCashPaymentType,
  isCashPaymentTypeName,
  type PaymentTypeOption,
  type CashReceiptPayload,
  type Payment,
} from '@/lib/hooks/usePayments'
import LoadingScreen from '@/components/LoadingScreen'
import CashReceiptPreviewModal from '@/components/CashReceiptPreviewModal'

const resolvePaymentTypeName = (payment: Payment): string => {
  if (payment.payment_type_name) return payment.payment_type_name
  if (payment.payment_type && typeof payment.payment_type === 'object') {
    return payment.payment_type.name || ''
  }
  return ''
}

const resolveGroupName = (payment: Payment): string => {
  if (payment.group_name) return payment.group_name
  if (payment.group && typeof payment.group === 'object') {
    return payment.group.name || '-'
  }
  return '-'
}

const resolveStudentName = (payment: Payment): string => {
  if (payment.student_full_name) return payment.student_full_name
  if (payment.by_user?.first_name && payment.by_user?.last_name) {
    return `${payment.by_user.first_name} ${payment.by_user.last_name}`
  }
  if (payment.by_user?.username) return payment.by_user.username
  return 'Unknown'
}

const isCashPaymentRecord = (payment: Payment): boolean => {
  if (typeof payment.is_cash_payment === 'boolean') {
    return payment.is_cash_payment
  }
  if (payment.payment_type && typeof payment.payment_type === 'object') {
    if (isCashPaymentType(payment.payment_type as PaymentTypeOption)) {
      return true
    }
  }
  return isCashPaymentTypeName(resolvePaymentTypeName(payment))
}

export default function PaymentsPage() {
  const { currency, formatCurrencyFromMinor, toSelectedCurrency, fromSelectedCurrency } = useSettings()
  // UI state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'cash' | 'with_receipt'>('all')

  // React Query hooks for data fetching
  const { data: paymentsData, isLoading: paymentsLoading } = usePaymentsList({
    page,
    limit,
    search: debouncedSearchQuery,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    group: selectedGroup || undefined,
    date_after: dateFrom || undefined,
    date_before: dateTo || undefined,
  })
  const { data: students = [] } = usePaymentStudents()
  const { data: groups = [] } = usePaymentGroups()
  const { data: paymentTypes = [] } = usePaymentTypes()
  const { data: teachers = [] } = usePaymentTeachers()
  const paymentTypeOptions = paymentTypes as PaymentTypeOption[]

  // React Query mutations
  const createPayment = useCreatePayment()
  const updatePayment = useUpdatePayment()
  const deletePayment = useDeletePayment()
  const sendReminder = useSendPaymentReminder()
  const sendBulkReminders = useSendBulkPaymentReminders()
  const saveAutoReminders = useSaveAutoReminderSettings()

  const payments: Payment[] = paymentsData?.results || []
  const displayPayments = payments.filter((payment) => {
    if (receiptFilter === 'cash') return isCashPaymentRecord(payment)
    if (receiptFilter === 'with_receipt') return Boolean(payment.has_cash_receipt || payment.cash_receipt)
    return true
  })
  const totalPayments = paymentsData?.count || 0
  const totalPages = Math.ceil(totalPayments / limit)

  // Helper hooks for calculated data, now fed with fetched data
  const paymentStats = usePaymentStats(payments)
  const paymentTrends = usePaymentTrends(payments)

  // Other local UI state
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false)
  const [selectedPayments, setSelectedPayments] = useState<number[]>([])
  const [autoReminderSettings, setAutoReminderSettings] = useState({
    enabled: false,
    daysBeforeDue: 3,
    frequency: 'daily',
    emailTemplate: 'default'
  })
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const [newPayment, setNewPayment] = useState({
    by_user: '',
    amount: 0,
    course_price: 0,
    status: 'pending' as const,
    group: '',
    detail: '',
    date: new Date().toISOString().split('T')[0],
    payment_type: '',
    teacher: '',
  })
  const [cashReceiptPreview, setCashReceiptPreview] = useState<CashReceiptPayload | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null)
  const [receiptAutoPrintKey, setReceiptAutoPrintKey] = useState(0)

  const isLoading = paymentsLoading

  const fetchAndShowReceipt = async (paymentId: number, autoPrint = false) => {
    try {
      setReceiptLoadingId(paymentId)
      const receipt = await apiService.getCashReceipt(paymentId)
      setCashReceiptPreview(receipt)
      setIsReceiptModalOpen(true)
      if (autoPrint) {
        setReceiptAutoPrintKey((prev) => prev + 1)
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Failed to load receipt'
      toast.error(message)
    } finally {
      setReceiptLoadingId(null)
    }
  }

  const handleAddPayment = async (options?: { autoPrint?: boolean }) => {
    if (!newPayment.by_user || !newPayment.amount) {
      toast.warning('Please fill in all required fields')
      return
    }
    if (!newPayment.payment_type) {
      toast.warning('Please select a payment method')
      return
    }

    const selectedPaymentType = paymentTypeOptions.find(
      (paymentType: any) => String(paymentType.id) === String(newPayment.payment_type),
    )
    const isCashType = isCashPaymentType(selectedPaymentType)
    const shouldAutoPrint = Boolean(options?.autoPrint)

    createPayment.mutate({
      ...newPayment,
      amount: fromSelectedCurrency(newPayment.amount),
      course_price: fromSelectedCurrency(newPayment.course_price),
    }, {
      onSuccess: (createdPayment) => {
        setIsAddingPayment(false)
        setNewPayment({
          by_user: '',
          amount: 0,
          course_price: 0,
          status: 'pending',
          group: '',
          detail: '',
          date: new Date().toISOString().split('T')[0],
          payment_type: '',
          teacher: '',
        })
        if (isCashType && createdPayment?.id) {
          fetchAndShowReceipt(createdPayment.id, shouldAutoPrint)
        }
      },
    })
  }

  const handleEdit = (payment: Payment) => {
    setEditingPayment({
      ...payment,
      amount: toSelectedCurrency(payment.amount / 100),
      course_price: toSelectedCurrency(payment.course_price / 100),
    } as any)
  }

  const handleSaveEdit = async () => {
    if (!editingPayment) return

    updatePayment.mutate(
      {
        id: editingPayment.id,
        data: {
          status: editingPayment.status,
          amount: fromSelectedCurrency((editingPayment.amount as any) || 0),
          detail: editingPayment.detail,
        },
      },
      {
        onSuccess: () => {
          setEditingPayment(null)
        },
      }
    )
  }

  const handleDelete = async (payment: Payment) => {
    if (!confirm(`Are you sure you want to delete this payment?`)) {
      return
    }

    deletePayment.mutate(payment.id)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Student', 'Group', `Amount (${currency})`, 'Status', 'Type', 'Detail']
    const rows = displayPayments.map((p: Payment) => [
      p.date,
      resolveStudentName(p),
      resolveGroupName(p),
      toSelectedCurrency(p.amount / 100).toFixed(2),
      p.status,
      resolvePaymentTypeName(p) || 'Other',
      p.detail || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | number)[]) => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Payments exported to CSV')
  }

  // Stats are now automatically calculated by React Query helper hooks
  const { totalRevenue, pendingAmount, failedAmount, averagePayment } = paymentStats

  const handleSendReminder = async (paymentId: number) => {
    sendReminder.mutate(paymentId)
  }

  const handleBulkReminders = async () => {
    if (selectedPayments.length === 0) {
      toast.warning('No payments selected')
      return
    }
    sendBulkReminders.mutate(selectedPayments, {
      onSuccess: () => {
        setSelectedPayments([])
        setIsReminderModalOpen(false)
      }
    })
  }

  const handleSaveAutoReminderSettings = () => {
    saveAutoReminders.mutate(autoReminderSettings, {
      onSuccess: () => {
        setIsSettingsModalOpen(false)
      }
    })
  }

  const handleTogglePaymentSelection = (paymentId: number) => {
    setSelectedPayments(prev =>
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    )
  }

  const handleSelectAllPending = () => {
    const pendingPaymentIds = payments
      .filter(p => p.status === 'pending')
      .map(p => p.id)
    setSelectedPayments(pendingPaymentIds)
  }

  const PaginationControls = () => (
    <div className="flex justify-between items-center mt-6">
      <div className="text-sm text-text-secondary">
        Showing {payments.length} of {totalPayments} payments
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

  if (isLoading && page === 1) {
    return <LoadingScreen message="Loading payments..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Payments & Finance 💰</h1>
        <p className="text-text-secondary">Track payments, invoices, and financial transactions</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by student, group, or transaction ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value)
              setPage(1)
            }}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Groups</option>
            {groups.map((group: any) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="To"
            />
          </div>

          {/* Actions */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            title="Auto-Reminder Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          <button
            onClick={() => setIsReminderModalOpen(true)}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Bell className="h-5 w-5" />
            Reminders
          </button>

          <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>

          <button
            onClick={() => setIsAddingPayment(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            New Payment
          </button>
        </div>
      </div>

      {/* Comprehensive Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(totalRevenue)}</p>
          <p className="text-sm text-text-secondary">Total Revenue (Page)</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <span className="text-xs text-warning font-medium">{payments.filter(p => p.status === 'pending').length}</span>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(pendingAmount)}</p>
          <p className="text-sm text-text-secondary">Pending (Page)</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-error" />
            </div>
            <span className="text-xs text-error font-medium">{payments.filter(p => p.status === 'failed').length}</span>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(failedAmount)}</p>
          <p className="text-sm text-text-secondary">Failed (Page)</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs text-text-secondary">Total</span>
          </div>
          <p className="text-3xl font-bold mb-1">{totalPayments}</p>
          <p className="text-sm text-text-secondary">Total Payments</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-info" />
            </div>
            <span className="text-xs text-text-secondary">Avg</span>
          </div>
          <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(averagePayment)}</p>
          <p className="text-sm text-text-secondary">Average (Page)</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <span className="text-xs text-success font-medium">Success</span>
          </div>
          <p className="text-3xl font-bold mb-1">{payments.length > 0 ? Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100) : 0}%</p>
          <p className="text-sm text-text-secondary">Success Rate (Page)</p>
        </div>
      </div>

      {/* Payment Trends Chart */}
      {paymentTrends.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Payment Trends (Page)</h2>
            <span className="text-sm text-text-secondary">Last {paymentTrends.length} months</span>
          </div>
          <div className="space-y-4">
            {paymentTrends.slice(-6).reverse().map((trend, index) => {
              const maxAmount = Math.max(...paymentTrends.map(t => t.amount))
              const percentage = (trend.amount / maxAmount) * 100
              return (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text-secondary font-medium">{trend.month}</span>
                    <span className="font-bold text-primary">{formatCurrencyFromMinor(trend.amount)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2">
            {['all', 'pending', 'paid', 'failed'].map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setStatusFilter(filter)
                  setPage(1)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-primary text-background'
                    : 'bg-surface text-text-secondary hover:bg-border'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All Payments' },
              { value: 'cash', label: 'Cash Only' },
              { value: 'with_receipt', label: 'With Receipt' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setReceiptFilter(item.value as 'all' | 'cash' | 'with_receipt')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  receiptFilter === item.value
                    ? 'bg-info/20 text-info border border-info/40'
                    : 'bg-surface text-text-secondary hover:bg-border'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-6 text-sm font-semibold">Student</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Date</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Amount</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Status</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Method</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Group</th>
                <th className="text-left py-4 px-6 text-sm font-semibold">Receipt #</th>
                <th className="text-right py-4 px-6 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.map((payment) => {
                const studentName = resolveStudentName(payment)
                const studentInitial = studentName?.trim()?.[0]?.toUpperCase() || 'U'
                const paymentTypeName = resolvePaymentTypeName(payment) || 'N/A'
                const groupName = resolveGroupName(payment)
                const receiptNumber = payment.cash_receipt?.receipt_number || '—'
                const canOpenReceipt = Boolean(payment.has_cash_receipt || isCashPaymentRecord(payment))

                return (
                <tr
                  key={payment.id}
                  className="border-b border-border hover:bg-background transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {studentInitial}
                      </div>
                      <div>
                        <p className="font-medium">{studentName}</p>
                        {payment.transaction_id && (
                          <p className="text-xs text-text-secondary">ID: {payment.transaction_id}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-text-secondary">
                    {new Date(payment.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold text-primary">
                      {formatCurrencyFromMinor(payment.amount)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        payment.status === 'paid'
                          ? 'bg-success/10 text-success'
                          : payment.status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-error/10 text-error'
                      }`}
                    >
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-text-secondary">
                    {paymentTypeName}
                  </td>
                  <td className="py-4 px-6 text-text-secondary">
                    {groupName}
                  </td>
                  <td className="py-4 px-6 text-text-secondary font-mono text-xs">
                    {receiptNumber}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      {canOpenReceipt && (
                        <button
                          onClick={() => fetchAndShowReceipt(payment.id)}
                          disabled={receiptLoadingId === payment.id}
                          className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                          title="Preview / Reprint receipt"
                        >
                          <Printer className="h-4 w-4 text-info" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(payment)}
                        className="p-2 hover:bg-background rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(payment)}
                        disabled={deletePayment.isPending}
                        className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>

          {displayPayments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-lg mb-2">No payments found</p>
              <p className="text-text-secondary text-sm">
                {searchQuery || statusFilter !== 'all' || receiptFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first payment to get started'}
              </p>
            </div>
          )}
        </div>
        {totalPages > 1 && <PaginationControls />}
      </div>

      {/* Add Payment Modal */}
      {isAddingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-2xl font-semibold mb-4">Add New Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Student *</label>
                <select
                  value={newPayment.by_user}
                  onChange={(e) => setNewPayment({ ...newPayment, by_user: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select a student</option>
                  {students.map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name && student.last_name
                        ? `${student.first_name} ${student.last_name}`
                        : student.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount ({currency}) *</label>
                <input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="0"
                  step="0.01"
                  placeholder="100.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Course Price ({currency}) *</label>
                <input
                  type="number"
                  value={newPayment.course_price}
                  onChange={(e) => setNewPayment({ ...newPayment, course_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="0"
                  step="0.01"
                  placeholder="500.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Group</label>
                <select
                  value={newPayment.group}
                  onChange={(e) => setNewPayment({ ...newPayment, group: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select a group (optional)</option>
                  {groups.map((group: any) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Method *</label>
                <select
                  value={newPayment.payment_type}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select payment method</option>
                  {paymentTypes.map((paymentType: any) => (
                    <option key={paymentType.id} value={paymentType.id}>
                      {paymentType.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={newPayment.status}
                  onChange={(e) => setNewPayment({ ...newPayment, status: e.target.value as any })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newPayment.detail}
                  onChange={(e) => setNewPayment({ ...newPayment, detail: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  rows={3}
                  placeholder="Payment details..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => handleAddPayment()} className="btn-primary flex-1">
                  Save Payment
                </button>
                {isCashPaymentType(
                  paymentTypeOptions.find((paymentType: any) => String(paymentType.id) === String(newPayment.payment_type)),
                ) && (
                  <button
                    onClick={() => handleAddPayment({ autoPrint: true })}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Save & Print
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsAddingPayment(false)
                    setNewPayment({
                      by_user: '',
                      amount: 0,
                      course_price: 0,
                      status: 'pending',
                      group: '',
                      detail: '',
                      date: new Date().toISOString().split('T')[0],
                      payment_type: '',
                      teacher: '',
                    })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Edit Payment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Amount ({currency})</label>
                <input
                  type="number"
                  value={(editingPayment as any).amount}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) } as any)
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={editingPayment.status}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, status: e.target.value as any })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={editingPayment.detail || ''}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, detail: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleSaveEdit} className="btn-primary flex-1">
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingPayment(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-surface rounded-xl p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Send Payment Reminders</h2>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl mb-3">
                <span className="text-sm font-medium">
                  {selectedPayments.length} payment(s) selected
                </span>
                <button
                  onClick={handleSelectAllPending}
                  className="text-sm text-primary hover:underline"
                >
                  Select All Pending
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {payments
                  .filter(p => p.status === 'pending')
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedPayments.includes(payment.id)
                          ? 'bg-primary/10 border-primary/20'
                          : 'bg-background border-border hover:border-primary/20'
                      }`}
                      onClick={() => handleTogglePaymentSelection(payment.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => handleTogglePaymentSelection(payment.id)}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="font-medium text-sm">
                            {payment.by_user?.first_name && payment.by_user?.last_name
                              ? `${payment.by_user.first_name} ${payment.by_user.last_name}`
                              : payment.by_user?.username || 'Unknown'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {payment.group?.name || 'No group'} • {new Date(payment.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-warning">
                        {formatCurrencyFromMinor(payment.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleBulkReminders}
                disabled={selectedPayments.length === 0}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                Send {selectedPayments.length} Reminder{selectedPayments.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => {
                  setIsReminderModalOpen(false)
                  setSelectedPayments([])
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Reminder Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Auto-Reminder Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                <div>
                  <p className="font-medium mb-1">Enable Auto-Reminders</p>
                  <p className="text-xs text-text-secondary">Automatically send payment reminders</p>
                </div>
                <button
                  onClick={() => setAutoReminderSettings({
                    ...autoReminderSettings,
                    enabled: !autoReminderSettings.enabled
                  })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoReminderSettings.enabled ? 'bg-success' : 'bg-border'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-background transition-transform ${
                    autoReminderSettings.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {autoReminderSettings.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Days Before Due</label>
                    <input
                      type="number"
                      value={autoReminderSettings.daysBeforeDue}
                      onChange={(e) => setAutoReminderSettings({
                        ...autoReminderSettings,
                        daysBeforeDue: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                      min="1"
                      max="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Frequency</label>
                    <select
                      value={autoReminderSettings.frequency}
                      onChange={(e) => setAutoReminderSettings({
                        ...autoReminderSettings,
                        frequency: e.target.value
                      })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Template</label>
                    <select
                      value={autoReminderSettings.emailTemplate}
                      onChange={(e) => setAutoReminderSettings({
                        ...autoReminderSettings,
                        emailTemplate: e.target.value
                      })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="default">Default Template</option>
                      <option value="friendly">Friendly Reminder</option>
                      <option value="urgent">Urgent Notice</option>
                      <option value="final">Final Notice</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={handleSaveAutoReminderSettings} className="btn-primary flex-1">
                  Save Settings
                </button>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CashReceiptPreviewModal
        isOpen={isReceiptModalOpen}
        receipt={cashReceiptPreview}
        autoPrintKey={receiptAutoPrintKey}
        onAutoPrintHandled={() => setReceiptAutoPrintKey(0)}
        onClose={() => {
          setIsReceiptModalOpen(false)
          setCashReceiptPreview(null)
        }}
      />
    </div>
  )
}

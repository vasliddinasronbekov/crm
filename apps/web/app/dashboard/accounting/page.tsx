'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign, Users, TrendingUp, AlertCircle, Calendar,
  Download, Filter, Search, ChevronRight, Wallet,
  Receipt, FileText, CreditCard, Clock,
  CheckCircle, XCircle, Plus, Eye, Edit, Trash2, X
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useSettings } from '@/contexts/SettingsContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  useStudentBalances,
  useTeacherEarnings,
  useStudentFines,
  useFinancialSummaries,
  useMarkEarningPaid,
  useMarkFinePaid,
  useCreateStudentFine,
  useUpdateStudentFine,
  useDeleteStudentFine,
  useAccountingSummaryStats,
  type StudentBalanceExtended,
  type TeacherEarningExtended,
  type StudentFineExtended,
  type FinancialSummaryExtended,
} from '@/lib/hooks/useAccounting'

type ActiveTab = 'balances' | 'earnings' | 'fines' | 'summaries'

export default function AccountingPage() {
  const { currency, formatCurrencyFromMinor, fromSelectedCurrency } = useSettings()
  const [activeTab, setActiveTab] = useState<ActiveTab>('balances')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Modal states
  const [showFineModal, setShowFineModal] = useState(false)
  const [selectedFine, setSelectedFine] = useState<StudentFineExtended | null>(null)
  const [fineForm, setFineForm] = useState({
    student: '',
    fine_type: '',
    amount: '',
    reason: '',
    description: '',
  })

  const commonQueryParams = { page, limit, search: debouncedSearchQuery }

  // React Query hooks
  const { data: balancesData, isLoading: isLoadingBalances } = useStudentBalances(
    activeTab === 'balances' ? commonQueryParams : {}
  )
  const { data: earningsData, isLoading: isLoadingEarnings } = useTeacherEarnings(
    activeTab === 'earnings' ? commonQueryParams : {}
  )
  const { data: finesData, isLoading: isLoadingFines } = useStudentFines(
    activeTab === 'fines' ? commonQueryParams : {}
  )
  const { data: summariesData, isLoading: isLoadingSummaries } = useFinancialSummaries()

  const createFine = useCreateStudentFine()
  const updateFine = useUpdateStudentFine()
  const deleteFine = useDeleteStudentFine()

  useEffect(() => {
    if (selectedFine) {
      setFineForm({
        student: selectedFine.student?.id.toString() || '',
        fine_type: selectedFine.fine_type?.id.toString() || '',
        amount: (selectedFine.amount / 100).toString(),
        reason: selectedFine.reason || '',
        description: selectedFine.description || '',
      })
    } else {
      setFineForm({ student: '', fine_type: '', amount: '', reason: '', description: '' })
    }
  }, [selectedFine, showFineModal])

  const handleFineFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFineForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...fineForm,
      amount: fromSelectedCurrency(parseFloat(fineForm.amount)) * 100,
      student: parseInt(fineForm.student),
      fine_type: parseInt(fineForm.fine_type),
    }

    if (selectedFine) {
      updateFine.mutate({ id: selectedFine.id, data })
    } else {
      createFine.mutate(data)
    }
    setShowFineModal(false)
  }

  const handleDeleteFine = async (id: number) => {
    if (confirm('Are you sure you want to delete this fine?')) {
      deleteFine.mutate(id)
    }
  }

  const balances = balancesData?.results || []
  const totalBalances = balancesData?.count || 0
  const earnings = earningsData?.results || []
  const totalEarnings = earningsData?.count || 0
  const fines = finesData?.results || []
  const totalFines = finesData?.count || 0
  const summaries = summariesData?.results || []
  const totalSummaries = summariesData?.count || 0

  // Mutations
  const markEarningPaid = useMarkEarningPaid()
  const markFinePaid = useMarkFinePaid()

  // Calculate summary stats using helper hook
  const stats = useAccountingSummaryStats()

  // Determine loading state based on active tab
  const isLoading =
    (activeTab === 'balances' && isLoadingBalances) ||
    (activeTab === 'earnings' && isLoadingEarnings) ||
    (activeTab === 'fines' && isLoadingFines) ||
    (activeTab === 'summaries' && isLoadingSummaries)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab)
    setPage(1)
    setSearchQuery('')
  }

  const handleMarkEarningPaid = async (earning: TeacherEarningExtended) => {
    if (!confirm(`Mark ${formatCurrencyFromMinor(earning.amount)} as paid to ${earning.teacher?.username}?`)) return

    markEarningPaid.mutate({
      id: earning.id,
      paid_date: new Date().toISOString().split('T')[0],
    })
  }

  const handleMarkFinePaid = async (fine: StudentFineExtended) => {
    if (!confirm(`Mark ${formatCurrencyFromMinor(fine.amount)} fine as paid for ${fine.student?.username}?`)) return

    markFinePaid.mutate({
      id: fine.id,
      paid_date: new Date().toISOString().split('T')[0],
    })
  }

  const PaginationControls = () => {
    let totalItems = 0
    if (activeTab === 'balances') totalItems = totalBalances
    if (activeTab === 'earnings') totalItems = totalEarnings
    if (activeTab === 'fines') totalItems = totalFines
    if (activeTab === 'summaries') totalItems = totalSummaries

    const totalPages = Math.ceil(totalItems / limit)

    if (totalPages <= 1) return null

    return (
      <div className="flex justify-between items-center mt-6 p-4">
        <div className="text-sm text-text-secondary">
          Showing page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="btn-secondary"
          >
            Previous
          </button>
          <span className="text-text-secondary text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="btn-secondary"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              Accounting & Finance
            </h1>
            <p className="text-text-secondary">Manage balances, earnings, fines, and financial summaries</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-error/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-error" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(stats.totalDebt)}</p>
              <p className="text-sm text-text-secondary">Total Student Debt</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-success/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(stats.totalCollected)}</p>
              <p className="text-sm text-text-secondary">Total Collected</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-warning/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(stats.unpaidEarnings)}</p>
              <p className="text-sm text-text-secondary">Unpaid Teacher Earnings</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-info/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-info" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(stats.unpaidFines)}</p>
              <p className="text-sm text-text-secondary">Unpaid Fines</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-surface rounded-2xl border border-border mb-6 p-1">
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => handleTabChange('balances')}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'balances'
                    ? 'bg-primary text-background'
                    : 'hover:bg-background text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Wallet className="h-5 w-5" />
                  <span>Balances</span>
                </div>
              </button>
              <button
                onClick={() => handleTabChange('earnings')}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'earnings'
                    ? 'bg-primary text-background'
                    : 'hover:bg-background text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Earnings</span>
                </div>
              </button>
              <button
                onClick={() => handleTabChange('fines')}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'fines'
                    ? 'bg-primary text-background'
                    : 'hover:bg-background text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Fines</span>
                </div>
              </button>
              <button
                onClick={() => handleTabChange('summaries')}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'summaries'
                    ? 'bg-primary text-background'
                    : 'hover:bg-background text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span>Summaries</span>
                </div>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <span>Filter</span>
              </button>
              <button className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 flex items-center gap-2">
                <Download className="h-5 w-5" />
                <span>Export</span>
              </button>
              {activeTab === 'fines' && (
                <button
                  onClick={() => {
                    setSelectedFine(null)
                    setShowFineModal(true)
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Fine</span>
                </button>
              )}
            </div>
          </div>

          {/* Content based on active tab */}
          {isLoading && page === 1 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Student Balances Tab */}
              {activeTab === 'balances' && (
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                          <th className="text-left p-4 font-medium text-text-secondary">Group</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Total Fee</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Paid</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Fines</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Balance</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Progress</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.map((balance) => (
                          <tr key={balance.id} className="border-b border-border hover:bg-background transition-colors">
                            <td className="p-4">
                              <div className="font-medium">{balance.student?.first_name} {balance.student?.last_name}</div>
                              <div className="text-sm text-text-secondary">@{balance.student?.username}</div>
                            </td>
                            <td className="p-4 text-text-secondary">{balance.group?.name || 'N/A'}</td>
                            <td className="p-4 text-right font-medium">{formatCurrencyFromMinor(balance.total_fee)}</td>
                            <td className="p-4 text-right text-success">{formatCurrencyFromMinor(balance.paid_amount)}</td>
                            <td className="p-4 text-right text-warning">{formatCurrencyFromMinor(balance.fine_amount)}</td>
                            <td className="p-4 text-right">
                              <span className={`font-bold ${balance.balance > 0 ? 'text-error' : 'text-success'}`}>
                                {balance.balance > 0 ? '-' : '+'}{formatCurrencyFromMinor(Math.abs(balance.balance))}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="w-full bg-background rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${balance.is_fully_paid ? 'bg-success' : 'bg-warning'}`}
                                  style={{ width: `${Math.min(balance.payment_percentage || 0, 100)}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-center mt-1 text-text-secondary">
                                {Math.round(balance.payment_percentage || 0)}%
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              {balance.is_fully_paid ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-success/10 text-success rounded-full text-sm">
                                  <CheckCircle className="h-4 w-4" />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-error/10 text-error rounded-full text-sm">
                                  <AlertCircle className="h-4 w-4" />
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {balances.length === 0 && !isLoading ? (
                    <div className="text-center py-12">
                      <Wallet className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                      <p className="text-text-secondary">No balances found</p>
                    </div>
                  ) : <PaginationControls />}
                </div>
              )}

              {/* Teacher Earnings Tab */}
              {activeTab === 'earnings' && (
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          <th className="text-left p-4 font-medium text-text-secondary">Teacher</th>
                          <th className="text-left p-4 font-medium text-text-secondary">Group</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Payment Amount</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Percentage</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Earning</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Date</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Status</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.map((earning) => (
                          <tr key={earning.id} className="border-b border-border hover:bg-background transition-colors">
                            <td className="p-4">
                              <div className="font-medium">{earning.teacher?.first_name} {earning.teacher?.last_name}</div>
                              <div className="text-sm text-text-secondary">@{earning.teacher?.username}</div>
                            </td>
                            <td className="p-4 text-text-secondary">{earning.group?.name || 'N/A'}</td>
                            <td className="p-4 text-right">{formatCurrencyFromMinor(earning.payment_amount)}</td>
                            <td className="p-4 text-center">
                              <span className="px-3 py-1 bg-info/10 text-info rounded-full text-sm">
                                {earning.percentage_applied}%
                              </span>
                            </td>
                            <td className="p-4 text-right font-bold text-primary">{formatCurrencyFromMinor(earning.amount)}</td>
                            <td className="p-4 text-center text-sm text-text-secondary">
                              {new Date(earning.date).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-center">
                              {earning.is_paid_to_teacher ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-success/10 text-success rounded-full text-sm">
                                  <CheckCircle className="h-4 w-4" />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-warning/10 text-warning rounded-full text-sm">
                                  <Clock className="h-4 w-4" />
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                {!earning.is_paid_to_teacher && (
                                  <button
                                    onClick={() => handleMarkEarningPaid(earning)}
                                    className="px-3 py-1 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors text-sm font-medium"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {earnings.length === 0 && !isLoading ? (
                    <div className="text-center py-12">
                      <CreditCard className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                      <p className="text-text-secondary">No earnings found</p>
                    </div>
                  ) : <PaginationControls />}
                </div>
              )}

              {/* Student Fines Tab */}
              {activeTab === 'fines' && (
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                          <th className="text-left p-4 font-medium text-text-secondary">Type</th>
                          <th className="text-left p-4 font-medium text-text-secondary">Reason</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Amount</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Applied Date</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Auto/Manual</th>
                          <th className="text-center p-4 font-medium text-text-secondary">Status</th>
                          <th className="text-right p-4 font-medium text-text-secondary">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fines.map((fine) => (
                          <tr key={fine.id} className="border-b border-border hover:bg-background transition-colors">
                            <td className="p-4">
                              <div className="font-medium">{fine.student?.first_name} {fine.student?.last_name}</div>
                              <div className="text-sm text-text-secondary">@{fine.student?.username}</div>
                            </td>
                            <td className="p-4 text-text-secondary">{fine.fine_type?.name || 'N/A'}</td>
                            <td className="p-4">
                              <div className="text-sm">{fine.reason}</div>
                              {fine.description && (
                                <div className="text-xs text-text-secondary mt-1">{fine.description}</div>
                              )}
                            </td>
                            <td className="p-4 text-right font-bold text-error">{formatCurrencyFromMinor(fine.amount)}</td>
                            <td className="p-4 text-center text-sm text-text-secondary">
                              {new Date(fine.applied_date).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-xs ${
                                fine.is_automatic
                                  ? 'bg-info/10 text-info'
                                  : 'bg-warning/10 text-warning'
                              }`}>
                                {fine.is_automatic ? 'Automatic' : 'Manual'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {fine.is_paid ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-success/10 text-success rounded-full text-sm">
                                  <CheckCircle className="h-4 w-4" />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-error/10 text-error rounded-full text-sm">
                                  <XCircle className="h-4 w-4" />
                                  Unpaid
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                {!fine.is_paid && (
                                  <button
                                    onClick={() => handleMarkFinePaid(fine)}
                                    className="px-3 py-1 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors text-sm font-medium"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedFine(fine)
                                    setShowFineModal(true)
                                  }}
                                  className="p-2 text-text-secondary hover:bg-border rounded-md"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteFine(fine.id)}
                                  className="p-2 text-error hover:bg-border rounded-md"
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
                  {fines.length === 0 && !isLoading ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                      <p className="text-text-secondary">No fines found</p>
                    </div>
                  ) : <PaginationControls />}
                </div>
              )}

              {/* Financial Summaries Tab */}
              {activeTab === 'summaries' && (
                <div className="space-y-6">
                  {summaries.map((summary) => (
                    <div key={summary.id} className="bg-surface rounded-2xl border border-border p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="h-6 w-6 text-primary" />
                            {new Date(summary.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </h3>
                        </div>
                        <div className={`text-2xl font-bold ${summary.net_profit >= 0 ? 'text-success' : 'text-error'}`}>
                          {summary.net_profit >= 0 ? '+' : ''}{formatCurrencyFromMinor(summary.net_profit)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-background p-4 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-5 w-5 text-success" />
                            <span className="text-sm text-text-secondary">Payments</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrencyFromMinor(summary.total_payments)}</p>
                          <p className="text-xs text-text-secondary">{summary.payment_count} payments</p>
                        </div>

                        <div className="bg-background p-4 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Receipt className="h-5 w-5 text-error" />
                            <span className="text-sm text-text-secondary">Expenses</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrencyFromMinor(summary.total_expenses)}</p>
                          <p className="text-xs text-text-secondary">{summary.expense_count} expenses</p>
                        </div>

                        <div className="bg-background p-4 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-5 w-5 text-warning" />
                            <span className="text-sm text-text-secondary">Teacher Earnings</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrencyFromMinor(summary.total_teacher_earnings)}</p>
                          <p className="text-xs text-text-secondary">
                            {formatCurrencyFromMinor(summary.teacher_earnings_paid)} paid
                          </p>
                        </div>

                        <div className="bg-background p-4 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-info" />
                            <span className="text-sm text-text-secondary">Fines</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrencyFromMinor(summary.total_fines)}</p>
                          <p className="text-xs text-text-secondary">
                            {formatCurrencyFromMinor(summary.fines_paid)} collected
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm text-text-secondary">Gross Revenue</p>
                              <p className="text-lg font-bold text-success">{formatCurrencyFromMinor(summary.gross_revenue)}</p>
                            </div>
                            <div className="h-8 w-px bg-border"></div>
                            <div>
                              <p className="text-sm text-text-secondary">Net Profit</p>
                              <p className={`text-lg font-bold ${summary.net_profit >= 0 ? 'text-success' : 'text-error'}`}>
                                {formatCurrencyFromMinor(summary.net_profit)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {summaries.length === 0 && (
                    <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                      <FileText className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                      <p className="text-text-secondary">No financial summaries found</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showFineModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-border">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{selectedFine ? 'Edit Fine' : 'Create Fine'}</h2>
                <button onClick={() => setShowFineModal(false)} className="btn-secondary p-2 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleFineSubmit}>
                <div className="space-y-4">
                  <input
                    name="student"
                    value={fineForm.student}
                    onChange={handleFineFormChange}
                    placeholder="Student ID"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                    required
                  />
                  <input
                    name="fine_type"
                    value={fineForm.fine_type}
                    onChange={handleFineFormChange}
                    placeholder="Fine Type ID"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                    required
                  />
                  <input
                    name="amount"
                    type="number"
                    value={fineForm.amount}
                    onChange={handleFineFormChange}
                    placeholder={`Amount (${currency})`}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                    required
                  />
                  <input
                    name="reason"
                    value={fineForm.reason}
                    onChange={handleFineFormChange}
                    placeholder="Reason"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                    required
                  />
                  <textarea
                    name="description"
                    value={fineForm.description}
                    onChange={handleFineFormChange}
                    placeholder="Description (optional)"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <button type="button" onClick={() => setShowFineModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {selectedFine ? 'Update Fine' : 'Create Fine'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

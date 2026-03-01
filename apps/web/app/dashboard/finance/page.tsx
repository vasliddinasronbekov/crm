'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import {
  DollarSign, TrendingUp, TrendingDown, Users, Calendar,
  FileText, Wallet, CreditCard, AlertCircle, ArrowRight,
  Download, RefreshCw, Eye, Clock, CheckCircle, XCircle,
  BarChart3, PieChart, Activity, Target, Zap
} from 'lucide-react'
import {
  useFinancialSummaries,
  usePayments,
  usePaymentStats,
  useAccountingStats,
  useRefreshFinance,
  useCreatePayment,
  useCreateExpense,
  Payment,
} from '@/lib/hooks/useFinance'

export default function FinanceDashboard() {
  const router = useRouter()
  const { currency, formatCurrencyFromMinor, fromSelectedCurrency } = useSettings()
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  // React Query hooks - automatic caching, loading, and error states
  const { data: financialSummariesData, isLoading: summariesLoading } = useFinancialSummaries()
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments()

  const createPayment = useCreatePayment()
  const createExpense = useCreateExpense()

  const [paymentForm, setPaymentForm] = useState({ student: '', amount: '', payment_type: '' })
  const [expenseForm, setExpenseForm] = useState({ expense_type: '', amount: '', description: '' })

  const handlePaymentFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentForm({ ...paymentForm, [e.target.name]: e.target.value })
  }

  const handleExpenseFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setExpenseForm({ ...expenseForm, [e.target.name]: e.target.value })
  }

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountInSelectedCurrency = parseFloat(paymentForm.amount)
    createPayment.mutate({
      ...paymentForm,
      amount: fromSelectedCurrency(Number.isFinite(amountInSelectedCurrency) ? amountInSelectedCurrency : 0) * 100,
      student: parseInt(paymentForm.student),
    })
    setShowPaymentModal(false)
  }

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountInSelectedCurrency = parseFloat(expenseForm.amount)
    createExpense.mutate({
      ...expenseForm,
      amount: fromSelectedCurrency(Number.isFinite(amountInSelectedCurrency) ? amountInSelectedCurrency : 0) * 100,
    })
    setShowExpenseModal(false)
  }

  // Stats hooks that automatically calculate from the data
  const paymentStats = usePaymentStats()
  const accountingStats = useAccountingStats()

  const refreshFinance = useRefreshFinance()

  const loading = summariesLoading || paymentsLoading

  const handleRefresh = async () => {
    setRefreshing(true)
    refreshFinance()
    setTimeout(() => {
      setRefreshing(false)
      toast.success('Financial data refreshed')
    }, 500)
  }

  const financialSummaries = financialSummariesData?.results || []
  const latestSummary = financialSummaries[0]
  const payments = paymentsData?.results || []
  const profitMargin = latestSummary && latestSummary.gross_revenue > 0
    ? ((latestSummary.net_profit / latestSummary.gross_revenue) * 100).toFixed(1)
    : '0.0'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading financial dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Wallet className="h-10 w-10 text-primary" />
                Financial Dashboard
              </h1>
              <p className="text-text-secondary">Complete financial overview and real-time insights</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Key Financial KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-2xl border border-success/20 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <span className="text-xs text-success font-medium">+12.5%</span>
            </div>
            <p className="text-3xl font-bold mb-1 text-success">
              {formatCurrencyFromMinor(paymentStats.totalRevenue + accountingStats.totalFines)}
            </p>
            <p className="text-sm text-text-secondary">Total Revenue</p>
          </div>

          {/* Total Expenses */}
          <div className="bg-gradient-to-br from-error/10 to-error/5 rounded-2xl border border-error/20 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-error" />
              </div>
              <span className="text-xs text-error font-medium">-3.2%</span>
            </div>
            <p className="text-3xl font-bold mb-1 text-error">
              {formatCurrencyFromMinor(accountingStats.totalTeacherEarnings)}
            </p>
            <p className="text-sm text-text-secondary">Total Expenses</p>
          </div>

          {/* Net Profit */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs text-primary font-medium">{profitMargin}%</span>
            </div>
            <p className="text-3xl font-bold mb-1 text-primary">
              {formatCurrencyFromMinor((paymentStats.totalRevenue + accountingStats.totalFines) - accountingStats.totalTeacherEarnings)}
            </p>
            <p className="text-sm text-text-secondary">Net Profit</p>
          </div>

          {/* Outstanding */}
          <div className="bg-gradient-to-br from-warning/10 to-warning/5 rounded-2xl border border-warning/20 p-6 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <span className="text-xs text-warning font-medium">{paymentStats.pending}</span>
            </div>
            <p className="text-3xl font-bold mb-1 text-warning">
              {formatCurrencyFromMinor(paymentStats.pendingAmount + accountingStats.pendingEarnings)}
            </p>
            <p className="text-sm text-text-secondary">Outstanding</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Payment Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Payment Status</h3>
              <CreditCard className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <span className="text-sm font-medium">Paid</span>
                </div>
                <span className="text-sm font-bold">{paymentStats.paid}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-warning" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <span className="text-sm font-bold">{paymentStats.pending}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-error" />
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <span className="text-sm font-bold">{paymentStats.failed}</span>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/payments')}
              className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
            >
              View All Payments
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Teacher Earnings */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Teacher Earnings</h3>
              <Users className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Total Earned</span>
                  <span className="font-bold text-primary">{formatCurrencyFromMinor(accountingStats.totalTeacherEarnings)}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Paid</span>
                  <span className="font-bold text-success">{formatCurrencyFromMinor(accountingStats.paidEarnings)}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div className="bg-gradient-to-r from-success to-success/80 h-2 rounded-full"
                    style={{ width: accountingStats.totalTeacherEarnings > 0 ? `${(accountingStats.paidEarnings / accountingStats.totalTeacherEarnings) * 100}%` : '0%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Pending</span>
                  <span className="font-bold text-warning">{formatCurrencyFromMinor(accountingStats.pendingEarnings)}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div className="bg-gradient-to-r from-warning to-warning/80 h-2 rounded-full"
                    style={{ width: accountingStats.totalTeacherEarnings > 0 ? `${(accountingStats.pendingEarnings / accountingStats.totalTeacherEarnings) * 100}%` : '0%' }} />
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/accounting')}
              className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
            >
              View Accounting
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Financial Health */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Financial Health</h3>
              <Activity className="h-5 w-5 text-text-secondary" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Profit Margin</p>
                  <p className="text-2xl font-bold text-success">{profitMargin}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Payment Success</p>
                  <p className="text-2xl font-bold text-primary">
                    {paymentStats.total > 0 ? Math.round((paymentStats.paid / paymentStats.total) * 100) : 0}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Collection Rate</p>
                  <p className="text-2xl font-bold text-info">87.5%</p>
                </div>
                <Target className="h-8 w-8 text-info" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card mb-8">
          <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/dashboard/reports')}
              className="flex flex-col items-center gap-3 p-4 bg-background rounded-xl hover:bg-border transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <span className="text-sm font-medium">Generate Report</span>
            </button>

            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex flex-col items-center gap-3 p-4 bg-background rounded-xl hover:bg-border transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <span className="text-sm font-medium">Add Payment</span>
            </button>

            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex flex-col items-center gap-3 p-4 bg-background rounded-xl hover:bg-border transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-error" />
              </div>
              <span className="text-sm font-medium">Add Expense</span>
            </button>

            <button
              onClick={() => router.push('/dashboard/analytics')}
              className="flex flex-col items-center gap-3 p-4 bg-background rounded-xl hover:bg-border transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-info" />
              </div>
              <span className="text-sm font-medium">View Analytics</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Recent Payments</h3>
              <button
                onClick={() => router.push('/dashboard/payments')}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {payments.slice(0, 5).map((payment: Payment, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-background rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${
                      payment.status === 'paid' ? 'bg-success/10' :
                      payment.status === 'pending' ? 'bg-warning/10' : 'bg-error/10'
                    } flex items-center justify-center`}>
                      {payment.status === 'paid' ? <CheckCircle className="h-5 w-5 text-success" /> :
                       payment.status === 'pending' ? <Clock className="h-5 w-5 text-warning" /> :
                       <XCircle className="h-5 w-5 text-error" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {payment.by_user?.first_name} {payment.by_user?.last_name || payment.by_user?.username}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {new Date(payment.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-sm">{formatCurrencyFromMinor(payment.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary Chart */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4">Monthly Trend</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Revenue</span>
                  <span className="font-bold text-success">{formatCurrencyFromMinor(paymentStats.totalRevenue)}</span>
                </div>
                <div className="w-full bg-background rounded-full h-3">
                  <div className="bg-gradient-to-r from-success to-success/80 h-3 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Expenses</span>
                  <span className="font-bold text-error">{formatCurrencyFromMinor(accountingStats.totalTeacherEarnings)}</span>
                </div>
                <div className="w-full bg-background rounded-full h-3">
                  <div className="bg-gradient-to-r from-error to-error/80 h-3 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">Profit</span>
                  <span className="font-bold text-primary">
                    {formatCurrencyFromMinor((paymentStats.totalRevenue + accountingStats.totalFines) - accountingStats.totalTeacherEarnings)}
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-3">
                  <div className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-border">
            <h2 className="text-2xl font-bold mb-6">Add Payment</h2>
            <form onSubmit={handlePaymentSubmit}>
              <div className="space-y-4">
                <input name="student" placeholder="Student ID" onChange={handlePaymentFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
                <input name="amount" type="number" placeholder={`Amount (${currency})`} onChange={handlePaymentFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
                <input name="payment_type" placeholder="Payment Type ID" onChange={handlePaymentFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-border">
            <h2 className="text-2xl font-bold mb-6">Add Expense</h2>
            <form onSubmit={handleExpenseSubmit}>
              <div className="space-y-4">
                <input name="expense_type" placeholder="Expense Type ID" onChange={handleExpenseFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
                <input name="amount" type="number" placeholder={`Amount (${currency})`} onChange={handleExpenseFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
                <textarea name="description" placeholder="Description" onChange={handleExpenseFormChange} className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

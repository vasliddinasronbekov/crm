'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  useCreateExpense,
  useCreatePayment,
  useFinancialSummaries,
  usePayments,
  useRefreshFinance,
  useStudentBalances,
  useStudentFines,
  useTeacherEarnings,
} from '@/lib/hooks/useFinance'
import {
  usePaymentStudents,
  usePaymentTypes,
  usePaymentGroups,
  usePaymentCourses,
  type PaymentCourseOption,
} from '@/lib/hooks/usePayments'
import { useExpenseTypes } from '@/lib/hooks/useExpenses'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'
import { usePermissions } from '@/lib/permissions'

type FinanceTab = 'overview' | 'receivables' | 'operations'
type PaymentStatus = 'paid' | 'pending' | 'failed'

type PaymentStatusMetric = {
  status: PaymentStatus
  label: string
  count: number
  amount: number
  tone: string
  icon: typeof CheckCircle2
}

type TrendPoint = {
  key: string
  label: string
  revenue: number
  expenses: number
  profit: number
}

type DebtorRow = {
  id: number
  name: string
  groupName: string
  balance: number
  paymentProgress: number
}

type PayrollRow = {
  id: number
  name: string
  amount: number
  groupName: string
}

type StudentOption = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

type SimpleOption = {
  id: number
  name?: string
}

type PaymentGroupOption = {
  id: number
  name?: string
  course?: {
    id?: number
    name?: string
    price?: number
  } | null
}

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  paid: {
    label: 'Paid',
    tone: 'text-success bg-success/10 border-success/20',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pending',
    tone: 'text-warning bg-warning/10 border-warning/20',
    icon: Clock3,
  },
  failed: {
    label: 'Failed',
    tone: 'text-error bg-error/10 border-error/20',
    icon: XCircle,
  },
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

function toPercent(value: number | string | null | undefined): number {
  const normalized = toNumber(value)
  if (!Number.isFinite(normalized)) {
    return 0
  }
  return Math.min(100, Math.max(0, normalized))
}

function clampWidth(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (value / max) * 100))
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function getDisplayName(entity: any, fallback = 'Unknown'): string {
  if (!entity) {
    return fallback
  }

  const fullName = `${entity.first_name || ''} ${entity.last_name || ''}`.trim()
  if (fullName) {
    return fullName
  }

  if (entity.username) {
    return entity.username
  }

  return fallback
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  })
}

const todayDate = new Date().toISOString().split('T')[0]

export default function FinanceDashboard() {
  const router = useRouter()
  const { currency, formatCurrencyFromMinor, fromSelectedCurrency, toSelectedCurrency } = useSettings()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreatePayment = permissionState.hasPermission('payments.create')
  const canCreateExpense = permissionState.hasPermission('expenses.create')

  const [activeTab, setActiveTab] = useState<FinanceTab>('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    by_user: '',
    group: '',
    course: '',
    payment_type: '',
    amount: '',
    course_price: '',
    pricing_mode: 'course' as 'course' | 'manual',
    status: 'paid' as PaymentStatus,
    detail: '',
    date: todayDate,
  })

  const [expenseForm, setExpenseForm] = useState({
    expense_type: '',
    amount: '',
    description: '',
    date: todayDate,
  })

  const { data: financialSummariesData, isLoading: summariesLoading } = useFinancialSummaries()
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({ limit: 200 })
  const { data: balancesData, isLoading: balancesLoading } = useStudentBalances({ limit: 200 })
  const { data: teacherEarningsData, isLoading: teacherEarningsLoading } = useTeacherEarnings({
    limit: 200,
  })
  const { data: studentFinesData, isLoading: finesLoading } = useStudentFines({ limit: 200 })

  const { data: studentsData = [] } = usePaymentStudents()
  const { data: groupsData = [] } = usePaymentGroups()
  const { data: coursesData = [] } = usePaymentCourses()
  const { data: paymentTypesData = [] } = usePaymentTypes()
  const { data: expenseTypesData = [] } = useExpenseTypes()

  const refreshFinance = useRefreshFinance()
  const createPayment = useCreatePayment()
  const createExpense = useCreateExpense()

  const financialSummaries = useMemo(
    () => financialSummariesData?.results || [],
    [financialSummariesData?.results]
  )
  const payments = useMemo(() => paymentsData?.results || [], [paymentsData?.results])
  const balances = useMemo(() => balancesData?.results || [], [balancesData?.results])
  const teacherEarnings = useMemo(
    () => teacherEarningsData?.results || [],
    [teacherEarningsData?.results]
  )
  const studentFines = useMemo(() => studentFinesData?.results || [], [studentFinesData?.results])

  const students = useMemo(
    () => (Array.isArray(studentsData) ? (studentsData as StudentOption[]) : []),
    [studentsData]
  )
  const groups = useMemo(
    () => (Array.isArray(groupsData) ? (groupsData as PaymentGroupOption[]) : []),
    [groupsData]
  )
  const courses = useMemo(
    () => (Array.isArray(coursesData) ? (coursesData as PaymentCourseOption[]) : []),
    [coursesData]
  )
  const paymentTypes = useMemo(
    () => (Array.isArray(paymentTypesData) ? (paymentTypesData as SimpleOption[]) : []),
    [paymentTypesData]
  )
  const expenseTypes = useMemo(
    () => (Array.isArray(expenseTypesData) ? (expenseTypesData as SimpleOption[]) : []),
    [expenseTypesData]
  )
  const groupsById = useMemo(
    () => new Map(groups.map((group) => [String(group.id), group])),
    [groups]
  )
  const coursesById = useMemo(
    () => new Map(courses.map((course) => [String(course.id), course])),
    [courses]
  )

  const loading =
    summariesLoading ||
    paymentsLoading ||
    balancesLoading ||
    teacherEarningsLoading ||
    finesLoading

  const dashboard = useMemo(() => {
    const latestSummary = financialSummaries[0]

    const statusCounts = payments.reduce<Record<PaymentStatus, { count: number; amount: number }>>(
      (acc, payment) => {
        const status = (payment.status || 'pending') as PaymentStatus
        if (!acc[status]) {
          acc[status] = { count: 0, amount: 0 }
        }
        acc[status].count += 1
        acc[status].amount += toNumber(payment.amount)
        return acc
      },
      {
        paid: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
      }
    )

    const paymentStatusMetrics: PaymentStatusMetric[] = (['paid', 'pending', 'failed'] as PaymentStatus[]).map(
      (status) => ({
        status,
        label: PAYMENT_STATUS_META[status].label,
        count: statusCounts[status].count,
        amount: statusCounts[status].amount,
        tone: PAYMENT_STATUS_META[status].tone,
        icon: PAYMENT_STATUS_META[status].icon,
      })
    )

    const debtBalances = balances.filter((balance) => toNumber(balance.balance) > 0)
    const overpaidBalances = balances.filter((balance) => toNumber(balance.balance) < 0)
    const fullyPaidCount = balances.filter((balance) => balance.is_fully_paid).length

    const receivables = debtBalances.reduce((sum, balance) => sum + toNumber(balance.balance), 0)
    const overpaidAmount = Math.abs(
      overpaidBalances.reduce((sum, balance) => sum + toNumber(balance.balance), 0)
    )

    const avgPaymentProgress =
      balances.length > 0
        ? balances.reduce((sum, balance) => sum + toPercent(balance.payment_percentage), 0) /
          balances.length
        : 0

    const totalTeacherEarnings = teacherEarnings.reduce(
      (sum, earning) => sum + toNumber(earning.amount),
      0
    )
    const paidTeacherEarnings = teacherEarnings
      .filter((earning) => earning.is_paid_to_teacher)
      .reduce((sum, earning) => sum + toNumber(earning.amount), 0)
    const pendingTeacherEarnings = totalTeacherEarnings - paidTeacherEarnings

    const totalFines = studentFines.reduce((sum, fine) => sum + toNumber(fine.amount), 0)
    const paidFines = studentFines
      .filter((fine) => fine.is_paid)
      .reduce((sum, fine) => sum + toNumber(fine.amount), 0)

    const grossRevenue =
      latestSummary?.gross_revenue != null
        ? toNumber(latestSummary.gross_revenue)
        : statusCounts.paid.amount + paidFines

    const operatingExpenses =
      latestSummary?.total_expenses != null
        ? toNumber(latestSummary.total_expenses)
        : totalTeacherEarnings

    const netProfit =
      latestSummary?.net_profit != null
        ? toNumber(latestSummary.net_profit)
        : grossRevenue - operatingExpenses

    const paymentSuccessRate =
      payments.length > 0 ? (statusCounts.paid.count / payments.length) * 100 : 0
    const collectionRate =
      grossRevenue + receivables > 0 ? (grossRevenue / (grossRevenue + receivables)) * 100 : 0
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0
    const payrollCoverage =
      totalTeacherEarnings > 0 ? (paidTeacherEarnings / totalTeacherEarnings) * 100 : 0
    const fineRecoveryRate = totalFines > 0 ? (paidFines / totalFines) * 100 : 0

    const trendPoints: TrendPoint[] = [...financialSummaries]
      .slice(0, 6)
      .reverse()
      .map((summary) => {
        const date = new Date(summary.date)
        return {
          key: `${summary.id}-${summary.date}`,
          label: date.toLocaleDateString(undefined, { month: 'short' }),
          revenue: toNumber(summary.gross_revenue),
          expenses: toNumber(summary.total_expenses),
          profit: toNumber(summary.net_profit),
        }
      })

    const trendMax = Math.max(
      1,
      ...trendPoints.map((point) => Math.max(point.revenue, point.expenses, Math.abs(point.profit), 1))
    )

    const paymentAmountMax = Math.max(1, ...paymentStatusMetrics.map((status) => status.amount))

    const topDebtors: DebtorRow[] = debtBalances
      .map((balance) => ({
        id: balance.id,
        name: getDisplayName(
          balance.student,
          balance.student_name || balance.student_username || `Student #${balance.id}`
        ),
        groupName:
          balance.group_name ||
          balance.group?.name ||
          (balance.group ? `Group #${balance.group.id || ''}` : 'No group'),
        balance: toNumber(balance.balance),
        paymentProgress: toPercent(balance.payment_percentage),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 7)

    const topPendingPayroll: PayrollRow[] = teacherEarnings
      .filter((earning) => !earning.is_paid_to_teacher)
      .map((earning) => ({
        id: earning.id,
        name: getDisplayName(
          earning.teacher,
          earning.teacher_name || earning.teacher_username || `Teacher #${earning.id}`
        ),
        amount: toNumber(earning.amount),
        groupName:
          earning.group_name ||
          earning.group?.name ||
          (earning.group ? `Group #${earning.group.id || ''}` : 'No group'),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7)

    const receivableRisk = {
      critical: debtBalances.filter((balance) => toPercent(balance.payment_percentage) < 40).length,
      watch: debtBalances.filter((balance) => {
        const progress = toPercent(balance.payment_percentage)
        return progress >= 40 && progress < 80
      }).length,
      nearClear: debtBalances.filter((balance) => toPercent(balance.payment_percentage) >= 80).length,
    }

    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)

    return {
      latestSummary,
      grossRevenue,
      operatingExpenses,
      netProfit,
      receivables,
      overpaidAmount,
      totalTeacherEarnings,
      pendingTeacherEarnings,
      paidTeacherEarnings,
      totalFines,
      paidFines,
      paymentSuccessRate,
      collectionRate,
      profitMargin,
      payrollCoverage,
      fineRecoveryRate,
      avgPaymentProgress,
      fullyPaidCount,
      debtStudentCount: debtBalances.length,
      overpaidCount: overpaidBalances.length,
      paymentStatusMetrics,
      paymentAmountMax,
      trendPoints,
      trendMax,
      topDebtors,
      topPendingPayroll,
      receivableRisk,
      recentPayments,
      totalPaymentsCount: payments.length,
    }
  }, [balances, financialSummaries, payments, studentFines, teacherEarnings])

  const handleRefresh = () => {
    setRefreshing(true)
    refreshFinance()
    setTimeout(() => {
      setRefreshing(false)
      toast.success('Finance dashboard refreshed')
    }, 450)
  }

  const resolveSelectedCourse = (groupId?: string, courseId?: string) => {
    const courseFromGroup = groupId ? groupsById.get(String(groupId))?.course : undefined
    if (courseFromGroup?.id) {
      return courseFromGroup
    }
    return courseId ? coursesById.get(String(courseId)) : undefined
  }

  const applyDerivedCoursePricing = (
    draft: typeof paymentForm,
    explicitCourseId?: string,
    explicitGroupId?: string
  ) => {
    const selectedCourse = resolveSelectedCourse(explicitGroupId ?? draft.group, explicitCourseId ?? draft.course)
    const coursePriceMinor = Number(selectedCourse?.price || 0)
    if (!selectedCourse?.id || coursePriceMinor <= 0) {
      return draft
    }

    const displayPrice = toSelectedCurrency(coursePriceMinor / 100)
    return {
      ...draft,
      course: String(selectedCourse.id),
      amount: displayPrice.toString(),
      course_price: displayPrice.toString(),
    }
  }

  const handlePaymentSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!canCreatePayment) {
      toast.error('You do not have permission to create payments')
      return
    }

    if (!paymentForm.by_user) {
      toast.error('Please select a student')
      return
    }

    const isCourseMode = paymentForm.pricing_mode === 'course'
    const selectedCourse = resolveSelectedCourse(paymentForm.group, paymentForm.course)
    const derivedCoursePriceMinor = Number(selectedCourse?.price || 0)

    if (isCourseMode && (!selectedCourse?.id || derivedCoursePriceMinor <= 0)) {
      toast.error('Select a valid course or a group with a linked course')
      return
    }

    if (!isCourseMode && (!paymentForm.amount || Number(paymentForm.amount) <= 0)) {
      toast.error('Please enter a valid payment amount')
      return
    }

    const amountInMinor = isCourseMode
      ? derivedCoursePriceMinor
      : Math.round(fromSelectedCurrency(Number(paymentForm.amount)) * 100)
    const coursePriceInMinor = isCourseMode
      ? derivedCoursePriceMinor
      : Math.round(
          fromSelectedCurrency(
            paymentForm.course_price ? Number(paymentForm.course_price) : Number(paymentForm.amount)
          ) * 100
        )

    createPayment.mutate(
      {
        by_user: Number(paymentForm.by_user),
        group: paymentForm.group ? Number(paymentForm.group) : undefined,
        course: selectedCourse?.id ? Number(selectedCourse.id) : undefined,
        pricing_mode: paymentForm.pricing_mode,
        payment_type: paymentForm.payment_type ? Number(paymentForm.payment_type) : undefined,
        status: paymentForm.status,
        detail: paymentForm.detail || undefined,
        date: paymentForm.date,
        amount: amountInMinor,
        course_price: coursePriceInMinor,
      },
      {
        onSuccess: () => {
          setShowPaymentModal(false)
          setPaymentForm({
            by_user: '',
            group: '',
            course: '',
            payment_type: '',
            amount: '',
            course_price: '',
            pricing_mode: 'course',
            status: 'paid',
            detail: '',
            date: todayDate,
          })
        },
      }
    )
  }

  const handleExpenseSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!canCreateExpense) {
      toast.error('You do not have permission to create expenses')
      return
    }

    if (!expenseForm.expense_type) {
      toast.error('Please select an expense type')
      return
    }

    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.error('Please enter a valid expense amount')
      return
    }

    createExpense.mutate(
      {
        expense_type: Number(expenseForm.expense_type),
        amount: Math.round(fromSelectedCurrency(Number(expenseForm.amount)) * 100),
        description: expenseForm.description || '',
        date: expenseForm.date,
      },
      {
        onSuccess: () => {
          setShowExpenseModal(false)
          setExpenseForm({
            expense_type: '',
            amount: '',
            description: '',
            date: todayDate,
          })
        },
      }
    )
  }

  return (
    <ProtectedRoute>
      {loading ? (
        <LoadingScreen message="Loading finance intelligence..." />
      ) : (
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="h-8 w-8 text-primary" />
              Finance Control Center
            </h1>
            <p className="text-text-secondary mt-1">
              Real revenue, receivables, payroll, and risk signals for production operations.
            </p>
            {dashboard.latestSummary?.date && (
              <p className="text-xs text-text-secondary mt-2">
                Latest accounting summary: {formatShortDate(dashboard.latestSummary.date)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={!canCreatePayment}
              title={!canCreatePayment ? 'You do not have permission to create payments' : undefined}
              className={`px-4 py-2 rounded-xl transition-opacity flex items-center gap-2 ${
                canCreatePayment
                  ? 'bg-success text-success-foreground hover:opacity-90'
                  : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Add Payment
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              disabled={!canCreateExpense}
              title={!canCreateExpense ? 'You do not have permission to create expenses' : undefined}
              className={`px-4 py-2 rounded-xl transition-opacity flex items-center gap-2 ${
                canCreateExpense
                  ? 'bg-error text-error-foreground hover:opacity-90'
                  : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Add Expense
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-surface border border-border rounded-xl hover:bg-border/50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('receivables')}
            className={`px-5 py-3 border-b-2 transition-colors ${
              activeTab === 'receivables'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Target className="h-4 w-4 inline mr-2" />
            Receivables
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-5 py-3 border-b-2 transition-colors ${
              activeTab === 'operations'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Activity className="h-4 w-4 inline mr-2" />
            Operations
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span className="text-xs text-text-secondary">Revenue</span>
                </div>
                <p className="text-xl font-bold">{formatCurrencyFromMinor(dashboard.grossRevenue)}</p>
                <p className="text-xs text-text-secondary mt-1">Gross collected</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingDown className="h-5 w-5 text-error" />
                  <span className="text-xs text-text-secondary">Expense</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrencyFromMinor(dashboard.operatingExpenses)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Operating cost</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      dashboard.netProfit >= 0
                        ? 'bg-success/10 text-success'
                        : 'bg-error/10 text-error'
                    }`}
                  >
                    {formatPercent(dashboard.profitMargin)}
                  </span>
                </div>
                <p className="text-xl font-bold">{formatCurrencyFromMinor(dashboard.netProfit)}</p>
                <p className="text-xs text-text-secondary mt-1">Net profit</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <CreditCard className="h-5 w-5 text-warning" />
                  <span className="text-xs text-text-secondary">Receivable</span>
                </div>
                <p className="text-xl font-bold">{formatCurrencyFromMinor(dashboard.receivables)}</p>
                <p className="text-xs text-text-secondary mt-1">Open student balances</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Users className="h-5 w-5 text-info" />
                  <span className="text-xs text-text-secondary">Payroll</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrencyFromMinor(dashboard.pendingTeacherEarnings)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Pending teacher payout</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="text-xs text-text-secondary">Efficiency</span>
                </div>
                <p className="text-xl font-bold">{formatPercent(dashboard.collectionRate)}</p>
                <p className="text-xs text-text-secondary mt-1">Collection rate</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">6-Period Revenue Trend</h2>
                  <p className="text-sm text-text-secondary">Revenue vs expense vs net</p>
                </div>

                {dashboard.trendPoints.length > 0 ? (
                  <div className="grid grid-cols-6 gap-3 h-64 items-end">
                    {dashboard.trendPoints.map((point) => {
                      const revenueHeight = clampWidth(point.revenue, dashboard.trendMax)
                      const expenseHeight = clampWidth(point.expenses, dashboard.trendMax)
                      const profitHeight = clampWidth(Math.abs(point.profit), dashboard.trendMax)

                      return (
                        <div key={point.key} className="flex flex-col items-center gap-2">
                          <div className="w-full h-44 flex items-end justify-center gap-1">
                            <div
                              className="w-3 rounded-t bg-success"
                              style={{ height: `${revenueHeight}%` }}
                              title={`Revenue: ${formatCurrencyFromMinor(point.revenue)}`}
                            />
                            <div
                              className="w-3 rounded-t bg-warning"
                              style={{ height: `${expenseHeight}%` }}
                              title={`Expense: ${formatCurrencyFromMinor(point.expenses)}`}
                            />
                            <div
                              className={`w-3 rounded-t ${point.profit >= 0 ? 'bg-primary' : 'bg-error'}`}
                              style={{ height: `${profitHeight}%` }}
                              title={`Net: ${formatCurrencyFromMinor(point.profit)}`}
                            />
                          </div>
                          <p className="text-xs text-text-secondary">{point.label}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-text-secondary">
                    No financial summary history yet.
                  </div>
                )}
              </div>

              <div className="lg:col-span-3 bg-surface border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Transaction Quality</h2>
                  <Activity className="h-5 w-5 text-text-secondary" />
                </div>

                {dashboard.paymentStatusMetrics.map((metric) => {
                  const Icon = metric.icon
                  const width = clampWidth(metric.amount, dashboard.paymentAmountMax)

                  return (
                    <div key={metric.status} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${metric.tone}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="font-medium">{metric.label}</span>
                        </div>
                        <span className="font-semibold">
                          {metric.count} / {formatCurrencyFromMinor(metric.amount)}
                        </span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            metric.status === 'paid'
                              ? 'bg-success'
                              : metric.status === 'pending'
                                ? 'bg-warning'
                                : 'bg-error'
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <p className="text-xs text-text-secondary">Payment success</p>
                    <p className="text-xl font-bold">{formatPercent(dashboard.paymentSuccessRate)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <p className="text-xs text-text-secondary">Payroll covered</p>
                    <p className="text-xl font-bold">{formatPercent(dashboard.payrollCoverage)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/dashboard/payments')}
                className="p-4 bg-surface border border-border rounded-2xl hover:bg-border/50 transition-colors text-left"
              >
                <CreditCard className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold">Payments Ledger</p>
                <p className="text-sm text-text-secondary">Filter and manage all transactions.</p>
                <span className="text-primary text-sm mt-2 inline-flex items-center gap-1">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>

              <button
                onClick={() => router.push('/dashboard/accounting')}
                className="p-4 bg-surface border border-border rounded-2xl hover:bg-border/50 transition-colors text-left"
              >
                <Wallet className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold">Accounting Ledger</p>
                <p className="text-sm text-text-secondary">Detailed balances and entries.</p>
                <span className="text-primary text-sm mt-2 inline-flex items-center gap-1">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>

              <button
                onClick={() => router.push('/dashboard/reports')}
                className="p-4 bg-surface border border-border rounded-2xl hover:bg-border/50 transition-colors text-left"
              >
                <FileText className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold">Reports</p>
                <p className="text-sm text-text-secondary">Generate downloadable finance reports.</p>
                <span className="text-primary text-sm mt-2 inline-flex items-center gap-1">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>

              <button
                onClick={() => router.push('/dashboard/analytics')}
                className="p-4 bg-surface border border-border rounded-2xl hover:bg-border/50 transition-colors text-left"
              >
                <BarChart3 className="h-5 w-5 text-primary mb-3" />
                <p className="font-semibold">Analytics</p>
                <p className="text-sm text-text-secondary">Cross-functional performance intelligence.</p>
                <span className="text-primary text-sm mt-2 inline-flex items-center gap-1">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'receivables' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Students with debt</p>
                <p className="text-3xl font-bold mt-2">{dashboard.debtStudentCount}</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Fully paid accounts</p>
                <p className="text-3xl font-bold mt-2">{dashboard.fullyPaidCount}</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Average payment progress</p>
                <p className="text-3xl font-bold mt-2">{formatPercent(dashboard.avgPaymentProgress)}</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Overpaid accounts</p>
                <p className="text-3xl font-bold mt-2">
                  {dashboard.overpaidCount} ({formatCurrencyFromMinor(dashboard.overpaidAmount)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Debt Risk Segments</h2>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border border-error/20 bg-error/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-error" />
                      <span className="text-sm font-medium">Critical (&lt;40%)</span>
                    </div>
                    <span className="font-semibold">{dashboard.receivableRisk.critical}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-warning/20 bg-warning/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-warning" />
                      <span className="text-sm font-medium">Watch (40-79%)</span>
                    </div>
                    <span className="font-semibold">{dashboard.receivableRisk.watch}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-success/20 bg-success/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Near clear (80%+)</span>
                    </div>
                    <span className="font-semibold">{dashboard.receivableRisk.nearClear}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">Top Receivables</h2>
                  <button
                    onClick={() => router.push('/dashboard/payments')}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Manage payments
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {dashboard.topDebtors.length > 0 ? (
                    dashboard.topDebtors.map((row) => (
                      <div key={row.id} className="p-3 rounded-xl bg-background border border-border">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-text-secondary">{row.groupName}</p>
                          </div>
                          <p className="font-semibold text-warning">
                            {formatCurrencyFromMinor(row.balance)}
                          </p>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                            <span>Payment progress</span>
                            <span>{formatPercent(row.paymentProgress)}</span>
                          </div>
                          <div className="h-2 bg-surface rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.paymentProgress >= 80
                                  ? 'bg-success'
                                  : row.paymentProgress >= 40
                                    ? 'bg-warning'
                                    : 'bg-error'
                              }`}
                              style={{ width: `${row.paymentProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-text-secondary">
                      No outstanding receivables right now.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'operations' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Total teacher earnings</p>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrencyFromMinor(dashboard.totalTeacherEarnings)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Paid: {formatCurrencyFromMinor(dashboard.paidTeacherEarnings)}</p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Fine recovery rate</p>
                <p className="text-2xl font-bold mt-2">{formatPercent(dashboard.fineRecoveryRate)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  Paid: {formatCurrencyFromMinor(dashboard.paidFines)} / {formatCurrencyFromMinor(dashboard.totalFines)}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-sm text-text-secondary">Tracked payments</p>
                <p className="text-2xl font-bold mt-2">{dashboard.totalPaymentsCount}</p>
                <p className="text-xs text-text-secondary mt-1">Current finance query scope</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">Pending Teacher Payroll</h2>
                  <Users className="h-5 w-5 text-text-secondary" />
                </div>

                <div className="space-y-3">
                  {dashboard.topPendingPayroll.length > 0 ? (
                    dashboard.topPendingPayroll.map((row) => (
                      <div key={row.id} className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-text-secondary">{row.groupName}</p>
                        </div>
                        <p className="font-semibold text-warning">{formatCurrencyFromMinor(row.amount)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-text-secondary">
                      No pending payroll payouts.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push('/dashboard/accounting')}
                  className="mt-4 btn-secondary w-full flex items-center justify-center gap-2"
                >
                  Open accounting payroll
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">Recent Transactions</h2>
                  <CreditCard className="h-5 w-5 text-text-secondary" />
                </div>

                <div className="space-y-3">
                  {dashboard.recentPayments.length > 0 ? (
                    dashboard.recentPayments.map((payment) => {
                      const status = (payment.status || 'pending') as PaymentStatus
                      const meta = PAYMENT_STATUS_META[status]
                      const Icon = meta.icon

                      return (
                        <div key={payment.id} className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`h-8 w-8 rounded-lg border flex items-center justify-center ${meta.tone}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {getDisplayName(payment.by_user, `Payment #${payment.id}`)}
                              </p>
                              <p className="text-xs text-text-secondary">
                                {formatShortDate(payment.date)}
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold whitespace-nowrap">
                            {formatCurrencyFromMinor(toNumber(payment.amount))}
                          </p>
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-10 text-center text-text-secondary">No payment activity yet.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showPaymentModal && canCreatePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-5">Record Payment</h2>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary block mb-1">Student</label>
                <select
                  value={paymentForm.by_user}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, by_user: event.target.value }))}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  required
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {getDisplayName(student, `Student #${student.id}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Group</label>
                  <select
                    value={paymentForm.group}
                    onChange={(event) => {
                      const nextGroup = event.target.value
                      setPaymentForm((prev) => {
                        const withGroup = { ...prev, group: nextGroup }
                        return prev.pricing_mode === 'course'
                          ? applyDerivedCoursePricing(withGroup, prev.course, nextGroup)
                          : withGroup
                      })
                    }}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  >
                    <option value="">Select group (optional)</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name || `Group #${group.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Course</label>
                  <select
                    value={paymentForm.course}
                    onChange={(event) => {
                      const nextCourse = event.target.value
                      setPaymentForm((prev) => {
                        const withCourse = { ...prev, course: nextCourse }
                        return prev.pricing_mode === 'course'
                          ? applyDerivedCoursePricing(withCourse, nextCourse, prev.group)
                          : withCourse
                      })
                    }}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  >
                    <option value="">Select course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name || `Course #${course.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={paymentForm.pricing_mode === 'manual'}
                  onChange={(event) => {
                    const manualMode = event.target.checked
                    setPaymentForm((prev) => {
                      const nextState = {
                        ...prev,
                        pricing_mode: manualMode ? 'manual' : 'course',
                      }
                      return manualMode ? nextState : applyDerivedCoursePricing(nextState)
                    })
                  }}
                  className="h-4 w-4 rounded border-border"
                />
                Manual override (exceptional)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Amount ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl disabled:opacity-60"
                    required
                    disabled={paymentForm.pricing_mode === 'course'}
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Course price ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.course_price}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, course_price: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl disabled:opacity-60"
                    placeholder={paymentForm.pricing_mode === 'course' ? 'Auto-filled from course' : 'Defaults to amount'}
                    disabled={paymentForm.pricing_mode === 'course'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Payment type</label>
                  <select
                    value={paymentForm.payment_type}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, payment_type: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  >
                    <option value="">Select type</option>
                    {paymentTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name || `Type #${type.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-text-secondary block mb-1">Status</label>
                  <select
                    value={paymentForm.status}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, status: event.target.value as PaymentStatus }))
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-text-secondary block mb-1">Date</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-text-secondary block mb-1">Notes</label>
                <textarea
                  value={paymentForm.detail}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, detail: event.target.value }))}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  rows={3}
                  placeholder="Optional payment details"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary"
                  disabled={createPayment.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!canCreatePayment || createPayment.isPending}
                >
                  {createPayment.isPending ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseModal && canCreateExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-5">Record Expense</h2>
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary block mb-1">Expense type</label>
                <select
                  value={expenseForm.expense_type}
                  onChange={(event) =>
                    setExpenseForm((prev) => ({ ...prev, expense_type: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  required
                >
                  <option value="">Select type</option>
                  {expenseTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name || `Type #${type.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Amount ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) =>
                      setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary block mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-text-secondary block mb-1">Description</label>
                <textarea
                  value={expenseForm.description}
                  onChange={(event) =>
                    setExpenseForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl"
                  rows={3}
                  placeholder="Optional expense details"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn-secondary"
                  disabled={createExpense.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!canCreateExpense || createExpense.isPending}
                >
                  {createExpense.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      )}
    </ProtectedRoute>
  )
}

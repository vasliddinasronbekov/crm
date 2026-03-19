'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
type FinanceQuickFocus = 'all' | 'cashflow' | 'risk' | 'payroll'
type PaymentStatus = 'paid' | 'pending' | 'failed'

const FINANCE_QUICK_FOCUS_STORAGE_KEY = 'dashboard.finance.quick_focus'
const FINANCE_QUICK_SEARCH_STORAGE_KEY = 'dashboard.finance.quick_search'
const FINANCE_ACTIVE_TAB_STORAGE_KEY = 'dashboard.finance.active_tab'

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

const TIYIN_PER_UZS = 100

const isFinanceTab = (value: string | null): value is FinanceTab =>
  value === 'overview' || value === 'receivables' || value === 'operations'

const isFinanceQuickFocus = (value: string | null): value is FinanceQuickFocus =>
  value === 'all' || value === 'cashflow' || value === 'risk' || value === 'payroll'

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
  const searchParams = useSearchParams()
  const { currency, formatCurrencyFromMinor, fromSelectedCurrency, toSelectedCurrency } = useSettings()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreatePayment = permissionState.hasPermission('payments.record')
  const canCreateExpense = permissionState.hasPermission('expenses.create')
  const canViewReceivables = permissionState.hasPermission('payments.view')
  const canViewOperations =
    permissionState.hasPermission('expenses.view') ||
    permissionState.hasPermission('hr.view') ||
    permissionState.hasPermission('salaries.view')

  const [activeTab, setActiveTab] = useState<FinanceTab>('overview')
  const [quickFocus, setQuickFocus] = useState<FinanceQuickFocus>('all')
  const [quickSearch, setQuickSearch] = useState('')
  const [hasLoadedQuickPrefs, setHasLoadedQuickPrefs] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    by_user: '',
    group: '',
    course: '',
    payment_type: '',
    amount_tiyin: 0,
    course_price_tiyin: 0,
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

  const availableTabs = useMemo<FinanceTab[]>(() => {
    const tabs: FinanceTab[] = ['overview']
    if (canViewReceivables) tabs.push('receivables')
    if (canViewOperations) tabs.push('operations')
    return tabs
  }, [canViewOperations, canViewReceivables])

  const queryTab = searchParams.get('tab')
  const queryFocus = searchParams.get('focus')

  useEffect(() => {
    try {
      const storedTab = localStorage.getItem(FINANCE_ACTIVE_TAB_STORAGE_KEY)
      if (storedTab && ['overview', 'receivables', 'operations'].includes(storedTab)) {
        setActiveTab(storedTab as FinanceTab)
      }

      const storedFocus = localStorage.getItem(FINANCE_QUICK_FOCUS_STORAGE_KEY)
      if (storedFocus && ['all', 'cashflow', 'risk', 'payroll'].includes(storedFocus)) {
        setQuickFocus(storedFocus as FinanceQuickFocus)
      }

      const storedSearch = localStorage.getItem(FINANCE_QUICK_SEARCH_STORAGE_KEY)
      if (storedSearch) {
        setQuickSearch(storedSearch)
      }
    } catch {
      // Ignore storage access failures.
    } finally {
      setHasLoadedQuickPrefs(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedQuickPrefs) return
    try {
      localStorage.setItem(FINANCE_ACTIVE_TAB_STORAGE_KEY, activeTab)
      localStorage.setItem(FINANCE_QUICK_FOCUS_STORAGE_KEY, quickFocus)
      localStorage.setItem(FINANCE_QUICK_SEARCH_STORAGE_KEY, quickSearch)
    } catch {
      // Ignore storage write failures.
    }
  }, [activeTab, quickFocus, quickSearch, hasLoadedQuickPrefs])

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'overview')
    }
  }, [activeTab, availableTabs])

  useEffect(() => {
    if (!hasLoadedQuickPrefs) return

    if (isFinanceTab(queryTab) && availableTabs.includes(queryTab) && queryTab !== activeTab) {
      setActiveTab(queryTab)
    }

    if (isFinanceQuickFocus(queryFocus) && queryFocus !== quickFocus) {
      setQuickFocus(queryFocus)
    }
  }, [activeTab, availableTabs, hasLoadedQuickPrefs, queryFocus, queryTab, quickFocus])

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

    return {
      ...draft,
      course: String(selectedCourse.id),
      amount_tiyin: Math.round(coursePriceMinor),
      course_price_tiyin: Math.round(coursePriceMinor),
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

    if (!isCourseMode && paymentForm.amount_tiyin <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    const amountInMinor = isCourseMode
      ? derivedCoursePriceMinor
      : Math.round(paymentForm.amount_tiyin)
    const coursePriceInMinor = isCourseMode
      ? derivedCoursePriceMinor
      : Math.round(paymentForm.course_price_tiyin > 0 ? paymentForm.course_price_tiyin : paymentForm.amount_tiyin)

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
        amount_tiyin: amountInMinor,
        course_price_tiyin: coursePriceInMinor,
      },
      {
        onSuccess: () => {
          setShowPaymentModal(false)
          setPaymentForm({
            by_user: '',
            group: '',
            course: '',
            payment_type: '',
            amount_tiyin: 0,
            course_price_tiyin: 0,
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

  const todayFinanceActions = [
    {
      key: 'payment',
      label: 'Record Payment',
      description: 'Capture incoming payment and update balance.',
      icon: DollarSign,
      disabled: !canCreatePayment,
      onClick: () => setShowPaymentModal(true),
    },
    {
      key: 'expense',
      label: 'Log Expense',
      description: 'Add operational expense and keep P&L accurate.',
      icon: TrendingDown,
      disabled: !canCreateExpense,
      onClick: () => setShowExpenseModal(true),
    },
    {
      key: 'debt',
      label: 'Review Debtors',
      description: 'Jump to receivables risk and top debtors.',
      icon: AlertTriangle,
      disabled: false,
      onClick: () => {
        setActiveTab('receivables')
        setQuickFocus('risk')
      },
    },
    {
      key: 'payroll',
      label: 'Check Payroll',
      description: 'Inspect pending teacher payouts.',
      icon: Users,
      disabled: false,
      onClick: () => {
        setActiveTab('operations')
        setQuickFocus('payroll')
      },
    },
  ]

  const operationCards = useMemo(
    () => [
      {
        key: 'payments',
        title: 'Payments Ledger',
        description: 'Filter and manage all transactions.',
        icon: CreditCard,
        href: '/dashboard/finance?tab=receivables&focus=cashflow',
        focus: 'cashflow' as FinanceQuickFocus,
      },
      {
        key: 'accounting',
        title: 'Accounting Ledger',
        description: 'Detailed balances and accounting entries.',
        icon: Wallet,
        href: '/dashboard/finance?tab=overview&focus=risk',
        focus: 'cashflow' as FinanceQuickFocus,
      },
      {
        key: 'reports',
        title: 'Reports',
        description: 'Generate downloadable finance reports.',
        icon: FileText,
        href: '/dashboard/reports',
        focus: 'risk' as FinanceQuickFocus,
      },
      {
        key: 'analytics',
        title: 'Analytics',
        description: 'Cross-functional performance intelligence.',
        icon: BarChart3,
        href: '/dashboard/analytics',
        focus: 'risk' as FinanceQuickFocus,
      },
      {
        key: 'hr',
        title: 'HR & Salary',
        description: 'Payroll approvals and compensation control.',
        icon: Users,
        href: '/dashboard/hr',
        focus: 'payroll' as FinanceQuickFocus,
      },
      {
        key: 'expenses',
        title: 'Expenses',
        description: 'Audit spend categories and trend outliers.',
        icon: TrendingDown,
        href: '/dashboard/finance?tab=operations&focus=cashflow',
        focus: 'risk' as FinanceQuickFocus,
      },
    ],
    []
  )

  const filteredOperationCards = useMemo(() => {
    const term = quickSearch.trim().toLowerCase()

    return operationCards.filter((card) => {
      const focusMatches = quickFocus === 'all' || card.focus === quickFocus
      if (!focusMatches) return false
      if (!permissionState.canAccessPage(card.href)) return false
      if (!term) return true
      return (
        card.title.toLowerCase().includes(term) ||
        card.description.toLowerCase().includes(term)
      )
    })
  }, [operationCards, permissionState, quickFocus, quickSearch])

  return (
    <ProtectedRoute>
      {loading ? (
        <LoadingScreen message="Loading finance intelligence..." />
      ) : (
        <div className="relative min-h-screen p-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -left-16 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
            <div className="absolute top-1/4 -right-24 h-80 w-80 rounded-full bg-success/12 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-warning/10 blur-3xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        <div className="glass-panel-strong rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
                  : 'glass-chip text-text-secondary/70 cursor-not-allowed'
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
                  : 'glass-chip text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Add Expense
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="glass-chip px-4 py-2 rounded-xl hover:bg-border/50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold">Today Focus</p>
              <p className="text-xs text-text-secondary">Action-first workflow for finance team</p>
            </div>
            <span className="text-xs text-text-secondary">
              Debtors: {dashboard.debtStudentCount} • Pending payroll: {formatCurrencyFromMinor(dashboard.pendingTeacherEarnings)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {todayFinanceActions.map((action) => {
              const ActionIcon = action.icon
              return (
                <button
                  key={action.key}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`rounded-xl px-4 py-3 text-left border transition-colors ${
                    action.disabled
                      ? 'glass-chip text-text-secondary/60 cursor-not-allowed'
                      : 'glass-chip hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ActionIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{action.label}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{action.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-2 flex gap-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 rounded-xl border transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background/60'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          {canViewReceivables && (
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-5 py-3 rounded-xl border transition-colors whitespace-nowrap ${
                activeTab === 'receivables'
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background/60'
              }`}
            >
              <Target className="h-4 w-4 inline mr-2" />
              Receivables
            </button>
          )}
          {canViewOperations && (
            <button
              onClick={() => setActiveTab('operations')}
              className={`px-5 py-3 rounded-xl border transition-colors whitespace-nowrap ${
                activeTab === 'operations'
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background/60'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Operations
            </button>
          )}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
              <div className="glass-panel-strong rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span className="text-xs text-text-secondary">Revenue</span>
                </div>
                <p className="text-xl font-bold">{formatCurrencyFromMinor(dashboard.grossRevenue)}</p>
                <p className="text-xs text-text-secondary mt-1">Gross collected</p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingDown className="h-5 w-5 text-error" />
                  <span className="text-xs text-text-secondary">Expense</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrencyFromMinor(dashboard.operatingExpenses)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Operating cost</p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
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

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <CreditCard className="h-5 w-5 text-warning" />
                  <span className="text-xs text-text-secondary">Receivable</span>
                </div>
                <p className="text-xl font-bold">{formatCurrencyFromMinor(dashboard.receivables)}</p>
                <p className="text-xs text-text-secondary mt-1">Open student balances</p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Users className="h-5 w-5 text-info" />
                  <span className="text-xs text-text-secondary">Payroll</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrencyFromMinor(dashboard.pendingTeacherEarnings)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Pending teacher payout</p>
              </div>

              <div className="glass-panel rounded-2xl p-5">
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

            <div className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="font-semibold">Operational Links</p>
                  <p className="text-xs text-text-secondary">Filter tools by focus and jump faster</p>
                </div>
                <span className="text-xs text-text-secondary">
                  Showing {filteredOperationCards.length} tools
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'cashflow', label: 'Cashflow' },
                  { id: 'risk', label: 'Risk' },
                  { id: 'payroll', label: 'Payroll' },
                ] as Array<{ id: FinanceQuickFocus; label: string }>).map((focus) => (
                  <button
                    key={focus.id}
                    onClick={() => setQuickFocus(focus.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      quickFocus === focus.id
                        ? 'bg-primary text-background border-primary'
                        : 'glass-chip text-text-secondary hover:text-text-primary hover:border-primary/40'
                    }`}
                  >
                    {focus.label}
                  </button>
                ))}
                <input
                  type="search"
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  placeholder="Search tools..."
                  className="glass-input rounded-xl px-3 py-2 text-sm min-w-[220px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOperationCards.map((card) => {
                  const CardIcon = card.icon
                  return (
                    <button
                      key={card.key}
                      onClick={() => router.push(card.href)}
                      className="glass-chip rounded-2xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                    >
                      <CardIcon className="h-5 w-5 text-primary mb-3" />
                      <p className="font-semibold">{card.title}</p>
                      <p className="text-sm text-text-secondary">{card.description}</p>
                      <span className="text-primary text-sm mt-2 inline-flex items-center gap-1">
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  )
                })}
              </div>

              {filteredOperationCards.length === 0 && (
                <div className="glass-chip rounded-xl p-6 mt-3 text-center">
                  <p className="font-semibold mb-1">No tools found</p>
                  <p className="text-sm text-text-secondary mb-3">Try another focus or clear search.</p>
                  <button
                    onClick={() => {
                      setQuickFocus('all')
                      setQuickSearch('')
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-medium"
                  >
                    Reset
                  </button>
                </div>
              )}
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
                    onClick={() => router.push('/dashboard/finance?tab=receivables&focus=cashflow')}
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
                  onClick={() => router.push('/dashboard/finance?tab=operations&focus=payroll')}
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
                      const nextPricingMode: typeof prev.pricing_mode = manualMode ? 'manual' : 'course'
                      const nextState = {
                        ...prev,
                        pricing_mode: nextPricingMode,
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
                    value={
                      paymentForm.amount_tiyin > 0
                        ? Number(toSelectedCurrency(paymentForm.amount_tiyin / TIYIN_PER_UZS).toFixed(2))
                        : ''
                    }
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount_tiyin: Math.round(fromSelectedCurrency(Number(event.target.value) || 0) * TIYIN_PER_UZS),
                      }))
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
                    value={
                      paymentForm.course_price_tiyin > 0
                        ? Number(toSelectedCurrency(paymentForm.course_price_tiyin / TIYIN_PER_UZS).toFixed(2))
                        : ''
                    }
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        course_price_tiyin: Math.round(fromSelectedCurrency(Number(event.target.value) || 0) * TIYIN_PER_UZS),
                      }))
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

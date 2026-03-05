'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import toast from '@/lib/toast'
import {
  useDashboardStats,
  useAnalytics,
  useReports,
  useGenerateReport,
  useRefreshAnalytics,
  Report,
} from '@/lib/hooks/useAnalytics'
import { useGetLeaderboard } from '@/lib/hooks/useLeaderboard'
import { useSettings } from '@/contexts/SettingsContext'
import LoadingScreen from '@/components/LoadingScreen'

type TabKey = 'overview' | 'reports'

function percent(value: number): string {
  return `${value.toFixed(1)}%`
}

function clampWidth(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

function getStatusClass(isGood: boolean): string {
  return isGood
    ? 'bg-success/10 text-success border-success/20'
    : 'bg-warning/10 text-warning border-warning/20'
}

export default function AnalyticsPage() {
  const { formatCurrencyFromMinor } = useSettings()

  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats()
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics()
  const {
    data: reportsData = { results: [], count: 0, next: null, previous: null },
    isLoading: reportsLoading,
  } = useReports()
  const { data: topStudents = [], isLoading: leaderboardLoading } = useGetLeaderboard({
    metric: 'score',
    filter: 'top10',
  })

  const generateReport = useGenerateReport()
  const refreshAnalytics = useRefreshAnalytics()

  const loading = statsLoading || analyticsLoading || reportsLoading

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [reportType, setReportType] = useState('student-performance')
  const [reportPeriod, setReportPeriod] = useState('month')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const trends = useMemo(() => analytics?.trends ?? [], [analytics?.trends])
  const leadDistribution = useMemo(
    () => analytics?.distribution?.lead_status ?? [],
    [analytics?.distribution?.lead_status]
  )
  const paymentDistribution = useMemo(
    () => analytics?.distribution?.payment_status ?? [],
    [analytics?.distribution?.payment_status]
  )
  const branchDistribution = useMemo(
    () => analytics?.distribution?.students_by_branch ?? [],
    [analytics?.distribution?.students_by_branch]
  )
  const topCourses = useMemo(
    () => analytics?.distribution?.top_courses ?? [],
    [analytics?.distribution?.top_courses]
  )

  const maxTrendAmount = useMemo(
    () =>
      Math.max(
        1,
        ...trends.map((row) => Math.max(row.income, row.expense, Math.abs(row.net_profit), 1))
      ),
    [trends]
  )

  const maxLeadCount = useMemo(
    () => Math.max(1, ...leadDistribution.map((row) => row.count || 0)),
    [leadDistribution]
  )

  const maxBranchStudents = useMemo(
    () => Math.max(1, ...branchDistribution.map((row) => row.students || 0)),
    [branchDistribution]
  )

  const maxCourseStudents = useMemo(
    () => Math.max(1, ...topCourses.map((row) => row.students || 0)),
    [topCourses]
  )

  const paymentTotalAmount = useMemo(
    () => paymentDistribution.reduce((sum, row) => sum + (row.amount || 0), 0),
    [paymentDistribution]
  )

  const kpis = analytics?.kpis
  const operations = analytics?.operations

  const conversionRate = Number.parseFloat(
    (analytics?.this_month.lead_conversion_rate || '0').replace('%', '')
  )

  const handleRefresh = () => {
    refreshAnalytics()
    toast.success('Analytics refreshed')
  }

  const handleGenerateReport = () => {
    generateReport.mutate(
      {
        reportType,
        options: { period: reportPeriod },
      },
      {
        onSuccess: (report) => setSelectedReport(report),
      }
    )
  }

  if (loading) {
    return <LoadingScreen message="Loading analytics dashboard..." />
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              EdTech Analytics Intelligence
            </h1>
            <p className="text-text-secondary mt-1">
              Enrollment, learning quality, finance, CRM, and operations in one production dashboard.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-surface border border-border rounded-xl hover:bg-border/50 transition-colors flex items-center gap-2 font-medium"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh Data
          </button>
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
            onClick={() => setActiveTab('reports')}
            className={`px-5 py-3 border-b-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Reports
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-xs text-text-secondary">Total</span>
                </div>
                <p className="text-3xl font-bold">{kpis?.total_students ?? dashboardStats?.total_students ?? 0}</p>
                <p className="text-sm text-text-secondary">Students</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Activity className="h-5 w-5 text-success" />
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusClass((kpis?.active_students_30d || 0) > 0)}`}>
                    30d
                  </span>
                </div>
                <p className="text-3xl font-bold">{kpis?.active_students_30d ?? 0}</p>
                <p className="text-sm text-text-secondary">Active Students</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Wallet className="h-5 w-5 text-info" />
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(kpis?.monthly_income ?? analytics?.this_month.income ?? 0)}</p>
                <p className="text-sm text-text-secondary">Monthly Revenue</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  {(kpis?.monthly_net_profit ?? analytics?.this_month.net_profit ?? 0) >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-error" />
                  )}
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(kpis?.monthly_net_profit ?? analytics?.this_month.net_profit ?? 0)}</p>
                <p className="text-sm text-text-secondary">Net Profit</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <GraduationCap className="h-5 w-5 text-warning" />
                  <span className="text-xs text-text-secondary">30d</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.attendance_rate_30d ?? 0)}</p>
                <p className="text-sm text-text-secondary">Attendance Rate</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Target className="h-5 w-5 text-success" />
                  <span className="text-xs text-text-secondary">30d</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.exam_pass_rate_30d ?? 0)}</p>
                <p className="text-sm text-text-secondary">Exam Pass Rate</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="text-xs text-text-secondary">LMS</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.lms_completion_rate ?? 0)}</p>
                <p className="text-sm text-text-secondary">Completion Rate</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className="h-5 w-5 text-error" />
                  <span className="text-xs text-text-secondary">Risk</span>
                </div>
                <p className="text-3xl font-bold">{kpis?.at_risk_students_30d ?? 0}</p>
                <p className="text-sm text-text-secondary">At-Risk Students</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">6-Month Financial Trend</h2>
                  <p className="text-sm text-text-secondary">Revenue vs Expense vs Net</p>
                </div>

                {trends.length > 0 ? (
                  <div className="grid grid-cols-6 gap-3 h-64 items-end">
                    {trends.map((row) => {
                      const incomeHeight = clampWidth(row.income, maxTrendAmount)
                      const expenseHeight = clampWidth(row.expense, maxTrendAmount)
                      const profitHeight = clampWidth(Math.abs(row.net_profit), maxTrendAmount)
                      const profitColor = row.net_profit >= 0 ? 'bg-primary' : 'bg-error'

                      return (
                        <div key={row.key} className="flex flex-col items-center gap-2">
                          <div className="w-full h-44 flex items-end justify-center gap-1">
                            <div className="w-3 rounded-t bg-success" style={{ height: `${incomeHeight}%` }} title={`Income: ${formatCurrencyFromMinor(row.income)}`} />
                            <div className="w-3 rounded-t bg-warning" style={{ height: `${expenseHeight}%` }} title={`Expense: ${formatCurrencyFromMinor(row.expense)}`} />
                            <div className={`w-3 rounded-t ${profitColor}`} style={{ height: `${profitHeight}%` }} title={`Net: ${formatCurrencyFromMinor(row.net_profit)}`} />
                          </div>
                          <p className="text-xs text-text-secondary">{row.label.split(' ')[0]}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-text-secondary">No trend data available.</div>
                )}

                <div className="flex flex-wrap gap-4 mt-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /> Revenue</span>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warning" /> Expense</span>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Net Profit</span>
                </div>
              </div>

              <div className="lg:col-span-3 bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5">Learning Quality</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">Attendance (30d)</span>
                      <span className="font-semibold">{percent(kpis?.attendance_rate_30d ?? 0)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${kpis?.attendance_rate_30d ?? 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">Exam Pass Rate (30d)</span>
                      <span className="font-semibold">{percent(kpis?.exam_pass_rate_30d ?? 0)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${kpis?.exam_pass_rate_30d ?? 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">LMS Completion</span>
                      <span className="font-semibold">{percent(kpis?.lms_completion_rate ?? 0)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-info" style={{ width: `${kpis?.lms_completion_rate ?? 0}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-background">
                      <p className="text-xs text-text-secondary mb-1">Avg Exam Score (30d)</p>
                      <p className="text-xl font-bold">{kpis?.avg_exam_score_30d ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background">
                      <p className="text-xs text-text-secondary mb-1">Avg Watch Time</p>
                      <p className="text-xl font-bold">{kpis?.avg_watch_minutes ?? 0}m</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-background flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Student / Teacher Ratio</span>
                    <span className="font-bold">{kpis?.student_teacher_ratio ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5">Lead Funnel & Conversion</h2>
                <div className="space-y-4">
                  {leadDistribution.length > 0 ? (
                    leadDistribution.map((row) => (
                      <div key={row.key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary">{row.label}</span>
                          <span className="font-semibold">{row.count}</span>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${clampWidth(row.count, maxLeadCount)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-secondary text-sm">No lead funnel data.</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
                    <div className="p-3 rounded-xl bg-background">
                      <p className="text-xs text-text-secondary mb-1">New Leads</p>
                      <p className="text-xl font-bold">{analytics?.this_month.new_leads ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background">
                      <p className="text-xs text-text-secondary mb-1">Converted Leads</p>
                      <p className="text-xl font-bold">{analytics?.this_month.converted_leads ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background">
                      <p className="text-xs text-text-secondary mb-1">Conversion Rate</p>
                      <p className="text-xl font-bold text-success">{conversionRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5">Collection Health</h2>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-background">
                    <p className="text-xs text-text-secondary mb-1">Outstanding Balance</p>
                    <p className="text-xl font-bold">{formatCurrencyFromMinor(kpis?.outstanding_balance ?? 0)}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-background">
                    <p className="text-xs text-text-secondary mb-1">ARPU (This Month)</p>
                    <p className="text-xl font-bold">{formatCurrencyFromMinor(kpis?.arpu_minor ?? 0)}</p>
                  </div>

                  <div className="space-y-2 pt-1">
                    {paymentDistribution.map((row) => {
                      const amountShare = paymentTotalAmount > 0 ? (row.amount / paymentTotalAmount) * 100 : 0
                      return (
                        <div key={row.key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-text-secondary">{row.label}</span>
                            <span className="font-medium">{row.count}</span>
                          </div>
                          <div className="h-2 bg-background rounded-full overflow-hidden">
                            <div className="h-full bg-info" style={{ width: `${amountShare}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Branch Distribution
                </h2>
                <div className="space-y-3">
                  {branchDistribution.length > 0 ? (
                    branchDistribution.map((row) => (
                      <div key={row.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary truncate pr-3">{row.name}</span>
                          <span className="font-semibold">{row.students}</span>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${clampWidth(row.students, maxBranchStudents)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-text-secondary">No branch data.</p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Course Demand
                </h2>
                <div className="space-y-3">
                  {topCourses.length > 0 ? (
                    topCourses.map((row) => (
                      <div key={row.course}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-secondary truncate pr-3">{row.course}</span>
                          <span className="font-semibold">{row.students}</span>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${clampWidth(row.students, maxCourseStudents)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-text-secondary">No course demand data.</p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Top Students
                </h2>

                {leaderboardLoading ? (
                  <div className="h-24 flex items-center justify-center text-text-secondary text-sm">
                    Loading leaderboard...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topStudents.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-background">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{entry.student_name}</p>
                          <p className="text-xs text-text-secondary">Rank #{entry.rank}</p>
                        </div>
                        <span className="text-sm font-bold text-primary">{entry.avg_score}</span>
                      </div>
                    ))}
                    {topStudents.length === 0 && (
                      <p className="text-sm text-text-secondary">No leaderboard data.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-5">Operational Monitor</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-background border border-border">
                  <p className="text-xs text-text-secondary mb-1">Today Attendance</p>
                  <p className="text-2xl font-bold">{operations?.today_attendance.total ?? 0}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    P: {operations?.today_attendance.present ?? 0} / E: {operations?.today_attendance.excused ?? 0} / U: {operations?.today_attendance.unexcused ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border">
                  <p className="text-xs text-text-secondary mb-1">Active Groups Today</p>
                  <p className="text-2xl font-bold">{operations?.active_group_sessions_today ?? 0}</p>
                  <p className="text-xs text-text-secondary mt-1">Scheduled sessions</p>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border">
                  <p className="text-xs text-text-secondary mb-1">Pending Payments</p>
                  <p className="text-2xl font-bold">{operations?.pending_payment_count ?? 0}</p>
                  <p className="text-xs text-text-secondary mt-1">Overdue: {operations?.overdue_pending_payments ?? 0}</p>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border">
                  <p className="text-xs text-text-secondary mb-1">Unpaid Teachers</p>
                  <p className="text-2xl font-bold">{operations?.unpaid_teacher_count ?? 0}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {formatCurrencyFromMinor(operations?.unpaid_teacher_amount ?? 0)} pending
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border">
                  <p className="text-xs text-text-secondary mb-1">Open Tickets</p>
                  <p className="text-2xl font-bold">{operations?.open_tickets ?? 0}</p>
                  <p className="text-xs text-text-secondary mt-1">Support queue</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-3 rounded-xl border border-border bg-background flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-xs text-text-secondary">Paid Payments</p>
                    <p className="font-semibold">{operations?.paid_payment_count ?? 0}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-xs text-text-secondary">Failed Payments</p>
                    <p className="font-semibold">
                      {operations?.failed_payment_count ?? 0} ({formatCurrencyFromMinor(operations?.failed_payment_amount ?? 0)})
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-info" />
                  <div>
                    <p className="text-xs text-text-secondary">Report Generated At</p>
                    <p className="font-semibold">{analytics?.report_generated_at ? new Date(analytics.report_generated_at).toLocaleString() : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-2xl border border-border">
              <h3 className="text-lg font-bold mb-4">Generate Analytical Report</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="student-performance">Student Performance</option>
                    <option value="attendance-summary">Attendance Summary</option>
                    <option value="financial-report">Financial Report</option>
                    <option value="teacher-workload">Teacher Workload</option>
                    <option value="course-completion">Course Completion</option>
                    <option value="enrollment-trends">Enrollment Trends</option>
                    <option value="profit-loss">Profit & Loss</option>
                    <option value="cash-flow">Cash Flow</option>
                    <option value="accounts-receivable">Accounts Receivable</option>
                    <option value="teacher-compensation">Teacher Compensation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Period</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    disabled={generateReport.isPending}
                    className="w-full px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generateReport.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {selectedReport && (
              <div className="bg-surface p-6 rounded-2xl border border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{selectedReport.title}</h3>
                    <p className="text-sm text-text-secondary">
                      Generated: {new Date(selectedReport.generated_at).toLocaleString()} | Period: {selectedReport.period}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2 font-medium">
                    <Download className="h-5 w-5" />
                    Export
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(selectedReport.summary || {}).map(([key, value]) => (
                    <div key={key} className="p-4 bg-background rounded-xl">
                      <p className="text-sm text-text-secondary capitalize mb-1">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xl font-bold">{value?.toString() || 'N/A'}</p>
                    </div>
                  ))}
                </div>

                {selectedReport.data && selectedReport.data.length > 0 && (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          {Object.keys(selectedReport.data[0]).map((key) => (
                            <th key={key} className="text-left p-4 font-medium text-text-secondary capitalize">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.data.map((row, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-background transition-colors">
                            {Object.values(row).map((value, colIdx) => (
                              <td key={colIdx} className="p-4 text-sm">
                                {typeof value === 'object' ? JSON.stringify(value) : value?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!selectedReport && (reportsData.results?.length || 0) === 0 && (
              <div className="text-center py-12 bg-surface rounded-2xl border border-border">
                <FileText className="h-14 w-14 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary text-lg mb-1">No generated reports yet</p>
                <p className="text-sm text-text-secondary">Create your first report for detailed analysis output.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ShieldAlert,
  Sparkles,
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
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'
import LoadingScreen from '@/components/LoadingScreen'
import apiService from '@/lib/api'

type TabKey = 'overview' | 'reports'

interface TeacherPerformanceRow {
  id: number
  name: string
  username: string
  isActive: boolean
  trendScore: number
  engagementScore: number
  riskScore: number
  overallScore: number
  currentMonthEarningsTiyin: number
  previousMonthEarningsTiyin: number
  unpaidRatioPercent: number
  absenceRatioPercent: number
  groupCount: number
  studentLoad: number
  presentCount: number
  attendanceRows: number
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`
}

function clampWidth(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

function clampScoreValue(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function getStatusClass(isGood: boolean): string {
  return isGood
    ? 'bg-success/10 text-success border-success/20'
    : 'bg-warning/10 text-warning border-warning/20'
}

function parseListPayload<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (Array.isArray(payload?.results)) return payload.results as T[]
  return []
}

function monthKeyFromDate(value?: string): string | null {
  if (!value) return null
  return value.length >= 7 ? value.slice(0, 7) : null
}

function teacherTier(score: number): string {
  if (score >= 85) return 'Elite'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Stable'
  if (score >= 40) return 'Watch'
  return 'Critical'
}

interface TeacherLite {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  is_active?: boolean
}

interface GroupLite {
  id: number
  student_count?: number
  students?: Array<number | { id?: number }>
  main_teacher?: number | { id?: number }
  assistant_teacher?: number | { id?: number }
}

interface TeacherEarningLite {
  id: number
  teacher?: number
  date?: string
  amount_tiyin?: number
  amount?: number
  is_paid_to_teacher?: boolean
}

interface AttendanceLite {
  id: number
  group?: number | { id?: number }
  attendance_status?: string
  status?: string
  is_present?: boolean
}

function readRelatedId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const idValue = Number((value as { id?: unknown }).id)
    if (Number.isFinite(idValue)) return Math.round(idValue)
  }
  return null
}

function groupStudentCount(group: GroupLite): number {
  const direct = Number(group.student_count)
  if (Number.isFinite(direct) && direct >= 0) return Math.round(direct)
  if (Array.isArray(group.students)) return group.students.length
  return 0
}

function resolveAttendanceStatus(row: AttendanceLite): 'present' | 'absence' | 'absent' {
  const normalized = String(row.attendance_status || row.status || '').toLowerCase()
  if (normalized === 'present') return 'present'
  if (normalized === 'absence' || normalized === 'excused' || normalized === 'absence_excused') return 'absence'
  if (normalized === 'absent' || normalized === 'absent_unexcused') return 'absent'
  if (typeof row.is_present === 'boolean') return row.is_present ? 'present' : 'absent'
  return 'absent'
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const { formatCurrencyFromMinor } = useSettings()
  const canGenerateReports = permissionState.hasPermission('reports.create')
  const canExportReports = permissionState.hasPermission('reports.export')

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
  const [teacherPerformanceRows, setTeacherPerformanceRows] = useState<TeacherPerformanceRow[]>([])
  const [teacherPerformanceLoading, setTeacherPerformanceLoading] = useState(true)

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

  const topTeacherPerformance = useMemo(
    () => teacherPerformanceRows.slice(0, 8),
    [teacherPerformanceRows],
  )

  const teacherPerformanceAverages = useMemo(() => {
    if (teacherPerformanceRows.length === 0) {
      return {
        trend: 0,
        engagement: 0,
        risk: 0,
      }
    }

    const totals = teacherPerformanceRows.reduce(
      (acc, row) => {
        acc.trend += row.trendScore
        acc.engagement += row.engagementScore
        acc.risk += row.riskScore
        return acc
      },
      { trend: 0, engagement: 0, risk: 0 },
    )

    return {
      trend: Math.round(totals.trend / teacherPerformanceRows.length),
      engagement: Math.round(totals.engagement / teacherPerformanceRows.length),
      risk: Math.round(totals.risk / teacherPerformanceRows.length),
    }
  }, [teacherPerformanceRows])

  const kpis = analytics?.kpis
  const operations = analytics?.operations

  const conversionRate = Number.parseFloat(
    (analytics?.this_month.lead_conversion_rate || '0').replace('%', '')
  )

  const fetchAllPages = useCallback(async <T,>(fetchPage: (page: number) => Promise<any>): Promise<T[]> => {
    const rows: T[] = []
    let page = 1
    let guard = 0

    while (guard < 60) {
      const response = await fetchPage(page)
      const pageRows = parseListPayload<T>(response)
      rows.push(...pageRows)

      if (!response?.next) break
      page += 1
      guard += 1
    }

    return rows
  }, [])

  const loadTeacherPerformance = useCallback(async () => {
    const dateToToken = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
    const earningsDateFrom = dateToToken(new Date(now.getFullYear(), now.getMonth() - 3, 1))
    const attendanceDateFrom = dateToToken(new Date(now.getFullYear(), now.getMonth(), 1))
    const attendanceDateTo = dateToToken(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    setTeacherPerformanceLoading(true)

    try {
      const [teachers, groups, earnings] = await Promise.all([
        fetchAllPages<TeacherLite>((page) =>
          apiService.getTeachers({ page, limit: 100 }),
        ),
        fetchAllPages<GroupLite>((page) =>
          apiService.getGroups({ page, limit: 100 }),
        ),
        fetchAllPages<TeacherEarningLite>((page) =>
          apiService.getTeacherEarnings({
            page,
            limit: 200,
            date_from: earningsDateFrom,
          }),
        ),
      ])

      const teacherMap = new Map<number, TeacherLite>()
      teachers.forEach((teacher) => {
        if (typeof teacher.id === 'number') {
          teacherMap.set(teacher.id, teacher)
        }
      })

      const groupInsights = new Map<number, { groupCount: number; studentLoad: number }>()
      const teacherIdsByGroup = new Map<number, number[]>()

      groups.forEach((group) => {
        const linkedTeachers = [readRelatedId(group.main_teacher), readRelatedId(group.assistant_teacher)]
          .filter((teacherId): teacherId is number => teacherId !== null && teacherMap.has(teacherId))

        if (linkedTeachers.length === 0) return

        teacherIdsByGroup.set(group.id, linkedTeachers)

        const students = groupStudentCount(group)
        linkedTeachers.forEach((teacherId) => {
          const current = groupInsights.get(teacherId) || { groupCount: 0, studentLoad: 0 }
          current.groupCount += 1
          current.studentLoad += students
          groupInsights.set(teacherId, current)
        })
      })

      const attendanceByTeacher = new Map<number, { present: number; absence: number; absent: number; total: number }>()
      const groupIds = Array.from(teacherIdsByGroup.keys()).slice(0, 60)
      if (groupIds.length > 0) {
        const attendancePayloads = await Promise.all(
          groupIds.map(async (groupId) => {
            const groupRows = await fetchAllPages<AttendanceLite>((page) =>
              apiService.getAttendance({
                page,
                limit: 200,
                group: groupId,
                date_from: attendanceDateFrom,
                date_to: attendanceDateTo,
              }),
            )
            return groupRows.map((row) => ({
              ...row,
              group: row.group || groupId,
            }))
          }),
        )

        attendancePayloads.flat().forEach((row) => {
          const groupId = readRelatedId(row.group)
          if (groupId === null) return
          const linkedTeacherIds = teacherIdsByGroup.get(groupId)
          if (!linkedTeacherIds || linkedTeacherIds.length === 0) return

          const status = resolveAttendanceStatus(row)
          linkedTeacherIds.forEach((teacherId) => {
            const current = attendanceByTeacher.get(teacherId) || { present: 0, absence: 0, absent: 0, total: 0 }
            current[status] += 1
            current.total += 1
            attendanceByTeacher.set(teacherId, current)
          })
        })
      }

      const earningsByTeacher = new Map<number, {
        current: number
        previous: number
        total: number
        unpaid: number
        eventsCurrent: number
      }>()

      earnings.forEach((entry) => {
        const teacherId = Number(entry.teacher)
        if (!Number.isFinite(teacherId) || !teacherMap.has(teacherId)) return

        const amount = Number(entry.amount_tiyin ?? entry.amount ?? 0)
        if (!Number.isFinite(amount)) return

        const monthKey = monthKeyFromDate(entry.date)
        const current = earningsByTeacher.get(teacherId) || {
          current: 0,
          previous: 0,
          total: 0,
          unpaid: 0,
          eventsCurrent: 0,
        }

        current.total += amount
        if (!entry.is_paid_to_teacher) current.unpaid += amount

        if (monthKey === currentMonthKey) {
          current.current += amount
          current.eventsCurrent += 1
        } else if (monthKey === previousMonthKey) {
          current.previous += amount
        }

        earningsByTeacher.set(teacherId, current)
      })

      const scoreRows: TeacherPerformanceRow[] = Array.from(teacherMap.values()).map((teacher) => {
        const teacherId = teacher.id
        const earning = earningsByTeacher.get(teacherId) || { current: 0, previous: 0, total: 0, unpaid: 0, eventsCurrent: 0 }
        const attendance = attendanceByTeacher.get(teacherId) || { present: 0, absence: 0, absent: 0, total: 0 }
        const groupInfo = groupInsights.get(teacherId) || { groupCount: 0, studentLoad: 0 }

        let trendScore = 40
        if (earning.previous <= 0 && earning.current > 0) {
          trendScore = 82
        } else if (earning.previous > 0) {
          const growthRate = (earning.current - earning.previous) / earning.previous
          trendScore = clampScoreValue(55 + growthRate * 55)
        }

        const groupLoadScore = clampScoreValue(groupInfo.groupCount * 18)
        const studentReachScore = clampScoreValue(groupInfo.studentLoad * 2.4)
        const activityScore = clampScoreValue(earning.eventsCurrent * 6)
        const attendancePresenceRate = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0

        const engagementScore = Math.round(
          groupLoadScore * 0.25 +
          studentReachScore * 0.25 +
          activityScore * 0.2 +
          attendancePresenceRate * 0.3,
        )

        const totalEarningMagnitude = Math.max(Math.abs(earning.total), 1)
        const unpaidRatio = earning.unpaid > 0 ? Math.min(1, earning.unpaid / totalEarningMagnitude) : 0
        const absenceRatio = attendance.total > 0
          ? (attendance.absence + attendance.absent) / attendance.total
          : 0
        const riskScore = Math.round(
          clampScoreValue(
            unpaidRatio * 55 +
            absenceRatio * 35 +
            (teacher.is_active === false ? 20 : 0) +
            (trendScore < 45 ? 10 : 0),
          ),
        )

        const overallScore = Math.round(
          clampScoreValue(
            trendScore * 0.35 +
            engagementScore * 0.45 +
            (100 - riskScore) * 0.2,
          ),
        )

        const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()

        return {
          id: teacherId,
          name: fullName || teacher.username || `Teacher #${teacherId}`,
          username: teacher.username || '-',
          isActive: teacher.is_active !== false,
          trendScore: Math.round(clampScoreValue(trendScore)),
          engagementScore,
          riskScore,
          overallScore,
          currentMonthEarningsTiyin: Math.round(earning.current),
          previousMonthEarningsTiyin: Math.round(earning.previous),
          unpaidRatioPercent: Math.round(unpaidRatio * 100),
          absenceRatioPercent: Math.round(absenceRatio * 100),
          groupCount: groupInfo.groupCount,
          studentLoad: groupInfo.studentLoad,
          presentCount: attendance.present,
          attendanceRows: attendance.total,
        }
      })

      scoreRows.sort((left, right) => right.overallScore - left.overallScore)
      setTeacherPerformanceRows(scoreRows)
    } catch (error: any) {
      console.error('Failed to load teacher performance data:', error)
      toast.error(error?.response?.data?.detail || 'Failed to load teacher performance scorecards')
      setTeacherPerformanceRows([])
    } finally {
      setTeacherPerformanceLoading(false)
    }
  }, [fetchAllPages])

  useEffect(() => {
    void loadTeacherPerformance()
  }, [loadTeacherPerformance])

  const handleRefresh = () => {
    refreshAnalytics()
    void loadTeacherPerformance()
    toast.success('Analytics refreshed')
  }

  const handleGenerateReport = () => {
    if (!canGenerateReports) {
      toast.error('You do not have permission to generate reports.')
      return
    }

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

  const handleExportSelectedReport = async () => {
    if (!selectedReport) return

    if (!canExportReports) {
      toast.error('You do not have permission to export reports.')
      return
    }

    const reportId = selectedReport.report_id || selectedReport.id
    try {
      const blob = await apiService.downloadReport(reportId, 'csv')
      const fileUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = fileUrl
      anchor.download = `${reportId}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(fileUrl)
      toast.success('Report exported successfully.')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to export report.')
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading analytics dashboard..." />
  }

  return (
    <div className="relative min-h-screen bg-background p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
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
            className="px-4 py-2 bg-surface/70 backdrop-blur-xl border border-white/20 rounded-xl hover:bg-surface/90 transition-colors flex items-center gap-2 font-medium"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh Data
          </button>
        </div>

        <div className="inline-flex gap-2 border border-white/15 bg-surface/70 backdrop-blur-xl rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 rounded-xl transition-colors ${
              activeTab === 'overview'
                ? 'bg-primary text-background'
                : 'text-text-secondary hover:text-text-primary hover:bg-background/70'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-5 py-3 rounded-xl transition-colors ${
              activeTab === 'reports'
                ? 'bg-primary text-background'
                : 'text-text-secondary hover:text-text-primary hover:bg-background/70'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Reports
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-xs text-text-secondary">Total</span>
                </div>
                <p className="text-3xl font-bold">{kpis?.total_students ?? dashboardStats?.total_students ?? 0}</p>
                <p className="text-sm text-text-secondary">Students</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Activity className="h-5 w-5 text-success" />
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusClass((kpis?.active_students_30d || 0) > 0)}`}>
                    30d
                  </span>
                </div>
                <p className="text-3xl font-bold">{kpis?.active_students_30d ?? 0}</p>
                <p className="text-sm text-text-secondary">Active Students</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Wallet className="h-5 w-5 text-info" />
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-bold">{formatCurrencyFromMinor(kpis?.monthly_income ?? analytics?.this_month.income ?? 0)}</p>
                <p className="text-sm text-text-secondary">Monthly Revenue</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
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

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <GraduationCap className="h-5 w-5 text-warning" />
                  <span className="text-xs text-text-secondary">30d</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.attendance_rate_30d ?? 0)}</p>
                <p className="text-sm text-text-secondary">Attendance Rate</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Target className="h-5 w-5 text-success" />
                  <span className="text-xs text-text-secondary">30d</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.exam_pass_rate_30d ?? 0)}</p>
                <p className="text-sm text-text-secondary">Exam Pass Rate</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="text-xs text-text-secondary">LMS</span>
                </div>
                <p className="text-3xl font-bold">{percent(kpis?.lms_completion_rate ?? 0)}</p>
                <p className="text-sm text-text-secondary">Completion Rate</p>
              </div>

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className="h-5 w-5 text-error" />
                  <span className="text-xs text-text-secondary">Risk</span>
                </div>
                <p className="text-3xl font-bold">{kpis?.at_risk_students_30d ?? 0}</p>
                <p className="text-sm text-text-secondary">At-Risk Students</p>
              </div>
            </div>

            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Teacher Performance Command Center
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Trend, engagement, and risk ranking based on attendance-linked financial activity.
                  </p>
                </div>
                <button
                  onClick={() => void loadTeacherPerformance()}
                  className="px-3 py-2 rounded-xl border border-white/20 bg-background/60 hover:bg-background/80 text-sm"
                >
                  Refresh Scorecards
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div className="rounded-xl border border-success/25 bg-success/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-success mb-1">Avg Trend</p>
                  <p className="text-2xl font-bold">{teacherPerformanceAverages.trend}</p>
                </div>
                <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-cyan-500 mb-1">Avg Engagement</p>
                  <p className="text-2xl font-bold">{teacherPerformanceAverages.engagement}</p>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-warning mb-1">Avg Risk</p>
                  <p className="text-2xl font-bold">{teacherPerformanceAverages.risk}</p>
                </div>
              </div>

              {teacherPerformanceLoading ? (
                <div className="h-32 rounded-2xl border border-white/10 bg-background/40 flex items-center justify-center text-text-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Building teacher scorecards...
                </div>
              ) : (
                <div className="space-y-3">
                  {topTeacherPerformance.map((row, index) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-background/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            #{index + 1} {row.name}
                          </p>
                          <p className="text-xs text-text-secondary">@{row.username}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{row.overallScore}</p>
                          <p className="text-xs text-text-secondary">{teacherTier(row.overallScore)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-1">Trend</p>
                          <div className="h-2 rounded-full bg-background overflow-hidden">
                            <div className="h-full rounded-full bg-success" style={{ width: `${row.trendScore}%` }} />
                          </div>
                          <p className="text-xs mt-1 text-text-secondary">
                            {formatCurrencyFromMinor(row.currentMonthEarningsTiyin)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-1">Engagement</p>
                          <div className="h-2 rounded-full bg-background overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${row.engagementScore}%` }} />
                          </div>
                          <p className="text-xs mt-1 text-text-secondary">
                            {row.groupCount} groups • {row.studentLoad} students
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-1">Risk</p>
                          <div className="h-2 rounded-full bg-background overflow-hidden">
                            <div className="h-full rounded-full bg-warning" style={{ width: `${row.riskScore}%` }} />
                          </div>
                          <p className="text-xs mt-1 text-text-secondary">
                            Unpaid {row.unpaidRatioPercent}% • Absence {row.absenceRatioPercent}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {topTeacherPerformance.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-background/40 p-6 text-center text-text-secondary">
                      <ShieldAlert className="h-5 w-5 inline mr-2" />
                      No teacher scorecards yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <div className="lg:col-span-4 bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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

              <div className="lg:col-span-3 bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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
              <div className="lg:col-span-2 bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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
              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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

              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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

            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
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
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 p-6 rounded-2xl">
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
                    disabled={!canGenerateReports || generateReport.isPending}
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
              <div className="bg-surface/70 backdrop-blur-xl border border-white/15 p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{selectedReport.title}</h3>
                    <p className="text-sm text-text-secondary">
                      Generated: {new Date(selectedReport.generated_at).toLocaleString()} | Period: {selectedReport.period}
                    </p>
                  </div>
                  <button
                    onClick={handleExportSelectedReport}
                    disabled={!canExportReports}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
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
              <div className="text-center py-12 bg-surface/70 backdrop-blur-xl rounded-2xl border border-white/15">
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

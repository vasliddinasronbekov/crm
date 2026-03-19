'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Coins,
  Edit3,
  Mail,
  Phone,
  Shield,
  TrendingUp,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@/contexts/SettingsContext'
import { usePermissions } from '@/lib/permissions'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { resolveApiAssetUrl } from '@/lib/utils/url'
import { useTeacher, useUpdateTeacher, type Teacher } from '@/lib/hooks/useTeachers'

type DetailTab = 'overview' | 'groups' | 'attendance' | 'earnings'
type EarningsStatusFilter = 'all' | 'paid' | 'unpaid'

const TEACHER_DETAIL_TAB_STORAGE_KEY = 'dashboard.teachers.detail.active_tab'
const TEACHER_ATTENDANCE_MONTH_STORAGE_KEY = 'dashboard.teachers.detail.attendance_month'
const TEACHER_ATTENDANCE_GROUP_STORAGE_KEY = 'dashboard.teachers.detail.attendance_group'
const TEACHER_EARNINGS_MONTH_STORAGE_KEY = 'dashboard.teachers.detail.earnings_month'
const TEACHER_EARNINGS_STATUS_STORAGE_KEY = 'dashboard.teachers.detail.earnings_status'

const getScopedTeacherDetailStorageKey = (
  baseKey: string,
  teacherId: number,
  userId: number | null | undefined,
  branchId: number | null,
): string => {
  const userScope = userId ?? 'anonymous'
  const branchScope = branchId ?? 'all'
  return `${baseKey}:t${teacherId}:u${userScope}:b${branchScope}`
}

interface TeacherGroup {
  id: number
  name: string
  is_active?: boolean
  days?: string
  start_time?: string
  end_time?: string
  start_day?: string
  end_day?: string
  branch_name?: string
  course_name?: string
  room_name?: string
  student_count?: number
  students?: Array<number | { id?: number }>
  main_teacher?: number | { id?: number; first_name?: string; last_name?: string; username?: string }
  assistant_teacher?: number | { id?: number; first_name?: string; last_name?: string; username?: string }
}

interface TeacherEarningRow {
  id: number
  date?: string
  amount?: number | string
  amount_tiyin?: number
  payment_amount?: number | string
  payment_amount_tiyin?: number
  is_paid_to_teacher?: boolean
  paid_date?: string | null
  group_name?: string
  student_name?: string
  source_type?: string
  entry_type?: string
}

interface TeacherAttendanceRow {
  id: number
  student?: number | { id?: number; first_name?: string; last_name?: string; username?: string }
  group?: number | { id?: number; name?: string }
  group_name?: string
  date?: string
  attendance_status?: string
  status?: string
  is_present?: boolean
}

interface TeacherEarningsSummary {
  total_earnings_count?: number
  total_amount?: number | string
  total_paid?: number | string
  total_unpaid?: number | string
  paid_count?: number
  unpaid_count?: number
}

interface TeacherEditForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  is_staff: boolean
  is_active: boolean
}

const TIYIN_PER_UZS = 100

const parseListPayload = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[]
  if (Array.isArray(payload?.results)) return payload.results as T[]
  return []
}

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const toMoneyTiyin = (explicitTiyin: unknown, fallbackUzs?: unknown): number => {
  const fromTiyin = toNumber(explicitTiyin)
  if (fromTiyin !== null) return Math.round(fromTiyin)

  const fromUzs = toNumber(fallbackUzs)
  if (fromUzs !== null) return Math.round(fromUzs * TIYIN_PER_UZS)

  return 0
}

const readRelatedUserId = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const parsed = toNumber((value as { id?: unknown }).id)
    if (parsed !== null) return Math.round(parsed)
  }
  return null
}

const getStudentCount = (group: TeacherGroup): number => {
  const fromField = toNumber(group.student_count)
  if (fromField !== null) return Math.max(0, Math.round(fromField))
  if (Array.isArray(group.students)) return group.students.length
  return 0
}

const roleLabelForGroup = (group: TeacherGroup, teacherId: number): string => {
  const mainId = readRelatedUserId(group.main_teacher)
  if (mainId === teacherId) return 'Main Teacher'
  const assistantId = readRelatedUserId(group.assistant_teacher)
  if (assistantId === teacherId) return 'Assistant Teacher'
  return 'Teacher'
}

const getInitials = (teacher: Teacher | null | undefined): string => {
  if (!teacher) return '??'
  const first = teacher.first_name?.trim()?.[0] || ''
  const last = teacher.last_name?.trim()?.[0] || ''
  return (first + last).toUpperCase() || teacher.username?.slice(0, 2).toUpperCase() || '??'
}

const monthKeyFromDate = (value?: string): string | null => {
  if (!value) return null
  return value.length >= 7 ? value.slice(0, 7) : null
}

const formatMonthTitle = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map((part) => Number(part))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const getRecentMonthKeys = (count: number): string[] => {
  const result: string[] = []
  const now = new Date()
  for (let index = count - 1; index >= 0; index -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push(key)
  }
  return result
}

const getMonthDateRange = (monthKey: string): { from: string; to: string; daysInMonth: number; monthLabel: string } => {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const fallback = new Date()
    const fallbackYear = fallback.getFullYear()
    const fallbackMonth = fallback.getMonth() + 1
    const fallbackDays = new Date(fallbackYear, fallbackMonth, 0).getDate()
    return {
      from: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-01`,
      to: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(fallbackDays).padStart(2, '0')}`,
      daysInMonth: fallbackDays,
      monthLabel: `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}`,
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const monthToken = `${year}-${String(month).padStart(2, '0')}`

  return {
    from: `${monthToken}-01`,
    to: `${monthToken}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
    monthLabel: monthToken,
  }
}

const resolveAttendanceStatus = (
  entry: TeacherAttendanceRow,
): 'present' | 'absence' | 'absent' => {
  const normalized = String(entry.attendance_status || entry.status || '').toLowerCase()
  if (normalized === 'present') return 'present'
  if (normalized === 'absence' || normalized === 'excused' || normalized === 'absence_excused') return 'absence'
  if (normalized === 'absent' || normalized === 'absent_unexcused') return 'absent'

  if (typeof entry.is_present === 'boolean') {
    return entry.is_present ? 'present' : 'absent'
  }

  return 'absent'
}

const clampScore = (value: number): number => Math.max(0, Math.min(100, value))

export default function TeacherDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranchId } = useBranchContext()
  const permissionState = usePermissions(user)
  const { formatCurrencyFromMinor } = useSettings()

  const teacherId = Number(params.id)
  const canEditTeacher = permissionState.hasPermission('teachers.edit')

  const { data: teacher, isLoading: teacherLoading, refetch: refetchTeacher } = useTeacher(
    Number.isFinite(teacherId) ? teacherId : null,
  )
  const updateTeacher = useUpdateTeacher()

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [earnings, setEarnings] = useState<TeacherEarningRow[]>([])
  const [earningsSummary, setEarningsSummary] = useState<TeacherEarningsSummary | null>(null)
  const [attendanceRows, setAttendanceRows] = useState<TeacherAttendanceRow[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceMonth, setAttendanceMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [attendanceGroupId, setAttendanceGroupId] = useState<string>('all')
  const [earningsMonth, setEarningsMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [earningsStatus, setEarningsStatus] = useState<EarningsStatusFilter>('all')
  const [hasLoadedDetailPrefs, setHasLoadedDetailPrefs] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<TeacherEditForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_staff: false,
    is_active: true,
  })

  const persistedUserId = useMemo(() => {
    const parsed = Number(user?.id)
    return Number.isFinite(parsed) ? parsed : null
  }, [user?.id])

  const detailStorageKeys = useMemo(() => {
    if (!Number.isFinite(teacherId) || persistedUserId === null) {
      return null
    }

    return {
      activeTab: getScopedTeacherDetailStorageKey(
        TEACHER_DETAIL_TAB_STORAGE_KEY,
        teacherId,
        persistedUserId,
        activeBranchId,
      ),
      attendanceMonth: getScopedTeacherDetailStorageKey(
        TEACHER_ATTENDANCE_MONTH_STORAGE_KEY,
        teacherId,
        persistedUserId,
        activeBranchId,
      ),
      attendanceGroup: getScopedTeacherDetailStorageKey(
        TEACHER_ATTENDANCE_GROUP_STORAGE_KEY,
        teacherId,
        persistedUserId,
        activeBranchId,
      ),
      earningsMonth: getScopedTeacherDetailStorageKey(
        TEACHER_EARNINGS_MONTH_STORAGE_KEY,
        teacherId,
        persistedUserId,
        activeBranchId,
      ),
      earningsStatus: getScopedTeacherDetailStorageKey(
        TEACHER_EARNINGS_STATUS_STORAGE_KEY,
        teacherId,
        persistedUserId,
        activeBranchId,
      ),
    }
  }, [activeBranchId, teacherId, persistedUserId])

  const fetchAllPages = useCallback(async <T,>(fetchPage: (page: number) => Promise<any>): Promise<T[]> => {
    const rows: T[] = []
    let page = 1
    let guard = 0

    while (guard < 40) {
      const response = await fetchPage(page)
      const pageRows = parseListPayload<T>(response)
      rows.push(...pageRows)

      if (!response?.next) break
      page += 1
      guard += 1
    }

    return rows
  }, [])

  const loadTeacherInsights = useCallback(async () => {
    if (!Number.isFinite(teacherId)) return

    setInsightsLoading(true)
    try {
      const [allGroups, earningsResponse, summaryResponse] = await Promise.all([
        fetchAllPages<TeacherGroup>((page) =>
          apiService.getGroups({
            page,
            limit: 100,
          }),
        ),
        apiService.getTeacherEarnings({
          teacher: teacherId,
          limit: 200,
        }),
        apiService.getTeacherEarningsSummary({
          teacher: teacherId,
        }),
      ])

      const teacherGroups = allGroups.filter((group) => {
        const mainTeacherId = readRelatedUserId(group.main_teacher)
        const assistantTeacherId = readRelatedUserId(group.assistant_teacher)
        return mainTeacherId === teacherId || assistantTeacherId === teacherId
      })

      setGroups(teacherGroups)
      setEarnings(parseListPayload<TeacherEarningRow>(earningsResponse))
      setEarningsSummary(summaryResponse || null)
    } catch (error: any) {
      console.error('Failed to load teacher insights:', error)
      const message = error?.response?.data?.detail || 'Failed to load teacher insights'
      toast.error(message)
    } finally {
      setInsightsLoading(false)
    }
  }, [fetchAllPages, teacherId])

  useEffect(() => {
    void loadTeacherInsights()
  }, [loadTeacherInsights])

  useEffect(() => {
    if (!Number.isFinite(teacherId) || !detailStorageKeys) return

    setHasLoadedDetailPrefs(false)

    try {
      setActiveTab('overview')
      setAttendanceMonth(new Date().toISOString().slice(0, 7))
      setAttendanceGroupId('all')
      setEarningsMonth(new Date().toISOString().slice(0, 7))
      setEarningsStatus('all')

      const tabValue = localStorage.getItem(detailStorageKeys.activeTab)
      if (tabValue && ['overview', 'groups', 'attendance', 'earnings'].includes(tabValue)) {
        setActiveTab(tabValue as DetailTab)
      }

      const attendanceMonthValue = localStorage.getItem(detailStorageKeys.attendanceMonth)
      if (attendanceMonthValue) {
        setAttendanceMonth(attendanceMonthValue)
      }

      const attendanceGroupValue = localStorage.getItem(detailStorageKeys.attendanceGroup)
      if (attendanceGroupValue) {
        setAttendanceGroupId(attendanceGroupValue)
      }

      const earningsMonthValue = localStorage.getItem(detailStorageKeys.earningsMonth)
      if (earningsMonthValue) {
        setEarningsMonth(earningsMonthValue)
      }

      const earningsStatusValue = localStorage.getItem(detailStorageKeys.earningsStatus)
      if (earningsStatusValue && ['all', 'paid', 'unpaid'].includes(earningsStatusValue)) {
        setEarningsStatus(earningsStatusValue as EarningsStatusFilter)
      }
    } catch {
      // Ignore storage access failures.
    } finally {
      setHasLoadedDetailPrefs(true)
    }
  }, [detailStorageKeys, teacherId])

  useEffect(() => {
    if (!Number.isFinite(teacherId) || !detailStorageKeys || !hasLoadedDetailPrefs) return

    try {
      localStorage.setItem(detailStorageKeys.activeTab, activeTab)
      localStorage.setItem(detailStorageKeys.attendanceMonth, attendanceMonth)
      localStorage.setItem(detailStorageKeys.attendanceGroup, attendanceGroupId)
      localStorage.setItem(detailStorageKeys.earningsMonth, earningsMonth)
      localStorage.setItem(detailStorageKeys.earningsStatus, earningsStatus)
    } catch {
      // Ignore storage write failures.
    }
  }, [
    activeTab,
    attendanceGroupId,
    attendanceMonth,
    detailStorageKeys,
    earningsMonth,
    earningsStatus,
    hasLoadedDetailPrefs,
    teacherId,
  ])

  const loadAttendanceInsights = useCallback(async () => {
    if (!Number.isFinite(teacherId) || groups.length === 0) {
      setAttendanceRows([])
      return
    }

    const selectedGroupIds =
      attendanceGroupId === 'all'
        ? groups.map((group) => group.id)
        : groups.filter((group) => String(group.id) === attendanceGroupId).map((group) => group.id)

    if (selectedGroupIds.length === 0) {
      setAttendanceRows([])
      return
    }

    const dateRange = getMonthDateRange(attendanceMonth)
    setAttendanceLoading(true)

    try {
      const attendancePages = await Promise.all(
        selectedGroupIds.map((groupId) =>
          fetchAllPages<TeacherAttendanceRow>((page) =>
            apiService.getAttendance({
              page,
              limit: 200,
              group: groupId,
              date_from: dateRange.from,
              date_to: dateRange.to,
            }),
          ),
        ),
      )

      const merged = attendancePages.flat()
      merged.sort((left, right) => {
        const leftDate = left.date || ''
        const rightDate = right.date || ''
        return rightDate.localeCompare(leftDate)
      })
      setAttendanceRows(merged)
    } catch (error: any) {
      console.error('Failed to load teacher attendance insights:', error)
      const message = error?.response?.data?.detail || 'Failed to load attendance insights'
      toast.error(message)
    } finally {
      setAttendanceLoading(false)
    }
  }, [attendanceGroupId, attendanceMonth, fetchAllPages, groups, teacherId])

  useEffect(() => {
    void loadAttendanceInsights()
  }, [loadAttendanceInsights])

  useEffect(() => {
    if (attendanceGroupId === 'all') return
    if (groups.some((group) => String(group.id) === attendanceGroupId)) return
    setAttendanceGroupId('all')
  }, [attendanceGroupId, groups])

  const teacherName = useMemo(() => {
    if (!teacher) return 'Teacher'
    const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()
    return fullName || teacher.username
  }, [teacher])

  const activeGroupCount = useMemo(
    () => groups.filter((group) => group.is_active !== false).length,
    [groups],
  )

  const totalStudents = useMemo(
    () => groups.reduce((sum, group) => sum + getStudentCount(group), 0),
    [groups],
  )

  const attendanceMonthRange = useMemo(
    () => getMonthDateRange(attendanceMonth),
    [attendanceMonth],
  )

  const attendanceDateMap = useMemo(() => {
    const map = new Map<string, { present: number; absence: number; absent: number; total: number }>()

    attendanceRows.forEach((row) => {
      if (!row.date) return
      const dateKey = row.date.slice(0, 10)
      const current = map.get(dateKey) || { present: 0, absence: 0, absent: 0, total: 0 }
      const status = resolveAttendanceStatus(row)
      current[status] += 1
      current.total += 1
      map.set(dateKey, current)
    })

    return map
  }, [attendanceRows])

  const attendanceSummary = useMemo(() => {
    let present = 0
    let absence = 0
    let absent = 0
    let total = 0
    const students = new Set<number>()
    const activeDates = new Set<string>()

    attendanceRows.forEach((row) => {
      const status = resolveAttendanceStatus(row)
      if (status === 'present') present += 1
      if (status === 'absence') absence += 1
      if (status === 'absent') absent += 1
      total += 1
      if (row.date) activeDates.add(row.date.slice(0, 10))

      const studentId = readRelatedUserId(row.student)
      if (studentId !== null) {
        students.add(studentId)
      }
    })

    return {
      present,
      absence,
      absent,
      total,
      uniqueStudents: students.size,
      lessonDays: activeDates.size,
      presenceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    }
  }, [attendanceRows])

  const attendanceTimeline = useMemo(() => {
    const rows = Array.from(attendanceDateMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }))
    rows.sort((left, right) => right.date.localeCompare(left.date))
    return rows
  }, [attendanceDateMap])

  const attendanceCalendar = useMemo(() => {
    const [yearRaw, monthRaw] = attendanceMonthRange.monthLabel.split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const daysInMonth = attendanceMonthRange.daysInMonth
    const items: Array<{
      date: string
      day: number
      total: number
      present: number
      absence: number
      absent: number
      presenceRate: number
    }> = []

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${attendanceMonthRange.monthLabel}-${String(day).padStart(2, '0')}`
      const counts = attendanceDateMap.get(date) || { present: 0, absence: 0, absent: 0, total: 0 }
      items.push({
        date,
        day,
        total: counts.total,
        present: counts.present,
        absence: counts.absence,
        absent: counts.absent,
        presenceRate: counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0,
      })
    }

    return { firstWeekday, items }
  }, [attendanceDateMap, attendanceMonthRange.daysInMonth, attendanceMonthRange.monthLabel])

  const summaryTotalEarningsTiyin = useMemo(() => {
    const fromSummary = toMoneyTiyin(earningsSummary?.total_amount)
    if (fromSummary > 0) return fromSummary
    return earnings.reduce((sum, entry) => sum + toMoneyTiyin(entry.amount_tiyin, entry.amount), 0)
  }, [earnings, earningsSummary?.total_amount])

  const summaryPaidTiyin = useMemo(() => {
    const fromSummary = toMoneyTiyin(earningsSummary?.total_paid)
    if (fromSummary > 0) return fromSummary
    return earnings
      .filter((entry) => entry.is_paid_to_teacher)
      .reduce((sum, entry) => sum + toMoneyTiyin(entry.amount_tiyin, entry.amount), 0)
  }, [earnings, earningsSummary?.total_paid])

  const summaryUnpaidTiyin = useMemo(() => {
    const fromSummary = toMoneyTiyin(earningsSummary?.total_unpaid)
    if (fromSummary > 0) return fromSummary
    return earnings
      .filter((entry) => !entry.is_paid_to_teacher)
      .reduce((sum, entry) => sum + toMoneyTiyin(entry.amount_tiyin, entry.amount), 0)
  }, [earnings, earningsSummary?.total_unpaid])

  const payoutRate = useMemo(() => {
    if (summaryTotalEarningsTiyin <= 0) return 0
    return Math.round((summaryPaidTiyin / summaryTotalEarningsTiyin) * 100)
  }, [summaryPaidTiyin, summaryTotalEarningsTiyin])

  const filteredEarnings = useMemo(() => {
    return earnings.filter((entry) => {
      const monthMatches = monthKeyFromDate(entry.date) === earningsMonth
      if (!monthMatches) return false

      if (earningsStatus === 'paid') return !!entry.is_paid_to_teacher
      if (earningsStatus === 'unpaid') return !entry.is_paid_to_teacher
      return true
    })
  }, [earnings, earningsMonth, earningsStatus])

  const currentMonthEarningsTiyin = useMemo(
    () => filteredEarnings.reduce((sum, entry) => sum + toMoneyTiyin(entry.amount_tiyin, entry.amount), 0),
    [filteredEarnings],
  )

  const trendByMonth = useMemo(() => {
    const monthKeys = getRecentMonthKeys(6)
    const totals = new Map(monthKeys.map((monthKey) => [monthKey, 0]))

    earnings.forEach((entry) => {
      const month = monthKeyFromDate(entry.date)
      if (!month || !totals.has(month)) return
      totals.set(month, (totals.get(month) || 0) + toMoneyTiyin(entry.amount_tiyin, entry.amount))
    })

    return monthKeys.map((month) => ({
      month,
      totalTiyin: totals.get(month) || 0,
    }))
  }, [earnings])

  const trendMax = useMemo(
    () => Math.max(1, ...trendByMonth.map((item) => item.totalTiyin)),
    [trendByMonth],
  )

  const performanceScorecard = useMemo(() => {
    const currentMonth = trendByMonth[trendByMonth.length - 1]?.totalTiyin || 0
    const previousMonth = trendByMonth[trendByMonth.length - 2]?.totalTiyin || 0

    let trendScore = 40
    if (previousMonth <= 0 && currentMonth > 0) {
      trendScore = 82
    } else if (previousMonth > 0) {
      const growthRate = (currentMonth - previousMonth) / previousMonth
      trendScore = clampScore(55 + growthRate * 55)
    }

    const groupLoadScore = clampScore(groups.length * 18)
    const studentReachScore = clampScore(totalStudents * 2.6)
    const calendarActivityScore = clampScore(attendanceSummary.lessonDays * 6)
    const engagementScore = Math.round(
      groupLoadScore * 0.25 +
      studentReachScore * 0.25 +
      calendarActivityScore * 0.2 +
      attendanceSummary.presenceRate * 0.3,
    )

    const unpaidRatio = summaryTotalEarningsTiyin > 0 ? summaryUnpaidTiyin / summaryTotalEarningsTiyin : 0
    const absenceRatio = attendanceSummary.total > 0
      ? (attendanceSummary.absence + attendanceSummary.absent) / attendanceSummary.total
      : 0

    const riskScore = Math.round(
      clampScore(
        unpaidRatio * 55 +
        absenceRatio * 35 +
        (teacher?.is_active === false ? 25 : 0) +
        (trendScore < 45 ? 10 : 0),
      ),
    )

    const overallScore = Math.round(
      clampScore(
        trendScore * 0.35 +
        engagementScore * 0.45 +
        (100 - riskScore) * 0.2,
      ),
    )

    const rankLabel =
      overallScore >= 85
        ? 'Elite'
        : overallScore >= 70
          ? 'Strong'
          : overallScore >= 55
            ? 'Stable'
            : overallScore >= 40
              ? 'Watch'
              : 'Critical'

    const trendDirection =
      currentMonth > previousMonth
        ? 'Up'
        : currentMonth < previousMonth
          ? 'Down'
          : 'Flat'

    return {
      trendScore: Math.round(clampScore(trendScore)),
      engagementScore,
      riskScore,
      overallScore,
      rankLabel,
      trendDirection,
      currentMonth,
      previousMonth,
      unpaidRatio: Math.round(unpaidRatio * 100),
      absenceRatio: Math.round(absenceRatio * 100),
    }
  }, [
    attendanceSummary.absence,
    attendanceSummary.absent,
    attendanceSummary.lessonDays,
    attendanceSummary.presenceRate,
    attendanceSummary.total,
    groups.length,
    summaryTotalEarningsTiyin,
    summaryUnpaidTiyin,
    teacher?.is_active,
    totalStudents,
    trendByMonth,
  ])

  const openEditModal = () => {
    if (!teacher) return
    setEditForm({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      is_staff: !!teacher.is_staff,
      is_active: teacher.is_active !== false,
    })
    setIsEditModalOpen(true)
  }

  const saveTeacherProfile = () => {
    if (!canEditTeacher) {
      toast.error('You do not have permission to edit teachers')
      return
    }

    updateTeacher.mutate(
      {
        id: teacherId,
        data: {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          phone: editForm.phone,
          is_staff: editForm.is_staff,
          is_active: editForm.is_active,
        },
      },
      {
        onSuccess: async () => {
          setIsEditModalOpen(false)
          await refetchTeacher()
          await loadTeacherInsights()
        },
      },
    )
  }

  const toggleTeacherActive = () => {
    if (!teacher) return
    if (!canEditTeacher) {
      toast.error('You do not have permission to edit teachers')
      return
    }

    const nextActive = teacher.is_active === false
    const prompt = nextActive
      ? `Activate ${teacherName}?`
      : `Deactivate ${teacherName}? This will block login access.`

    if (!confirm(prompt)) return

    updateTeacher.mutate(
      {
        id: teacherId,
        data: {
          is_active: nextActive,
        },
      },
      {
        onSuccess: async () => {
          await refetchTeacher()
          await loadTeacherInsights()
        },
      },
    )
  }

  if (teacherLoading || insightsLoading) {
    return <LoadingScreen message="Loading teacher profile..." />
  }

  if (!teacher) {
    return (
      <ProtectedRoute>
        <div className="p-8">
          <div className="max-w-2xl mx-auto glass-panel-strong rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">Teacher not found</h1>
            <p className="text-text-secondary mb-6">The teacher may have been removed or you may not have access.</p>
            <button
              onClick={() => router.push('/dashboard/teachers')}
              className="px-5 py-3 rounded-xl bg-primary text-background font-semibold"
            >
              Back to teachers
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/4 -right-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-warning/20 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-8">
        <div className="glass-panel-strong rounded-3xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/teachers')}
              className="h-10 w-10 rounded-xl glass-chip hover:bg-background transition-colors flex items-center justify-center"
              title="Back to teachers"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/30 overflow-hidden flex items-center justify-center">
              {teacher.photo ? (
                <NextImage
                  src={resolveApiAssetUrl(teacher.photo) || teacher.photo}
                  alt={teacherName}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-primary">{getInitials(teacher)}</span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{teacherName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  @{teacher.username}
                </span>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    teacher.is_active === false
                      ? 'bg-error/10 text-error border-error/20'
                      : 'bg-success/10 text-success border-success/20'
                  }`}
                >
                  {teacher.is_active === false ? 'Inactive' : 'Active'}
                </span>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    teacher.is_staff
                      ? 'bg-warning/10 text-warning border-warning/20'
                      : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                  }`}
                >
                  {teacher.is_staff ? 'Staff Access' : 'Teacher Access'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleTeacherActive}
              disabled={!canEditTeacher || updateTeacher.isPending}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                canEditTeacher
                  ? teacher.is_active === false
                    ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                    : 'border-error/30 bg-error/10 text-error hover:bg-error/20'
                  : 'border-border bg-background text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              {teacher.is_active === false ? 'Activate' : 'Deactivate'}
            </button>
            <button
              onClick={openEditModal}
              disabled={!canEditTeacher}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-2 ${
                canEditTeacher
                  ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-border bg-background text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Groups</p>
            <p className="text-2xl font-bold">{groups.length}</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Active Groups</p>
            <p className="text-2xl font-bold">{activeGroupCount}</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Students</p>
            <p className="text-2xl font-bold">{totalStudents}</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">This Month</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyFromMinor(currentMonthEarningsTiyin)}</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Unpaid Accrual</p>
            <p className="text-2xl font-bold text-warning">{formatCurrencyFromMinor(summaryUnpaidTiyin)}</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Payout Rate</p>
            <p className="text-2xl font-bold">{payoutRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 via-primary/10 to-cyan-500/10 backdrop-blur-xl p-4 shadow-[0_20px_45px_-28px_rgba(59,130,246,0.75)]">
            <p className="text-xs uppercase tracking-wide text-primary/90 mb-2">Performance Rank</p>
            <p className="text-3xl font-bold">{performanceScorecard.overallScore}</p>
            <p className="text-sm text-primary/80 mt-1">{performanceScorecard.rankLabel}</p>
          </div>
          <div className="rounded-2xl border border-success/30 bg-success/10 backdrop-blur-xl p-4">
            <p className="text-xs uppercase tracking-wide text-success mb-2">Trend Score</p>
            <p className="text-3xl font-bold">{performanceScorecard.trendScore}</p>
            <p className="text-xs text-success/80 mt-1">
              {performanceScorecard.trendDirection} • {formatCurrencyFromMinor(performanceScorecard.currentMonth)}
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-xl p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-500 mb-2">Engagement Score</p>
            <p className="text-3xl font-bold">{performanceScorecard.engagementScore}</p>
            <p className="text-xs text-cyan-500/90 mt-1">
              Presence {attendanceSummary.presenceRate}% • {attendanceSummary.lessonDays} lesson days
            </p>
          </div>
          <div className="rounded-2xl border border-warning/30 bg-warning/10 backdrop-blur-xl p-4">
            <p className="text-xs uppercase tracking-wide text-warning mb-2">Risk Score</p>
            <p className="text-3xl font-bold">{performanceScorecard.riskScore}</p>
            <p className="text-xs text-warning/90 mt-1">
              Unpaid {performanceScorecard.unpaidRatio}% • Absence {performanceScorecard.absenceRatio}%
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center rounded-2xl glass-panel p-1.5">
          {([
            ['overview', 'Overview'],
            ['groups', 'Groups'],
            ['attendance', 'Attendance'],
            ['earnings', 'Earnings'],
          ] as Array<[DetailTab, string]>).map(([tabId, label]) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === tabId
                  ? 'bg-gradient-to-r from-primary to-cyan-500 text-background shadow-[0_12px_24px_-16px_rgba(37,99,235,0.8)]'
                  : 'glass-chip text-text-secondary hover:text-text-primary hover:bg-background/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-6">
              <div className="glass-panel rounded-2xl p-5">
                <h2 className="text-lg font-bold mb-4">Profile</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-text-secondary" />
                    <span>{teacher.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-text-secondary" />
                    <span>{teacher.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-text-secondary" />
                    <span>
                      Joined {teacher.date_joined ? new Date(teacher.date_joined).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-4 w-4 text-text-secondary" />
                    <span>
                      Last login {teacher.last_login ? new Date(teacher.last_login).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <h2 className="text-lg font-bold mb-4">Compensation Snapshot</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Total earned</span>
                    <span className="font-semibold">{formatCurrencyFromMinor(summaryTotalEarningsTiyin)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Paid out</span>
                    <span className="font-semibold text-success">{formatCurrencyFromMinor(summaryPaidTiyin)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Pending payout</span>
                    <span className="font-semibold text-warning">{formatCurrencyFromMinor(summaryUnpaidTiyin)}</span>
                  </div>
                  <div className="pt-2 border-t border-border text-xs text-text-secondary">
                    Based on attendance-linked accruals.
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-2 space-y-6">
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Earnings Trend (6 months)</h2>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-3">
                  {trendByMonth.map((point) => (
                    <div key={point.month}>
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>{formatMonthTitle(point.month)}</span>
                        <span>{formatCurrencyFromMinor(point.totalTiyin)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-background overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500"
                          style={{ width: `${Math.max(6, Math.round((point.totalTiyin / trendMax) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <h2 className="text-lg font-bold mb-4">Recent Accrual Events</h2>
                <div className="space-y-3">
                  {earnings.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="p-3 rounded-xl border border-border bg-background/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{entry.student_name || 'Student'}</p>
                          <p className="text-xs text-text-secondary">
                            {entry.group_name || 'Group'} • {entry.source_type || 'attendance'}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            {entry.date ? new Date(entry.date).toLocaleDateString() : 'No date'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrencyFromMinor(toMoneyTiyin(entry.amount_tiyin, entry.amount))}</p>
                          <span
                            className={`inline-flex mt-1 px-2 py-1 rounded-md text-[11px] font-semibold ${
                              entry.is_paid_to_teacher
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {entry.is_paid_to_teacher ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {earnings.length === 0 && (
                    <div className="py-10 text-center text-text-secondary">
                      No earnings data yet for this teacher.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {groups.map((group) => (
              <div key={group.id} className="glass-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{group.name}</h3>
                    <p className="text-sm text-text-secondary">{group.course_name || 'Course not assigned'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {roleLabelForGroup(group, teacherId)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-xs text-text-secondary mb-1">Branch</p>
                    <p className="font-medium">{group.branch_name || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-xs text-text-secondary mb-1">Room</p>
                    <p className="font-medium">{group.room_name || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-xs text-text-secondary mb-1">Students</p>
                    <p className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-text-secondary" />
                      {getStudentCount(group)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-xs text-text-secondary mb-1">Schedule</p>
                    <p className="font-medium">
                      {group.days || 'N/A'} {group.start_time && group.end_time ? `• ${group.start_time} - ${group.end_time}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background hover:bg-border/50 text-sm font-semibold"
                >
                  Open Group
                </button>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="col-span-full glass-panel rounded-2xl p-10 text-center text-text-secondary">
                No assigned groups found for this teacher.
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(event) => setAttendanceMonth(event.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
                />
                <select
                  value={attendanceGroupId}
                  onChange={(event) => setAttendanceGroupId(event.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-background text-sm min-w-56"
                >
                  <option value="all">All teacher groups</option>
                  {groups.map((group) => (
                    <option key={group.id} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void loadAttendanceInsights()}
                  className="px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20"
                >
                  Refresh
                </button>
                <span className="text-sm text-text-secondary">
                  {formatMonthTitle(attendanceMonthRange.monthLabel)}
                </span>
              </div>
            </div>

            {attendanceLoading ? (
              <div className="glass-panel rounded-2xl p-10">
                <LoadingScreen message="Loading attendance insights..." fullHeight={false} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Attendance Rows</p>
                    <p className="text-2xl font-bold">{attendanceSummary.total}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Present</p>
                    <p className="text-2xl font-bold text-success">{attendanceSummary.present}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Excused</p>
                    <p className="text-2xl font-bold text-warning">{attendanceSummary.absence}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Unexcused</p>
                    <p className="text-2xl font-bold text-error">{attendanceSummary.absent}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Students Marked</p>
                    <p className="text-2xl font-bold">{attendanceSummary.uniqueStudents}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Presence Rate</p>
                    <p className="text-2xl font-bold">{attendanceSummary.presenceRate}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 glass-panel rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold">Daily Attendance Heatmap</h2>
                      <span className="text-sm text-text-secondary">
                        {attendanceSummary.lessonDays} lesson days marked
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-xs text-text-secondary mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                        <div key={weekday} className="text-center py-1">
                          {weekday}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: attendanceCalendar.firstWeekday }).map((_, index) => (
                        <div key={`blank-${index}`} className="h-16 rounded-xl border border-transparent" />
                      ))}

                      {attendanceCalendar.items.map((item) => {
                        const tone =
                          item.total === 0
                            ? 'bg-background border-border text-text-secondary'
                            : item.presenceRate >= 80
                              ? 'bg-success/10 border-success/30 text-success'
                              : item.presenceRate >= 50
                                ? 'bg-warning/10 border-warning/30 text-warning'
                                : 'bg-error/10 border-error/30 text-error'

                        return (
                          <div
                            key={item.date}
                            className={`h-16 rounded-xl border p-2 flex flex-col justify-between ${tone}`}
                            title={`${item.date}: ${item.present} present, ${item.absence} excused, ${item.absent} absent`}
                          >
                            <span className="text-xs font-semibold">{item.day}</span>
                            <span className="text-[11px]">
                              {item.total > 0 ? `${item.present}/${item.total}` : '-'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-5">
                    <h2 className="text-lg font-bold mb-4">Latest Marked Days</h2>
                    <div className="space-y-2">
                      {attendanceTimeline.slice(0, 10).map((row) => (
                        <div key={row.date} className="rounded-xl border border-border bg-background/40 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">{new Date(row.date).toLocaleDateString()}</p>
                            <span className="text-xs text-text-secondary">{row.total} rows</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <span className="text-success">{row.present} P</span>
                            <span className="text-warning">{row.absence} E</span>
                            <span className="text-error">{row.absent} A</span>
                          </div>
                        </div>
                      ))}
                      {attendanceTimeline.length === 0 && (
                        <div className="py-10 text-center text-text-secondary">
                          No attendance records for selected filters.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <Coins className="h-4 w-4 text-primary" />
                <span className="font-medium">{formatCurrencyFromMinor(currentMonthEarningsTiyin)}</span>
                <span className="text-text-secondary">in {formatMonthTitle(earningsMonth)}</span>
              </div>
              <input
                type="month"
                value={earningsMonth}
                onChange={(event) => setEarningsMonth(event.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
              />
              <select
                value={earningsStatus}
                onChange={(event) => setEarningsStatus(event.target.value as EarningsStatusFilter)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background/60 text-xs uppercase tracking-wide text-text-secondary">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Group</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="text-right py-3 px-4">Payment</th>
                    <th className="text-right py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEarnings.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 hover:bg-background/40 transition-colors">
                      <td className="py-3 px-4 text-sm">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-4 text-sm font-medium">{entry.student_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{entry.group_name || '-'}</td>
                      <td className="py-3 px-4 text-xs text-text-secondary uppercase">{entry.source_type || entry.entry_type || '-'}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-primary">
                        {formatCurrencyFromMinor(toMoneyTiyin(entry.amount_tiyin, entry.amount))}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-text-secondary">
                        {formatCurrencyFromMinor(toMoneyTiyin(entry.payment_amount_tiyin, entry.payment_amount))}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            entry.is_paid_to_teacher
                              ? 'bg-success/10 text-success'
                              : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {entry.is_paid_to_teacher ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock3 className="h-3.5 w-3.5" />
                          )}
                          {entry.is_paid_to_teacher ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEarnings.length === 0 && (
              <div className="py-14 text-center text-text-secondary">
                No earnings found for selected filters.
              </div>
            )}
          </div>
        )}

        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Edit Teacher Profile</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, first_name: event.target.value }))}
                    className="px-4 py-3 rounded-xl border border-border bg-background"
                    placeholder="First name"
                  />
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, last_name: event.target.value }))}
                    className="px-4 py-3 rounded-xl border border-border bg-background"
                    placeholder="Last name"
                  />
                </div>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                  placeholder="Email"
                />
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                  placeholder="Phone"
                />

                <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                  <Shield className="h-4 w-4 text-warning" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Staff access</p>
                    <p className="text-xs text-text-secondary">Allows admin-level modules for this teacher.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.is_staff}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, is_staff: event.target.checked }))}
                  />
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                  {editForm.is_active ? (
                    <UserCheck className="h-4 w-4 text-success" />
                  ) : (
                    <UserRoundX className="h-4 w-4 text-error" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Account active</p>
                    <p className="text-xs text-text-secondary">Inactive users cannot login to staff platform.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveTeacherProfile}
                  disabled={updateTeacher.isPending}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-background font-semibold disabled:opacity-60"
                >
                  {updateTeacher.isPending ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

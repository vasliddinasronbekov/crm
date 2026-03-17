'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  User,
  CheckCircle,
  AlertCircle,
  Plus,
  Save,
  Settings,
  Search,
  Wallet,
  ClipboardCheck,
  BookOpen,
  ShieldAlert,
} from 'lucide-react'

import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'
import { useOngoingGroups } from '@/lib/hooks/useGroups'
import { WEEK_DAYS } from '@/lib/utils/schedule'
import LoadingScreen from '@/components/LoadingScreen'
import { ProtectedRoute } from '@/components/ProtectedRoute'

interface Student {
  id: number
  username?: string
  first_name: string
  last_name: string
  phone?: string
  email?: string
  photo?: string
  balance_tiyin?: number
}

interface CourseOption {
  id: number
  name: string
}

interface TeacherOption {
  id: number
  username?: string
  first_name: string
  last_name: string
}

interface RoomOption {
  id: number
  name: string
  capacity?: number
}

interface PaymentTypeOption {
  id: number
  name: string
}

interface GroupSnapshot {
  id: number
  name: string
  course_id: number | null
  course_name: string
  students: Student[]
  student_ids: number[]
  start_day: string
  end_day: string
  start_time: string
  end_time: string
  days: string
  room_id: number | null
  room_name: string
  branch_name: string
  main_teacher_id: number | null
  main_teacher_name: string
  assistant_teacher_id: number | null
  assistant_teacher_name: string
}

interface AttendanceRecord {
  id: number
  student: number | { id?: number }
  date?: string
  is_present?: boolean
  status?: string
  attendance_status?: string
  created_at?: string
}

interface GroupConfigForm {
  name: string
  course_id: number | ''
  room_id: number | ''
  main_teacher_id: number | ''
  assistant_teacher_id: number | ''
  start_day: string
  end_day: string
  start_time: string
  end_time: string
  days: string[]
  student_ids: number[]
}

interface PaymentForm {
  by_user: number | ''
  amount_tiyin: number
  course_price_tiyin: number
  status: 'pending' | 'paid' | 'failed'
  date: string
  payment_type: number | ''
  teacher: number | ''
  detail: string
}

type Tab = 'students' | 'schedule' | 'payments' | 'attendance'
type AttendanceStatus = 'present' | 'absent' | 'absence'
type AlertSeverity = 'info' | 'warning' | 'error'
type AttendanceView = 'register' | 'weekday'
type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

interface OperationalAlert {
  id: string
  title: string
  detail: string
  severity: AlertSeverity
}

const ATTENDANCE_WEEKDAY_ORDER: Array<{ key: WeekdayKey; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const TIYIN_PER_UZS = 100

const parseListPayload = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

const toNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const extractId = (value: any): number | null => {
  if (value && typeof value === 'object') {
    return toNumber(value.id)
  }
  return toNumber(value)
}

const normalizeString = (value: any): string => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

const normalizeDateInput = (value: any): string => {
  const text = normalizeString(value)
  if (!text) return ''
  if (text.includes('T')) return text.split('T')[0]
  return text
}

const normalizeTimeInput = (value: any): string => {
  const text = normalizeString(value)
  if (!text) return ''
  return text.slice(0, 5)
}

const normalizeAttendanceDate = (value: string | undefined): string => {
  if (!value) return ''
  return value.includes('T') ? value.split('T')[0] : value
}

const getWeekdayKey = (dateValue: string): WeekdayKey => {
  const date = new Date(`${dateValue}T00:00:00`)
  const day = date.getDay()
  if (day === 0) return 'sun'
  if (day === 1) return 'mon'
  if (day === 2) return 'tue'
  if (day === 3) return 'wed'
  if (day === 4) return 'thu'
  if (day === 5) return 'fri'
  return 'sat'
}

const normalizeAttendanceStatus = (record: AttendanceRecord | null | undefined): AttendanceStatus => {
  if (!record) return 'absent'

  const rawStatus = normalizeString(record.attendance_status || record.status).toLowerCase()
  if (rawStatus === 'present') return 'present'
  if (rawStatus === 'absence' || rawStatus === 'absence_excused' || rawStatus === 'excused') return 'absence'
  if (rawStatus === 'absent' || rawStatus === 'absent_unexcused') return 'absent'

  return record.is_present ? 'present' : 'absent'
}

const getAttendanceRecordDate = (record: AttendanceRecord | null | undefined): string => {
  if (!record) return ''
  return normalizeAttendanceDate(record.date || record.created_at)
}

const getAttendanceRecordTimestamp = (record: AttendanceRecord | null | undefined): number => {
  if (!record) return 0
  const timestamp = record.created_at ? new Date(record.created_at).getTime() : Number.NaN
  if (!Number.isNaN(timestamp)) return timestamp

  const normalizedDate = getAttendanceRecordDate(record)
  if (!normalizedDate) return 0
  const fallbackTimestamp = new Date(`${normalizedDate}T00:00:00`).getTime()
  return Number.isNaN(fallbackTimestamp) ? 0 : fallbackTimestamp
}

const isAttendanceRecordNewer = (candidate: AttendanceRecord, current: AttendanceRecord): boolean => {
  const timestampDifference = getAttendanceRecordTimestamp(candidate) - getAttendanceRecordTimestamp(current)
  if (timestampDifference !== 0) return timestampDifference > 0
  return (toNumber(candidate.id) || 0) > (toNumber(current.id) || 0)
}

const getAttendanceCellKey = (studentId: number, date: string): string => `${studentId}:${date}`

const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  {
    label: string
    markedLabel: string
    buttonClassName: string
    badgeClassName: string
  }
> = {
  present: {
    label: 'Present',
    markedLabel: 'Present (already marked)',
    buttonClassName: 'text-success hover:bg-success/20',
    badgeClassName: 'bg-success/10 text-success',
  },
  absent: {
    label: 'Absent (Unexcused)',
    markedLabel: 'Absent (unexcused, already marked)',
    buttonClassName: 'text-error hover:bg-error/20',
    badgeClassName: 'bg-error/10 text-error',
  },
  absence: {
    label: 'Absence (Excused)',
    markedLabel: 'Absence (excused, already marked)',
    buttonClassName: 'text-warning hover:bg-warning/20',
    badgeClassName: 'bg-warning/10 text-warning',
  },
}

const ATTENDANCE_REGISTER_CELL_META: Record<
  AttendanceStatus,
  {
    symbol: string
    label: string
    className: string
  }
> = {
  present: {
    symbol: '+',
    label: 'Present',
    className: 'bg-success/20 text-success',
  },
  absence: {
    symbol: '!',
    label: 'Absence (Excused)',
    className: 'bg-warning/20 text-warning',
  },
  absent: {
    symbol: '-',
    label: 'Absent (Unexcused)',
    className: 'bg-error/20 text-error',
  },
}

const toAttendancePayload = (status: AttendanceStatus): { attendance_status: string; is_present: boolean } => ({
  attendance_status:
    status === 'present' ? 'present' : status === 'absence' ? 'absence_excused' : 'absent_unexcused',
  is_present: status === 'present',
})

const getFullName = (person: { first_name?: string; last_name?: string; username?: string } | null | undefined): string => {
  if (!person) return 'Unknown'
  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim()
  return fullName || person.username || 'Unknown'
}

const toTiyin = (value: any): number | null => {
  const parsed = toNumber(value)
  if (parsed === null) return null
  return Math.round(parsed)
}

const uzsToTiyin = (value: any): number | null => {
  const parsed = toNumber(value)
  if (parsed === null) return null
  return Math.round(parsed * TIYIN_PER_UZS)
}

const toStudentBalanceTiyin = (raw: any): number | null => {
  const fromTiyinAlias = toTiyin(raw?.balance_tiyin)
  if (fromTiyinAlias !== null) return fromTiyinAlias

  const fromCanonical = toTiyin(raw?.balance)
  if (fromCanonical !== null) return fromCanonical

  const fromUzsAlias = uzsToTiyin(raw?.balance_uzs)
  if (fromUzsAlias !== null) return fromUzsAlias

  const fromLegacySum = uzsToTiyin(raw?.balance_sum)
  if (fromLegacySum !== null) return fromLegacySum

  return null
}

const emptyConfigForm: GroupConfigForm = {
  name: '',
  course_id: '',
  room_id: '',
  main_teacher_id: '',
  assistant_teacher_id: '',
  start_day: '',
  end_day: '',
  start_time: '',
  end_time: '',
  days: [],
  student_ids: [],
}

const emptyPaymentForm = (): PaymentForm => ({
  by_user: '',
  amount_tiyin: 0,
  course_price_tiyin: 0,
  status: 'paid',
  date: new Date().toISOString().split('T')[0],
  payment_type: '',
  teacher: '',
  detail: '',
})

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupIdNumber = Number(params.id)

  const { formatCurrencyFromMinor, toSelectedCurrency, fromSelectedCurrency, currency } = useSettings()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canConfigureGroup = permissionState.hasPermission('groups.edit')
  const canRecordPayment = permissionState.hasPermission('payments.record')
  const canViewPayments = permissionState.hasPermission('payments.view')
  const canMarkAttendance = permissionState.hasAnyPermission(['attendance.create', 'attendance.edit'])
  const canViewAttendance = permissionState.hasPermission('attendance.view')
  const { data: ongoingGroupsData } = useOngoingGroups({
    enabled: Boolean(user),
    refetchIntervalMs: 60_000,
  })

  const [rawGroup, setRawGroup] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('students')

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([])

  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [studentBalanceById, setStudentBalanceById] = useState<Record<number, number>>({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7))
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('register')
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null)

  const [isConfigMode, setIsConfigMode] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configForm, setConfigForm] = useState<GroupConfigForm>(emptyConfigForm)
  const [studentSearchQuery, setStudentSearchQuery] = useState('')

  const [newPayment, setNewPayment] = useState<PaymentForm>(emptyPaymentForm)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)

  const selectedCurrencyAmountToTiyin = useCallback(
    (amountInSelectedCurrency: number): number => Math.round(fromSelectedCurrency(amountInSelectedCurrency) * TIYIN_PER_UZS),
    [fromSelectedCurrency],
  )

  const tiyinToSelectedCurrencyAmount = useCallback(
    (amountTiyin: number): number => toSelectedCurrency(amountTiyin / TIYIN_PER_UZS),
    [toSelectedCurrency],
  )

  const fetchAllPages = useCallback(async <T,>(fetchPage: (page: number) => Promise<any>): Promise<T[]> => {
    const collected: T[] = []
    let page = 1

    while (page <= 200) {
      const payload = await fetchPage(page)
      collected.push(...parseListPayload<T>(payload))
      if (!payload?.next) break
      page += 1
    }

    return collected
  }, [])

  const courseById = useMemo(() => new Map(courses.map((item) => [item.id, item])), [courses])
  const teacherById = useMemo(() => new Map(teachers.map((item) => [item.id, item])), [teachers])
  const roomById = useMemo(() => new Map(rooms.map((item) => [item.id, item])), [rooms])
  const studentById = useMemo(() => new Map(allStudents.map((item) => [item.id, item])), [allStudents])

  const normalizeGroup = useCallback(
    (raw: any): GroupSnapshot => {
      const rawCourse = raw?.course
      const rawRoom = raw?.room
      const rawMainTeacher = raw?.main_teacher
      const rawAssistantTeacher = raw?.assistant_teacher

      let courseId = extractId(rawCourse)
      let courseName =
        normalizeString(raw?.course_name) ||
        normalizeString(rawCourse?.name) ||
        (typeof rawCourse === 'string' ? rawCourse : '')
      if (!courseId && typeof rawCourse === 'string') {
        const matched = courses.find((course) => course.name.toLowerCase() === rawCourse.toLowerCase())
        courseId = matched?.id || null
      }
      if (!courseName && courseId) {
        courseName = courseById.get(courseId)?.name || ''
      }

      const roomId = extractId(rawRoom)
      const mainTeacherId = extractId(rawMainTeacher)
      const assistantTeacherId = extractId(rawAssistantTeacher)

      const rawStudents = Array.isArray(raw?.students) ? raw.students : []
      const seenStudentIds = new Set<number>()
      const normalizedStudents: Student[] = []

      rawStudents.forEach((rawStudent: any) => {
        const studentId = extractId(rawStudent)
        if (!studentId || seenStudentIds.has(studentId)) return
        seenStudentIds.add(studentId)

        const studentFromLookup = studentById.get(studentId)
        const studentFromPayload = rawStudent && typeof rawStudent === 'object' ? rawStudent : null

        const student: Student = {
          id: studentId,
          username: studentFromPayload?.username || studentFromLookup?.username,
          first_name:
            studentFromPayload?.first_name ||
            studentFromLookup?.first_name ||
            `Student`,
          last_name:
            studentFromPayload?.last_name ||
            studentFromLookup?.last_name ||
            `#${studentId}`,
          phone: studentFromPayload?.phone || studentFromLookup?.phone || '',
          email: studentFromPayload?.email || studentFromLookup?.email || '',
          photo: studentFromPayload?.photo || studentFromLookup?.photo || '',
        }

        const balanceFromPayload = toStudentBalanceTiyin(studentFromPayload)
        const balanceFromLookup = toStudentBalanceTiyin(studentFromLookup)
        const resolvedBalanceTiyin =
          balanceFromPayload !== null ? balanceFromPayload : balanceFromLookup
        if (resolvedBalanceTiyin !== null) {
          student.balance_tiyin = resolvedBalanceTiyin
        }
        if (studentBalanceById[studentId] !== undefined) {
          student.balance_tiyin = studentBalanceById[studentId]
        }

        normalizedStudents.push(student)
      })

      return {
        id: toNumber(raw?.id) || 0,
        name: normalizeString(raw?.name),
        course_id: courseId,
        course_name: courseName || 'Unknown course',
        students: normalizedStudents,
        student_ids: normalizedStudents.map((student) => student.id),
        start_day: normalizeDateInput(raw?.start_day),
        end_day: normalizeDateInput(raw?.end_day),
        start_time: normalizeTimeInput(raw?.start_time),
        end_time: normalizeTimeInput(raw?.end_time),
        days: normalizeString(raw?.days),
        room_id: roomId,
        room_name:
          normalizeString(rawRoom?.name) ||
          normalizeString(raw?.room_name) ||
          roomById.get(roomId || 0)?.name ||
          '',
        branch_name: normalizeString(raw?.branch?.name) || normalizeString(raw?.branch_name),
        main_teacher_id: mainTeacherId,
        main_teacher_name:
          getFullName(rawMainTeacher) ||
          getFullName(teacherById.get(mainTeacherId || 0)),
        assistant_teacher_id: assistantTeacherId,
        assistant_teacher_name:
          getFullName(rawAssistantTeacher) ||
          getFullName(teacherById.get(assistantTeacherId || 0)),
      }
    },
    [courseById, courses, roomById, studentBalanceById, studentById, teacherById],
  )

  const group = useMemo(() => {
    if (!rawGroup) return null
    return normalizeGroup(rawGroup)
  }, [normalizeGroup, rawGroup])

  const studentsInGroup = useMemo(() => group?.students || [], [group?.students])

  const loadReferenceData = useCallback(async () => {
    const [courseRows, teacherRows, roomRows, studentRows, paymentTypeRows] = await Promise.all([
      fetchAllPages<any>((page) => apiService.getCourses({ page })),
      fetchAllPages<any>((page) => apiService.getTeachers({ page })),
      fetchAllPages<any>((page) => apiService.getRooms({ page })),
      fetchAllPages<any>((page) => apiService.getStudents({ page })),
      fetchAllPages<any>((page) => apiService.getPaymentTypes({ page })),
    ])

    setCourses(
      courseRows
        .map((row) => ({
          id: toNumber(row?.id) || 0,
          name: normalizeString(row?.name) || `Course #${row?.id || 'N/A'}`,
        }))
        .filter((course) => course.id > 0),
    )

    setTeachers(
      teacherRows
        .map((row) => ({
          id: toNumber(row?.id) || 0,
          username: normalizeString(row?.username),
          first_name: normalizeString(row?.first_name),
          last_name: normalizeString(row?.last_name),
        }))
        .filter((teacher) => teacher.id > 0),
    )

    setRooms(
      roomRows
        .map((row) => ({
          id: toNumber(row?.id) || 0,
          name: normalizeString(row?.name),
        }))
        .filter((room) => room.id > 0),
    )

    setAllStudents(
      studentRows
        .map((row) => ({
          id: toNumber(row?.id) || 0,
          username: normalizeString(row?.username),
          first_name: normalizeString(row?.first_name),
          last_name: normalizeString(row?.last_name),
          phone: normalizeString(row?.phone),
          email: normalizeString(row?.email),
          photo: normalizeString(row?.photo),
        }))
        .filter((student) => student.id > 0),
    )

    setPaymentTypes(
      paymentTypeRows
        .map((row) => ({
          id: toNumber(row?.id) || 0,
          name: normalizeString(row?.name),
        }))
        .filter((item) => item.id > 0),
    )
  }, [fetchAllPages])

  const loadGroupDetail = useCallback(async () => {
    const payload = await apiService.getGroupDetail(groupIdNumber)
    setRawGroup(payload)
  }, [groupIdNumber])

  const loadAttendance = useCallback(async () => {
    const records = await fetchAllPages<any>((page) =>
      apiService.getAttendance({ group: groupIdNumber, page }),
    )

    setAttendanceData(
      records.map((record) => ({
        id: toNumber(record?.id) || 0,
        student: record?.student,
        date: normalizeDateInput(record?.date),
        is_present: Boolean(record?.is_present),
        status: normalizeString(record?.status),
        created_at: normalizeString(record?.created_at),
      })),
    )
  }, [fetchAllPages, groupIdNumber])

  const verifyAttendancePersisted = useCallback(
    async (studentId: number, attendanceDate: string) => {
      const payload = await apiService.getAttendance({
        group: groupIdNumber,
        student: studentId,
        date: attendanceDate,
        page: 1,
      })
      const records = parseListPayload<any>(payload)
      return records.some((record) => {
        const recordStudentId = extractId(record?.student)
        const recordDate = normalizeAttendanceDate(record?.date || record?.created_at)
        return recordStudentId === studentId && recordDate === attendanceDate
      })
    },
    [groupIdNumber],
  )

  const loadStudentBalances = useCallback(async () => {
    const rows = await fetchAllPages<any>((page) =>
      apiService.getStudentBalances({ group: groupIdNumber, page }),
    )

    const nextMap: Record<number, number> = {}
    rows.forEach((row) => {
      const studentId = extractId(row?.student)
      if (!studentId) return
      nextMap[studentId] = toStudentBalanceTiyin(row) ?? 0
    })
    setStudentBalanceById(nextMap)
  }, [fetchAllPages, groupIdNumber])

  useEffect(() => {
    if (!groupIdNumber || Number.isNaN(groupIdNumber)) {
      setIsLoading(false)
      return
    }

    const bootstrap = async () => {
      try {
        setIsLoading(true)
        await Promise.all([loadReferenceData(), loadGroupDetail(), loadStudentBalances()])
      } catch (error) {
        console.error('Failed to load group context:', error)
        toast.error('Failed to load group details.')
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [groupIdNumber, loadGroupDetail, loadReferenceData, loadStudentBalances])

  useEffect(() => {
    if (activeTab !== 'attendance' || !group) return
    void loadAttendance()
  }, [activeTab, group, loadAttendance])

  useEffect(() => {
    if (!group || isConfigMode) return

    const dayTokens = group.days
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)

    setConfigForm({
      name: group.name,
      course_id: group.course_id || '',
      room_id: group.room_id || '',
      main_teacher_id: group.main_teacher_id || '',
      assistant_teacher_id: group.assistant_teacher_id || '',
      start_day: group.start_day,
      end_day: group.end_day,
      start_time: group.start_time,
      end_time: group.end_time,
      days: dayTokens,
      student_ids: group.student_ids,
    })
  }, [group, isConfigMode])

  useEffect(() => {
    if (!group) return

    setNewPayment((previous) => {
      if (previous.by_user && group.student_ids.includes(Number(previous.by_user))) return previous
      return {
        ...previous,
        by_user: group.student_ids[0] || '',
      }
    })
  }, [group])

  const configuredStudents = useMemo(() => {
    const fallbackFromGroup = new Map(group?.students.map((student) => [student.id, student]) || [])
    return configForm.student_ids
      .map((studentId) => studentById.get(studentId) || fallbackFromGroup.get(studentId))
      .filter((student): student is Student => Boolean(student))
  }, [configForm.student_ids, group?.students, studentById])

  const selectedStudentIdSet = useMemo(() => new Set(configForm.student_ids), [configForm.student_ids])

  const availableStudents = useMemo(() => {
    const query = studentSearchQuery.trim().toLowerCase()

    return allStudents.filter((student) => {
      if (selectedStudentIdSet.has(student.id)) return false

      if (!query) return true
      const fullName = getFullName(student).toLowerCase()
      return (
        fullName.includes(query) ||
        (student.username || '').toLowerCase().includes(query) ||
        (student.phone || '').toLowerCase().includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      )
    })
  }, [allStudents, selectedStudentIdSet, studentSearchQuery])

  const attendanceByStudentAndDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    attendanceData.forEach((record) => {
      const studentId = extractId(record.student)
      const recordDate = getAttendanceRecordDate(record)
      if (!studentId || !recordDate) return

      const key = getAttendanceCellKey(studentId, recordDate)
      const existing = map.get(key)
      if (!existing || isAttendanceRecordNewer(record, existing)) {
        map.set(key, record)
      }
    })
    return map
  }, [attendanceData])

  const attendanceMonthDays = useMemo(() => {
    const [yearToken, monthToken] = attendanceMonth.split('-')
    const year = Number(yearToken)
    const month = Number(monthToken)
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return []

    const daysInMonth = new Date(year, month, 0).getDate()
    return Array.from({ length: daysInMonth }).map((_, index) => {
      const day = index + 1
      const date = `${attendanceMonth}-${String(day).padStart(2, '0')}`
      const weekdayLabel = new Date(year, month - 1, day).toLocaleDateString(undefined, {
        weekday: 'short',
      })

      return {
        date,
        dayNumber: day,
        dayLabel: String(day).padStart(2, '0'),
        weekdayLabel,
      }
    })
  }, [attendanceMonth])

  const attendanceMonthLabel = useMemo(() => {
    const [yearToken, monthToken] = attendanceMonth.split('-')
    const year = Number(yearToken)
    const month = Number(monthToken)
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return attendanceMonth

    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }, [attendanceMonth])

  const attendanceMonthDaysByWeekday = useMemo(() => {
    const grouped: Record<WeekdayKey, typeof attendanceMonthDays> = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    }

    attendanceMonthDays.forEach((day) => {
      grouped[getWeekdayKey(day.date)].push(day)
    })

    return grouped
  }, [attendanceMonthDays])

  const attendanceByStudentOnDate = useMemo(() => {
    const map = new Map<number, AttendanceRecord>()
    if (!selectedDate) return map

    attendanceByStudentAndDate.forEach((record, key) => {
      const [studentIdToken, dateToken] = key.split(':')
      if (dateToken !== selectedDate) return

      const studentId = Number(studentIdToken)
      if (!Number.isFinite(studentId)) return
      map.set(studentId, record)
    })
    return map
  }, [attendanceByStudentAndDate, selectedDate])

  const selectedDateAttendanceTotals = useMemo(
    () =>
      studentsInGroup.reduce(
        (totals, student) => {
          const record = attendanceByStudentAndDate.get(getAttendanceCellKey(student.id, selectedDate))
          if (!record) {
            totals.unmarked += 1
            return totals
          }

          const status = normalizeAttendanceStatus(record)
          totals[status] += 1
          return totals
        },
        { present: 0, absence: 0, absent: 0, unmarked: 0 },
      ),
    [attendanceByStudentAndDate, selectedDate, studentsInGroup],
  )

  const selectedWeekdayKey = useMemo(() => getWeekdayKey(selectedDate), [selectedDate])

  const shiftAttendanceMonth = (offset: number) => {
    const [yearToken, monthToken] = attendanceMonth.split('-')
    const year = Number(yearToken)
    const month = Number(monthToken)
    if (!Number.isFinite(year) || !Number.isFinite(month)) return

    const nextMonthDate = new Date(year, month - 1 + offset, 1)
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
    setAttendanceMonth(nextMonth)

    if (!selectedDate.startsWith(nextMonth)) {
      setSelectedDate(`${nextMonth}-01`)
    }
  }

  const toggleScheduleDay = (day: string) => {
    setConfigForm((previous) => {
      const selected = new Set(previous.days)
      if (selected.has(day)) {
        selected.delete(day)
      } else {
        selected.add(day)
      }

      const orderedDays = WEEK_DAYS.filter((weekDay) => selected.has(weekDay))
      return {
        ...previous,
        days: orderedDays,
      }
    })
  }

  const handleAddStudentToConfig = (studentId: number) => {
    setConfigForm((previous) => {
      if (previous.student_ids.includes(studentId)) return previous
      return { ...previous, student_ids: [...previous.student_ids, studentId] }
    })
  }

  const handleRemoveStudentFromConfig = (studentId: number) => {
    setConfigForm((previous) => ({
      ...previous,
      student_ids: previous.student_ids.filter((id) => id !== studentId),
    }))
  }

  const handleCancelConfiguration = () => {
    setIsConfigMode(false)
    setStudentSearchQuery('')
    setConfigForm(emptyConfigForm)
  }

  const handleSaveConfiguration = async () => {
    if (!group || !canConfigureGroup) {
      toast.error('You do not have permission to update group configuration.')
      return
    }

    if (!configForm.name.trim() || !configForm.course_id) {
      toast.error('Group name and course are required.')
      return
    }

    setIsSavingConfig(true)
    try {
      await apiService.updateGroup(group.id, {
        name: configForm.name.trim(),
        course: Number(configForm.course_id),
        room: configForm.room_id ? Number(configForm.room_id) : null,
        main_teacher: configForm.main_teacher_id ? Number(configForm.main_teacher_id) : null,
        assistant_teacher: configForm.assistant_teacher_id ? Number(configForm.assistant_teacher_id) : null,
        start_day: configForm.start_day || null,
        end_day: configForm.end_day || null,
        start_time: configForm.start_time || null,
        end_time: configForm.end_time || null,
        days: configForm.days.join(','),
        students: configForm.student_ids,
      })

      await Promise.all([loadGroupDetail(), loadStudentBalances()])
      setIsConfigMode(false)
      setStudentSearchQuery('')
      toast.success('Group configuration updated successfully.')
    } catch (error: any) {
      console.error('Failed to save group configuration:', error)
      toast.error(error?.response?.data?.detail || 'Failed to save group configuration.')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const markAttendance = async (studentId: number, status: AttendanceStatus, attendanceDate: string) => {
    if (!canMarkAttendance) {
      toast.error('You do not have permission to mark attendance.')
      return
    }
    const cellKey = getAttendanceCellKey(studentId, attendanceDate)
    setMarkingAttendance(cellKey)
    setSelectedDate(attendanceDate)

    const existingRecord = attendanceByStudentAndDate.get(cellKey)
    const payload = toAttendancePayload(status)
    try {
      if (existingRecord?.id) {
        await apiService.updateAttendance(existingRecord.id, {
          student: studentId,
          group: groupIdNumber,
          date: attendanceDate,
          ...payload,
        })
      } else {
        await apiService.markAttendance({
          student: studentId,
          group: groupIdNumber,
          date: attendanceDate,
          ...payload,
        })
      }
      toast.success(`Attendance marked as ${ATTENDANCE_STATUS_META[status].label.toLowerCase()}.`)
      await Promise.all([loadAttendance(), loadStudentBalances()])
    } catch (error: any) {
      console.error('Failed to mark attendance:', error)
      try {
        const persisted = await verifyAttendancePersisted(studentId, attendanceDate)
        if (persisted) {
          toast.success('Attendance saved successfully. Server returned an automation error.')
          await Promise.all([loadAttendance(), loadStudentBalances()])
          return
        }
      } catch (verificationError) {
        console.error('Failed to verify attendance after error:', verificationError)
      }
      toast.error(error?.response?.data?.detail || 'Failed to mark attendance.')
    } finally {
      setMarkingAttendance(null)
    }
  }

  const handleRecordPayment = async () => {
    if (!canRecordPayment) {
      toast.error('You do not have permission to record payments.')
      return
    }
    if (!group || !newPayment.by_user) {
      toast.error('Select a student first.')
      return
    }
    if (newPayment.amount_tiyin <= 0 || newPayment.course_price_tiyin <= 0) {
      toast.error('Amount and course price must be greater than 0.')
      return
    }

    setIsCreatingPayment(true)
    try {
      await apiService.createPayment({
        by_user: Number(newPayment.by_user),
        group: group.id,
        amount_tiyin: newPayment.amount_tiyin,
        course_price_tiyin: newPayment.course_price_tiyin,
        status: newPayment.status,
        date: newPayment.date,
        payment_type: newPayment.payment_type ? Number(newPayment.payment_type) : null,
        teacher: newPayment.teacher ? Number(newPayment.teacher) : null,
        detail: newPayment.detail.trim() || '',
      })

      toast.success('Payment recorded successfully.')
      setNewPayment((previous) => ({
        ...previous,
        amount_tiyin: 0,
        course_price_tiyin: 0,
        detail: '',
      }))
      await Promise.all([loadGroupDetail(), loadStudentBalances()])
    } catch (error: any) {
      console.error('Failed to record payment:', error)
      toast.error(error?.response?.data?.detail || 'Failed to record payment.')
    } finally {
      setIsCreatingPayment(false)
    }
  }

  const allPresentDates = useMemo(() => {
    const dates = new Set<string>()
    if (!studentsInGroup.length) return dates

    attendanceMonthDays.forEach((day) => {
      const everyonePresent = studentsInGroup.every((student) => {
        const record = attendanceByStudentAndDate.get(getAttendanceCellKey(student.id, day.date))
        return normalizeAttendanceStatus(record) === 'present'
      })

      if (everyonePresent) {
        dates.add(day.date)
      }
    })

    return dates
  }, [attendanceByStudentAndDate, attendanceMonthDays, studentsInGroup])

  const markAllPresentForDate = async (attendanceDate: string) => {
    if (!canMarkAttendance) {
      toast.error('You do not have permission to mark attendance.')
      return
    }

    const bulkKey = `bulk:${attendanceDate}`
    setMarkingAttendance(bulkKey)
    setSelectedDate(attendanceDate)

    try {
      const presentPayload = toAttendancePayload('present')
      const studentsToMark = studentsInGroup.filter((student) => {
        const cellKey = getAttendanceCellKey(student.id, attendanceDate)
        const existingRecord = attendanceByStudentAndDate.get(cellKey)
        return normalizeAttendanceStatus(existingRecord) !== 'present'
      })

      if (!studentsToMark.length) {
        toast.success('All students are already marked as present for this day.')
        return
      }

      let successCount = 0
      const failedStudents: string[] = []

      for (const student of studentsToMark) {
        const cellKey = getAttendanceCellKey(student.id, attendanceDate)
        const existingRecord = attendanceByStudentAndDate.get(cellKey)

        try {
          if (existingRecord?.id) {
            await apiService.updateAttendance(existingRecord.id, {
              student: student.id,
              group: groupIdNumber,
              date: attendanceDate,
              ...presentPayload,
            })
          } else {
            await apiService.markAttendance({
              student: student.id,
              group: groupIdNumber,
              date: attendanceDate,
              ...presentPayload,
            })
          }
          successCount += 1
        } catch (error) {
          try {
            const persisted = await verifyAttendancePersisted(student.id, attendanceDate)
            if (persisted) {
              successCount += 1
              continue
            }
          } catch (verificationError) {
            console.error('Failed to verify bulk attendance persistence:', verificationError)
          }

          failedStudents.push(getFullName(student))
        }
      }

      await Promise.all([loadAttendance(), loadStudentBalances()])

      if (!failedStudents.length) {
        toast.success(`Marked ${successCount} students as present.`)
        return
      }

      const failedPreview = failedStudents.slice(0, 3).join(', ')
      if (successCount > 0) {
        toast.error(
          `Marked ${successCount} students, but ${failedStudents.length} failed (${failedPreview}${failedStudents.length > 3 ? ', ...' : ''}).`,
        )
      } else {
        toast.error(
          `Failed to mark students as present (${failedPreview}${failedStudents.length > 3 ? ', ...' : ''}).`,
        )
      }
    } catch (error: any) {
      console.error('Failed to mark all students as present:', error)
      toast.error(error?.response?.data?.detail || 'Failed to mark all students as present.')
    } finally {
      setMarkingAttendance(null)
    }
  }

  const paidStudentsCount = studentsInGroup.filter((student) => (student.balance_tiyin || 0) <= 0).length
  const debtStudentsCount = studentsInGroup.filter((student) => (student.balance_tiyin || 0) > 0).length
  const totalBalanceTiyin = studentsInGroup.reduce((sum, student) => sum + (student.balance_tiyin || 0), 0)
  const ongoingSession = useMemo(
    () => (ongoingGroupsData?.results || []).find((item) => Number(item.id) === groupIdNumber) || null,
    [groupIdNumber, ongoingGroupsData?.results],
  )
  const sessionStatusLabel = ongoingSession
    ? `Live now • ${ongoingSession.minutes_until_end}m left`
    : 'Not in session'
  const daysPerWeek = group?.days ? group.days.split(',').filter((item) => item.trim()).length : 0
  const durationHours =
    group?.start_time && group.end_time
      ? Math.max(
          0,
          Math.floor(
            (new Date(`2000-01-01 ${group.end_time}`).getTime() -
              new Date(`2000-01-01 ${group.start_time}`).getTime()) /
              (1000 * 60 * 60),
          ),
        )
      : 0
  const durationWeeks =
    group?.start_day && group.end_day
      ? Math.max(
          0,
          Math.ceil(
            (new Date(group.end_day).getTime() - new Date(group.start_day).getTime()) /
              (1000 * 60 * 60 * 24 * 7),
          ),
        )
      : 0
  const roomCapacity = group?.room_id ? rooms.find((room) => room.id === group.room_id)?.capacity || 0 : 0
  const utilizationPercent =
    roomCapacity > 0 ? Math.round((studentsInGroup.length / roomCapacity) * 100) : 0
  const operationalAlerts = useMemo<OperationalAlert[]>(() => {
    if (!group) return []

    const alerts: OperationalAlert[] = []

    if (!group.main_teacher_id) {
      alerts.push({
        id: 'missing-main-teacher',
        title: 'Main teacher is not assigned',
        detail: 'Assign a primary teacher to keep attendance and lesson ownership clear.',
        severity: 'warning',
      })
    }

    if (!group.days || !group.start_time || !group.end_time) {
      alerts.push({
        id: 'missing-schedule',
        title: 'Schedule is incomplete',
        detail: 'Set meeting days and time window so this group appears correctly in schedule and ongoing widgets.',
        severity: 'error',
      })
    }

    if (!group.room_id) {
      alerts.push({
        id: 'missing-room',
        title: 'Room is not assigned',
        detail: 'Room assignment helps avoid conflicts and gives staff location context.',
        severity: 'warning',
      })
    }

    if (roomCapacity > 0 && utilizationPercent >= 90) {
      alerts.push({
        id: 'capacity-risk',
        title: 'Capacity risk detected',
        detail: `${studentsInGroup.length}/${roomCapacity} students assigned (${utilizationPercent}%).`,
        severity: 'warning',
      })
    }

    if (debtStudentsCount > 0) {
      alerts.push({
        id: 'students-in-debt',
        title: 'Outstanding student balances',
        detail: `${debtStudentsCount} students currently have unpaid balance.`,
        severity: 'info',
      })
    }

    return alerts
  }, [debtStudentsCount, group, roomCapacity, studentsInGroup.length, utilizationPercent])

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
      { id: 'students', label: 'Students', icon: Users },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
    ]

    if (canViewPayments) {
      tabs.push({ id: 'payments', label: 'Payments', icon: DollarSign })
    }
    if (canViewAttendance) {
      tabs.push({ id: 'attendance', label: 'Attendance', icon: CheckCircle })
    }

    return tabs
  }, [canViewAttendance, canViewPayments])

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('students')
    }
  }, [activeTab, visibleTabs])

  if (!groupIdNumber || Number.isNaN(groupIdNumber)) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-surface border border-border rounded-2xl text-center py-12">
              <p className="text-text-secondary">Invalid group id.</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <LoadingScreen message="Loading group details..." />
      </ProtectedRoute>
    )
  }

  if (!group) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-surface border border-border rounded-2xl text-center py-12">
              <p className="text-text-secondary text-lg mb-4">Group not found.</p>
              <button onClick={() => router.push('/dashboard/groups')} className="btn-primary">
                Back to Groups
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <button
                onClick={() => router.push('/dashboard/groups')}
                className="flex items-center gap-2 text-text-secondary hover:text-primary mb-4 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Groups
              </button>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                {group.name}
              </h1>
              <p className="text-text-secondary mt-1">{group.course_name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    ongoingSession ? 'bg-success/15 text-success' : 'bg-background text-text-secondary'
                  }`}
                >
                  {sessionStatusLabel}
                </span>
                {group.room_name && (
                  <span className="inline-flex items-center rounded-full bg-background px-3 py-1 text-xs text-text-secondary">
                    Room: {group.room_name}
                  </span>
                )}
              </div>
              {group.branch_name && (
                <p className="text-sm text-text-secondary mt-1">Branch: {group.branch_name}</p>
              )}
              {!canConfigureGroup && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <AlertCircle className="h-4 w-4" />
                  Read-only mode for this group configuration.
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab('students')}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Students workspace
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Schedule panel
                </button>
                {canViewAttendance && (
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Attendance desk
                  </button>
                )}
                {canViewPayments && (
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Payments desk
                  </button>
                )}
              </div>
            </div>

            {canConfigureGroup && (
              <div className="flex items-center gap-2">
                {!isConfigMode ? (
                  <button
                    onClick={() => setIsConfigMode(true)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Configure Group
                  </button>
                ) : (
                  <>
                    <button onClick={handleCancelConfiguration} className="btn-secondary">
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSaveConfiguration()}
                      disabled={isSavingConfig}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {isSavingConfig ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl font-bold">{studentsInGroup.length}</p>
              <p className="text-sm text-text-secondary">Students</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Calendar className="h-5 w-5 text-info" />
              </div>
              <p className="text-3xl font-bold">{daysPerWeek}</p>
              <p className="text-sm text-text-secondary">Days per Week</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <p className="text-3xl font-bold">{durationHours}h</p>
              <p className="text-sm text-text-secondary">Session Duration</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <CalendarDays className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold">{durationWeeks}</p>
              <p className="text-sm text-text-secondary">Duration (Weeks)</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className={`h-5 w-5 ${debtStudentsCount > 0 ? 'text-warning' : 'text-success'}`} />
              </div>
              <p className={`text-3xl font-bold ${debtStudentsCount > 0 ? 'text-warning' : 'text-success'}`}>
                {debtStudentsCount}
              </p>
              <p className="text-sm text-text-secondary">Students in Debt</p>
              <p className="text-xs text-text-secondary mt-1">
                {roomCapacity > 0
                  ? `Room usage: ${studentsInGroup.length}/${roomCapacity} (${utilizationPercent}%)`
                  : 'No room capacity configured'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-surface/90 backdrop-blur-md border border-border rounded-2xl p-5">
              <p className="text-xs text-text-secondary uppercase tracking-wide mb-2">Session status</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">{sessionStatusLabel}</p>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="text-sm text-primary hover:underline"
                >
                  View schedule
                </button>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                {group.days || 'No days configured'} • {group.start_time || '--:--'} - {group.end_time || '--:--'}
              </p>
            </div>

            <div className="bg-surface/90 backdrop-blur-md border border-border rounded-2xl p-5">
              <p className="text-xs text-text-secondary uppercase tracking-wide mb-2">Financial snapshot</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">{formatCurrencyFromMinor(totalBalanceTiyin)}</p>
                {canViewPayments && (
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="text-sm text-primary hover:underline"
                  >
                    Open payments
                  </button>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-2">
                {paidStudentsCount} paid • {debtStudentsCount} with debt
              </p>
            </div>

            <div className="bg-surface/90 backdrop-blur-md border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-text-secondary uppercase tracking-wide">Operational alerts</p>
                <ShieldAlert className="h-4 w-4 text-warning" />
              </div>
              {operationalAlerts.length > 0 ? (
                <div className="space-y-2 max-h-[130px] overflow-y-auto pr-1">
                  {operationalAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border px-3 py-2 ${
                        alert.severity === 'error'
                          ? 'border-error/30 bg-error/10'
                          : alert.severity === 'warning'
                            ? 'border-warning/30 bg-warning/10'
                            : 'border-info/30 bg-info/10'
                      }`}
                    >
                      <p className="text-xs font-semibold">{alert.title}</p>
                      <p className="text-[11px] text-text-secondary mt-1">{alert.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-text-secondary">
                  No blockers detected for this group.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 border-b border-border">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            {activeTab === 'students' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold">Students ({studentsInGroup.length})</h2>
                </div>

                {isConfigMode && canConfigureGroup && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-surface border border-border rounded-2xl p-6">
                      <h3 className="text-lg font-semibold mb-4">Current Students ({configuredStudents.length})</h3>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {configuredStudents.map((student, index) => (
                          <div key={`${student.id}-${index}`} className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div>
                              <p className="font-medium">{getFullName(student)}</p>
                              <p className="text-xs text-text-secondary">{student.phone || student.email || '-'}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveStudentFromConfig(student.id)}
                              className="text-error hover:bg-error/10 rounded-lg px-2 py-1 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        {configuredStudents.length === 0 && (
                          <p className="text-text-secondary text-sm">No students selected.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface border border-border rounded-2xl p-6">
                      <h3 className="text-lg font-semibold mb-4">Add Students</h3>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                        <input
                          value={studentSearchQuery}
                          onChange={(event) => setStudentSearchQuery(event.target.value)}
                          placeholder="Search by name, username, phone..."
                          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {availableStudents.map((student, index) => (
                          <div key={`${student.id}-${index}`} className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div>
                              <p className="font-medium">{getFullName(student)}</p>
                              <p className="text-xs text-text-secondary">@{student.username || '-'} • {student.phone || '-'}</p>
                            </div>
                            <button
                              onClick={() => handleAddStudentToConfig(student.id)}
                              className="text-primary hover:bg-primary/10 rounded-lg px-2 py-1 text-sm inline-flex items-center gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                        ))}
                        {availableStudents.length === 0 && (
                          <p className="text-text-secondary text-sm">No available students match this query.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {studentsInGroup.length > 0 ? (
                    studentsInGroup.map((student, index) => (
                      <div key={`${student.id}-${index}`} className="bg-surface border border-border rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                            {(student.first_name || 'S')[0]}
                            {(student.last_name || 'T')[0]}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{getFullName(student)}</h3>
                            <p className="text-sm text-text-secondary">{student.phone || '-'}</p>
                          </div>
                        </div>
                        {student.email && (
                          <p className="text-sm text-text-secondary mb-2">Email: {student.email}</p>
                        )}
                        {typeof student.balance_tiyin !== 'undefined' && (
                          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                            <span className="text-sm text-text-secondary">Balance:</span>
                            <span className={`font-semibold ${(student.balance_tiyin || 0) <= 0 ? 'text-success' : 'text-error'}`}>
                              {formatCurrencyFromMinor(student.balance_tiyin || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full bg-surface border border-border rounded-2xl text-center py-12">
                      <Users className="h-12 w-12 mx-auto mb-4 text-text-secondary" />
                      <p className="text-text-secondary">No students enrolled yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            

        {activeTab === 'schedule' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Schedule & Configuration</h2>

            {isConfigMode && canConfigureGroup ? (
              <div className="bg-surface border border-border rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Group Name *</label>
                    <input
                      value={configForm.name}
                      onChange={(event) =>
                        setConfigForm((previous) => ({ ...previous, name: event.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Course *</label>
                    <select
                      value={configForm.course_id}
                      onChange={(event) =>
                        setConfigForm((previous) => ({
                          ...previous,
                          course_id: event.target.value ? Number(event.target.value) : '',
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="">Select a course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Room</label>
                    <select
                      value={configForm.room_id}
                      onChange={(event) =>
                        setConfigForm((previous) => ({
                          ...previous,
                          room_id: event.target.value ? Number(event.target.value) : '',
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="">No room</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Main Teacher</label>
                    <select
                      value={configForm.main_teacher_id}
                      onChange={(event) =>
                        setConfigForm((previous) => ({
                          ...previous,
                          main_teacher_id: event.target.value ? Number(event.target.value) : '',
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="">No main teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {getFullName(teacher)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Assistant Teacher</label>
                    <select
                      value={configForm.assistant_teacher_id}
                      onChange={(event) =>
                        setConfigForm((previous) => ({
                          ...previous,
                          assistant_teacher_id: event.target.value ? Number(event.target.value) : '',
                        }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    >
                      <option value="">No assistant teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {getFullName(teacher)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div />

                  <div>
                    <label className="block text-sm font-medium mb-2">Start Date</label>
                    <input
                      type="date"
                      value={configForm.start_day}
                      onChange={(event) =>
                        setConfigForm((previous) => ({ ...previous, start_day: event.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">End Date</label>
                    <input
                      type="date"
                      value={configForm.end_day}
                      onChange={(event) =>
                        setConfigForm((previous) => ({ ...previous, end_day: event.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <input
                      type="time"
                      value={configForm.start_time}
                      onChange={(event) =>
                        setConfigForm((previous) => ({ ...previous, start_time: event.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">End Time</label>
                    <input
                      type="time"
                      value={configForm.end_time}
                      onChange={(event) =>
                        setConfigForm((previous) => ({ ...previous, end_time: event.target.value }))
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-medium mb-2">Schedule Days</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => {
                      const isSelected = configForm.days.includes(day)
                      return (
                        <button
                          key={day}
                          onClick={() => toggleScheduleDay(day)}
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary border-primary/40'
                              : 'border-border hover:bg-background'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Class Times
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Start Time:</span>
                      <span className="font-semibold">{group.start_time || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">End Time:</span>
                      <span className="font-semibold">{group.end_time || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Days:</span>
                      <span className="font-semibold">{group.days || 'Not set'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Course Duration
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Start Date:</span>
                      <span className="font-semibold">
                        {group.start_day ? new Date(group.start_day).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">End Date:</span>
                      <span className="font-semibold">
                        {group.end_day ? new Date(group.end_day).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Location
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Room:</span>
                      <span className="font-semibold">{group.room_name || 'Not assigned'}</span>
                    </div>
                    {group.branch_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Branch:</span>
                        <span className="font-semibold">{group.branch_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Teachers
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Main Teacher</div>
                      <div className="font-semibold">{group.main_teacher_name || 'Not assigned'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Assistant Teacher</div>
                      <div className="font-semibold">{group.assistant_teacher_name || 'Not assigned'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Group Payments</h2>
            {!canRecordPayment && (
              <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                You can view balances, but only finance-enabled roles can record payments.
              </div>
            )}

            {canRecordPayment && (
              <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={newPayment.by_user}
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        by_user: event.target.value ? Number(event.target.value) : '',
                      }))
                    }
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">Select student</option>
                    {studentsInGroup.map((student, index) => (
                      <option key={`${student.id}-${index}`} value={student.id}>
                        {getFullName(student)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      newPayment.amount_tiyin > 0
                        ? Number(tiyinToSelectedCurrencyAmount(newPayment.amount_tiyin).toFixed(2))
                        : ''
                    }
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        amount_tiyin: selectedCurrencyAmountToTiyin(Number(event.target.value) || 0),
                      }))
                    }
                    placeholder={`Amount (${currency})`}
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      newPayment.course_price_tiyin > 0
                        ? Number(tiyinToSelectedCurrencyAmount(newPayment.course_price_tiyin).toFixed(2))
                        : ''
                    }
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        course_price_tiyin: selectedCurrencyAmountToTiyin(Number(event.target.value) || 0),
                      }))
                    }
                    placeholder={`Course price (${currency})`}
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />

                  <select
                    value={newPayment.status}
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        status: event.target.value as PaymentForm['status'],
                      }))
                    }
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={newPayment.payment_type}
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        payment_type: event.target.value ? Number(event.target.value) : '',
                      }))
                    }
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">Payment type</option>
                    {paymentTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newPayment.teacher}
                    onChange={(event) =>
                      setNewPayment((previous) => ({
                        ...previous,
                        teacher: event.target.value ? Number(event.target.value) : '',
                      }))
                    }
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">Teacher (optional)</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {getFullName(teacher)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={newPayment.date}
                    onChange={(event) =>
                      setNewPayment((previous) => ({ ...previous, date: event.target.value }))
                    }
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />

                  <input
                    value={newPayment.detail}
                    onChange={(event) =>
                      setNewPayment((previous) => ({ ...previous, detail: event.target.value }))
                    }
                    placeholder="Notes (optional)"
                    className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary lg:col-span-2"
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => void handleRecordPayment()}
                    disabled={isCreatingPayment}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isCreatingPayment ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-surface border border-border rounded-2xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">Student</th>
                      <th className="text-left py-3 px-4">Phone</th>
                      <th className="text-right py-3 px-4">Balance</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsInGroup.length > 0 ? (
                      studentsInGroup.map((student, index) => {
                        const hasDebt = (student.balance_tiyin || 0) > 0
                        return (
                          <tr key={`${student.id}-${index}`} className="border-b border-border/50 hover:bg-background/50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{getFullName(student)}</div>
                            </td>
                            <td className="py-3 px-4 text-text-secondary">{student.phone || '-'}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-semibold ${hasDebt ? 'text-error' : 'text-success'}`}>
                                {formatCurrencyFromMinor(student.balance_tiyin || 0)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-3 py-1 rounded-lg text-sm ${
                                  hasDebt ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                                }`}
                              >
                                {hasDebt ? 'Debt' : 'Paid'}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-text-secondary">
                          No payment data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {studentsInGroup.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <div className="text-3xl font-bold text-success">{paidStudentsCount}</div>
                  <div className="text-sm text-text-secondary">Paid Students</div>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <div className="text-3xl font-bold text-error">{debtStudentsCount}</div>
                  <div className="text-sm text-text-secondary">Students with Debt</div>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <div className="text-3xl font-bold">{formatCurrencyFromMinor(totalBalanceTiyin)}</div>
                  <div className="text-sm text-text-secondary">Total Balance</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Attendance Register</h2>
                <p className="text-sm text-text-secondary mt-1">
                  Hover any day cell to expand quick actions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftAttendanceMonth(-1)}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:bg-background transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(event) => {
                    const monthValue = event.target.value
                    if (!monthValue) return
                    setAttendanceMonth(monthValue)
                    if (!selectedDate.startsWith(monthValue)) {
                      setSelectedDate(`${monthValue}-01`)
                    }
                  }}
                  className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => shiftAttendanceMonth(1)}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:bg-background transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <span className="rounded-lg border border-border bg-surface px-3 py-1.5">
                Month: {attendanceMonthLabel}
              </span>
              <span className="rounded-lg border border-border bg-surface px-3 py-1.5">
                Selected day: {new Date(`${selectedDate}T00:00:00`).toLocaleDateString()}
              </span>
              <span className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-success">
                Present: {selectedDateAttendanceTotals.present}
              </span>
              <span className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-warning">
                Excused: {selectedDateAttendanceTotals.absence}
              </span>
              <span className="rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-error">
                Absent: {selectedDateAttendanceTotals.absent}
              </span>
              <span className="rounded-lg border border-border bg-surface px-3 py-1.5">
                Unmarked: {selectedDateAttendanceTotals.unmarked}
              </span>
            </div>
            <div className="mb-4 inline-flex items-center rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setAttendanceView('register')}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  attendanceView === 'register' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background'
                }`}
              >
                Register View
              </button>
              <button
                type="button"
                onClick={() => setAttendanceView('weekday')}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  attendanceView === 'weekday' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background'
                }`}
              >
                Weekday View
              </button>
            </div>
            {!canMarkAttendance && (
              <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                Read-only attendance mode. You can review records but cannot mark attendance.
              </div>
            )}

            {studentsInGroup.length > 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
                {attendanceView === 'register' ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1380px] w-full border-separate border-spacing-0">
                        <thead>
                          <tr>
                            <th className="sticky left-0 z-20 min-w-[52px] border border-border bg-surface px-2 py-2 text-center text-xs font-semibold">
                              #
                            </th>
                            <th className="sticky left-[52px] z-20 min-w-[220px] border border-border bg-surface px-3 py-2 text-left text-xs font-semibold">
                              Student
                            </th>
                            {attendanceMonthDays.map((day) => {
                              const isSelectedDate = day.date === selectedDate
                              const bulkKey = `bulk:${day.date}`
                              const isBulkMarkingDay = markingAttendance === bulkKey
                              const isBulkDisabled = Boolean(markingAttendance && markingAttendance !== bulkKey)
                              const isAllPresentDay = allPresentDates.has(day.date)
                              return (
                                <th
                                  key={day.date}
                                  className={`min-w-[72px] border border-border px-2 py-2 text-center ${
                                    isSelectedDate ? 'bg-primary/15 text-primary' : 'bg-background'
                                  }`}
                                  title={day.date}
                                >
                                  <div className="text-[11px] font-semibold leading-none">{day.dayLabel}</div>
                                  <div className="text-[10px] text-text-secondary mt-1">{day.weekdayLabel}</div>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void markAllPresentForDate(day.date)
                                    }}
                                    disabled={!canMarkAttendance || isBulkDisabled}
                                    className={`mt-1 inline-flex h-5 w-7 items-center justify-center rounded-sm border text-[11px] font-semibold ${
                                      canMarkAttendance
                                        ? 'border-success/40 bg-success/5 text-success hover:bg-success/15'
                                        : 'border-border text-text-secondary/30'
                                    } disabled:opacity-40`}
                                    title="Mark all students present for this day"
                                    aria-label="Mark all students present for this day"
                                  >
                                    {isBulkMarkingDay ? '…' : isAllPresentDay ? '✓' : ''}
                                  </button>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {studentsInGroup.map((student, index) => (
                            <tr key={`${student.id}-${index}`}>
                              <td className="sticky left-0 z-10 border border-border bg-surface px-2 py-2 text-center text-xs text-text-secondary">
                                {index + 1}
                              </td>
                              <td className="sticky left-[52px] z-10 border border-border bg-surface px-3 py-2">
                                <p className="text-sm font-medium leading-tight">{getFullName(student)}</p>
                                <p className="text-xs text-text-secondary mt-0.5">{student.phone || '-'}</p>
                              </td>
                              {attendanceMonthDays.map((day) => {
                                const cellKey = getAttendanceCellKey(student.id, day.date)
                                const record = attendanceByStudentAndDate.get(cellKey)
                                const status = record ? normalizeAttendanceStatus(record) : null
                                const registerMeta = status ? ATTENDANCE_REGISTER_CELL_META[status] : null
                                const isSelectedDate = day.date === selectedDate
                                const isMarkingCell = markingAttendance === cellKey
                                const disableActions = Boolean(markingAttendance && markingAttendance !== cellKey)

                                return (
                                  <td
                                    key={cellKey}
                                    className={`h-12 border border-border px-1 py-1 text-center ${isSelectedDate ? 'bg-primary/5' : 'bg-background'}`}
                                    onClick={() => setSelectedDate(day.date)}
                                  >
                                    <div className="group relative flex justify-center">
                                      <div
                                        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all duration-200 ${
                                          registerMeta
                                            ? `${registerMeta.className} border-transparent`
                                            : 'bg-background text-text-secondary/45 border-border'
                                        } ${
                                          canMarkAttendance && !isMarkingCell
                                            ? 'group-hover:w-[190px] group-hover:justify-start group-hover:px-1.5 group-hover:shadow-lg'
                                            : ''
                                        } ${isSelectedDate ? 'ring-2 ring-primary/30' : ''}`}
                                      >
                                        <span className={`${canMarkAttendance && !isMarkingCell ? 'group-hover:opacity-0 transition-opacity' : ''}`}>
                                          {isMarkingCell ? '...' : registerMeta ? registerMeta.symbol : '·'}
                                        </span>
                                      </div>

                                      {canMarkAttendance && !isMarkingCell && (
                                        <div className="pointer-events-none absolute inset-0 z-20 hidden items-center gap-1 px-1.5 group-hover:flex group-hover:pointer-events-auto">
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              void markAttendance(student.id, 'present', day.date)
                                            }}
                                            disabled={disableActions}
                                            className="rounded-md bg-success/20 px-1.5 py-1 text-[10px] font-medium text-success disabled:opacity-40"
                                            title="Present"
                                          >
                                            + Present
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              void markAttendance(student.id, 'absence', day.date)
                                            }}
                                            disabled={disableActions}
                                            className="rounded-md bg-warning/20 px-1.5 py-1 text-[10px] font-medium text-warning disabled:opacity-40"
                                            title="Absence (Excused)"
                                          >
                                            ! Absence
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              void markAttendance(student.id, 'absent', day.date)
                                            }}
                                            disabled={disableActions}
                                            className="rounded-md bg-error/20 px-1.5 py-1 text-[10px] font-medium text-error disabled:opacity-40"
                                            title="Absent (Unexcused)"
                                          >
                                            - Absent
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                      {(Object.keys(ATTENDANCE_REGISTER_CELL_META) as AttendanceStatus[]).map((status) => (
                        <span key={status} className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${ATTENDANCE_REGISTER_CELL_META[status].className}`}
                          >
                            {ATTENDANCE_REGISTER_CELL_META[status].symbol}
                          </span>
                          {ATTENDANCE_REGISTER_CELL_META[status].label}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                        Marked on selected date: {attendanceByStudentOnDate.size}/{studentsInGroup.length}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1320px] w-full border-separate border-spacing-0">
                        <thead>
                          <tr>
                            {ATTENDANCE_WEEKDAY_ORDER.map((weekday) => (
                              (() => {
                                const isSelectedWeekday = weekday.key === selectedWeekdayKey
                                const bulkKey = `bulk:${selectedDate}`
                                const isBulkMarkingSelectedDay = markingAttendance === bulkKey
                                const isSelectedDateFullyPresent = allPresentDates.has(selectedDate)
                                const isBulkDisabled =
                                  !isSelectedWeekday ||
                                  !canMarkAttendance ||
                                  Boolean(markingAttendance && markingAttendance !== bulkKey)

                                return (
                                  <th
                                    key={weekday.key}
                                    className={`min-w-[150px] border border-border px-3 py-2 text-left text-xs font-semibold ${
                                      isSelectedWeekday ? 'bg-primary/10' : 'bg-background'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{weekday.label}</span>
                                      <button
                                        type="button"
                                        onClick={() => void markAllPresentForDate(selectedDate)}
                                        disabled={isBulkDisabled}
                                        className={`inline-flex h-5 w-7 items-center justify-center rounded-sm border text-[11px] font-semibold ${
                                          isSelectedWeekday && canMarkAttendance
                                            ? 'border-success/40 bg-success/5 text-success hover:bg-success/15'
                                            : 'border-border text-text-secondary/30'
                                        } disabled:opacity-40`}
                                        title={
                                          isSelectedWeekday
                                            ? `Mark all students present for ${selectedDate}`
                                            : 'Select a date in this weekday column to enable'
                                        }
                                        aria-label="Mark all students present for selected day"
                                      >
                                        {isBulkMarkingSelectedDay && isSelectedWeekday ? '…' : isSelectedWeekday && isSelectedDateFullyPresent ? '✓' : ''}
                                      </button>
                                    </div>
                                  </th>
                                )
                              })()
                            ))}
                            <th className="sticky right-0 z-20 min-w-[220px] border border-border bg-surface px-3 py-2 text-left text-xs font-semibold">
                              Student
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsInGroup.map((student, index) => (
                            <tr key={`${student.id}-${index}`}>
                              {ATTENDANCE_WEEKDAY_ORDER.map((weekday) => (
                                <td key={`${student.id}-${weekday.key}`} className="border border-border px-2 py-2 align-top">
                                  <div className="flex flex-wrap gap-1.5">
                                    {attendanceMonthDaysByWeekday[weekday.key].map((day) => {
                                      const cellKey = getAttendanceCellKey(student.id, day.date)
                                      const record = attendanceByStudentAndDate.get(cellKey)
                                      const status = record ? normalizeAttendanceStatus(record) : null
                                      const isMarkingCell = markingAttendance === cellKey
                                      const isSelectedDate = day.date === selectedDate
                                      const disableActions = Boolean(markingAttendance && markingAttendance !== cellKey)
                                      const dayCellClassName =
                                        status === 'present'
                                          ? 'bg-success/25 border-success/30 text-success'
                                          : status === 'absence'
                                            ? 'bg-warning/25 border-warning/30 text-warning'
                                            : status === 'absent'
                                              ? 'bg-error/25 border-error/30 text-error'
                                              : 'bg-background border-border text-text-secondary/55'

                                      return (
                                        <div key={cellKey} className="group relative">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedDate(day.date)}
                                            className={`h-8 w-8 rounded-lg border text-[11px] font-semibold transition-colors ${dayCellClassName} ${
                                              isSelectedDate ? 'ring-2 ring-primary/40' : ''
                                            }`}
                                          >
                                            {isMarkingCell ? '...' : day.dayNumber}
                                          </button>

                                          {canMarkAttendance && !isMarkingCell && (
                                            <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-lg group-hover:flex group-hover:pointer-events-auto">
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  void markAttendance(student.id, 'present', day.date)
                                                }}
                                                disabled={disableActions}
                                                className="rounded-md bg-success/20 px-1.5 py-1 text-[10px] font-medium text-success disabled:opacity-40"
                                              >
                                                Present
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  void markAttendance(student.id, 'absence', day.date)
                                                }}
                                                disabled={disableActions}
                                                className="rounded-md bg-warning/20 px-1.5 py-1 text-[10px] font-medium text-warning disabled:opacity-40"
                                              >
                                                Excused
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  void markAttendance(student.id, 'absent', day.date)
                                                }}
                                                disabled={disableActions}
                                                className="rounded-md bg-error/20 px-1.5 py-1 text-[10px] font-medium text-error disabled:opacity-40"
                                              >
                                                Absent
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </td>
                              ))}
                              <td className="sticky right-0 z-10 border border-border bg-surface px-3 py-2">
                                <p className="text-sm font-medium leading-tight">{getFullName(student)}</p>
                                <p className="text-xs text-text-secondary mt-0.5">{student.phone || '-'}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                        <span className="inline-flex h-4 w-4 rounded bg-success/25 border border-success/30" />
                        Present
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                        <span className="inline-flex h-4 w-4 rounded bg-warning/25 border border-warning/30" />
                        Absence (Excused)
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                        <span className="inline-flex h-4 w-4 rounded bg-error/25 border border-error/30" />
                        Absent (Unexcused)
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                        Marked on selected date: {attendanceByStudentOnDate.size}/{studentsInGroup.length}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl text-center py-12 mb-6">
                <Users className="h-12 w-12 mx-auto mb-4 text-text-secondary" />
                <p className="text-text-secondary">No students in this group.</p>
              </div>
            )}

          </div>
        )}
      </div>
      </div>
      </div>
    </ProtectedRoute>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Coins,
  Edit3,
  ExternalLink,
  Globe2,
  MapPin,
  TrendingUp,
  UserSquare2,
  Users,
  X,
} from 'lucide-react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import LoadingScreen from '@/components/LoadingScreen'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useSettings } from '@/contexts/SettingsContext'

type DetailTab = 'overview' | 'staff' | 'groups' | 'finance'
type TrendWindow = '3' | '6' | '12'

interface BranchRecord {
  id: number
  name: string
  latitude?: string | null
  longitude?: string | null
}

interface GroupRecord {
  id: number
  name?: string
  branch?: number | { id?: number; name?: string } | null
  branch_name?: string
  course_name?: string | null
  room_name?: string | null
  student_count?: number | null
  students?: unknown[]
  is_active?: boolean
  start_day?: string | null
  end_day?: string | null
  days?: string | null
  start_time?: string | null
  end_time?: string | null
  main_teacher?: number | { id?: number; first_name?: string; last_name?: string; username?: string } | null
  assistant_teacher?: number | { id?: number; first_name?: string; last_name?: string; username?: string } | null
  main_teacher_name?: string | null
  assistant_teacher_name?: string | null
}

interface TeacherRecord {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  is_active?: boolean
  last_login?: string | null
}

interface PaymentRecord {
  id: number
  group?: number | { id?: number } | null
  by_user?: number | { id?: number } | null
  branch_name?: string | null
  amount?: number | string | null
  amount_tiyin?: number | string | null
  status?: string | null
  date?: string | null
  created_at?: string | null
}

interface StaffRow {
  id: number
  fullName: string
  email: string
  phone: string
  isActive: boolean
  mainGroups: number
  assistantGroups: number
  activeGroups: number
  studentLoad: number
  lastLogin: string | null
}

interface TrendPoint {
  monthKey: string
  label: string
  revenueTiyin: number
  paidCount: number
}

interface BranchEditForm {
  name: string
  latitude: string
  longitude: string
}

const BRANCH_DETAIL_TAB_STORAGE_KEY = 'dashboard.branches.detail.active_tab'
const BRANCH_DETAIL_TREND_WINDOW_STORAGE_KEY = 'dashboard.branches.detail.trend_window'
const BRANCH_DETAIL_GROUP_SEARCH_STORAGE_KEY = 'dashboard.branches.detail.group_search'

const parseListPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const maybeResults = (payload as { results?: unknown }).results
    if (Array.isArray(maybeResults)) {
      return maybeResults as T[]
    }
  }
  return []
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const readRelatedId = (value: unknown): number | null => {
  if (value && typeof value === 'object') {
    return toNumber((value as { id?: unknown }).id)
  }
  return toNumber(value)
}

const resolveGroupBranchId = (group: GroupRecord): number | null => {
  return readRelatedId(group.branch)
}

const normalizeBranchName = (value: string | null | undefined): string => {
  return String(value || '').trim().toLowerCase()
}

const resolveMinorAmount = (payment: PaymentRecord): number => {
  const explicitMinor = toNumber(payment.amount_tiyin)
  if (explicitMinor !== null) {
    return Math.round(explicitMinor)
  }

  const fallback = toNumber(payment.amount)
  if (fallback !== null) {
    return Math.round(fallback)
  }

  return 0
}

const validateCoordinate = (value: string, min: number, max: number): string | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return `Value must be between ${min} and ${max}`
  }
  return null
}

const monthKeyFromDate = (value?: string | null): string | null => {
  if (!value) return null
  const normalized = value.includes('T') ? value.split('T')[0] : value
  if (normalized.length < 7) return null
  return normalized.slice(0, 7)
}

const getRecentMonthKeys = (count: number): string[] => {
  const now = new Date()
  const keys: string[] = []

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return keys
}

const formatMonthLabel = (monthKey: string): string => {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey
  }
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const formatSchedule = (group: GroupRecord): string => {
  const days = String(group.days || '').trim()
  const startTime = String(group.start_time || '').slice(0, 5)
  const endTime = String(group.end_time || '').slice(0, 5)

  const dayToken = days || 'No days'
  if (startTime && endTime) {
    return `${dayToken} • ${startTime}-${endTime}`
  }

  return dayToken
}

const isGroupActive = (group: GroupRecord): boolean => {
  const today = new Date().toISOString().slice(0, 10)
  if (group.is_active === false) return false
  if (group.end_day && group.end_day < today) return false
  return true
}

const getDisplayName = (teacher: TeacherRecord): string => {
  const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()
  if (fullName) return fullName
  return teacher.username || `Teacher #${teacher.id}`
}

const getScopedBranchDetailStorageKey = (
  baseKey: string,
  branchId: number,
  userId: number,
  branchScopeId: number | null,
): string => {
  const scopeToken = branchScopeId ?? 'all'
  return `${baseKey}:branch${branchId}:u${userId}:scope${scopeToken}`
}

export default function BranchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { formatCurrencyFromMinor } = useSettings()
  const {
    branches: accessibleBranches,
    activeBranchId,
    isGlobalScope,
    setActiveBranch,
    isSwitching,
    refreshBranchContext,
    patchBranchOption,
  } = useBranchContext()

  const branchId = Number(params.id)
  const [branch, setBranch] = useState<BranchRecord | null>(null)
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [trendWindow, setTrendWindow] = useState<TrendWindow>('6')
  const [groupSearch, setGroupSearch] = useState('')
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<BranchEditForm>({
    name: '',
    latitude: '',
    longitude: '',
  })

  const canManageBranches = Boolean(user?.is_staff || user?.is_superuser)

  const persistedUserId = useMemo(() => {
    const parsed = Number(user?.id)
    return Number.isFinite(parsed) ? parsed : null
  }, [user?.id])

  const detailStorageKeys = useMemo(() => {
    if (!Number.isFinite(branchId) || persistedUserId === null) return null

    return {
      activeTab: getScopedBranchDetailStorageKey(
        BRANCH_DETAIL_TAB_STORAGE_KEY,
        branchId,
        persistedUserId,
        activeBranchId,
      ),
      trendWindow: getScopedBranchDetailStorageKey(
        BRANCH_DETAIL_TREND_WINDOW_STORAGE_KEY,
        branchId,
        persistedUserId,
        activeBranchId,
      ),
      groupSearch: getScopedBranchDetailStorageKey(
        BRANCH_DETAIL_GROUP_SEARCH_STORAGE_KEY,
        branchId,
        persistedUserId,
        activeBranchId,
      ),
    }
  }, [activeBranchId, branchId, persistedUserId])

  useEffect(() => {
    if (!detailStorageKeys) {
      setHasLoadedPrefs(true)
      return
    }

    setHasLoadedPrefs(false)

    try {
      setActiveTab('overview')
      setTrendWindow('6')
      setGroupSearch('')

      const storedTab = localStorage.getItem(detailStorageKeys.activeTab)
      if (storedTab && ['overview', 'staff', 'groups', 'finance'].includes(storedTab)) {
        setActiveTab(storedTab as DetailTab)
      }

      const storedTrend = localStorage.getItem(detailStorageKeys.trendWindow)
      if (storedTrend && ['3', '6', '12'].includes(storedTrend)) {
        setTrendWindow(storedTrend as TrendWindow)
      }

      const storedGroupSearch = localStorage.getItem(detailStorageKeys.groupSearch)
      if (storedGroupSearch) {
        setGroupSearch(storedGroupSearch)
      }
    } catch {
      // Ignore storage access failures.
    } finally {
      setHasLoadedPrefs(true)
    }
  }, [detailStorageKeys])

  useEffect(() => {
    if (!detailStorageKeys || !hasLoadedPrefs) return

    try {
      localStorage.setItem(detailStorageKeys.activeTab, activeTab)
      localStorage.setItem(detailStorageKeys.trendWindow, trendWindow)
      localStorage.setItem(detailStorageKeys.groupSearch, groupSearch)
    } catch {
      // Ignore storage write failures.
    }
  }, [activeTab, detailStorageKeys, groupSearch, hasLoadedPrefs, trendWindow])

  const fetchAllPages = useCallback(async <T,>(fetchPage: (page: number) => Promise<unknown>, maxPages = 25): Promise<T[]> => {
    const rows: T[] = []
    let page = 1

    while (page <= maxPages) {
      const payload = await fetchPage(page)
      rows.push(...parseListPayload<T>(payload))

      if (!payload || typeof payload !== 'object' || !(payload as { next?: string | null }).next) {
        break
      }
      page += 1
    }

    return rows
  }, [])

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!Number.isFinite(branchId)) {
        setLoadError('Invalid branch id.')
        setIsLoading(false)
        return
      }

      if (!silent) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      setLoadError(null)

      try {
        const [branchResponse, allGroups] = await Promise.all([
          apiService.getBranch(branchId) as Promise<BranchRecord>,
          fetchAllPages<GroupRecord>((page) => apiService.getGroups({ page, limit: 100 }), 25),
        ])

        const branchGroups = allGroups.filter((group) => resolveGroupBranchId(group) === branchId)
        const branchGroupIds = new Set(branchGroups.map((group) => group.id))

        const staffIds = new Set<number>()
        branchGroups.forEach((group) => {
          const mainTeacherId = readRelatedId(group.main_teacher)
          const assistantTeacherId = readRelatedId(group.assistant_teacher)
          if (mainTeacherId !== null) staffIds.add(mainTeacherId)
          if (assistantTeacherId !== null) staffIds.add(assistantTeacherId)
        })

        const [allTeachersResult, allPaymentsResult] = await Promise.all([
          fetchAllPages<TeacherRecord>((page) => apiService.getTeachers({ page, limit: 100 }), 25),
          fetchAllPages<PaymentRecord>((page) => apiService.getPayments({ page, limit: 100 }), 25),
        ])

        const teacherById = new Map<number, TeacherRecord>()
        allTeachersResult.forEach((teacher) => {
          teacherById.set(teacher.id, teacher)
        })

        const staffRowsMap = new Map<number, StaffRow>()

        const ensureStaffRow = (
          teacherId: number,
          fallbackName: string,
        ): StaffRow => {
          if (staffRowsMap.has(teacherId)) {
            return staffRowsMap.get(teacherId) as StaffRow
          }

          const teacher = teacherById.get(teacherId)
          const fullName = teacher ? getDisplayName(teacher) : fallbackName || `Teacher #${teacherId}`

          const row: StaffRow = {
            id: teacherId,
            fullName,
            email: teacher?.email || '',
            phone: teacher?.phone || '',
            isActive: teacher?.is_active !== false,
            mainGroups: 0,
            assistantGroups: 0,
            activeGroups: 0,
            studentLoad: 0,
            lastLogin: teacher?.last_login || null,
          }

          staffRowsMap.set(teacherId, row)
          return row
        }

        branchGroups.forEach((group) => {
          const studentsCount =
            toNumber(group.student_count) !== null
              ? Math.max(0, Math.round(toNumber(group.student_count) as number))
              : Array.isArray(group.students)
                ? group.students.length
                : 0

          const active = isGroupActive(group)

          const mainTeacherId = readRelatedId(group.main_teacher)
          if (mainTeacherId !== null) {
            const row = ensureStaffRow(mainTeacherId, group.main_teacher_name || 'Main Teacher')
            row.mainGroups += 1
            row.studentLoad += studentsCount
            if (active) row.activeGroups += 1
          }

          const assistantTeacherId = readRelatedId(group.assistant_teacher)
          if (assistantTeacherId !== null) {
            const row = ensureStaffRow(assistantTeacherId, group.assistant_teacher_name || 'Assistant Teacher')
            row.assistantGroups += 1
            row.studentLoad += studentsCount
            if (active) row.activeGroups += 1
          }
        })

        allTeachersResult
          .filter((teacher) => staffIds.has(teacher.id) && !staffRowsMap.has(teacher.id))
          .forEach((teacher) => {
            staffRowsMap.set(teacher.id, {
              id: teacher.id,
              fullName: getDisplayName(teacher),
              email: teacher.email || '',
              phone: teacher.phone || '',
              isActive: teacher.is_active !== false,
              mainGroups: 0,
              assistantGroups: 0,
              activeGroups: 0,
              studentLoad: 0,
              lastLogin: teacher.last_login || null,
            })
          })

        const filteredPayments = allPaymentsResult.filter((payment) => {
          const paymentGroupId = readRelatedId(payment.group)
          if (paymentGroupId !== null && branchGroupIds.has(paymentGroupId)) {
            return true
          }
          return normalizeBranchName(payment.branch_name) === normalizeBranchName(branchResponse.name)
        })

        const sortedStaffRows = Array.from(staffRowsMap.values()).sort((left, right) => {
          if (right.studentLoad !== left.studentLoad) {
            return right.studentLoad - left.studentLoad
          }
          return left.fullName.localeCompare(right.fullName)
        })

        setBranch(branchResponse)
        setGroups(branchGroups)
        setStaff(sortedStaffRows)
        setPayments(filteredPayments)
      } catch (error: any) {
        console.error('Failed to load branch detail page:', error)
        const statusCode = error?.response?.status
        if (statusCode === 404) {
          setLoadError('Branch not found or not accessible in current scope.')
        } else if (statusCode === 403) {
          setLoadError('You do not have permission to view this branch detail.')
        } else {
          setLoadError('Failed to load branch detail data. Please try again.')
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [branchId, fetchAllPages],
  )

  useEffect(() => {
    void loadDetail(false)
  }, [loadDetail])

  const activeBranchLabel = useMemo(() => {
    if (activeBranchId !== null && branch && activeBranchId === branch.id) {
      return branch.name
    }
    if (activeBranchId === null) {
      return isGlobalScope ? 'All branches' : 'Assigned branch scope'
    }
    return accessibleBranches.find((branchOption) => branchOption.id === activeBranchId)?.name || `Branch #${activeBranchId}`
  }, [activeBranchId, accessibleBranches, branch, isGlobalScope])

  const branchHasCoordinates = Boolean(
    branch && String(branch.latitude || '').trim() && String(branch.longitude || '').trim(),
  )

  const summary = useMemo(() => {
    const totalGroups = groups.length
    const activeGroups = groups.filter((group) => isGroupActive(group)).length
    const completedGroups = Math.max(0, totalGroups - activeGroups)

    const totalStudents = groups.reduce((sum, group) => {
      const explicitCount = toNumber(group.student_count)
      if (explicitCount !== null) return sum + Math.max(0, Math.round(explicitCount))
      return sum + (Array.isArray(group.students) ? group.students.length : 0)
    }, 0)

    const totalRevenueTiyin = payments
      .filter((payment) => (payment.status || 'paid') === 'paid')
      .reduce((sum, payment) => sum + resolveMinorAmount(payment), 0)

    const pendingRevenueTiyin = payments
      .filter((payment) => (payment.status || 'pending') === 'pending')
      .reduce((sum, payment) => sum + resolveMinorAmount(payment), 0)

    const thisMonthKey = new Date().toISOString().slice(0, 7)
    const thisMonthRevenueTiyin = payments
      .filter((payment) => monthKeyFromDate(payment.date || payment.created_at) === thisMonthKey)
      .reduce((sum, payment) => sum + resolveMinorAmount(payment), 0)

    const previousMonthDate = new Date()
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
    const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`

    const previousMonthRevenueTiyin = payments
      .filter((payment) => monthKeyFromDate(payment.date || payment.created_at) === previousMonthKey)
      .reduce((sum, payment) => sum + resolveMinorAmount(payment), 0)

    const growthPercent =
      previousMonthRevenueTiyin > 0
        ? Math.round(((thisMonthRevenueTiyin - previousMonthRevenueTiyin) / previousMonthRevenueTiyin) * 100)
        : thisMonthRevenueTiyin > 0
          ? 100
          : 0

    return {
      totalGroups,
      activeGroups,
      completedGroups,
      totalStudents,
      totalRevenueTiyin,
      pendingRevenueTiyin,
      thisMonthRevenueTiyin,
      growthPercent,
    }
  }, [groups, payments])

  const trendData = useMemo<TrendPoint[]>(() => {
    const monthKeys = getRecentMonthKeys(Number(trendWindow))

    return monthKeys.map((monthKey) => {
      let revenueTiyin = 0
      let paidCount = 0

      payments.forEach((payment) => {
        if (monthKeyFromDate(payment.date || payment.created_at) !== monthKey) return

        const amount = resolveMinorAmount(payment)
        revenueTiyin += amount

        if ((payment.status || 'paid') === 'paid') {
          paidCount += 1
        }
      })

      return {
        monthKey,
        label: formatMonthLabel(monthKey),
        revenueTiyin,
        paidCount,
      }
    })
  }, [payments, trendWindow])

  const maxTrendRevenue = useMemo(() => {
    const max = trendData.reduce((currentMax, row) => Math.max(currentMax, row.revenueTiyin), 0)
    return max > 0 ? max : 1
  }, [trendData])

  const filteredGroups = useMemo(() => {
    const normalizedSearch = groupSearch.trim().toLowerCase()
    if (!normalizedSearch) return groups

    return groups.filter((group) => {
      const haystack = [
        group.name || '',
        group.course_name || '',
        group.room_name || '',
        group.main_teacher_name || '',
        group.assistant_teacher_name || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [groupSearch, groups])

  const topStaff = useMemo(() => {
    return staff.slice(0, 5)
  }, [staff])

  const mapUrl = branchHasCoordinates
    ? `https://maps.google.com/?q=${encodeURIComponent(`${branch?.latitude},${branch?.longitude}`)}`
    : null

  const openEditModal = useCallback(() => {
    if (!branch || !canManageBranches) return
    setEditForm({
      name: branch.name || '',
      latitude: String(branch.latitude || ''),
      longitude: String(branch.longitude || ''),
    })
    setShowEditModal(true)
  }, [branch, canManageBranches])

  const closeEditModal = useCallback(() => {
    setShowEditModal(false)
    setIsSavingEdit(false)
  }, [])

  const handleSubmitBranchEdit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!branch || !canManageBranches) return

      const trimmedName = editForm.name.trim()
      if (!trimmedName) {
        toast.error('Branch name is required.')
        return
      }

      const latitudeError = validateCoordinate(editForm.latitude, -90, 90)
      if (latitudeError) {
        toast.error(`Latitude: ${latitudeError}`)
        return
      }

      const longitudeError = validateCoordinate(editForm.longitude, -180, 180)
      if (longitudeError) {
        toast.error(`Longitude: ${longitudeError}`)
        return
      }

      setIsSavingEdit(true)
      const previousBranchSnapshot = { ...branch }
      const optimisticBranch: BranchRecord = {
        ...branch,
        name: trimmedName,
        latitude: editForm.latitude.trim() || null,
        longitude: editForm.longitude.trim() || null,
      }
      setBranch(optimisticBranch)
      patchBranchOption(branch.id, { name: trimmedName })
      setShowEditModal(false)

      try {
        await apiService.updateBranch(branch.id, optimisticBranch)

        toast.success('Branch updated successfully.')
        await Promise.allSettled([loadDetail(true), refreshBranchContext()])
      } catch (error: any) {
        setBranch(previousBranchSnapshot)
        patchBranchOption(previousBranchSnapshot.id, { name: previousBranchSnapshot.name })
        setShowEditModal(true)
        console.error('Failed to update branch:', error)
        const message = error?.response?.data?.detail || 'Failed to update branch.'
        toast.error(message)
      } finally {
        setIsSavingEdit(false)
      }
    },
    [branch, canManageBranches, editForm, loadDetail, patchBranchOption, refreshBranchContext],
  )

  if (isLoading) {
    return <LoadingScreen message="Loading branch detail..." />
  }

  if (!Number.isFinite(branchId)) {
    return (
      <ProtectedRoute>
        <div className="p-6 lg:p-8">
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold">Invalid branch id.</p>
            <Link href="/dashboard/branches" className="btn-secondary mt-4 inline-flex">Back to branches</Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (loadError || !branch) {
    return (
      <ProtectedRoute>
        <div className="p-6 lg:p-8">
          <div className="glass-panel rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold">{loadError || 'Branch detail unavailable.'}</p>
            <button onClick={() => void loadDetail(false)} className="btn-primary mt-4">Retry</button>
            <div className="mt-3">
              <Link href="/dashboard/branches" className="text-sm text-primary hover:underline">Back to branches</Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-6 lg:p-8 space-y-6">
        <section className="glass-panel-strong rounded-3xl p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/branches')}
                  className="h-10 w-10 rounded-xl glass-chip inline-flex items-center justify-center"
                  aria-label="Back to branches"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Building2 className="h-7 w-7 text-primary" />
                    {branch.name}
                  </h1>
                  <p className="text-text-secondary mt-1">
                    Deep branch operations view: staff, groups, finance, and growth trend.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary">
                  Current scope: {activeBranchLabel}
                </span>
                <span className="glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary">
                  Accessible branches: {accessibleBranches.length}
                </span>
                {branchHasCoordinates ? (
                  <span className="rounded-xl border border-success/40 bg-success/15 text-success px-3 py-1.5 text-xs font-semibold">
                    Geo mapped
                  </span>
                ) : (
                  <span className="rounded-xl border border-warning/40 bg-warning/15 text-warning px-3 py-1.5 text-xs font-semibold">
                    Coordinates missing
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeBranchId !== branchId && (
                <button
                  type="button"
                  onClick={() => void setActiveBranch(branchId)}
                  disabled={isSwitching}
                  className="glass-chip rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                >
                  {isSwitching ? 'Switching...' : 'Switch scope to this branch'}
                </button>
              )}

              {canManageBranches && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="glass-chip rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary inline-flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit branch
                </button>
              )}

              <button
                type="button"
                onClick={() => void loadDetail(true)}
                className="glass-chip rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>

              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open map
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Groups</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalGroups}</p>
            <p className="mt-1 text-xs text-text-secondary">{summary.activeGroups} active</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Staff in classes</p>
            <p className="mt-2 text-2xl font-semibold">{staff.length}</p>
            <p className="mt-1 text-xs text-text-secondary">Main + assistant teachers</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Student seats</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalStudents}</p>
            <p className="mt-1 text-xs text-text-secondary">Across grouped rosters</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Revenue total</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrencyFromMinor(summary.totalRevenueTiyin)}</p>
            <p className="mt-1 text-xs text-text-secondary">Paid records only</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Revenue trend</p>
            <p className="mt-2 text-2xl font-semibold">{summary.growthPercent >= 0 ? '+' : ''}{summary.growthPercent}%</p>
            <p className="mt-1 text-xs text-text-secondary">vs previous month</p>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-2 inline-flex flex-wrap gap-1.5 w-fit">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'staff', label: 'Staff' },
            { id: 'groups', label: 'Groups' },
            { id: 'finance', label: 'Finance' },
          ] as Array<{ id: DetailTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'glass-chip text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {activeTab === 'overview' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Growth trend
              </h2>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">Revenue by month</p>
                <select
                  value={trendWindow}
                  onChange={(event) => setTrendWindow(event.target.value as TrendWindow)}
                  className="glass-input rounded-xl px-3 py-2 text-sm"
                >
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {trendData.map((point) => (
                  <div key={point.monthKey}>
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                      <span>{point.label}</span>
                      <span>{formatCurrencyFromMinor(point.revenueTiyin)} • {point.paidCount} paid</span>
                    </div>
                    <div className="h-2 rounded-full bg-background/70 border border-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/80 to-cyan-400/80"
                        style={{ width: `${Math.max(6, Math.round((point.revenueTiyin / maxTrendRevenue) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserSquare2 className="h-5 w-5 text-primary" />
                Top staff load
              </h2>

              {topStaff.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-text-secondary text-center">
                  No staff activity yet for this branch.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {topStaff.map((member) => (
                    <div key={member.id} className="glass-chip rounded-xl p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{member.fullName}</p>
                        <p className="text-xs text-text-secondary">
                          {member.mainGroups} main / {member.assistantGroups} assistant groups
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{member.studentLoad} students</p>
                        <p className="text-xs text-text-secondary">{member.activeGroups} active groups</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'staff' && (
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Staff list (group-linked)
            </h2>

            {staff.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
                No teacher assignments found for this branch yet.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="py-2 pr-4">Teacher</th>
                      <th className="py-2 pr-4">Contact</th>
                      <th className="py-2 pr-4">Group role split</th>
                      <th className="py-2 pr-4">Student load</th>
                      <th className="py-2">Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id} className="border-b border-border/60">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{member.fullName}</div>
                          <div className="text-xs text-text-secondary">{member.isActive ? 'Active account' : 'Inactive account'}</div>
                        </td>
                        <td className="py-3 pr-4 text-xs text-text-secondary">
                          <div>{member.email || '—'}</div>
                          <div>{member.phone || '—'}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="text-xs text-text-secondary">Main: {member.mainGroups}</div>
                          <div className="text-xs text-text-secondary">Assistant: {member.assistantGroups}</div>
                        </td>
                        <td className="py-3 pr-4 font-medium">{member.studentLoad}</td>
                        <td className="py-3 text-xs text-text-secondary">
                          {member.lastLogin ? new Date(member.lastLogin).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'groups' && (
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Groups in this branch
              </h2>
              <input
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Search groups, course, room, teacher"
                className="glass-input rounded-xl px-3 py-2 text-sm w-full sm:w-80"
              />
            </div>

            {filteredGroups.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
                No groups match this filter.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredGroups.map((group) => {
                  const studentCount = toNumber(group.student_count)
                  const studentTotal = studentCount !== null
                    ? Math.max(0, Math.round(studentCount))
                    : Array.isArray(group.students)
                      ? group.students.length
                      : 0

                  return (
                    <article key={group.id} className="glass-chip rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{group.name || `Group #${group.id}`}</h3>
                          <p className="text-xs text-text-secondary mt-1">{group.course_name || 'Course not assigned'}</p>
                        </div>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            isGroupActive(group)
                              ? 'border border-success/40 bg-success/15 text-success'
                              : 'border border-warning/40 bg-warning/15 text-warning'
                          }`}
                        >
                          {isGroupActive(group) ? 'Active' : 'Completed'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-text-secondary">
                        <p className="flex items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatSchedule(group)}
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          {studentTotal} students
                        </p>
                        <p className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          Room: {group.room_name || 'Not assigned'}
                        </p>
                        <p>Main teacher: {group.main_teacher_name || 'Not assigned'}</p>
                        <p>Assistant: {group.assistant_teacher_name || 'Not assigned'}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'finance' && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="glass-panel rounded-2xl p-5 xl:col-span-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Finance snapshot
              </h2>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="glass-chip rounded-xl p-3">
                  <p className="text-xs text-text-secondary">Collected (paid)</p>
                  <p className="mt-1 font-semibold">{formatCurrencyFromMinor(summary.totalRevenueTiyin)}</p>
                </div>
                <div className="glass-chip rounded-xl p-3">
                  <p className="text-xs text-text-secondary">Pending</p>
                  <p className="mt-1 font-semibold">{formatCurrencyFromMinor(summary.pendingRevenueTiyin)}</p>
                </div>
                <div className="glass-chip rounded-xl p-3">
                  <p className="text-xs text-text-secondary">This month</p>
                  <p className="mt-1 font-semibold">{formatCurrencyFromMinor(summary.thisMonthRevenueTiyin)}</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="py-2 pr-4">Payment id</th>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 15).map((payment) => {
                      const status = payment.status || 'pending'
                      const statusTone =
                        status === 'paid'
                          ? 'text-success'
                          : status === 'failed'
                            ? 'text-error'
                            : 'text-warning'

                      return (
                        <tr key={payment.id} className="border-b border-border/60">
                          <td className="py-3 pr-4 font-medium">#{payment.id}</td>
                          <td className="py-3 pr-4 text-text-secondary text-xs">
                            {payment.date
                              ? new Date(payment.date).toLocaleDateString()
                              : payment.created_at
                                ? new Date(payment.created_at).toLocaleDateString()
                                : '—'}
                          </td>
                          <td className={`py-3 pr-4 text-xs font-semibold ${statusTone}`}>{status}</td>
                          <td className="py-3 font-medium">{formatCurrencyFromMinor(resolveMinorAmount(payment))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-primary" />
                Branch coordinates
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="glass-chip rounded-xl p-3">
                  <p className="text-xs text-text-secondary">Latitude</p>
                  <p className="mt-1 font-medium">{branch.latitude || 'Not set'}</p>
                </div>
                <div className="glass-chip rounded-xl p-3">
                  <p className="text-xs text-text-secondary">Longitude</p>
                  <p className="mt-1 font-medium">{branch.longitude || 'Not set'}</p>
                </div>
                {canManageBranches && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="glass-chip w-full rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary inline-flex items-center justify-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit coordinates
                  </button>
                )}
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary w-full inline-flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    Open in maps
                  </a>
                ) : (
                  <p className="text-xs text-text-secondary">
                    Add coordinates in branch edit form to enable maps.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl glass-panel-strong rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Edit branch</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl glass-chip text-text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBranchEdit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Branch name *</label>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="glass-input w-full rounded-xl px-3 py-2.5"
                  placeholder="Downtown Campus"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Latitude</label>
                  <input
                    value={editForm.latitude}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, latitude: event.target.value }))}
                    className="glass-input w-full rounded-xl px-3 py-2.5"
                    placeholder="41.2995"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Longitude</label>
                  <input
                    value={editForm.longitude}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, longitude: event.target.value }))}
                    className="glass-input w-full rounded-xl px-3 py-2.5"
                    placeholder="69.2401"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-3 text-xs text-text-secondary">
                Tip: keeping accurate coordinates improves maps, routing, and branch analytics quality.
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={closeEditModal} className="btn-secondary flex-1" disabled={isSavingEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={isSavingEdit}>
                  {isSavingEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

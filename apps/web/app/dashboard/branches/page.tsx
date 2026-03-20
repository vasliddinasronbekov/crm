'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Edit3,
  Globe2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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

type BranchSort = 'name' | 'groups' | 'revenue' | 'health'
type GeoFilter = 'all' | 'mapped' | 'unmapped'

interface BranchRecord {
  id: number
  name: string
  latitude?: string | null
  longitude?: string | null
}

interface GroupRecord {
  id: number
  branch?: number | { id?: number; name?: string } | null
  branch_name?: string
  student_count?: number | null
  students?: unknown[]
  is_active?: boolean
  start_day?: string | null
  end_day?: string | null
  main_teacher?: number | { id?: number } | null
  assistant_teacher?: number | { id?: number } | null
}

interface PaymentRecord {
  id: number
  group?: number | { id?: number } | null
  branch_name?: string
  amount?: number | string | null
  amount_tiyin?: number | string | null
  date?: string | null
  created_at?: string | null
}

interface BranchAnalyticsRow {
  branch: BranchRecord
  hasCoordinates: boolean
  groupCount: number
  activeGroupCount: number
  unassignedGroupCount: number
  studentCount: number
  paymentCount: number
  revenueTiyin: number
  monthRevenueTiyin: number
  healthScore: number
}

interface BranchFormState {
  name: string
  latitude: string
  longitude: string
}

const BRANCH_SEARCH_STORAGE_KEY = 'dashboard.branches.search'
const BRANCH_SORT_STORAGE_KEY = 'dashboard.branches.sort'
const BRANCH_GEO_FILTER_STORAGE_KEY = 'dashboard.branches.geo_filter'

const DEFAULT_BRANCH_FORM: BranchFormState = {
  name: '',
  latitude: '',
  longitude: '',
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseListPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[]
  }
  if (payload && typeof payload === 'object') {
    const maybeResults = (payload as { results?: unknown }).results
    if (Array.isArray(maybeResults)) {
      return maybeResults as T[]
    }
  }
  return []
}

const getScopedStorageKey = (baseKey: string, userId: number, branchId: number | null): string => {
  const branchScope = branchId ?? 'all'
  return `${baseKey}:u${userId}:b${branchScope}`
}

const hasCoordinates = (branch: BranchRecord): boolean => {
  return Boolean(String(branch.latitude || '').trim() && String(branch.longitude || '').trim())
}

const normalizeBranchName = (value: string | null | undefined): string => {
  return String(value || '').trim().toLowerCase()
}

const readRelatedId = (value: unknown): number | null => {
  if (value && typeof value === 'object') {
    return toNumber((value as { id?: unknown }).id)
  }
  return toNumber(value)
}

const resolveBranchIdFromGroup = (group: GroupRecord): number | null => {
  return readRelatedId(group.branch)
}

const resolveGroupIdFromPayment = (payment: PaymentRecord): number | null => {
  return readRelatedId(payment.group)
}

const resolvePaymentMinorAmount = (payment: PaymentRecord): number => {
  const explicitMinor = toNumber(payment.amount_tiyin)
  if (explicitMinor !== null) {
    return Math.round(explicitMinor)
  }

  const fallbackAmount = toNumber(payment.amount)
  if (fallbackAmount !== null) {
    return Math.round(fallbackAmount)
  }

  return 0
}

const monthKeyFromDate = (value?: string | null): string | null => {
  if (!value) return null
  const normalized = value.includes('T') ? value.split('T')[0] : value
  if (normalized.length < 7) return null
  return normalized.slice(0, 7)
}

const validateCoordinate = (value: string, min: number, max: number): string | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return `Value must be between ${min} and ${max}`
  }
  return null
}

export default function BranchesPage() {
  const { user } = useAuth()
  const { formatCurrencyFromMinor } = useSettings()
  const {
    branches: accessibleBranches,
    activeBranchId,
    isGlobalScope,
    refreshBranchContext,
  } = useBranchContext()

  const canManageBranches = Boolean(user?.is_staff || user?.is_superuser)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [branchRecords, setBranchRecords] = useState<BranchRecord[]>([])
  const [groupRecords, setGroupRecords] = useState<GroupRecord[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<BranchSort>('health')
  const [geoFilter, setGeoFilter] = useState<GeoFilter>('all')
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null)
  const [formState, setFormState] = useState<BranchFormState>(DEFAULT_BRANCH_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const persistedUserId = useMemo(() => {
    const parsed = Number(user?.id)
    return Number.isFinite(parsed) ? parsed : null
  }, [user?.id])

  const scopedStorageKeys = useMemo(() => {
    if (persistedUserId === null) {
      return null
    }

    return {
      search: getScopedStorageKey(BRANCH_SEARCH_STORAGE_KEY, persistedUserId, activeBranchId),
      sort: getScopedStorageKey(BRANCH_SORT_STORAGE_KEY, persistedUserId, activeBranchId),
      geoFilter: getScopedStorageKey(BRANCH_GEO_FILTER_STORAGE_KEY, persistedUserId, activeBranchId),
    }
  }, [activeBranchId, persistedUserId])

  useEffect(() => {
    if (!scopedStorageKeys) {
      setHasLoadedPrefs(true)
      return
    }

    setHasLoadedPrefs(false)

    try {
      setSearchQuery(localStorage.getItem(scopedStorageKeys.search) || '')

      const storedSort = localStorage.getItem(scopedStorageKeys.sort)
      if (storedSort && ['name', 'groups', 'revenue', 'health'].includes(storedSort)) {
        setSortBy(storedSort as BranchSort)
      } else {
        setSortBy('health')
      }

      const storedGeoFilter = localStorage.getItem(scopedStorageKeys.geoFilter)
      if (storedGeoFilter && ['all', 'mapped', 'unmapped'].includes(storedGeoFilter)) {
        setGeoFilter(storedGeoFilter as GeoFilter)
      } else {
        setGeoFilter('all')
      }
    } catch {
      // Ignore storage access issues and keep defaults.
    } finally {
      setHasLoadedPrefs(true)
    }
  }, [scopedStorageKeys])

  useEffect(() => {
    if (!scopedStorageKeys || !hasLoadedPrefs) return

    try {
      localStorage.setItem(scopedStorageKeys.search, searchQuery)
      localStorage.setItem(scopedStorageKeys.sort, sortBy)
      localStorage.setItem(scopedStorageKeys.geoFilter, geoFilter)
    } catch {
      // Ignore storage write failures.
    }
  }, [geoFilter, hasLoadedPrefs, scopedStorageKeys, searchQuery, sortBy])

  const fetchAllPages = useCallback(async <T,>(fetchPage: (page: number) => Promise<unknown>, maxPages: number): Promise<T[]> => {
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

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        if (!canManageBranches) {
          setBranchRecords(accessibleBranches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            latitude: null,
            longitude: null,
          })))
          setGroupRecords([])
          setPaymentRecords([])
          return
        }

        const [branchesResult, groupsResult, paymentsResult] = await Promise.allSettled([
          fetchAllPages<BranchRecord>((page) => apiService.getBranches({ page, limit: 100 }), 5),
          fetchAllPages<GroupRecord>((page) => apiService.getGroups({ page, limit: 100 }), 25),
          fetchAllPages<PaymentRecord>((page) => apiService.getPayments({ page, limit: 100 }), 25),
        ])

        if (branchesResult.status === 'rejected') {
          throw branchesResult.reason
        }

        if (groupsResult.status === 'rejected') {
          console.error('Failed to load branch group analytics:', groupsResult.reason)
          toast.error('Could not load full groups analytics. Branch metrics may be partial.')
        }

        if (paymentsResult.status === 'rejected') {
          console.error('Failed to load branch payment analytics:', paymentsResult.reason)
          toast.error('Could not load full payment analytics. Revenue metrics may be partial.')
        }

        setBranchRecords(branchesResult.value)
        setGroupRecords(groupsResult.status === 'fulfilled' ? groupsResult.value : [])
        setPaymentRecords(paymentsResult.status === 'fulfilled' ? paymentsResult.value : [])
      } catch (error: unknown) {
        console.error('Failed to load branch management data:', error)
        toast.error('Failed to load branch management data')
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [accessibleBranches, canManageBranches, fetchAllPages],
  )

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const activeBranchLabel = useMemo(() => {
    if (activeBranchId === null) {
      return isGlobalScope ? 'All branches' : 'Assigned branch scope'
    }
    return accessibleBranches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`
  }, [activeBranchId, accessibleBranches, isGlobalScope])

  const analyticsRows = useMemo<BranchAnalyticsRow[]>(() => {
    const monthKey = new Date().toISOString().slice(0, 7)
    const today = new Date().toISOString().slice(0, 10)

    const rows = new Map<number, BranchAnalyticsRow>()
    const branchNameToId = new Map<string, number>()

    branchRecords.forEach((branch) => {
      rows.set(branch.id, {
        branch,
        hasCoordinates: hasCoordinates(branch),
        groupCount: 0,
        activeGroupCount: 0,
        unassignedGroupCount: 0,
        studentCount: 0,
        paymentCount: 0,
        revenueTiyin: 0,
        monthRevenueTiyin: 0,
        healthScore: 0,
      })
      branchNameToId.set(normalizeBranchName(branch.name), branch.id)
    })

    const groupToBranch = new Map<number, number>()

    groupRecords.forEach((group) => {
      const branchId = resolveBranchIdFromGroup(group)
      if (branchId === null) return
      const target = rows.get(branchId)
      if (!target) return

      target.groupCount += 1

      const explicitStudentCount = toNumber(group.student_count)
      const fallbackStudentCount = Array.isArray(group.students) ? group.students.length : 0
      target.studentCount += explicitStudentCount !== null ? Math.max(0, Math.round(explicitStudentCount)) : fallbackStudentCount

      const hasTeacher = Boolean(readRelatedId(group.main_teacher) || readRelatedId(group.assistant_teacher))
      if (!hasTeacher) {
        target.unassignedGroupCount += 1
      }

      const isGroupActive = group.is_active !== false && (!group.end_day || group.end_day >= today)
      if (isGroupActive) {
        target.activeGroupCount += 1
      }

      groupToBranch.set(group.id, branchId)
    })

    paymentRecords.forEach((payment) => {
      const linkedGroupId = resolveGroupIdFromPayment(payment)
      const branchIdFromGroup = linkedGroupId !== null ? groupToBranch.get(linkedGroupId) ?? null : null
      const branchIdFromName = branchNameToId.get(normalizeBranchName(payment.branch_name)) ?? null
      const branchId = branchIdFromGroup ?? branchIdFromName

      if (branchId === null) return
      const target = rows.get(branchId)
      if (!target) return

      const amountTiyin = resolvePaymentMinorAmount(payment)
      target.paymentCount += 1
      target.revenueTiyin += amountTiyin

      if (monthKeyFromDate(payment.date || payment.created_at) === monthKey) {
        target.monthRevenueTiyin += amountTiyin
      }
    })

    rows.forEach((row) => {
      const activeRatio = row.groupCount > 0 ? Math.round((row.activeGroupCount / row.groupCount) * 100) : 0
      const teacherPenalty = row.unassignedGroupCount > 0 ? Math.min(20, row.unassignedGroupCount * 6) : 0
      const geoBonus = row.hasCoordinates ? 8 : 0
      row.healthScore = Math.max(0, Math.min(100, activeRatio + geoBonus - teacherPenalty))
    })

    return Array.from(rows.values())
  }, [branchRecords, groupRecords, paymentRecords])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    const filtered = analyticsRows.filter((row) => {
      if (geoFilter === 'mapped' && !row.hasCoordinates) return false
      if (geoFilter === 'unmapped' && row.hasCoordinates) return false

      if (!normalizedSearch) return true

      const haystack = [
        row.branch.name,
        row.branch.latitude || '',
        row.branch.longitude || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    filtered.sort((left, right) => {
      if (sortBy === 'name') {
        return left.branch.name.localeCompare(right.branch.name)
      }
      if (sortBy === 'groups') {
        return right.groupCount - left.groupCount
      }
      if (sortBy === 'revenue') {
        return right.monthRevenueTiyin - left.monthRevenueTiyin
      }
      return right.healthScore - left.healthScore
    })

    return filtered
  }, [analyticsRows, geoFilter, searchQuery, sortBy])

  const summary = useMemo(() => {
    const totalBranches = analyticsRows.length
    const mappedBranches = analyticsRows.filter((row) => row.hasCoordinates).length
    const totalGroups = analyticsRows.reduce((sum, row) => sum + row.groupCount, 0)
    const totalStudents = analyticsRows.reduce((sum, row) => sum + row.studentCount, 0)
    const monthRevenueTiyin = analyticsRows.reduce((sum, row) => sum + row.monthRevenueTiyin, 0)

    return {
      totalBranches,
      mappedBranches,
      totalGroups,
      totalStudents,
      monthRevenueTiyin,
    }
  }, [analyticsRows])

  const resetModalState = () => {
    setEditingBranch(null)
    setFormState(DEFAULT_BRANCH_FORM)
    setShowModal(false)
    setIsSaving(false)
  }

  const openCreateModal = () => {
    setEditingBranch(null)
    setFormState(DEFAULT_BRANCH_FORM)
    setShowModal(true)
  }

  const openEditModal = (branch: BranchRecord) => {
    setEditingBranch(branch)
    setFormState({
      name: branch.name || '',
      latitude: branch.latitude || '',
      longitude: branch.longitude || '',
    })
    setShowModal(true)
  }

  const validateForm = (): string | null => {
    if (!formState.name.trim()) {
      return 'Branch name is required.'
    }

    const latitudeError = validateCoordinate(formState.latitude, -90, 90)
    if (latitudeError) {
      return `Latitude: ${latitudeError}`
    }

    const longitudeError = validateCoordinate(formState.longitude, -180, 180)
    if (longitudeError) {
      return `Longitude: ${longitudeError}`
    }

    return null
  }

  const buildBranchPayload = () => ({
    name: formState.name.trim(),
    latitude: formState.latitude.trim() || null,
    longitude: formState.longitude.trim() || null,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageBranches) {
      toast.error('You do not have permission to modify branches.')
      return
    }

    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setIsSaving(true)

    try {
      const payload = buildBranchPayload()

      if (editingBranch) {
        await apiService.updateBranch(editingBranch.id, payload)
        toast.success('Branch updated successfully.')
      } else {
        await apiService.createBranch(payload)
        toast.success('Branch created successfully.')
      }

      resetModalState()
      await Promise.allSettled([loadData(true), refreshBranchContext()])
    } catch (error: any) {
      console.error('Failed to save branch:', error)
      const message = error?.response?.data?.detail || 'Failed to save branch.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (branch: BranchRecord) => {
    if (!canManageBranches) {
      toast.error('You do not have permission to delete branches.')
      return
    }

    const confirmed = window.confirm(`Delete branch "${branch.name}"? This cannot be undone.`)
    if (!confirmed) {
      return
    }

    try {
      await apiService.deleteBranch(branch.id)
      toast.success('Branch deleted successfully.')
      await Promise.allSettled([loadData(true), refreshBranchContext()])
    } catch (error: any) {
      console.error('Failed to delete branch:', error)
      const message = error?.response?.data?.detail || 'Failed to delete branch.'
      toast.error(message)
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading branch management..." />
  }

  return (
    <ProtectedRoute>
      <div className="p-6 lg:p-8 space-y-6">
        <section className="glass-panel-strong rounded-3xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                Branch Management Center
              </h1>
              <p className="mt-2 text-text-secondary">
                Create, update, and monitor branch operations from one control panel.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary">
                  Scope: {activeBranchLabel}
                </span>
                <span className="glass-chip rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary">
                  Accessible branches: {accessibleBranches.length}
                </span>
                <span
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                    canManageBranches
                      ? 'border border-success/40 bg-success/15 text-success'
                      : 'border border-warning/40 bg-warning/15 text-warning'
                  }`}
                >
                  {canManageBranches ? 'Management mode' : 'Read-only mode'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void loadData(true)}
                className="glass-chip rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                disabled={isRefreshing}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </span>
              </button>
              {canManageBranches && (
                <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Branch
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Branches</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalBranches}</p>
            <p className="mt-1 text-xs text-text-secondary">Total managed locations</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Mapped branches</p>
            <p className="mt-2 text-2xl font-semibold">{summary.mappedBranches}</p>
            <p className="mt-1 text-xs text-text-secondary">Geo-ready for map views</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Groups</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalGroups}</p>
            <p className="mt-1 text-xs text-text-secondary">Active + planned classes</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Student seats</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalStudents}</p>
            <p className="mt-1 text-xs text-text-secondary">From current group rosters</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Revenue (month)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrencyFromMinor(summary.monthRevenueTiyin)}</p>
            <p className="mt-1 text-xs text-text-secondary">Payments tied to branch groups</p>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-6 relative">
              <Search className="h-4 w-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search branch by name or coordinates"
                className="glass-input w-full rounded-xl pl-10 pr-3 py-2.5"
              />
            </div>

            <div className="lg:col-span-3">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as BranchSort)}
                className="glass-input w-full rounded-xl px-3 py-2.5"
              >
                <option value="health">Sort by health score</option>
                <option value="revenue">Sort by month revenue</option>
                <option value="groups">Sort by groups</option>
                <option value="name">Sort by name</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <select
                value={geoFilter}
                onChange={(event) => setGeoFilter(event.target.value as GeoFilter)}
                className="glass-input w-full rounded-xl px-3 py-2.5"
              >
                <option value="all">All branches</option>
                <option value="mapped">Only mapped branches</option>
                <option value="unmapped">Only unmapped branches</option>
              </select>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredRows.map((row) => {
            const mapUrl = row.hasCoordinates
              ? `https://maps.google.com/?q=${encodeURIComponent(`${row.branch.latitude},${row.branch.longitude}`)}`
              : null

            return (
              <article key={row.branch.id} className="glass-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{row.branch.name}</h2>
                    <p className="text-sm text-text-secondary mt-1">Branch #{row.branch.id}</p>
                  </div>
                  <div
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                      row.healthScore >= 75
                        ? 'border border-success/40 bg-success/15 text-success'
                        : row.healthScore >= 45
                          ? 'border border-warning/40 bg-warning/15 text-warning'
                          : 'border border-error/40 bg-error/15 text-error'
                    }`}
                  >
                    Health {row.healthScore}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="glass-chip rounded-xl p-3">
                    <p className="text-text-secondary text-xs">Groups</p>
                    <p className="mt-1 font-semibold">{row.groupCount}</p>
                  </div>
                  <div className="glass-chip rounded-xl p-3">
                    <p className="text-text-secondary text-xs">Students</p>
                    <p className="mt-1 font-semibold">{row.studentCount}</p>
                  </div>
                  <div className="glass-chip rounded-xl p-3">
                    <p className="text-text-secondary text-xs">Month revenue</p>
                    <p className="mt-1 font-semibold">{formatCurrencyFromMinor(row.monthRevenueTiyin)}</p>
                  </div>
                  <div className="glass-chip rounded-xl p-3">
                    <p className="text-text-secondary text-xs">Unassigned groups</p>
                    <p className="mt-1 font-semibold">{row.unassignedGroupCount}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 border border-border">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {row.activeGroupCount} active groups
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 border border-border">
                    <Users className="h-3.5 w-3.5" />
                    {row.paymentCount} payments tracked
                  </span>
                  {row.hasCoordinates ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 border border-border text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Geo mapped
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 border border-border text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Missing coordinates
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/branches/${row.branch.id}`}
                    className="glass-chip rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary inline-flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Details
                  </Link>

                  {mapUrl ? (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-chip rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary inline-flex items-center gap-2"
                    >
                      <Globe2 className="h-4 w-4" />
                      Open map
                    </a>
                  ) : (
                    <div className="glass-chip rounded-xl px-3 py-2 text-sm text-text-secondary inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Add coordinates to map this branch
                    </div>
                  )}

                  {canManageBranches && (
                    <>
                      <button
                        onClick={() => openEditModal(row.branch)}
                        className="glass-chip rounded-xl px-3 py-2 text-sm font-medium text-primary inline-flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(row.branch)}
                        className="rounded-xl px-3 py-2 text-sm font-medium border border-error/40 bg-error/10 text-error inline-flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        {filteredRows.length === 0 && (
          <section className="glass-panel rounded-2xl p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-text-secondary mb-3" />
            <h3 className="text-lg font-semibold">No branches match this filter</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {searchQuery
                ? `No branch matches "${searchQuery}" in ${activeBranchLabel}.`
                : `No branches available in ${activeBranchLabel}.`}
            </p>
          </section>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl glass-panel-strong rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingBranch ? 'Edit branch' : 'Create branch'}
              </h2>
              <button
                onClick={resetModalState}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl glass-chip text-text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Branch name *</label>
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="glass-input w-full rounded-xl px-3 py-2.5"
                  placeholder="Downtown Campus"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Latitude</label>
                  <input
                    value={formState.latitude}
                    onChange={(event) => setFormState((prev) => ({ ...prev, latitude: event.target.value }))}
                    className="glass-input w-full rounded-xl px-3 py-2.5"
                    placeholder="41.2995"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Longitude</label>
                  <input
                    value={formState.longitude}
                    onChange={(event) => setFormState((prev) => ({ ...prev, longitude: event.target.value }))}
                    className="glass-input w-full rounded-xl px-3 py-2.5"
                    placeholder="69.2401"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-3 text-xs text-text-secondary">
                Tip: Coordinates help branch analysis, map routing, and future geo-based dashboards.
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={resetModalState} className="btn-secondary flex-1" disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingBranch ? 'Save changes' : 'Create branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

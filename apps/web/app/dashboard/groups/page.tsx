'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Calendar,
  Clock,
  CalendarDays,
  AlertTriangle,
  Activity,
  LayoutGrid,
  Rows3,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import toast from '@/lib/toast'
import apiService from '@/lib/api'
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useOngoingGroups, Group } from '@/lib/hooks/useGroups'
import { useCourses, Course } from '@/lib/hooks/useCourses'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { normalizeDayToken, parseGroupDays, type WeekDay } from '@/lib/utils/schedule'
import LoadingScreen from '@/components/LoadingScreen'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

type SearchStatus = 'all' | 'scheduled' | 'unscheduled'
type GroupFocusFilter = 'all' | 'ongoing' | 'capacity' | 'unscheduled' | 'conflicts'
type GroupsViewMode = 'cards' | 'table'

interface ParsedGroupSearch {
  text: string
  course: string
  teacher: string
  room: string
  day: WeekDay | null
  status: SearchStatus
}

interface GroupScheduleHealth {
  total_groups: number
  scheduled_groups: number
  unscheduled_groups: number
  teacher_conflicts: number
  room_conflicts: number
  capacity_near_full_groups: number
  capacity_overflow_groups: number
  top_conflicts?: Array<{
    type: string
    day: string
    time: string
    resource?: string | null
    groups?: Array<{ id: number; name: string }>
  }>
}

const PAGE_SIZE = 9

const createEmptyGroupForm = () => ({
  name: '',
  course: '',
  days: '',
  start_time: '09:00',
  end_time: '11:00',
  start_day: '',
  end_day: '',
})

const parseStructuredGroupSearch = (rawQuery: string): ParsedGroupSearch => {
  const parsed: ParsedGroupSearch = {
    text: '',
    course: '',
    teacher: '',
    room: '',
    day: null,
    status: 'all',
  }

  const textTokens: string[] = []

  rawQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      const separatorIndex = token.indexOf(':')
      if (separatorIndex < 0) {
        const normalized = token.toLowerCase()
        if (normalized === 'scheduled' || normalized === 'unscheduled') {
          parsed.status = normalized
          return
        }
        textTokens.push(token)
        return
      }

      const key = token.slice(0, separatorIndex).toLowerCase()
      const value = token.slice(separatorIndex + 1).trim().toLowerCase()
      if (!value) return

      if (key === 'course' || key === 'c') {
        parsed.course = value
        return
      }
      if (key === 'teacher' || key === 't') {
        parsed.teacher = value
        return
      }
      if (key === 'room' || key === 'r') {
        parsed.room = value
        return
      }
      if (key === 'day' || key === 'd') {
        parsed.day = normalizeDayToken(value)
        return
      }
      if (key === 'status' || key === 's') {
        if (value.startsWith('sched')) parsed.status = 'scheduled'
        if (value.startsWith('unsched')) parsed.status = 'unscheduled'
        return
      }

      textTokens.push(token)
    })

  parsed.text = textTokens.join(' ').trim().toLowerCase()
  return parsed
}

export default function GroupsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateGroup = permissionState.hasPermission('groups.create')
  const canEditGroup = permissionState.hasPermission('groups.edit')
  const canDeleteGroup = permissionState.hasPermission('groups.delete')
  const canManageGroups = canCreateGroup || canEditGroup || canDeleteGroup

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const parsedSearch = useMemo(
    () => parseStructuredGroupSearch(debouncedSearchQuery),
    [debouncedSearchQuery],
  )

  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'students_desc' | 'schedule' | 'risk'>('name')
  const [focusFilter, setFocusFilter] = useState<GroupFocusFilter>('all')
  const [viewMode, setViewMode] = useState<GroupsViewMode>('table')
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [newGroup, setNewGroup] = useState(createEmptyGroupForm)

  const hasStructuredFilters = useMemo(
    () =>
      Boolean(
        parsedSearch.course ||
          parsedSearch.teacher ||
          parsedSearch.room ||
          parsedSearch.day ||
          parsedSearch.status !== 'all',
      ),
    [parsedSearch],
  )

  const requiresClientWindow = hasStructuredFilters || focusFilter !== 'all'

  const groupsQueryParams = useMemo(
    () => ({
      page: requiresClientWindow ? 1 : page,
      limit: requiresClientWindow ? 1000 : PAGE_SIZE,
      search: parsedSearch.text || undefined,
    }),
    [page, parsedSearch.text, requiresClientWindow],
  )

  const { data: groupsData, isLoading } = useGroups(groupsQueryParams)
  const rawGroups = useMemo(() => groupsData?.results || [], [groupsData?.results])

  const { data: scheduleHealthData } = useQuery<GroupScheduleHealth>({
    queryKey: ['groups', 'schedule-health'],
    queryFn: () => apiService.getGroupScheduleHealth(),
    staleTime: 60 * 1000,
    enabled: Boolean(user),
  })
  const { data: ongoingGroupsData } = useOngoingGroups({
    enabled: Boolean(user),
    refetchIntervalMs: 60_000,
  })

  const { data: coursesData } = useCourses()
  const courses = useMemo(() => coursesData?.results || [], [coursesData?.results])

  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const filteredGroups = useMemo(() => {
    return rawGroups.filter((group: Group) => {
      const teacherName =
        `${group.main_teacher?.first_name || ''} ${group.main_teacher?.last_name || ''}`.trim().toLowerCase()
      const normalizedDays = parseGroupDays(group.days)
      const hasSchedule = normalizedDays.length > 0

      const matchesCourse =
        !parsedSearch.course || (group.course?.name || '').toLowerCase().includes(parsedSearch.course)
      const matchesTeacher =
        !parsedSearch.teacher ||
        teacherName.includes(parsedSearch.teacher) ||
        (group.main_teacher?.username || '').toLowerCase().includes(parsedSearch.teacher)
      const matchesRoom =
        !parsedSearch.room || (group.room?.name || '').toLowerCase().includes(parsedSearch.room)
      const matchesDay = !parsedSearch.day || normalizedDays.includes(parsedSearch.day)
      const matchesStatus =
        parsedSearch.status === 'all' ||
        (parsedSearch.status === 'scheduled' && hasSchedule) ||
        (parsedSearch.status === 'unscheduled' && !hasSchedule)

      return matchesCourse && matchesTeacher && matchesRoom && matchesDay && matchesStatus
    })
  }, [rawGroups, parsedSearch])

  const sortedGroups = useMemo(() => {
    const rows = [...filteredGroups]
    if (sortBy === 'students_desc') {
      rows.sort((a, b) => (b.students?.length || 0) - (a.students?.length || 0))
      return rows
    }
    if (sortBy === 'schedule') {
      rows.sort((a, b) => {
        const aSchedule = `${a.start_time || '99:99'}-${a.end_time || '99:99'}`
        const bSchedule = `${b.start_time || '99:99'}-${b.end_time || '99:99'}`
        return aSchedule.localeCompare(bSchedule)
      })
      return rows
    }
    if (sortBy === 'risk') {
      rows.sort((a, b) => {
        const aCapacity = a.room?.capacity || 0
        const bCapacity = b.room?.capacity || 0
        const aRatio = aCapacity > 0 ? (a.students?.length || 0) / aCapacity : 0
        const bRatio = bCapacity > 0 ? (b.students?.length || 0) / bCapacity : 0
        return bRatio - aRatio
      })
      return rows
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [filteredGroups, sortBy])

  const ongoingGroups = useMemo(
    () => ongoingGroupsData?.results || [],
    [ongoingGroupsData?.results],
  )
  const ongoingGroupIdSet = useMemo(
    () => new Set(ongoingGroups.map((group) => Number(group.id))),
    [ongoingGroups],
  )
  const topConflicts = useMemo(
    () => scheduleHealthData?.top_conflicts || [],
    [scheduleHealthData?.top_conflicts],
  )
  const conflictGroupIdSet = useMemo(() => {
    const ids = new Set<number>()
    topConflicts.forEach((conflict) => {
      ;(conflict.groups || []).forEach((group) => {
        if (group?.id) ids.add(Number(group.id))
      })
    })
    return ids
  }, [topConflicts])
  const capacityRiskCountClient = useMemo(
    () =>
      sortedGroups.filter((group) => {
        const roomCapacity = group.room?.capacity || 0
        if (roomCapacity <= 0) return false
        const studentCount = group.students?.length || 0
        return studentCount / roomCapacity >= 0.9
      }).length,
    [sortedGroups],
  )
  const unscheduledCountClient = useMemo(
    () => sortedGroups.filter((group) => parseGroupDays(group.days).length === 0).length,
    [sortedGroups],
  )
  const focusFilteredGroups = useMemo(() => {
    if (focusFilter === 'all') return sortedGroups
    if (focusFilter === 'ongoing') {
      return sortedGroups.filter((group) => ongoingGroupIdSet.has(Number(group.id)))
    }
    if (focusFilter === 'capacity') {
      return sortedGroups.filter((group) => {
        const roomCapacity = group.room?.capacity || 0
        if (roomCapacity <= 0) return false
        const studentCount = group.students?.length || 0
        return studentCount / roomCapacity >= 0.9
      })
    }
    if (focusFilter === 'unscheduled') {
      return sortedGroups.filter((group) => parseGroupDays(group.days).length === 0)
    }
    if (focusFilter === 'conflicts') {
      return sortedGroups.filter((group) => conflictGroupIdSet.has(Number(group.id)))
    }
    return sortedGroups
  }, [conflictGroupIdSet, focusFilter, ongoingGroupIdSet, sortedGroups])
  const baseTotalGroups = hasStructuredFilters ? sortedGroups.length : groupsData?.count || 0
  const totalGroups = requiresClientWindow ? focusFilteredGroups.length : baseTotalGroups
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE))

  const visibleGroups = useMemo(() => {
    if (!requiresClientWindow) return focusFilteredGroups
    const start = (page - 1) * PAGE_SIZE
    return focusFilteredGroups.slice(start, start + PAGE_SIZE)
  }, [focusFilteredGroups, page, requiresClientWindow])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [focusFilter])

  const handleDelete = async (group: Group) => {
    if (!canDeleteGroup) {
      toast.error('You do not have permission to delete groups')
      return
    }
    if (!confirm(`Are you sure you want to delete group "${group.name}"?`)) {
      return
    }
    deleteGroup.mutate(group.id)
  }

  const handleSaveEdit = async () => {
    if (!canEditGroup) {
      toast.error('You do not have permission to edit groups')
      return
    }
    if (!editingGroup) return
    if (!editingGroup.course?.id) {
      toast.error('Cannot update group without course')
      return
    }

    updateGroup.mutate(
      {
        id: editingGroup.id,
        data: {
          name: editingGroup.name,
          days: editingGroup.days,
          start_time: editingGroup.start_time,
          end_time: editingGroup.end_time,
          course: editingGroup.course.id,
        },
      },
      {
        onSuccess: () => setEditingGroup(null),
      },
    )
  }

  const handleCreateGroup = async () => {
    if (!canCreateGroup) {
      toast.error('You do not have permission to create groups')
      return
    }
    if (!newGroup.name || !newGroup.course) {
      toast.warning('Please fill in all required fields')
      return
    }

    createGroup.mutate(newGroup, {
      onSuccess: () => {
        setIsCreatingGroup(false)
        setNewGroup(createEmptyGroupForm())
      },
    })
  }

  const studentsOnPage = visibleGroups.reduce((sum: number, group: Group) => sum + (group.students?.length || 0), 0)
  const averageStudents =
    visibleGroups.length > 0 ? Math.round(studentsOnPage / visibleGroups.length) : 0
  const scheduledGroups =
    scheduleHealthData?.scheduled_groups ||
    rawGroups.filter((group: Group) => parseGroupDays(group.days).length > 0).length
  const unscheduledGroups =
    scheduleHealthData?.unscheduled_groups ?? Math.max(0, totalGroups - scheduledGroups)
  const activeConflicts =
    (scheduleHealthData?.teacher_conflicts || 0) + (scheduleHealthData?.room_conflicts || 0)
  const capacityRiskGroups = scheduleHealthData
    ? (scheduleHealthData.capacity_near_full_groups || 0) + (scheduleHealthData.capacity_overflow_groups || 0)
    : capacityRiskCountClient

  const PaginationControls = () => (
    <div className="flex justify-center items-center gap-4 mt-8">
      <button
        onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
        disabled={page <= 1}
        className="btn-secondary"
      >
        Previous
      </button>
      <span className="text-text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => setPage((previous) => Math.min(previous + 1, totalPages))}
        disabled={page >= totalPages}
        className="btn-secondary"
      >
        Next
      </button>
    </div>
  )

  if (isLoading && !groupsData) {
    return (
      <ProtectedRoute>
        <LoadingScreen message="Loading groups..." />
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Groups Management
              </h1>
              <p className="text-text-secondary mt-1">
                Create, plan, and operate academic groups with conflict-aware scheduling.
              </p>
              {!canManageGroups && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Read-only mode: you can view groups but cannot create or modify them.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/dashboard/schedule')} className="btn-secondary flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                View Schedule
              </button>
              <button
                onClick={() => setIsCreatingGroup(true)}
                disabled={!canCreateGroup}
                title={!canCreateGroup ? 'You do not have permission to create groups' : undefined}
                className={`flex items-center gap-2 ${
                  canCreateGroup ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'
                }`}
              >
                <Plus className="h-5 w-5" />
                Create Group
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search... e.g. group-a course:ielts day:mon status:scheduled"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <p className="text-xs text-text-secondary mt-2">
              Inline filters: <code>course:</code> <code>teacher:</code> <code>room:</code> <code>day:</code> <code>status:</code>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-text-secondary">Sort by</label>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as 'name' | 'students_desc' | 'schedule' | 'risk')
                  setPage(1)
                }}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="name">Name (A-Z)</option>
                <option value="students_desc">Students (High-Low)</option>
                <option value="schedule">Schedule time</option>
                <option value="risk">Capacity risk</option>
              </select>

              <div className="ml-auto inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'table' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Rows3 className="h-3.5 w-3.5" />
                  Ops Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'cards' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All', count: baseTotalGroups },
                { key: 'ongoing', label: 'Live now', count: ongoingGroups.length },
                { key: 'capacity', label: 'Capacity risk', count: capacityRiskCountClient },
                { key: 'unscheduled', label: 'Unscheduled', count: unscheduledCountClient },
                { key: 'conflicts', label: 'Conflicts', count: conflictGroupIdSet.size },
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  type="button"
                  onClick={() => setFocusFilter(filterOption.key as GroupFocusFilter)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    focusFilter === filterOption.key
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {filterOption.label}
                  <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px]">
                    {filterOption.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-4">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">
                {hasStructuredFilters || focusFilter !== 'all' ? 'Filtered Groups' : 'Total Groups'}
              </p>
              <p className="text-3xl font-bold">{totalGroups}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Scheduled Groups</p>
              <p className="text-3xl font-bold">{scheduledGroups}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Unscheduled Groups</p>
              <p className="text-3xl font-bold">{unscheduledGroups}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Ongoing Now</p>
              <p className="text-3xl font-bold text-success">{ongoingGroups.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Active Conflicts</p>
              <p className={`text-3xl font-bold ${activeConflicts > 0 ? 'text-warning' : ''}`}>{activeConflicts}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Capacity Risk</p>
              <p className={`text-3xl font-bold ${capacityRiskGroups > 0 ? 'text-warning' : ''}`}>{capacityRiskGroups}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">Avg Students/Group</p>
              <p className="text-3xl font-bold">{averageStudents}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-surface/90 backdrop-blur-md border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-success" />
                  <h2 className="text-lg font-semibold">Ongoing Groups</h2>
                </div>
                <button
                  onClick={() => router.push('/dashboard/schedule')}
                  className="text-sm text-primary hover:underline"
                >
                  Open schedule
                </button>
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {ongoingGroups.length > 0 ? (
                  ongoingGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <p className="text-xs text-text-secondary mt-1">
                            {group.main_teacher_name || group.main_teacher?.username || 'No teacher'} •{' '}
                            {group.room?.name || 'No room'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                            Live
                          </span>
                          <p className="text-xs text-text-secondary mt-1">{group.minutes_until_end}m left</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-text-secondary">
                    No ongoing groups right now.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-4">Conflict Highlights</h2>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {topConflicts.length > 0 ? (
                  topConflicts.slice(0, 8).map((conflict, index) => (
                    <div
                      key={`${conflict.type}-${conflict.day}-${index}`}
                      className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                        {conflict.type} conflict
                      </p>
                      <p className="text-sm mt-1">
                        {(conflict.groups || []).map((group: { name: string }) => group.name).join(' vs ')}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {conflict.day} • {conflict.time}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background px-3 py-8 text-center text-sm text-text-secondary">
                    No schedule conflicts detected.
                  </div>
                )}
              </div>
            </div>
          </div>

          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleGroups.map((group: Group) => {
                const isOngoing = ongoingGroupIdSet.has(Number(group.id))
                const studentCount = group.students?.length || 0
                const roomCapacity = group.room?.capacity || 0
                const utilizationPercent = roomCapacity > 0 ? Math.round((studentCount / roomCapacity) * 100) : 0
                const isCapacityRisk = utilizationPercent >= 90
                const hasConflict = conflictGroupIdSet.has(Number(group.id))

                return (
                  <div key={group.id} className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">{group.name}</h3>
                        <p className="text-sm text-text-secondary">{group.course?.name || 'No Course'}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {isOngoing && (
                            <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                              Ongoing
                            </span>
                          )}
                          {isCapacityRisk && (
                            <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                              Capacity Risk
                            </span>
                          )}
                          {hasConflict && (
                            <span className="inline-flex items-center rounded-full bg-error/15 px-2 py-0.5 text-xs font-semibold text-error">
                              Conflict
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingGroup(group)}
                          disabled={!canEditGroup}
                          title={!canEditGroup ? 'You do not have permission to edit groups' : undefined}
                          className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit className="h-4 w-4 text-primary" />
                        </button>
                        <button
                          onClick={() => handleDelete(group)}
                          disabled={deleteGroup.isPending || !canDeleteGroup}
                          title={!canDeleteGroup ? 'You do not have permission to delete groups' : undefined}
                          className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Users className="h-4 w-4" />
                        <span>
                          {studentCount} students
                          {roomCapacity > 0 && ` • ${utilizationPercent}% of room`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Calendar className="h-4 w-4" />
                        <span>{group.days || 'Not scheduled'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Clock className="h-4 w-4" />
                        <span>
                          {group.start_time
                            ? `${group.start_time.slice(0, 5)} - ${group.end_time.slice(0, 5)}`
                            : 'No time set'}
                        </span>
                      </div>
                      {group.room && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <span>🚪</span>
                          <span>{group.room.name}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                      className="w-full btn-secondary text-sm py-2"
                    >
                      View Details →
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-background/80">
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                      <th className="text-left px-4 py-3">Group</th>
                      <th className="text-left px-4 py-3">Schedule</th>
                      <th className="text-left px-4 py-3">Teacher / Room</th>
                      <th className="text-left px-4 py-3">Students</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGroups.map((group: Group) => {
                      const studentCount = group.students?.length || 0
                      const roomCapacity = group.room?.capacity || 0
                      const utilizationPercent = roomCapacity > 0 ? Math.round((studentCount / roomCapacity) * 100) : 0
                      const isCapacityRisk = utilizationPercent >= 90
                      const isOngoing = ongoingGroupIdSet.has(Number(group.id))
                      const hasConflict = conflictGroupIdSet.has(Number(group.id))

                      return (
                        <tr key={group.id} className="border-b border-border/60 hover:bg-background/40 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                              className="text-left"
                            >
                              <p className="font-semibold hover:text-primary transition-colors">{group.name}</p>
                              <p className="text-xs text-text-secondary">{group.course?.name || 'No course'}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">{group.days || 'Not scheduled'}</p>
                            <p className="text-xs text-text-secondary">
                              {group.start_time ? `${group.start_time.slice(0, 5)} - ${group.end_time.slice(0, 5)}` : 'No time'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">
                              {group.main_teacher_name || group.main_teacher?.username || 'No teacher'}
                            </p>
                            <p className="text-xs text-text-secondary">{group.room?.name || 'No room'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium">{studentCount}</p>
                            <p className="text-xs text-text-secondary">
                              {roomCapacity > 0 ? `${utilizationPercent}% of ${roomCapacity}` : 'No room capacity'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {isOngoing && (
                                <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                                  Live
                                </span>
                              )}
                              {isCapacityRisk && (
                                <span className="inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                                  Capacity risk
                                </span>
                              )}
                              {hasConflict && (
                                <span className="inline-flex rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-semibold text-error">
                                  Conflict
                                </span>
                              )}
                              {!isOngoing && !isCapacityRisk && !hasConflict && (
                                <span className="inline-flex rounded-full bg-background px-2 py-0.5 text-[11px] text-text-secondary">
                                  Stable
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10"
                              >
                                Open
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingGroup(group)}
                                disabled={!canEditGroup}
                                title={!canEditGroup ? 'You do not have permission to edit groups' : undefined}
                                className="p-1.5 hover:bg-background rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit className="h-4 w-4 text-primary" />
                              </button>
                              <button
                                onClick={() => handleDelete(group)}
                                disabled={deleteGroup.isPending || !canDeleteGroup}
                                title={!canDeleteGroup ? 'You do not have permission to delete groups' : undefined}
                                className="p-1.5 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4 text-error" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {visibleGroups.length === 0 && (
            <div className="bg-surface border border-border rounded-2xl text-center py-12">
              <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-text-secondary" />
              <p className="text-text-secondary text-lg mb-2">No groups found</p>
              <p className="text-text-secondary text-sm">
                {searchQuery || focusFilter !== 'all'
                  ? 'Try adjusting search or operational filters'
                  : 'Create your first group to get started'}
              </p>
            </div>
          )}

          {totalGroups > PAGE_SIZE && <PaginationControls />}

      {isCreatingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-2xl font-semibold mb-4">Create New Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Group Name *</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="e.g., Group A, Morning Class"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Course *</label>
                <select
                  value={newGroup.course}
                  onChange={(event) => setNewGroup({ ...newGroup, course: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select a course</option>
                  {courses.map((course: Course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Days of Week</label>
                <input
                  type="text"
                  value={newGroup.days}
                  onChange={(event) => setNewGroup({ ...newGroup, days: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="e.g., Mon, Wed, Fri"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newGroup.start_time}
                    onChange={(event) => setNewGroup({ ...newGroup, start_time: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Time</label>
                  <input
                    type="time"
                    value={newGroup.end_time}
                    onChange={(event) => setNewGroup({ ...newGroup, end_time: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <input
                    type="date"
                    value={newGroup.start_day}
                    onChange={(event) => setNewGroup({ ...newGroup, start_day: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input
                    type="date"
                    value={newGroup.end_day}
                    onChange={(event) => setNewGroup({ ...newGroup, end_day: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateGroup}
                  disabled={!canCreateGroup || createGroup.isPending}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {createGroup.isPending ? 'Creating...' : 'Create Group'}
                </button>
                <button
                  onClick={() => {
                    setIsCreatingGroup(false)
                    setNewGroup(createEmptyGroupForm())
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">Edit Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Group Name</label>
                <input
                  type="text"
                  value={editingGroup.name}
                  onChange={(event) => setEditingGroup({ ...editingGroup, name: event.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Course</label>
                <input
                  type="text"
                  value={editingGroup.course?.name}
                  disabled
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Days of Week</label>
                <input
                  type="text"
                  value={editingGroup.days}
                  onChange={(event) => setEditingGroup({ ...editingGroup, days: event.target.value })}
                  placeholder="e.g., Mon, Wed, Fri"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Time</label>
                  <input
                    type="time"
                    value={editingGroup.start_time}
                    onChange={(event) => setEditingGroup({ ...editingGroup, start_time: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Time</label>
                  <input
                    type="time"
                    value={editingGroup.end_time}
                    onChange={(event) => setEditingGroup({ ...editingGroup, end_time: event.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={!canEditGroup || updateGroup.isPending}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {updateGroup.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingGroup(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Users, Calendar, Clock, CalendarDays, AlertTriangle } from 'lucide-react'
import toast from '@/lib/toast'
import apiService from '@/lib/api'
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, Group } from '@/lib/hooks/useGroups'
import { useCourses, Course } from '@/lib/hooks/useCourses'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { normalizeDayToken, parseGroupDays, type WeekDay } from '@/lib/utils/schedule'
import LoadingScreen from '@/components/LoadingScreen'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

type SearchStatus = 'all' | 'scheduled' | 'unscheduled'

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

  const groupsQueryParams = useMemo(
    () => ({
      page: hasStructuredFilters ? 1 : page,
      limit: hasStructuredFilters ? 1000 : PAGE_SIZE,
      search: parsedSearch.text || undefined,
    }),
    [hasStructuredFilters, page, parsedSearch.text],
  )

  const { data: groupsData, isLoading } = useGroups(groupsQueryParams)
  const rawGroups = useMemo(() => groupsData?.results || [], [groupsData?.results])

  const { data: scheduleHealthData } = useQuery<GroupScheduleHealth>({
    queryKey: ['groups', 'schedule-health'],
    queryFn: () => apiService.getGroupScheduleHealth(),
    staleTime: 60 * 1000,
    enabled: Boolean(user),
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

  const totalGroups = hasStructuredFilters ? filteredGroups.length : groupsData?.count || 0
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE))

  const visibleGroups = useMemo(() => {
    if (!hasStructuredFilters) return filteredGroups
    const start = (page - 1) * PAGE_SIZE
    return filteredGroups.slice(start, start + PAGE_SIZE)
  }, [filteredGroups, hasStructuredFilters, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

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

  const studentsOnPage = visibleGroups.reduce(
    (sum: number, group: Group) => sum + (group.students?.length || 0),
    0,
  )
  const averageStudents =
    visibleGroups.length > 0 ? Math.round(studentsOnPage / visibleGroups.length) : 0
  const scheduledGroups =
    scheduleHealthData?.scheduled_groups ||
    rawGroups.filter((group: Group) => parseGroupDays(group.days).length > 0).length
  const unscheduledGroups =
    scheduleHealthData?.unscheduled_groups ?? Math.max(0, totalGroups - scheduledGroups)
  const activeConflicts =
    (scheduleHealthData?.teacher_conflicts || 0) + (scheduleHealthData?.room_conflicts || 0)
  const capacityRiskGroups =
    (scheduleHealthData?.capacity_near_full_groups || 0) +
    (scheduleHealthData?.capacity_overflow_groups || 0)

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-secondary mb-2">{hasStructuredFilters ? 'Matched Groups' : 'Total Groups'}</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleGroups.map((group: Group) => (
              <div key={group.id} className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{group.name}</h3>
                    <p className="text-sm text-text-secondary">{group.course?.name || 'No Course'}</p>
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
                    <span>{group.students?.length || 0} students</span>
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
            ))}
          </div>

          {visibleGroups.length === 0 && (
            <div className="bg-surface border border-border rounded-2xl text-center py-12">
              <p className="text-text-secondary text-lg mb-2">No groups found</p>
              <p className="text-text-secondary text-sm">
                {searchQuery ? 'Try adjusting your query or filters' : 'Create your first group to get started'}
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

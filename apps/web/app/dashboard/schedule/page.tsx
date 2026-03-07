'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Users, Undo2, Redo2, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react'
import toast from '@/lib/toast'
import apiService from '@/lib/api'
import { useGroups, useCreateGroup, useUpdateGroup, Group } from '@/lib/hooks/useGroups'
import { useCourses, Course } from '@/lib/hooks/useCourses'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { normalizeDayToken, parseGroupDays, toShortDayLabel, WEEK_DAYS, type WeekDay } from '@/lib/utils/schedule'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

import ScheduleView from '@/components/dashboard/schedule/ScheduleView'
import UnscheduledGroupsPanel from '@/components/dashboard/schedule/UnscheduledGroupsPanel'
import LoadingScreen from '@/components/LoadingScreen'

interface ScheduleChange {
  groupId: number
  oldDays: string
  oldStartTime: string
  oldEndTime: string
  newDays: string
  newStartTime: string
  newEndTime: string
  courseId: number
}

type SearchStatus = 'all' | 'scheduled' | 'unscheduled'

interface ParsedScheduleSearch {
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
  top_conflicts: Array<{
    type: 'room' | 'teacher'
    day: string
    time: string
    resource?: string | null
    groups: Array<{ id: number; name: string }>
  }>
}

const DAY_ORDER_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const createEmptyGroupForm = () => ({
  name: '',
  course: '',
  days: '',
  start_time: '09:00',
  end_time: '11:00',
  start_day: '',
  end_day: '',
})

const parseStructuredScheduleSearch = (rawQuery: string): ParsedScheduleSearch => {
  const parsed: ParsedScheduleSearch = {
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

const uniqueById = <T extends { id: number }>(items: Array<T | null | undefined>): T[] => {
  const uniqueMap = new Map<number, T>()
  items.forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item)
    }
  })
  return Array.from(uniqueMap.values())
}

const toMinutes = (time: string): number => {
  if (!time) return 0
  const [hoursRaw, minutesRaw] = time.split(':')
  const hours = Number(hoursRaw || '0')
  const minutes = Number(minutesRaw || '0')
  return hours * 60 + minutes
}

const toTimeString = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.min(minutes, 23 * 60 + 59))
  const hh = Math.floor(safeMinutes / 60)
  const mm = safeMinutes % 60
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}

const getWeekRange = (offset: number = 0) => {
  const today = new Date()
  const currentDay = today.getDay()
  const diff = currentDay === 0 ? -6 : 1 - currentDay
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

const formatWeekRange = (offset: number = 0) => {
  const { start, end } = getWeekRange(offset)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`
}

const getDateForWeekDay = (weekStart: Date, day: WeekDay): Date => {
  const dayIndex = WEEK_DAYS.indexOf(day)
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + dayIndex)
  return date
}

export default function SchedulePage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateGroup = permissionState.hasPermission('groups.create')
  const canEditSchedule = permissionState.hasPermission('groups.edit')
  const canManageSchedule = canCreateGroup || canEditSchedule

  const { data, isLoading } = useGroups({ limit: 1000 })
  const groups = useMemo(() => data?.results || [], [data?.results])

  const { data: coursesData } = useCourses()
  const courses = useMemo(() => coursesData?.results || [], [coursesData?.results])

  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const parsedSearch = useMemo(
    () => parseStructuredScheduleSearch(debouncedSearchQuery),
    [debouncedSearchQuery],
  )

  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [newGroup, setNewGroup] = useState(createEmptyGroupForm)

  const [undoStack, setUndoStack] = useState<ScheduleChange[]>([])
  const [redoStack, setRedoStack] = useState<ScheduleChange[]>([])

  const [selectedTeacher, setSelectedTeacher] = useState<string>('all')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(20)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [showConflicts, setShowConflicts] = useState(true)
  const [colorByCategory, setColorByCategory] = useState<'course' | 'teacher' | 'none'>('course')
  const [swimlaneBy, setSwimlaneBy] = useState<'none' | 'teacher' | 'room'>('none')

  const { data: scheduleHealthData, isLoading: isScheduleHealthLoading } = useQuery<GroupScheduleHealth>({
    queryKey: ['groups', 'schedule-health'],
    queryFn: () => apiService.getGroupScheduleHealth(),
    staleTime: 60 * 1000,
    enabled: Boolean(user),
  })

  const activeWeekRange = useMemo(() => getWeekRange(currentWeekOffset), [currentWeekOffset])

  const allTeachers = useMemo(
    () => uniqueById(groups.map((group: Group) => group.main_teacher)),
    [groups],
  )
  const allCourses = useMemo(
    () => uniqueById(groups.map((group: Group) => group.course)),
    [groups],
  )
  const allRooms = useMemo(
    () => uniqueById(groups.map((group: Group) => group.room)),
    [groups],
  )

  const goToPreviousWeek = () => setCurrentWeekOffset((prev) => prev - 1)
  const goToNextWeek = () => setCurrentWeekOffset((prev) => prev + 1)
  const goToCurrentWeek = () => setCurrentWeekOffset(0)

  const handleAddDaysToGroup = useCallback(
    async (group: Group, targetDays: string[]) => {
      if (!canEditSchedule) {
        toast.error('You do not have permission to update schedule.')
        return
      }
      const currentDays = parseGroupDays(group.days)
      const normalizedTargetDays = targetDays
        .map((day) => normalizeDayToken(day))
        .filter((day): day is WeekDay => Boolean(day))
      const allDays = Array.from(new Set<WeekDay>([...currentDays, ...normalizedTargetDays]))
      const allDaysShort = allDays
        .map((day) => toShortDayLabel(day))
        .filter(Boolean)
        .sort((a, b) => DAY_ORDER_SHORT.indexOf(a) - DAY_ORDER_SHORT.indexOf(b))

      const newDaysString = allDaysShort.join(', ')
      if (newDaysString === group.days) {
        toast.info('Schedule already includes these days.')
        return
      }

      updateGroup.mutate(
        { id: group.id, data: { days: newDaysString } },
        {
          onSuccess: () => toast.success(`Group schedule updated: ${newDaysString}`),
          onError: () => toast.error('Failed to update group schedule'),
        },
      )
    },
    [canEditSchedule, updateGroup],
  )

  const stringToColor = (value: string): string => {
    let hash = 0
    const normalizedValue = value || 'Default'
    for (let i = 0; i < normalizedValue.length; i += 1) {
      hash = normalizedValue.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 65%, 50%)`
  }

  const getGroupColor = (group: Group): string => {
    if (colorByCategory === 'none') return 'hsl(var(--primary))'
    if (colorByCategory === 'course') {
      return group.course?.name ? stringToColor(group.course.name) : 'hsl(var(--primary))'
    }
    if (colorByCategory === 'teacher') {
      return stringToColor(group.main_teacher?.username || 'No Teacher')
    }
    return 'hsl(var(--primary))'
  }

  const detectConflicts = (group: Group, day: string): string[] => {
    const conflicts = new Set<string>()
    const normalizedDay = normalizeDayToken(day)
    if (!normalizedDay) return []

    const groupStartMinutes = toMinutes(group.start_time)
    const groupEndMinutes = toMinutes(group.end_time)

    groups.forEach((candidate: Group) => {
      if (candidate.id === group.id || !candidate.days || !candidate.start_time || !candidate.end_time) {
        return
      }

      if (!parseGroupDays(candidate.days).includes(normalizedDay)) return

      const candidateStartMinutes = toMinutes(candidate.start_time)
      const candidateEndMinutes = toMinutes(candidate.end_time)
      const overlaps =
        groupStartMinutes < candidateEndMinutes && candidateStartMinutes < groupEndMinutes
      if (!overlaps) return

      if (group.main_teacher?.id && candidate.main_teacher?.id === group.main_teacher.id) {
        conflicts.add(`Teacher conflict with ${candidate.name}`)
      }
      if (group.room?.id && candidate.room?.id === group.room.id) {
        conflicts.add(`Room conflict with ${candidate.name}`)
      }
    })

    return Array.from(conflicts)
  }

  const detectCapacityWarning = (group: Group): string | null => {
    if (!group.room?.capacity) return null
    const studentCount = group.students?.length || 0
    const roomCapacity = group.room.capacity

    if (studentCount > roomCapacity) {
      const excess = studentCount - roomCapacity
      return `Room over capacity! ${studentCount} students in room for ${roomCapacity} (${excess} over)`
    }

    const utilizationPercent = (studentCount / roomCapacity) * 100
    if (utilizationPercent >= 90 && utilizationPercent < 100) {
      return `Room nearly full: ${studentCount}/${roomCapacity} students (${Math.round(utilizationPercent)}%)`
    }

    return null
  }

  const filteredGroups = useMemo(() => {
    return groups.filter((group: Group) => {
      const normalizedDays = parseGroupDays(group.days)
      const hasSchedule = normalizedDays.length > 0
      const teacherName = `${group.main_teacher?.first_name || ''} ${group.main_teacher?.last_name || ''}`
        .trim()
        .toLowerCase()
      const searchableText = [
        group.name,
        group.course?.name,
        group.main_teacher?.username,
        teacherName,
        group.room?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesText = !parsedSearch.text || searchableText.includes(parsedSearch.text)
      const matchesSearchTeacher =
        !parsedSearch.teacher ||
        teacherName.includes(parsedSearch.teacher) ||
        (group.main_teacher?.username || '').toLowerCase().includes(parsedSearch.teacher)
      const matchesSearchCourse =
        !parsedSearch.course || (group.course?.name || '').toLowerCase().includes(parsedSearch.course)
      const matchesSearchRoom =
        !parsedSearch.room || (group.room?.name || '').toLowerCase().includes(parsedSearch.room)
      const matchesSearchDay = !parsedSearch.day || normalizedDays.includes(parsedSearch.day)
      const matchesSearchStatus =
        parsedSearch.status === 'all' ||
        (parsedSearch.status === 'scheduled' && hasSchedule) ||
        (parsedSearch.status === 'unscheduled' && !hasSchedule)

      const matchesToolbarTeacher =
        selectedTeacher === 'all' || group.main_teacher?.id?.toString() === selectedTeacher
      const matchesToolbarCourse =
        selectedCourse === 'all' || group.course?.id.toString() === selectedCourse
      const matchesToolbarRoom = selectedRoom === 'all' || group.room?.id?.toString() === selectedRoom

      return (
        matchesText &&
        matchesSearchTeacher &&
        matchesSearchCourse &&
        matchesSearchRoom &&
        matchesSearchDay &&
        matchesSearchStatus &&
        matchesToolbarTeacher &&
        matchesToolbarCourse &&
        matchesToolbarRoom
      )
    })
  }, [groups, parsedSearch, selectedTeacher, selectedCourse, selectedRoom])

  const handleCreateGroup = async () => {
    if (!canCreateGroup) {
      toast.error('You do not have permission to create groups.')
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

  const handleUndo = useCallback(() => {
    if (!canEditSchedule) {
      toast.error('You do not have permission to update schedule.')
      return
    }
    if (undoStack.length === 0) {
      toast.warning('Nothing to undo')
      return
    }

    const lastChange = undoStack[undoStack.length - 1]
    const group = groups.find((item: Group) => item.id === lastChange.groupId)
    if (!group) {
      toast.error('Group not found')
      return
    }

    updateGroup.mutate(
      {
        id: lastChange.groupId,
        data: {
          days: lastChange.oldDays,
          start_time: lastChange.oldStartTime,
          end_time: lastChange.oldEndTime,
          course: lastChange.courseId,
        },
      },
      {
        onSuccess: () => {
          setRedoStack((previous) => [...previous, lastChange])
          setUndoStack((previous) => previous.slice(0, -1))
          toast.success('Undone')
        },
        onError: () => toast.error('Failed to undo'),
      },
    )
  }, [canEditSchedule, undoStack, groups, updateGroup])

  const handleRedo = useCallback(() => {
    if (!canEditSchedule) {
      toast.error('You do not have permission to update schedule.')
      return
    }
    if (redoStack.length === 0) {
      toast.warning('Nothing to redo')
      return
    }

    const lastUndone = redoStack[redoStack.length - 1]
    const group = groups.find((item: Group) => item.id === lastUndone.groupId)
    if (!group) {
      toast.error('Group not found')
      return
    }

    updateGroup.mutate(
      {
        id: lastUndone.groupId,
        data: {
          days: lastUndone.newDays,
          start_time: lastUndone.newStartTime,
          end_time: lastUndone.newEndTime,
          course: lastUndone.courseId,
        },
      },
      {
        onSuccess: () => {
          setUndoStack((previous) => [...previous, lastUndone])
          setRedoStack((previous) => previous.slice(0, -1))
          toast.success('Redone')
        },
        onError: () => toast.error('Failed to redo'),
      },
    )
  }, [canEditSchedule, redoStack, groups, updateGroup])

  useEffect(() => {
    if (!canEditSchedule) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canEditSchedule, handleUndo, handleRedo])

  const handleRescheduleGroup = useCallback(
    async (groupId: number, newDay: string, newStartTime: string) => {
      if (!canEditSchedule) {
        toast.error('You do not have permission to update schedule.')
        return
      }
      const group = groups.find((item: Group) => item.id === groupId)
      if (!group) return
      if (!group.course?.id) {
        toast.error('Cannot reschedule: group course is missing')
        return
      }

      const currentStartMinutes = toMinutes(group.start_time)
      const currentEndMinutes = toMinutes(group.end_time)
      const duration = Math.max(60, currentEndMinutes - currentStartMinutes)

      const newStartMinutes = toMinutes(newStartTime)
      const newEndMinutes = newStartMinutes + duration
      const newEndTime = toTimeString(newEndMinutes)
      const newDayShort = toShortDayLabel(newDay)

      const change: ScheduleChange = {
        groupId: group.id,
        oldDays: group.days,
        oldStartTime: group.start_time,
        oldEndTime: group.end_time,
        newDays: newDayShort,
        newStartTime,
        newEndTime,
        courseId: group.course.id,
      }

      updateGroup.mutate(
        {
          id: groupId,
          data: {
            days: newDayShort,
            start_time: newStartTime,
            end_time: newEndTime,
            course: group.course.id,
          },
        },
        {
          onSuccess: () => {
            setUndoStack((previous) => [...previous, change])
            setRedoStack([])
            toast.success('Schedule updated • Press Ctrl+Z to undo')
          },
          onError: () => toast.error('Failed to update schedule'),
        },
      )
    },
    [canEditSchedule, groups, updateGroup],
  )

  const buildExportRows = useCallback(() => {
    return filteredGroups.flatMap((group: Group) => {
      const normalizedDays = parseGroupDays(group.days)
      const teacherName =
        `${group.main_teacher?.first_name || ''} ${group.main_teacher?.last_name || ''}`.trim() ||
        group.main_teacher?.username ||
        '-'

      if (!normalizedDays.length) {
        return [
          {
            Group: group.name,
            Course: group.course?.name || '-',
            Teacher: teacherName,
            Room: group.room?.name || '-',
            Day: 'Unscheduled',
            Date: '-',
            Start: group.start_time ? group.start_time.slice(0, 5) : '-',
            End: group.end_time ? group.end_time.slice(0, 5) : '-',
            Students: group.students?.length || 0,
          },
        ]
      }

      return normalizedDays.map((day) => {
        const date = getDateForWeekDay(activeWeekRange.start, day)
        return {
          Group: group.name,
          Course: group.course?.name || '-',
          Teacher: teacherName,
          Room: group.room?.name || '-',
          Day: day,
          Date: date.toLocaleDateString('en-CA'),
          Start: group.start_time ? group.start_time.slice(0, 5) : '-',
          End: group.end_time ? group.end_time.slice(0, 5) : '-',
          Students: group.students?.length || 0,
        }
      })
    })
  }, [activeWeekRange.start, filteredGroups])

  const exportToExcel = useCallback(() => {
    const rows = buildExportRows()
    if (!rows.length) {
      toast.warning('No schedule data to export')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule')

    const buffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    })

    const filename = `schedule-${activeWeekRange.start.toISOString().slice(0, 10)}.xlsx`
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename,
    )
    toast.success('Schedule exported to Excel')
  }, [activeWeekRange.start, buildExportRows])

  const exportToPDF = useCallback(() => {
    const rows = buildExportRows()
    if (!rows.length) {
      toast.warning('No schedule data to export')
      return
    }

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Weekly Schedule Export', 14, 14)
    doc.setFontSize(10)
    doc.text(`Week: ${formatWeekRange(currentWeekOffset)}`, 14, 20)

    autoTable(doc, {
      startY: 24,
      head: [['Group', 'Course', 'Teacher', 'Room', 'Day', 'Date', 'Start', 'End', 'Students']],
      body: rows.map((row) => [
        row.Group,
        row.Course,
        row.Teacher,
        row.Room,
        row.Day,
        row.Date,
        row.Start,
        row.End,
        String(row.Students),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
    })

    const filename = `schedule-${activeWeekRange.start.toISOString().slice(0, 10)}.pdf`
    doc.save(filename)
    toast.success('Schedule exported to PDF')
  }, [activeWeekRange.start, buildExportRows, currentWeekOffset])

  const scheduledGroups = scheduleHealthData?.scheduled_groups ?? groups.filter((group) => parseGroupDays(group.days).length > 0).length
  const unscheduledGroups = scheduleHealthData?.unscheduled_groups ?? Math.max(0, groups.length - scheduledGroups)
  const activeConflicts = (scheduleHealthData?.teacher_conflicts || 0) + (scheduleHealthData?.room_conflicts || 0)
  const capacityRiskGroups =
    (scheduleHealthData?.capacity_near_full_groups || 0) + (scheduleHealthData?.capacity_overflow_groups || 0)
  const topConflicts = (scheduleHealthData?.top_conflicts || []).slice(0, 4)

  if (isLoading) {
    return (
      <ProtectedRoute>
        <LoadingScreen message="Loading schedule..." />
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Schedule Board 🗓️</h1>
        <p className="text-text-secondary">Manage group schedules with an interactive board</p>
        {!canManageSchedule && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            Read-only mode: you can view schedule but cannot change it.
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex-1 max-w-md min-w-[280px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search... e.g. english teacher:john day:mon status:unscheduled"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <p className="text-xs text-text-secondary mt-2">
            Inline filters: <code>course:</code> <code>teacher:</code> <code>room:</code> <code>day:</code> <code>status:</code>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl p-1">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0 || !canEditSchedule}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              undoStack.length === 0 || !canEditSchedule
                ? 'text-text-secondary/50 cursor-not-allowed'
                : 'text-text-secondary hover:text-text hover:bg-background'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
            <span className="text-sm">Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0 || !canEditSchedule}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              redoStack.length === 0 || !canEditSchedule
                ? 'text-text-secondary/50 cursor-not-allowed'
                : 'text-text-secondary hover:text-text hover:bg-background'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
            <span className="text-sm">Redo</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard/groups')} className="btn-secondary flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Groups
          </button>
          <button
            onClick={() => setIsCreatingGroup(true)}
            disabled={!canCreateGroup}
            title={!canCreateGroup ? 'You do not have permission to create groups' : undefined}
            className={`flex items-center gap-2 ${canCreateGroup ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'}`}
          >
            <Plus className="h-5 w-5" />
            Create Group
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{groups.length}</div>
          <div className="stat-label">Total Groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{scheduledGroups}</div>
          <div className="stat-label">Scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{unscheduledGroups}</div>
          <div className="stat-label">Unscheduled</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${activeConflicts > 0 ? 'text-warning' : ''}`}>{activeConflicts}</div>
          <div className="stat-label">Active Conflicts</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${capacityRiskGroups > 0 ? 'text-warning' : ''}`}>{capacityRiskGroups}</div>
          <div className="stat-label">Capacity Risk</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{filteredGroups.length}</div>
          <div className="stat-label">Filtered View</div>
        </div>
      </div>

      {topConflicts.length > 0 && (
        <div className="card mb-6 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Conflict Radar</h3>
            <span className="text-xs text-text-secondary">
              {isScheduleHealthLoading ? 'Updating...' : 'Live from backend checks'}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {topConflicts.map((conflict, index) => (
              <div key={`${conflict.type}-${conflict.day}-${conflict.time}-${index}`} className="rounded-xl border border-border bg-surface/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold uppercase ${conflict.type === 'room' ? 'text-warning' : 'text-error'}`}>
                    {conflict.type} conflict
                  </span>
                  <span className="text-xs text-text-secondary">{conflict.day} • {conflict.time}</span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {conflict.resource || 'Shared resource'} — {conflict.groups.map((group) => group.name).join(' vs ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 bg-surface border border-border rounded-lg hover:bg-background transition-colors"
              title="Previous week"
            >
              ← Previous
            </button>
            <button
              onClick={goToCurrentWeek}
              disabled={currentWeekOffset === 0}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentWeekOffset === 0
                  ? 'bg-surface border border-border text-text-secondary cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
              title="Go to current week"
            >
              Today
            </button>
            <button
              onClick={goToNextWeek}
              className="px-3 py-2 bg-surface border border-border rounded-lg hover:bg-background transition-colors"
              title="Next week"
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">
              {formatWeekRange(currentWeekOffset)}
              {currentWeekOffset !== 0 && (
                <span className="ml-2 text-text-secondary">
                  ({currentWeekOffset > 0 ? `+${currentWeekOffset}` : currentWeekOffset} week
                  {Math.abs(currentWeekOffset) !== 1 ? 's' : ''})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 border-l border-border pl-3">
              <button
                onClick={exportToExcel}
                disabled={filteredGroups.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export to Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm">Excel</span>
              </button>
              <button
                onClick={exportToPDF}
                disabled={filteredGroups.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export to PDF"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm">PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedTeacher}
              onChange={(event) => setSelectedTeacher(event.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
            >
              <option value="all">All Teachers</option>
              {allTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id.toString()}>
                  {teacher.username || teacher.first_name || 'Teacher'}
                </option>
              ))}
            </select>

            <select
              value={selectedCourse}
              onChange={(event) => setSelectedCourse(event.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
            >
              <option value="all">All Courses</option>
              {allCourses.map((course) => (
                <option key={course.id} value={course.id.toString()}>
                  {course.name}
                </option>
              ))}
            </select>

            <select
              value={selectedRoom}
              onChange={(event) => setSelectedRoom(event.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
            >
              <option value="all">All Rooms</option>
              {allRooms.map((room) => (
                <option key={room.id} value={room.id.toString()}>
                  {room.name}
                </option>
              ))}
            </select>

            <select
              value={swimlaneBy}
              onChange={(event) => setSwimlaneBy(event.target.value as 'none' | 'teacher' | 'room')}
              className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
            >
              <option value="none">No Grouping</option>
              <option value="teacher">Group by Teacher</option>
              <option value="room">Group by Room</option>
            </select>

            <select
              value={colorByCategory}
              onChange={(event) => setColorByCategory(event.target.value as 'course' | 'teacher' | 'none')}
              className="px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
            >
              <option value="course">Color by Course</option>
              <option value="teacher">Color by Teacher</option>
              <option value="none">No Colors</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showConflicts}
                onChange={(event) => setShowConflicts(event.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-text-secondary">Show Conflicts</span>
            </label>

            <div className="flex items-center gap-2 border-l border-border pl-3 ml-2">
              <span className="text-sm text-text-secondary">Hours:</span>
              <select
                value={startHour}
                onChange={(event) => {
                  const nextStart = Number(event.target.value)
                  if (nextStart >= endHour) {
                    toast.warning('Start hour must be before end hour')
                    return
                  }
                  setStartHour(nextStart)
                }}
                className="px-2 py-1 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
                title="Start hour"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>

              <span className="text-sm text-text-secondary">to</span>

              <select
                value={endHour}
                onChange={(event) => {
                  const nextEnd = Number(event.target.value)
                  if (nextEnd <= startHour) {
                    toast.warning('End hour must be after start hour')
                    return
                  }
                  setEndHour(nextEnd)
                }}
                className="px-2 py-1 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-sm"
                title="End hour"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 border-l border-border pl-3 ml-2">
              <button
                onClick={() => {
                  setStartHour(8)
                  setEndHour(20)
                  toast.success('Set to work hours (8:00 - 20:00)')
                }}
                className="px-2 py-1 text-xs bg-surface border border-border rounded hover:bg-background transition-colors"
                title="Work hours: 8 AM - 8 PM"
              >
                Work
              </button>
              <button
                onClick={() => {
                  setStartHour(9)
                  setEndHour(17)
                  toast.success('Set to standard hours (9:00 - 17:00)')
                }}
                className="px-2 py-1 text-xs bg-surface border border-border rounded hover:bg-background transition-colors"
                title="Standard hours: 9 AM - 5 PM"
              >
                9-5
              </button>
              <button
                onClick={() => {
                  setStartHour(0)
                  setEndHour(23)
                  toast.success('Set to full day (0:00 - 23:00)')
                }}
                className="px-2 py-1 text-xs bg-surface border border-border rounded hover:bg-background transition-colors"
                title="Full day: 12 AM - 11 PM"
              >
                24h
              </button>
            </div>
          </div>

          <div className="text-sm text-text-secondary">
            Showing {filteredGroups.length} of {groups.length} loaded groups
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-grow">
          <ScheduleView
            groups={filteredGroups.filter((group) => group.days && group.days.trim() !== '')}
            onReschedule={handleRescheduleGroup}
            onGroupClick={(group) => router.push(`/dashboard/groups/${group.id}`)}
            onDuplicateGroup={handleAddDaysToGroup}
            getGroupColor={getGroupColor}
            detectConflicts={detectConflicts}
            detectCapacityWarning={detectCapacityWarning}
            showConflicts={showConflicts}
            startHour={startHour}
            endHour={endHour}
            canEditSchedule={canEditSchedule}
            currentWeekOffset={currentWeekOffset}
            weekRange={activeWeekRange}
            swimlaneBy={swimlaneBy}
            allTeachers={allTeachers}
            allRooms={allRooms}
          />
        </div>

        <div className="w-64 flex-shrink-0">
          <div className="card sticky top-24">
            <h3 className="text-lg font-semibold p-4 border-b border-border">Unscheduled</h3>
            <UnscheduledGroupsPanel
              groups={filteredGroups.filter((group) => !group.days || group.days.trim() === '')}
              onGroupClick={(group) => router.push(`/dashboard/groups/${group.id}`)}
              canDrag={canEditSchedule}
            />
          </div>
        </div>
      </div>

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
                  Create Group
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
      </div>
    </ProtectedRoute>
  )
}

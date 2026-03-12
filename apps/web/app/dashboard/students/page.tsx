'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  Users, Plus, Edit, Trash2, X, Search, Mail, Phone,
  Calendar, Download, Upload, Eye, MoreVertical, Activity, CheckCircle,
  UserCheck, PauseCircle, UserX
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import apiService from '@/lib/api'
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  type Student,
  type StudentFormData
} from '@/lib/hooks/useStudents'
import { usePermissions } from '@/lib/permissions'
import LoadingScreen from '@/components/LoadingScreen'

type ViewMode = 'grid' | 'table'
type StudentAccountStatus = 'active' | 'frozen' | 'deactivated'

interface StudentAccountStatusEntry {
  accountId?: number
  status: StudentAccountStatus
}

const normalizeStudentAccountStatus = (value: unknown): StudentAccountStatus => {
  if (value === 'frozen' || value === 'deactivated') {
    return value
  }
  return 'active'
}

export default function StudentsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateStudent = permissionState.hasPermission('students.create')
  const canEditStudent = permissionState.hasPermission('students.edit')
  const canDeleteStudent = permissionState.hasPermission('students.delete')

  // React Query hooks
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(9)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'with_email' | 'missing_email' | 'with_phone' | 'missing_phone'
  >('all')
  const [recentOnly, setRecentOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [accountStatusByStudentId, setAccountStatusByStudentId] = useState<Record<number, StudentAccountStatusEntry>>({})
  const [statusActionStudentId, setStatusActionStudentId] = useState<number | null>(null)

  const { data: studentsData, isLoading, isFetching } = useStudents({
    page,
    limit,
    search: debouncedSearchQuery,
    has_email: filterStatus === 'with_email' ? true : filterStatus === 'missing_email' ? false : undefined,
    has_phone: filterStatus === 'with_phone' ? true : filterStatus === 'missing_phone' ? false : undefined,
  })
  const createStudent = useCreateStudent()
  const updateStudent = useUpdateStudent()
  const deleteStudent = useDeleteStudent()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // Form state
  const [studentForm, setStudentForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    parent_phone: '',
    parent_email: '',
    notes: ''
  })

  const students = studentsData?.results || []
  const studentIdsParam = students.map((student: Student) => student.id).join(',')

  const displayStudents = recentOnly
    ? students.filter((student: Student) => {
        if (!student.date_joined) return false
        const joinDate = new Date(student.date_joined)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return joinDate > weekAgo
      })
    : students
  const totalStudents = studentsData?.count || 0
  const totalPages = Math.ceil(totalStudents / limit)

  useEffect(() => {
    setSelectedIds([])
  }, [page, limit, filterStatus, debouncedSearchQuery, recentOnly])

  useEffect(() => {
    let cancelled = false

    const loadStudentAccountStatuses = async () => {
      const currentStudentIds = studentIdsParam
        .split(',')
        .map((value: string) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0)

      if (!studentIdsParam) {
        setAccountStatusByStudentId({})
        return
      }

      try {
        const response = await apiService.getStudentAccounts({
          student_ids: studentIdsParam,
          limit: currentStudentIds.length || 10,
        })
        const rows = Array.isArray(response) ? response : response?.results || []
        const nextMap: Record<number, StudentAccountStatusEntry> = {}

        rows.forEach((row: any) => {
          if (typeof row?.student !== 'number') return
          const status = normalizeStudentAccountStatus(row?.status)
          nextMap[row.student] = {
            accountId: typeof row?.id === 'number' ? row.id : undefined,
            status,
          }
        })

        currentStudentIds.forEach((studentId) => {
          if (!nextMap[studentId]) {
            nextMap[studentId] = { status: 'active' }
          }
        })

        if (!cancelled) {
          setAccountStatusByStudentId(nextMap)
        }
      } catch (error) {
        console.error('Failed to load student account statuses:', error)
      }
    }

    loadStudentAccountStatuses()
    return () => {
      cancelled = true
    }
  }, [studentIdsParam])

  const getAccountStatus = (studentId: number): StudentAccountStatus =>
    accountStatusByStudentId[studentId]?.status || 'active'

  const getAccountStatusBadgeClass = (status: StudentAccountStatus): string => {
    switch (status) {
      case 'frozen':
        return 'bg-warning/10 text-warning border-warning/30'
      case 'deactivated':
        return 'bg-error/10 text-error border-error/30'
      default:
        return 'bg-success/10 text-success border-success/30'
    }
  }

  const getAccountStatusLabel = (status: StudentAccountStatus): string => {
    switch (status) {
      case 'frozen':
        return 'Frozen'
      case 'deactivated':
        return 'Deactivated'
      default:
        return 'Active'
    }
  }

  const handleAccountStatusChange = async (student: Student, nextStatus: StudentAccountStatus) => {
    if (!canEditStudent) {
      toast.error('You do not have permission to manage student account status')
      return
    }

    const currentStatus = getAccountStatus(student.id)
    if (currentStatus === nextStatus) {
      return
    }

    const fullName = `${student.first_name} ${student.last_name}`.trim() || student.username
    const confirmed = confirm(
      `Change ${fullName} account status from ${getAccountStatusLabel(currentStatus)} to ${getAccountStatusLabel(nextStatus)}?`,
    )
    if (!confirmed) return

    try {
      setStatusActionStudentId(student.id)

      let response: any
      if (nextStatus === 'active') {
        response = await apiService.activateStudentAccount(student.id)
      } else if (nextStatus === 'frozen') {
        response = await apiService.freezeStudentAccount(student.id)
      } else {
        response = await apiService.deactivateStudentAccount(student.id)
      }

      const returnedStatus = normalizeStudentAccountStatus(response?.account_status || nextStatus)
      setAccountStatusByStudentId((prev) => ({
        ...prev,
        [student.id]: {
          accountId: response?.account_id ?? prev[student.id]?.accountId,
          status: returnedStatus,
        },
      }))
      toast.success(response?.detail || `Student account marked as ${getAccountStatusLabel(returnedStatus).toLowerCase()}`)
    } catch (error: any) {
      console.error('Failed to update student account status:', error)
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to update student account status'
      toast.error(message)
    } finally {
      setStatusActionStudentId(null)
    }
  }

  const handleDelete = async (student: Student) => {
    if (!canDeleteStudent) {
      toast.error('You do not have permission to delete students')
      return
    }

    if (!confirm(`Are you sure you want to delete ${student.first_name} ${student.last_name}?`)) return

    deleteStudent.mutate(student.id)
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canCreateStudent) {
      toast.error('You do not have permission to create students')
      return
    }

    if (!studentForm.username || !studentForm.password || !studentForm.first_name || !studentForm.last_name) {
      toast.error('Please fill in all required fields')
      return
    }

    createStudent.mutate(studentForm as StudentFormData, {
      onSuccess: () => {
        setShowAddModal(false)
        resetForm()
      }
    })
  }

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditStudent) {
      toast.error('You do not have permission to edit students')
      return
    }
    if (!selectedStudent) return

    updateStudent.mutate(
      { id: selectedStudent.id, data: studentForm as StudentFormData },
      {
        onSuccess: () => {
          setShowEditModal(false)
          setSelectedStudent(null)
          resetForm()
        }
      }
    )
  }

  const openEditModal = (student: Student) => {
    if (!canEditStudent) {
      toast.error('You do not have permission to edit students')
      return
    }

    setSelectedStudent(student)
    setStudentForm({
      username: student.username,
      password: '',
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      birth_date: student.birth_date || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
      notes: student.notes || ''
    })
    setShowEditModal(true)
  }

  const openDetailModal = (student: Student) => {
    setSelectedStudent(student)
    setShowDetailModal(true)
  }

  const resetForm = () => {
    setStudentForm({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      birth_date: '',
      parent_phone: '',
      parent_email: '',
      notes: ''
    })
  }

  const getInitials = (student: Student) => {
    return `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || student.username[0].toUpperCase()
  }

  const getProfileCompleteness = (student: Student) => {
    const fields = [
      student.email,
      student.phone,
      student.address,
      student.birth_date,
      student.parent_phone,
      student.parent_email
    ]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  }

  const toggleSelectStudent = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (displayStudents.length === 0) return
    const allSelected = displayStudents.every((student: Student) => selectedIds.includes(student.id))
    setSelectedIds(allSelected ? [] : displayStudents.map((student: Student) => student.id))
  }

  const exportStudents = (list: Student[], filename: string) => {
    const header = ['id', 'username', 'first_name', 'last_name', 'email', 'phone', 'date_joined']
    const rows = list.map((student: Student) => [
      student.id,
      student.username,
      student.first_name,
      student.last_name,
      student.email || '',
      student.phone || '',
      student.date_joined || ''
    ])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Note: These stats are now for the entire dataset, not just the current page.
  // This assumes the API could provide these stats, or we'd need separate queries.
  // For now, we'll use the total count.
  const stats = {
    total: totalStudents,
    // The following stats would require dedicated API endpoints for accuracy with pagination
    withEmail: displayStudents.filter((s: Student) => s.email).length,
    withPhone: displayStudents.filter((s: Student) => s.phone).length,
    recentlyAdded: displayStudents.filter((s: Student) => {
      if (!s.date_joined) return false
      const joinDate = new Date(s.date_joined)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return joinDate > weekAgo
    }).length,
    completeProfiles: displayStudents.filter((s: Student) => s.email && s.phone && s.address).length
  }
  const pageCompleteness = displayStudents.length
    ? Math.round((stats.completeProfiles / displayStudents.length) * 100)
    : 0

  const PaginationControls = () => (
    <div className="flex justify-center items-center gap-4 mt-8">
      <button
        onClick={() => setPage(p => Math.max(p - 1, 1))}
        disabled={page <= 1}
        className="btn-secondary"
      >
        Previous
      </button>
      <span className="text-text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
        disabled={page >= totalPages}
        className="btn-secondary"
      >
        Next
      </button>
    </div>
  );

  if (isLoading && page === 1) {
    return <LoadingScreen message="Loading students..." />
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Students Management
            </h1>
            <p className="text-text-secondary">
              Centralized student operations, data quality, and engagement signals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => exportStudents(displayStudents, 'students-page.csv')}
              className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Export Page
            </button>
            <button
              disabled
              className="px-4 py-2 bg-background border border-border rounded-xl text-text-secondary/60 cursor-not-allowed flex items-center gap-2 text-sm"
              title="Bulk import will be enabled once CSV templates are finalized."
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!canCreateStudent}
              title={!canCreateStudent ? 'You do not have permission to create students' : undefined}
              className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium ${
                canCreateStudent
                  ? 'bg-primary text-background hover:bg-primary/90'
                  : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
              }`}
            >
              <Plus className="h-5 w-5" />
              Add Student
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              {isFetching && <div className="w-4 h-4 border-2 border-primary/50 border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <p className="text-3xl font-bold mb-1">{stats.total}</p>
            <p className="text-sm text-text-secondary">Total Students</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-success" />
              </div>
              <span className="text-xs text-text-secondary">On this page</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.withEmail}</p>
            <p className="text-sm text-text-secondary">With Email</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-info" />
              </div>
              <span className="text-xs text-text-secondary">On this page</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.withPhone}</p>
            <p className="text-sm text-text-secondary">With Phone</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-warning" />
              </div>
              <span className="text-xs text-text-secondary">On this page</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.recentlyAdded}</p>
            <p className="text-sm text-text-secondary">Recently Added</p>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs text-text-secondary">On this page</span>
            </div>
            <p className="text-3xl font-bold mb-1">{pageCompleteness}%</p>
            <p className="text-sm text-text-secondary">Profile Completeness</p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full lg:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search students (backend)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as any)
                  setPage(1)
                }}
                className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Students</option>
                <option value="with_email">With Email</option>
                <option value="missing_email">Missing Email</option>
                <option value="with_phone">With Phone</option>
                <option value="missing_phone">Missing Phone</option>
              </select>

              <button
                onClick={() => setRecentOnly((prev) => !prev)}
                className={`px-4 py-2 rounded-xl border transition-colors flex items-center gap-2 text-sm ${
                  recentOnly ? 'bg-primary text-background border-primary' : 'bg-background border-border hover:bg-border/50'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Last 7 days
              </button>

              <div className="flex gap-1 bg-background border border-border rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-background' : 'hover:bg-surface'}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-primary text-background' : 'hover:bg-surface'}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="font-medium">{selectedIds.length} selected</span>
                <span className="text-text-secondary">on this page</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    exportStudents(
                      displayStudents.filter((student: Student) => selectedIds.includes(student.id)),
                      'students-selected.csv'
                    )
                  }
                  className="px-3 py-2 bg-background border border-border rounded-lg hover:bg-border/50 text-sm"
                >
                  Export Selected
                </button>
                <button
                  onClick={() => {
                    if (!canDeleteStudent) {
                      toast.error('You do not have permission to delete students')
                      return
                    }
                    if (!confirm(`Delete ${selectedIds.length} students? This cannot be undone.`)) return
                    selectedIds.forEach((id) => deleteStudent.mutate(id))
                    setSelectedIds([])
                  }}
                  disabled={!canDeleteStudent}
                  title={!canDeleteStudent ? 'You do not have permission to delete students' : undefined}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    canDeleteStudent
                      ? 'bg-error/10 text-error hover:bg-error/20'
                      : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                  }`}
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-2 bg-background border border-border rounded-lg hover:bg-border/50 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayStudents.map((student: Student) => (
              <div
                key={student.id}
                onClick={() => router.push(`/dashboard/students/${student.id}`)}
                className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelectStudent(student.id)
                      }}
                      className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                        selectedIds.includes(student.id)
                          ? 'bg-primary border-primary text-background'
                          : 'border-border text-transparent hover:border-primary'
                      }`}
                      aria-label="Select student"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/20">
                      {getInitials(student)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                        {student.first_name} {student.last_name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-text-secondary">@{student.username}</p>
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${getAccountStatusBadgeClass(getAccountStatus(student.id))}`}>
                          {getAccountStatusLabel(getAccountStatus(student.id))}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <button className="p-2 hover:bg-background rounded-lg transition-colors">
                      <MoreVertical className="h-4 w-4 text-text-secondary" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {student.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-text-secondary" />
                      <span className="text-text-secondary truncate">{student.email}</span>
                    </div>
                  )}
                  {student.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-text-secondary" />
                      <span className="text-text-secondary">{student.phone}</span>
                    </div>
                  )}
                  {student.date_joined && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-text-secondary" />
                      <span className="text-text-secondary">
                        Joined {new Date(student.date_joined).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Profile completeness</p>
                    <div className="h-2 bg-background rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${getProfileCompleteness(student)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccountStatusChange(student, 'active')
                      }}
                      disabled={!canEditStudent || getAccountStatus(student.id) === 'active' || statusActionStudentId === student.id}
                      className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                        canEditStudent && getAccountStatus(student.id) !== 'active' && statusActionStudentId !== student.id
                          ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                          : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                      }`}
                    >
                      <UserCheck className="h-3 w-3" />
                      Activate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccountStatusChange(student, 'frozen')
                      }}
                      disabled={!canEditStudent || getAccountStatus(student.id) === 'frozen' || statusActionStudentId === student.id}
                      className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                        canEditStudent && getAccountStatus(student.id) !== 'frozen' && statusActionStudentId !== student.id
                          ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                          : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                      }`}
                    >
                      <PauseCircle className="h-3 w-3" />
                      Freeze
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccountStatusChange(student, 'deactivated')
                      }}
                      disabled={!canEditStudent || getAccountStatus(student.id) === 'deactivated' || statusActionStudentId === student.id}
                      className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                        canEditStudent && getAccountStatus(student.id) !== 'deactivated' && statusActionStudentId !== student.id
                          ? 'bg-error/10 text-error border-error/30 hover:bg-error/20'
                          : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                      }`}
                    >
                      <UserX className="h-3 w-3" />
                      Deactivate
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/students/${student.id}`)
                      }}
                      className="flex-1 px-3 py-2 bg-info/10 text-info rounded-xl hover:bg-info/20 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(student)
                      }}
                      disabled={!canEditStudent}
                      title={!canEditStudent ? 'You do not have permission to edit students' : undefined}
                      className={`flex-1 px-3 py-2 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium ${
                        canEditStudent
                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                          : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                      }`}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(student)
                      }}
                      disabled={!canDeleteStudent}
                      title={!canDeleteStudent ? 'You do not have permission to delete students' : undefined}
                      className={`px-3 py-2 rounded-xl transition-colors ${
                        canDeleteStudent
                          ? 'bg-error/10 text-error hover:bg-error/20'
                          : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-text-secondary">
                      <button
                        onClick={toggleSelectAll}
                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          displayStudents.length > 0 && displayStudents.every((student: Student) => selectedIds.includes(student.id))
                            ? 'bg-primary border-primary text-background'
                            : 'border-border text-transparent hover:border-primary'
                        }`}
                        aria-label="Select all students"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    </th>
                    <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Username</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Email</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Phone</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Joined</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Account</th>
                    <th className="text-left p-4 font-medium text-text-secondary">Completeness</th>
                    <th className="text-right p-4 font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStudents.map((student: Student) => (
                    <tr key={student.id} className="border-b border-border hover:bg-background transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => toggleSelectStudent(student.id)}
                          className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                            selectedIds.includes(student.id)
                              ? 'bg-primary border-primary text-background'
                              : 'border-border text-transparent hover:border-primary'
                          }`}
                          aria-label="Select student"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/20">
                            {getInitials(student)}
                          </div>
                          <div>
                            <p className="font-medium">{student.first_name} {student.last_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-text-secondary">@{student.username}</td>
                      <td className="p-4">
                        {student.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-text-secondary" />
                            <span className="text-sm">{student.email}</span>
                          </div>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {student.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-text-secondary" />
                            <span className="text-sm">{student.phone}</span>
                          </div>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="p-4 text-text-secondary text-sm">
                        {student.date_joined ? new Date(student.date_joined).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <span className={`w-fit px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${getAccountStatusBadgeClass(getAccountStatus(student.id))}`}>
                            {getAccountStatusLabel(getAccountStatus(student.id))}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAccountStatusChange(student, 'active')}
                              disabled={!canEditStudent || getAccountStatus(student.id) === 'active' || statusActionStudentId === student.id}
                              title="Activate"
                              className={`p-1 rounded-md border transition-colors ${
                                canEditStudent && getAccountStatus(student.id) !== 'active' && statusActionStudentId !== student.id
                                  ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                                  : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                              }`}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleAccountStatusChange(student, 'frozen')}
                              disabled={!canEditStudent || getAccountStatus(student.id) === 'frozen' || statusActionStudentId === student.id}
                              title="Freeze"
                              className={`p-1 rounded-md border transition-colors ${
                                canEditStudent && getAccountStatus(student.id) !== 'frozen' && statusActionStudentId !== student.id
                                  ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                                  : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                              }`}
                            >
                              <PauseCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleAccountStatusChange(student, 'deactivated')}
                              disabled={!canEditStudent || getAccountStatus(student.id) === 'deactivated' || statusActionStudentId === student.id}
                              title="Deactivate"
                              className={`p-1 rounded-md border transition-colors ${
                                canEditStudent && getAccountStatus(student.id) !== 'deactivated' && statusActionStudentId !== student.id
                                  ? 'bg-error/10 text-error border-error/30 hover:bg-error/20'
                                  : 'bg-background text-text-secondary/60 border-border cursor-not-allowed'
                              }`}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 bg-background rounded-full overflow-hidden border border-border">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${getProfileCompleteness(student)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary">{getProfileCompleteness(student)}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/students/${student.id}`)}
                            className="p-2 hover:bg-info/20 text-info rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(student)}
                            disabled={!canEditStudent}
                            title={!canEditStudent ? 'You do not have permission to edit students' : undefined}
                            className={`p-2 rounded-lg transition-colors ${
                              canEditStudent
                                ? 'hover:bg-primary/20 text-primary'
                                : 'text-text-secondary/60 cursor-not-allowed'
                            }`}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            disabled={!canDeleteStudent}
                            title={!canDeleteStudent ? 'You do not have permission to delete students' : undefined}
                            className={`p-2 rounded-lg transition-colors ${
                              canDeleteStudent
                                ? 'hover:bg-error/20 text-error'
                                : 'text-text-secondary/60 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {displayStudents.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary">No students found</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State for Grid */}
        {viewMode === 'grid' && displayStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
            <p className="text-text-secondary text-lg mb-2">No students found</p>
            <p className="text-sm text-text-secondary">
              {searchQuery ? 'Try adjusting your search' : 'Add your first student to get started'}
            </p>
          </div>
        )}

        {totalPages > 1 && <PaginationControls />}
      </div>

      {/* Add Student Modal */}
      {showAddModal && canCreateStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">Add New Student</h2>
              <button onClick={() => { setShowAddModal(false); resetForm() }} className="p-2 hover:bg-background rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username *</label>
                  <input
                    type="text"
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password *</label>
                  <input
                    type="password"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input
                    type="text"
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="tel"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm() }} className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canCreateStudent || createStudent.isPending}
                  className={`flex-1 px-6 py-3 rounded-xl font-medium ${
                    canCreateStudent && !createStudent.isPending
                      ? 'bg-primary text-background hover:bg-primary/90'
                      : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                  }`}
                >
                  Create Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && canEditStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">Edit Student</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedStudent(null); resetForm() }} className="p-2 hover:bg-background rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="tel"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedStudent(null); resetForm() }} className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border/50 font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canEditStudent || updateStudent.isPending}
                  className={`flex-1 px-6 py-3 rounded-xl font-medium ${
                    canEditStudent && !updateStudent.isPending
                      ? 'bg-primary text-background hover:bg-primary/90'
                      : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                  }`}
                >
                  Update Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">Student Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedStudent(null) }} className="p-2 hover:bg-background rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-2xl border-2 border-primary/20">
                  {getInitials(selectedStudent)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedStudent.first_name} {selectedStudent.last_name}</h3>
                  <p className="text-text-secondary">@{selectedStudent.username}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {selectedStudent.email && (
                  <div className="p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Email</span>
                    </div>
                    <p className="text-sm">{selectedStudent.email}</p>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div className="p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Phone</span>
                    </div>
                    <p className="text-sm">{selectedStudent.phone}</p>
                  </div>
                )}
                {selectedStudent.date_joined && (
                  <div className="p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Joined</span>
                    </div>
                    <p className="text-sm">{new Date(selectedStudent.date_joined).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    openEditModal(selectedStudent)
                  }}
                  disabled={!canEditStudent}
                  title={!canEditStudent ? 'You do not have permission to edit students' : undefined}
                  className={`flex-1 px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                    canEditStudent
                      ? 'bg-primary text-background hover:bg-primary/90'
                      : 'bg-background border border-border text-text-secondary/70 cursor-not-allowed'
                  }`}
                >
                  <Edit className="h-5 w-5" />
                  Edit Student
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

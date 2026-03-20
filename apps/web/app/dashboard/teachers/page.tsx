'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Edit,
  Eye,
  Grid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import toast from '@/lib/toast'
import {
  useCreateTeacher,
  useDeleteTeacher,
  useTeachers,
  useUpdateTeacher,
  type Teacher,
} from '@/lib/hooks/useTeachers'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { usePermissions } from '@/lib/permissions'
import LoadingScreen from '@/components/LoadingScreen'

type ViewMode = 'grid' | 'table'
type FilterType = 'all' | 'admin' | 'teacher' | 'withEmail' | 'withPhone' | 'active' | 'inactive'

const FILTER_OPTIONS: Array<{
  key: FilterType
  label: string
  activeClass: string
}> = [
  { key: 'all', label: 'All', activeClass: 'bg-primary text-background border-primary/30' },
  { key: 'admin', label: 'Admins', activeClass: 'bg-warning/20 text-warning border-warning/30' },
  { key: 'teacher', label: 'Teachers', activeClass: 'bg-success/20 text-success border-success/30' },
  { key: 'withEmail', label: 'With Email', activeClass: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30' },
  { key: 'withPhone', label: 'With Phone', activeClass: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
  { key: 'active', label: 'Active', activeClass: 'bg-success/20 text-success border-success/30' },
  { key: 'inactive', label: 'Inactive', activeClass: 'bg-error/20 text-error border-error/30' },
]

const buildTeacherForm = (defaultBranchId: number | null) => ({
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  is_staff: false,
  branch_ids: defaultBranchId !== null ? [defaultBranchId] : [],
  primary_branch_id: defaultBranchId,
})

const getInitials = (teacher: Teacher) => {
  if (teacher.first_name && teacher.last_name) {
    return `${teacher.first_name[0]}${teacher.last_name[0]}`.toUpperCase()
  }
  return teacher.username.substring(0, 2).toUpperCase()
}

const getFullName = (teacher: Teacher) => {
  if (teacher.first_name && teacher.last_name) {
    return `${teacher.first_name} ${teacher.last_name}`
  }
  return teacher.username
}

export default function TeachersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { branches, activeBranchId, isGlobalScope } = useBranchContext()
  const permissionState = usePermissions(user)
  const canCreateTeacher = permissionState.hasPermission('teachers.create')
  const canEditTeacher = permissionState.hasPermission('teachers.edit')
  const canDeleteTeacher = permissionState.hasPermission('teachers.delete')

  const [page, setPage] = useState(1)
  const [limit] = useState(12)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const [filterType, setFilterType] = useState<FilterType>('all')

  const branchScopeKey = activeBranchId ?? 'all'
  const activeBranchName = useMemo(() => {
    if (activeBranchId === null) {
      return isGlobalScope ? 'All branches' : 'Your branch scope'
    }
    return branches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`
  }, [activeBranchId, branches, isGlobalScope])

  const branchScopeDescription = useMemo(() => {
    if (activeBranchId === null) {
      return isGlobalScope ? 'Cross-branch dataset' : 'Current branch scope'
    }
    return activeBranchName
  }, [activeBranchId, activeBranchName, isGlobalScope])

  useEffect(() => {
    setPage(1)
  }, [branchScopeKey])

  const { data: teachersData, isLoading } = useTeachers({
    page,
    limit,
    search: debouncedSearchQuery,
    scopeKey: branchScopeKey,
    ...(filterType === 'admin' ? { is_staff: true } : {}),
    ...(filterType === 'teacher' ? { is_staff: false } : {}),
    ...(filterType === 'withEmail' ? { has_email: true } : {}),
    ...(filterType === 'withPhone' ? { has_phone: true } : {}),
    ...(filterType === 'active' ? { is_active: true } : {}),
    ...(filterType === 'inactive' ? { is_active: false } : {}),
  })

  const createTeacher = useCreateTeacher()
  const updateTeacher = useUpdateTeacher()
  const deleteTeacher = useDeleteTeacher()

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [isAddingTeacher, setIsAddingTeacher] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [newTeacher, setNewTeacher] = useState(() => buildTeacherForm(activeBranchId))

  useEffect(() => {
    if (isAddingTeacher) return
    setNewTeacher(buildTeacherForm(activeBranchId))
  }, [activeBranchId, isAddingTeacher])

  const teachers = useMemo<Teacher[]>(() => (teachersData?.results ?? []) as Teacher[], [teachersData?.results])
  const totalTeachers = teachersData?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalTeachers / limit))

  const stats = useMemo(() => {
    const visible = teachers.length
    const admins = teachers.filter((teacher) => teacher.is_staff).length
    const active = teachers.filter((teacher) => teacher.is_active !== false).length
    const inactive = teachers.filter((teacher) => teacher.is_active === false).length

    return {
      total: totalTeachers,
      visible,
      admins,
      active,
      inactive,
    }
  }, [teachers, totalTeachers])

  const openTeacherDetail = (teacherId: number) => {
    router.push(`/dashboard/teachers/${teacherId}`)
  }

  const handleDelete = (teacher: Teacher) => {
    if (!canDeleteTeacher) {
      toast.error('You do not have permission to deactivate teachers')
      return
    }

    if (!confirm(`Deactivate ${getFullName(teacher)}? They will not be able to login.`)) {
      return
    }

    deleteTeacher.mutate(teacher.id)
  }

  const withToggledBranch = (branchIds: number[] | undefined, branchId: number, checked: boolean): number[] => {
    const current = new Set(branchIds || [])
    if (checked) {
      current.add(branchId)
    } else {
      current.delete(branchId)
    }
    return Array.from(current)
  }

  const handleEdit = (teacher: Teacher) => {
    if (!canEditTeacher) {
      toast.error('You do not have permission to edit teachers')
      return
    }
    const resolvedBranchIds = teacher.branch_ids || (teacher.primary_branch_id ? [teacher.primary_branch_id] : [])
    setEditingTeacher({
      ...teacher,
      branch_ids: resolvedBranchIds,
      primary_branch_id: teacher.primary_branch_id ?? resolvedBranchIds[0] ?? null,
    })
  }

  const handleSaveEdit = () => {
    if (!canEditTeacher) {
      toast.error('You do not have permission to edit teachers')
      return
    }

    if (!editingTeacher) return

    updateTeacher.mutate(
      {
        id: editingTeacher.id,
        data: {
          first_name: editingTeacher.first_name,
          last_name: editingTeacher.last_name,
          email: editingTeacher.email,
          phone: editingTeacher.phone,
          branch_ids: editingTeacher.branch_ids || [],
          primary_branch_id: editingTeacher.primary_branch_id ?? null,
        },
      },
      {
        onSuccess: () => setEditingTeacher(null),
      },
    )
  }

  const handleAddTeacher = () => {
    if (!canCreateTeacher) {
      toast.error('You do not have permission to create teachers')
      return
    }

    if (!newTeacher.username || !newTeacher.password || !newTeacher.first_name || !newTeacher.last_name) {
      toast.warning('Please fill required fields: username, password, first name, last name')
      return
    }

    if (!newTeacher.branch_ids || newTeacher.branch_ids.length === 0) {
      toast.warning('Assign at least one branch for this teacher')
      return
    }

    createTeacher.mutate(newTeacher, {
      onSuccess: () => {
        setIsAddingTeacher(false)
        setNewTeacher(buildTeacherForm(activeBranchId))
      },
    })
  }

  if (isLoading && page === 1) {
    return <LoadingScreen message="Loading teachers..." />
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-28 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-primary" />
                Teachers Control Center
              </h1>
              <p className="text-text-secondary mt-1">
                Advanced teacher accounts, access, and profile operations.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  Branch scope
                </span>
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-text-secondary">
                  {branchScopeDescription}
                </span>
                {activeBranchId === null && isGlobalScope && (
                  <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-text-secondary">
                    Cross-branch view
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setNewTeacher(buildTeacherForm(activeBranchId))
                setIsAddingTeacher(true)
              }}
              disabled={!canCreateTeacher}
              title={!canCreateTeacher ? 'You do not have permission to create teachers' : undefined}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${
                canCreateTeacher
                  ? 'bg-primary text-background border-primary/30 hover:bg-primary/90'
                  : 'bg-surface/60 text-text-secondary/70 border-white/10 cursor-not-allowed'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Teacher
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Total in System</p>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-xs text-text-secondary mt-1">All pages</p>
            </div>
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">Visible Now</p>
              <p className="text-3xl font-bold">{stats.visible}</p>
              <p className="text-xs text-text-secondary mt-1">Current filter</p>
            </div>
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-warning mb-2">Admins</p>
              <p className="text-3xl font-bold">{stats.admins}</p>
              <p className="text-xs text-text-secondary mt-1">On this page</p>
            </div>
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-success mb-2">Active</p>
              <p className="text-3xl font-bold">{stats.active}</p>
              <p className="text-xs text-text-secondary mt-1">Can login</p>
            </div>
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-error mb-2">Inactive</p>
              <p className="text-3xl font-bold">{stats.inactive}</p>
              <p className="text-xs text-text-secondary mt-1">Blocked accounts</p>
            </div>
          </div>

          <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search teachers by name, username, email, phone..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="inline-flex items-center rounded-xl border border-white/15 bg-background/50 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-primary text-background'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background/70'
                  }`}
                  title="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                    viewMode === 'table'
                      ? 'bg-primary text-background'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background/70'
                  }`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => {
                    setFilterType(filter.key)
                    setPage(1)
                  }}
                  className={`px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition-colors ${
                    filterType === filter.key
                      ? filter.activeClass
                      : 'bg-background/60 border-white/10 text-text-secondary hover:text-text-primary hover:bg-background/80'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => openTeacherDetail(teacher.id)}
                  className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl p-5 hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {getInitials(teacher)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{getFullName(teacher)}</p>
                        <p className="text-xs text-text-secondary truncate">@{teacher.username}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] border ${teacher.is_staff ? 'bg-warning/10 text-warning border-warning/30' : 'bg-success/10 text-success border-success/30'}`}>
                        {teacher.is_staff ? 'Admin' : 'Teacher'}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md text-[11px] border ${teacher.is_active === false ? 'bg-error/10 text-error border-error/30' : 'bg-primary/10 text-primary border-primary/30'}`}>
                        {teacher.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{teacher.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Phone className="h-4 w-4" />
                      <span>{teacher.phone || 'No phone'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        openTeacherDetail(teacher.id)
                      }}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-background/60 text-xs font-semibold hover:bg-background/80"
                    >
                      <span className="inline-flex items-center justify-center gap-1 w-full">
                        <Eye className="h-3.5 w-3.5" />
                        Open
                      </span>
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleEdit(teacher)
                      }}
                      disabled={!canEditTeacher}
                      title={!canEditTeacher ? 'You do not have permission to edit teachers' : undefined}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                        canEditTeacher
                          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                          : 'border-white/10 bg-background/60 text-text-secondary/60 cursor-not-allowed'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1 w-full">
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </span>
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDelete(teacher)
                      }}
                      disabled={!canDeleteTeacher || deleteTeacher.isPending}
                      title={!canDeleteTeacher ? 'You do not have permission to deactivate teachers' : undefined}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                        canDeleteTeacher
                          ? 'border-error/30 bg-error/10 text-error hover:bg-error/20'
                          : 'border-white/10 bg-background/60 text-text-secondary/60 cursor-not-allowed'
                      } disabled:opacity-50`}
                    >
                      <span className="inline-flex items-center justify-center gap-1 w-full">
                        <Trash2 className="h-3.5 w-3.5" />
                        Stop
                      </span>
                    </button>
                  </div>
                </div>
              ))}

              {teachers.length === 0 && (
                <div className="col-span-full bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl py-14 text-center">
                  <Users className="h-10 w-10 text-text-secondary/60 mx-auto mb-3" />
                  <p className="font-semibold">No teachers found</p>
                  <p className="text-sm text-text-secondary mt-1">
                    {searchQuery ? 'Try a different keyword or filter.' : 'Create your first teacher to start.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="bg-surface/70 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-background/40 text-xs uppercase tracking-wide text-text-secondary">
                      <th className="text-left py-3 px-4">Teacher</th>
                      <th className="text-left py-3 px-4">Username</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4">Phone</th>
                      <th className="text-left py-3 px-4">Role</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b border-white/10 hover:bg-background/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                              {getInitials(teacher)}
                            </div>
                            <span className="font-medium">{getFullName(teacher)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">@{teacher.username}</td>
                        <td className="py-3 px-4 text-text-secondary">{teacher.email || '-'}</td>
                        <td className="py-3 px-4 text-text-secondary">{teacher.phone || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] border ${teacher.is_staff ? 'bg-warning/10 text-warning border-warning/30' : 'bg-success/10 text-success border-success/30'}`}>
                            {teacher.is_staff ? 'Admin' : 'Teacher'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] border ${teacher.is_active === false ? 'bg-error/10 text-error border-error/30' : 'bg-primary/10 text-primary border-primary/30'}`}>
                            {teacher.is_active === false ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openTeacherDetail(teacher.id)}
                              className="h-8 w-8 rounded-lg border border-white/10 bg-background/50 hover:bg-background/80 flex items-center justify-center"
                              title="Open"
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleEdit(teacher)}
                              disabled={!canEditTeacher}
                              title={!canEditTeacher ? 'You do not have permission to edit teachers' : 'Edit'}
                              className={`h-8 w-8 rounded-lg border flex items-center justify-center ${
                                canEditTeacher
                                  ? 'border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary'
                                  : 'border-white/10 bg-background/50 text-text-secondary/60 cursor-not-allowed'
                              }`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(teacher)}
                              disabled={!canDeleteTeacher || deleteTeacher.isPending}
                              title={!canDeleteTeacher ? 'You do not have permission to deactivate teachers' : 'Deactivate'}
                              className={`h-8 w-8 rounded-lg border flex items-center justify-center ${
                                canDeleteTeacher
                                  ? 'border-error/20 bg-error/10 hover:bg-error/20 text-error'
                                  : 'border-white/10 bg-background/50 text-text-secondary/60 cursor-not-allowed'
                              } disabled:opacity-50`}
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

              {teachers.length === 0 && (
                <div className="text-center py-14 text-text-secondary">
                  No teachers match your current search/filter.
                </div>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl border border-white/15 bg-surface/70 backdrop-blur-xl disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-text-secondary">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-xl border border-white/15 bg-surface/70 backdrop-blur-xl disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {isAddingTeacher && canCreateTeacher && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-surface/80 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-5">Create Teacher Account</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Username *</label>
                    <input
                      type="text"
                      value={newTeacher.username}
                      onChange={(event) => setNewTeacher({ ...newTeacher, username: event.target.value })}
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="teacher_username"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Password *</label>
                    <input
                      type="password"
                      value={newTeacher.password}
                      onChange={(event) => setNewTeacher({ ...newTeacher, password: event.target.value })}
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="********"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">First Name *</label>
                      <input
                        type="text"
                        value={newTeacher.first_name}
                        onChange={(event) => setNewTeacher({ ...newTeacher, first_name: event.target.value })}
                        className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Last Name *</label>
                      <input
                        type="text"
                        value={newTeacher.last_name}
                        onChange={(event) => setNewTeacher({ ...newTeacher, last_name: event.target.value })}
                        className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={newTeacher.email}
                      onChange={(event) => setNewTeacher({ ...newTeacher, email: event.target.value })}
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="teacher@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={newTeacher.phone}
                      onChange={(event) => setNewTeacher({ ...newTeacher, phone: event.target.value })}
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="+998901234567"
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Branch Assignments *</p>
                      <p className="text-xs text-text-secondary">
                        Teacher will be visible only in selected branches.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {branches.map((branch) => {
                        const checked = (newTeacher.branch_ids || []).includes(branch.id)
                        return (
                          <label
                            key={branch.id}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-background/50 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextBranchIds = withToggledBranch(
                                  newTeacher.branch_ids,
                                  branch.id,
                                  event.target.checked,
                                )
                                const nextPrimary =
                                  nextBranchIds.length === 0
                                    ? null
                                    : newTeacher.primary_branch_id &&
                                        nextBranchIds.includes(newTeacher.primary_branch_id)
                                      ? newTeacher.primary_branch_id
                                      : nextBranchIds[0]

                                setNewTeacher({
                                  ...newTeacher,
                                  branch_ids: nextBranchIds,
                                  primary_branch_id: nextPrimary,
                                })
                              }}
                            />
                            <span>{branch.name}</span>
                          </label>
                        )
                      })}
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-text-secondary">Primary Branch</label>
                      <select
                        value={newTeacher.primary_branch_id ?? ''}
                        onChange={(event) => {
                          const nextPrimary = event.target.value ? Number(event.target.value) : null
                          setNewTeacher({
                            ...newTeacher,
                            primary_branch_id: nextPrimary,
                          })
                        }}
                        className="w-full px-3 py-2 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                        disabled={(newTeacher.branch_ids || []).length === 0}
                      >
                        <option value="">Select primary branch</option>
                        {(newTeacher.branch_ids || []).map((branchId) => {
                          const branch = branches.find((item) => item.id === branchId)
                          return (
                            <option key={branchId} value={branchId}>
                              {branch?.name || `Branch #${branchId}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-background/50">
                    <input
                      type="checkbox"
                      checked={newTeacher.is_staff}
                      onChange={(event) => setNewTeacher({ ...newTeacher, is_staff: event.target.checked })}
                    />
                    <div>
                      <p className="text-sm font-medium">Grant staff/admin access</p>
                      <p className="text-xs text-text-secondary">Enable only if this user should access admin modules.</p>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={handleAddTeacher}
                    disabled={!canCreateTeacher || createTeacher.isPending}
                    className="px-4 py-3 rounded-xl bg-primary text-background font-semibold disabled:opacity-50"
                  >
                    {createTeacher.isPending ? 'Creating...' : 'Create Teacher'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingTeacher(false)
                      setNewTeacher(buildTeacherForm(activeBranchId))
                    }}
                    className="px-4 py-3 rounded-xl border border-white/15 bg-background/60 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingTeacher && canEditTeacher && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-surface/80 backdrop-blur-xl border border-white/15 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-5">Edit Teacher</h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">First Name</label>
                      <input
                        type="text"
                        value={editingTeacher.first_name}
                        onChange={(event) =>
                          setEditingTeacher({ ...editingTeacher, first_name: event.target.value })
                        }
                        className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Last Name</label>
                      <input
                        type="text"
                        value={editingTeacher.last_name}
                        onChange={(event) =>
                          setEditingTeacher({ ...editingTeacher, last_name: event.target.value })
                        }
                        className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={editingTeacher.email}
                      onChange={(event) =>
                        setEditingTeacher({ ...editingTeacher, email: event.target.value })
                      }
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={editingTeacher.phone || ''}
                      onChange={(event) =>
                        setEditingTeacher({ ...editingTeacher, phone: event.target.value })
                      }
                      className="w-full px-4 py-3 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-background/40 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Branch Assignments</p>
                      <p className="text-xs text-text-secondary">
                        This teacher will appear only inside selected branches.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {branches.map((branch) => {
                        const checked = (editingTeacher.branch_ids || []).includes(branch.id)
                        return (
                          <label
                            key={branch.id}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-background/50 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextBranchIds = withToggledBranch(
                                  editingTeacher.branch_ids,
                                  branch.id,
                                  event.target.checked,
                                )
                                const nextPrimary =
                                  nextBranchIds.length === 0
                                    ? null
                                    : editingTeacher.primary_branch_id &&
                                        nextBranchIds.includes(editingTeacher.primary_branch_id)
                                      ? editingTeacher.primary_branch_id
                                      : nextBranchIds[0]

                                setEditingTeacher({
                                  ...editingTeacher,
                                  branch_ids: nextBranchIds,
                                  primary_branch_id: nextPrimary,
                                })
                              }}
                            />
                            <span>{branch.name}</span>
                          </label>
                        )
                      })}
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-text-secondary">Primary Branch</label>
                      <select
                        value={editingTeacher.primary_branch_id ?? ''}
                        onChange={(event) => {
                          const nextPrimary = event.target.value ? Number(event.target.value) : null
                          setEditingTeacher({
                            ...editingTeacher,
                            primary_branch_id: nextPrimary,
                          })
                        }}
                        className="w-full px-3 py-2 bg-background/70 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                        disabled={(editingTeacher.branch_ids || []).length === 0}
                      >
                        <option value="">Select primary branch</option>
                        {(editingTeacher.branch_ids || []).map((branchId) => {
                          const branch = branches.find((item) => item.id === branchId)
                          return (
                            <option key={branchId} value={branchId}>
                              {branch?.name || `Branch #${branchId}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={handleSaveEdit}
                    disabled={!canEditTeacher || updateTeacher.isPending}
                    className="px-4 py-3 rounded-xl bg-primary text-background font-semibold disabled:opacity-50"
                  >
                    {updateTeacher.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditingTeacher(null)}
                    className="px-4 py-3 rounded-xl border border-white/15 bg-background/60 font-semibold"
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

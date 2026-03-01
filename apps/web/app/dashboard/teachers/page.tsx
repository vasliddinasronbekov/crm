'use client'

import { useState } from 'react'
import { Search, Plus, Edit, Trash2, Users, Shield, Mail, Phone, Eye, Grid, List, UserCircle2, Filter, TrendingUp } from 'lucide-react'
import toast from '@/lib/toast'
import { useTeachers, useCreateTeacher, useUpdateTeacher, useDeleteTeacher, Teacher } from '@/lib/hooks/useTeachers'
import { ProtectedRoute, RequirePermission } from '@/components/ProtectedRoute'
import { ActionButton } from '@/components/PermissionButton'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

type ViewMode = 'grid' | 'table'
type FilterType = 'all' | 'admin' | 'teacher' | 'withEmail' | 'withPhone'

export default function TeachersPage() {
  // React Query hooks
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(9)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const [filterType, setFilterType] = useState<FilterType>('all')

  const { data: teachersData, isLoading } = useTeachers({
  page,
  limit,
  search: debouncedSearchQuery,
  // 1. Agar 'all' bo'lsa, hech qanday staff filtrini yubormaymiz.
  // 2. Faqat 'admin' yoki 'teacher' tanlangandagina mos filtrni yuboramiz.
  ...(filterType === 'admin' ? { is_staff: true } : {}),
  ...(filterType === 'teacher' ? { is_staff: false } : {}), // Bazada teacherlar staff bo'lmasa
  ...(filterType === 'withEmail' ? { has_email: true } : {}),
  ...(filterType === 'withPhone' ? { has_phone: true } : {}),
})
  const createTeacher = useCreateTeacher()
  const updateTeacher = useUpdateTeacher()
  const deleteTeacher = useDeleteTeacher()

  // Local UI state
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [showDetailModal, setShowDetailModal] = useState<Teacher | null>(null)
  const [isAddingTeacher, setIsAddingTeacher] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [newTeacher, setNewTeacher] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })

  const teachers = teachersData?.results || []
  const totalTeachers = teachersData?.count || 0
  const totalPages = Math.ceil(totalTeachers / limit)

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

  // Statistics
  const stats = {
    total: totalTeachers,
    // The following stats would require dedicated API endpoints for accuracy with pagination
    admins: teachers.filter((t: Teacher) => t.is_staff).length,
    withEmail: teachers.filter((t: Teacher) => t.email).length,
    withPhone: teachers.filter((t: Teacher) => t.phone).length,
  }

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`Are you sure you want to delete ${getFullName(teacher)}? Note: Teachers cannot be permanently deleted, only deactivated.`)) {
      return
    }
    deleteTeacher.mutate(teacher.id)
  }

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
  }

  const handleSaveEdit = async () => {
    if (!editingTeacher) return

    updateTeacher.mutate(
      {
        id: editingTeacher.id,
        data: {
          first_name: editingTeacher.first_name,
          last_name: editingTeacher.last_name,
          email: editingTeacher.email,
          phone: editingTeacher.phone,
        },
      },
      {
        onSuccess: () => {
          setEditingTeacher(null)
        },
      }
    )
  }

  const handleAddTeacher = async () => {
    if (!newTeacher.username || !newTeacher.password || !newTeacher.first_name || !newTeacher.last_name) {
      toast.warning('Please fill in all required fields')
      return
    }

    createTeacher.mutate(newTeacher, {
      onSuccess: () => {
        setIsAddingTeacher(false)
        setNewTeacher({
          username: '',
          password: '',
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        })
      },
    })
  }

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading teachers...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              Teachers Management
            </span>
            <span className="text-gray-700">
              👨‍🏫
            </span>
          </h1>

          <p className="text-text-secondary">Manage teacher accounts and permissions</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.total}</p>
            <p className="text-sm text-text-secondary">Total Teachers</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-warning/50 transition-all hover:shadow-lg hover:shadow-warning/10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center border border-warning/20">
                <Shield className="h-6 w-6 text-warning" />
              </div>
              <span className="text-xs font-semibold text-text-secondary">
                On this page
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.admins}</p>
            <p className="text-sm text-text-secondary">Administrators</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center border border-cyan-500/20">
                <Mail className="h-6 w-6 text-cyan-500" />
              </div>
              <span className="text-xs font-semibold text-text-secondary">
                On this page
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.withEmail}</p>
            <p className="text-sm text-text-secondary">With Email</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6 hover:border-green-500/50 transition-all hover:shadow-lg hover:shadow-green-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center border border-green-500/20">
                <Phone className="h-6 w-6 text-green-500" />
              </div>
              <span className="text-xs font-semibold text-text-secondary">
                On this page
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.withPhone}</p>
            <p className="text-sm text-text-secondary">With Phone</p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search teachers (backend)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
              <button
                onClick={() => { setFilterType('all'); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filterType === 'all'
                  ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/20'
                  : 'bg-surface border border-border hover:border-primary/50'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => { setFilterType('admin'); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filterType === 'admin'
                  ? 'bg-gradient-to-r from-warning to-orange-500 text-white shadow-lg shadow-warning/20'
                  : 'bg-surface border border-border hover:border-warning/50'
                  }`}
              >
                Admins
              </button>
              <button
                onClick={() => { setFilterType('teacher'); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filterType === 'teacher'
                  ? 'bg-gradient-to-r from-success to-green-600 text-white shadow-lg shadow-success/20'
                  : 'bg-surface border border-border hover:border-success/50'
                  }`}
              >
                Teachers
              </button>
              <button
                onClick={() => { setFilterType('withEmail'); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filterType === 'withEmail'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-surface border border-border hover:border-cyan-500/50'
                  }`}
              >
                With Email
              </button>
            </div>
          </div>

          {/* View Mode and Add Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-surface border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                  ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg'
                  : 'text-text-secondary hover:bg-background'
                  }`}
                title="Grid View"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table'
                  ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg'
                  : 'text-text-secondary hover:bg-background'
                  }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Add Button */}
            <RequirePermission permission="teachers.create">
              <button
                onClick={() => setIsAddingTeacher(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-105 font-semibold"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Add Teacher</span>
                <span className="sm:hidden">Add</span>
              </button>
            </RequirePermission>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map((teacher: Teacher) => (
              <div
                key={teacher.id}
                className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/20">
                      {getInitials(teacher)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{getFullName(teacher)}</h3>
                      <p className="text-sm text-text-secondary">@{teacher.username}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${teacher.is_staff
                      ? 'bg-gradient-to-r from-warning/20 to-orange-500/20 text-warning border border-warning/30'
                      : 'bg-gradient-to-r from-success/20 to-green-500/20 text-success border border-success/30'
                      }`}
                  >
                    {teacher.is_staff ? '🛡️ Admin' : '👨‍🏫 Teacher'}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-text-secondary" />
                    <span className="text-text-secondary truncate">
                      {teacher.email || 'No email'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-text-secondary" />
                    <span className="text-text-secondary">
                      {teacher.phone || 'No phone'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => setShowDetailModal(teacher)}
                    className="flex-1 px-4 py-2 bg-background hover:bg-primary/10 rounded-xl text-sm font-semibold transition-all hover:border-primary/50 border border-border flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <RequirePermission permission="teachers.edit">
                    <button
                      onClick={() => handleEdit(teacher)}
                      className="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-xl transition-all"
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </button>
                  </RequirePermission>
                  <RequirePermission permission="teachers.delete">
                    <button
                      onClick={() => handleDelete(teacher)}
                      disabled={deleteTeacher.isPending}
                      className="px-4 py-2 bg-error/10 hover:bg-error/20 rounded-xl transition-all disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </button>
                  </RequirePermission>
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
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left py-4 px-6 text-sm font-semibold">Teacher</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold">Username</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold">Email</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold">Phone</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold">Role</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher: Teacher) => (
                    <tr
                      key={teacher.id}
                      className="border-b border-border hover:bg-background/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/20">
                            {getInitials(teacher)}
                          </div>
                          <div>
                            <p className="font-medium">{getFullName(teacher)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-text-secondary">@{teacher.username}</td>
                      <td className="py-4 px-6 text-text-secondary">{teacher.email || '-'}</td>
                      <td className="py-4 px-6 text-text-secondary">{teacher.phone || '-'}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${teacher.is_staff
                            ? 'bg-warning/20 text-warning border border-warning/30'
                            : 'bg-success/20 text-success border border-success/30'
                            }`}
                        >
                          {teacher.is_staff ? 'Admin' : 'Teacher'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowDetailModal(teacher)}
                            className="p-2 hover:bg-background rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4 text-cyan-500" />
                          </button>
                          <RequirePermission permission="teachers.edit">
                            <button
                              onClick={() => handleEdit(teacher)}
                              className="p-2 hover:bg-background rounded-lg transition-colors"
                            >
                              <Edit className="h-4 w-4 text-primary" />
                            </button>
                          </RequirePermission>
                          <RequirePermission permission="teachers.delete">
                            <button
                              onClick={() => handleDelete(teacher)}
                              disabled={deleteTeacher.isPending}
                              className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4 text-error" />
                            </button>
                          </RequirePermission>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {teachers.length === 0 && (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-text-secondary text-lg mb-2 font-semibold">No teachers found</p>
                  <p className="text-text-secondary text-sm">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'Add your first teacher to get started'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {totalPages > 1 && <PaginationControls />}

        {/* Add Teacher Modal */}
        {isAddingTeacher && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                Add New Teacher
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Username *</label>
                  <input
                    type="text"
                    value={newTeacher.username}
                    onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="teacher_username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Password *</label>
                  <input
                    type="password"
                    value={newTeacher.password}
                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="********"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">First Name *</label>
                    <input
                      type="text"
                      value={newTeacher.first_name}
                      onChange={(e) => setNewTeacher({ ...newTeacher, first_name: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={newTeacher.last_name}
                      onChange={(e) => setNewTeacher({ ...newTeacher, last_name: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="teacher@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Phone</label>
                  <input
                    type="tel"
                    value={newTeacher.phone}
                    onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="+998901234567"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleAddTeacher}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold"
                  >
                    Create Teacher
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingTeacher(false)
                      setNewTeacher({
                        username: '',
                        password: '',
                        first_name: '',
                        last_name: '',
                        email: '',
                        phone: '',
                      })
                    }}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border transition-all font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingTeacher && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                Edit Teacher
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">First Name</label>
                    <input
                      type="text"
                      value={editingTeacher.first_name}
                      onChange={(e) =>
                        setEditingTeacher({ ...editingTeacher, first_name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Last Name</label>
                    <input
                      type="text"
                      value={editingTeacher.last_name}
                      onChange={(e) =>
                        setEditingTeacher({ ...editingTeacher, last_name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={editingTeacher.email}
                    onChange={(e) =>
                      setEditingTeacher({ ...editingTeacher, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editingTeacher.phone || ''}
                    onChange={(e) =>
                      setEditingTeacher({ ...editingTeacher, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingTeacher(null)}
                    className="flex-1 px-6 py-3 bg-background border border-border rounded-xl hover:bg-border transition-all font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                  Teacher Details
                </h2>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="p-2 hover:bg-background rounded-lg transition-colors"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {/* Profile */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-br from-primary/10 to-cyan-500/10 rounded-xl border border-primary/20">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xl border-2 border-primary/30">
                  {getInitials(showDetailModal)}
                </div>
                <div>
                  <h3 className="font-bold text-xl">{getFullName(showDetailModal)}</h3>
                  <p className="text-sm text-text-secondary">@{showDetailModal.username}</p>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-4">
                <div className="p-4 bg-background rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-text-secondary uppercase">Email</p>
                  </div>
                  <p className="font-medium">{showDetailModal.email || 'Not provided'}</p>
                </div>

                <div className="p-4 bg-background rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-text-secondary uppercase">Phone</p>
                  </div>
                  <p className="font-medium">{showDetailModal.phone || 'Not provided'}</p>
                </div>

                <div className="p-4 bg-background rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-text-secondary uppercase">Role</p>
                  </div>
                  <span
                    className={`inline-flex px-3 py-1 rounded-lg text-sm font-semibold ${showDetailModal.is_staff
                      ? 'bg-warning/20 text-warning border border-warning/30'
                      : 'bg-success/20 text-success border border-success/30'
                      }`}
                  >
                    {showDetailModal.is_staff ? '🛡️ Administrator' : '👨‍🏫 Teacher'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowDetailModal(null)}
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

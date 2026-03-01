'use client'

import { useState } from 'react'
import toast from '@/lib/toast'
import { useSettings } from '@/contexts/SettingsContext'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  X,
  Search,
  Filter,
  Award,
  Calendar
} from 'lucide-react'
import { useCourses, useCreateCourse, useUpdateCourse, useDeleteCourse, Course } from '@/lib/hooks/useCourses'

export default function CoursesPage() {
  const { currency, formatCurrencyFromMinor, toSelectedCurrency, fromSelectedCurrency } = useSettings()
  // React Query hooks
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(6)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: coursesData, isLoading } = useCourses({
    page,
    limit,
    search: debouncedSearchTerm,
    level: levelFilter !== 'all' ? levelFilter : undefined,
    is_active: statusFilter !== 'all' ? (statusFilter === 'active' ? 'true' : 'false') : undefined,
  })
  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const deleteCourse = useDeleteCourse()

  // Local UI state
  const [showModal, setShowModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    duration_weeks: 0,
    level: 'beginner',
    is_active: true
  })

  const courses = coursesData?.results || []
  const totalCourses = coursesData?.count || 0
  const totalPages = Math.ceil(totalCourses / limit)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price) {
      toast.warning('Please fill in all required fields')
      return
    }

    createCourse.mutate({
      ...formData,
      price: fromSelectedCurrency(formData.price),
    }, {
      onSuccess: () => {
        setShowModal(false)
        resetForm()
      },
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCourse) return

    updateCourse.mutate(
      {
        id: editingCourse.id,
        data: {
          ...formData,
          price: fromSelectedCurrency(formData.price),
        },
      },
      {
        onSuccess: () => {
          setShowModal(false)
          setEditingCourse(null)
          resetForm()
        },
      }
    )
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return
    deleteCourse.mutate(id)
  }

  const openEditModal = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      name: course.name,
      description: course.description,
      price: toSelectedCurrency(course.price / 100),
      duration_weeks: course.duration_weeks,
      level: course.level,
      is_active: course.is_active
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      duration_weeks: 0,
      level: 'beginner',
      is_active: true
    })
  }

  // Stats are now based on the entire dataset from the API
  const stats = {
    totalCourses: coursesData?.count || 0,
    // The following stats would require dedicated API endpoints for accuracy with pagination
    activeCourses: (coursesData?.results || []).filter((c: Course) => c.is_active).length,
    averagePrice: (coursesData?.results || []).length > 0
      ? (coursesData?.results || []).reduce((sum: number, c: Course) => sum + c.price, 0) / (coursesData?.results || []).length
      : 0,
    totalRevenue: (coursesData?.results || []).reduce((sum: number, c: Course) => sum + c.price, 0)
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
          <p className="text-text-secondary">Loading courses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-primary" />
          Courses Management
        </h1>
        <p className="text-text-secondary">Manage your course catalog and pricing</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Courses</p>
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{stats.totalCourses}</p>
          <p className="text-xs text-text-secondary mt-2">In catalog</p>
        </div>

        <div className="stat-card border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Active Courses</p>
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">{stats.activeCourses}</p>
          <p className="text-xs text-text-secondary mt-2">On this page</p>
        </div>

        <div className="stat-card border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Average Price</p>
            <DollarSign className="h-5 w-5 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning">{formatCurrencyFromMinor(stats.averagePrice)}</p>
          <p className="text-xs text-text-secondary mt-2">On this page</p>
        </div>

        <div className="stat-card border-l-4 border-l-info">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Value</p>
            <Award className="h-5 w-5 text-info" />
          </div>
          <p className="text-3xl font-bold text-info">{formatCurrencyFromMinor(stats.totalRevenue)}</p>
          <p className="text-xs text-text-secondary mt-2">On this page</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search courses (backend)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Add Button */}
          <button
            onClick={() => {
              setEditingCourse(null)
              resetForm()
              setShowModal(true)
            }}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            Add Course
          </button>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course: Course) => (
          <div
            key={course.id}
            className="card hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{course.name}</h3>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    course.level === 'beginner'
                      ? 'bg-success/10 text-success'
                      : course.level === 'intermediate'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-error/10 text-error'
                  }`}>
                    {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    course.is_active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-text-secondary/10 text-text-secondary'
                  }`}>
                    {course.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-text-secondary text-sm mb-4 line-clamp-3">
              {course.description}
            </p>

            {/* Details */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="font-bold text-success text-lg">
                  {formatCurrencyFromMinor(course.price)}
                </span>
                <span className="text-text-secondary">/ course</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Clock className="h-4 w-4" />
                <span>{course.duration_weeks} weeks duration</span>
              </div>

              <div className="text-xs text-text-secondary">
                Created: {new Date(course.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                onClick={() => openEditModal(course)}
                className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(course.id)}
                className="px-4 py-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="card text-center py-12">
          <BookOpen className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
          <p className="text-text-secondary text-lg">No courses found</p>
          <p className="text-text-secondary text-sm mt-1">
            {searchTerm || levelFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first course to get started'}
          </p>
        </div>
      )}

      {totalPages > 1 && <PaginationControls />}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-2xl font-bold">
                {editingCourse ? 'Edit Course' : 'Create New Course'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingCourse(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingCourse ? handleUpdate : handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Course Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., English for Beginners"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={4}
                  placeholder="Describe what students will learn in this course..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price ({currency}) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || ''}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Duration (weeks) *</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                    <input
                      type="number"
                      min="1"
                      value={formData.duration_weeks || ''}
                      onChange={(e) => setFormData({ ...formData, duration_weeks: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="12"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Level *</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Course is active and available for enrollment</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingCourse(null)
                    resetForm()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingCourse ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { Search, Plus, Edit, Trash2, FileText, CheckCircle, Clock, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

interface Assignment {
  id: number
  course: number
  course_name?: string
  title: string
  description: string
  instructions: string
  due_date: string
  max_score: number
  is_published: boolean
  allow_late_submission: boolean
  submission_count?: number
  graded_count?: number
  created_at: string
}

interface Course {
  id: number
  name: string
}

export default function AssignmentsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateAssignment = permissionState.hasPermission('assignments.create')
  const canEditAssignment = permissionState.hasPermission('assignments.edit')
  const canDeleteAssignment = permissionState.hasPermission('assignments.delete')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [formData, setFormData] = useState({
    course: '',
    title: '',
    description: '',
    instructions: '',
    due_date: '',
    max_score: 100,
    is_published: false,
    allow_late_submission: false
  })

  const fetchCourses = useCallback(async () => {
    try {
      const response = await apiService.getCourses()
      setCourses(response.results || response || [])
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast.error('Failed to load courses')
    }
  }, [])

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (selectedCourse !== 'all') {
        params.course = selectedCourse
      }
      if (statusFilter !== 'all') {
        params.is_published = statusFilter === 'published'
      }
      const response = await apiService.getAssignments(params)
      setAssignments(response.results || response || [])
    } catch (error) {
      console.error('Error fetching assignments:', error)
      toast.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }, [selectedCourse, statusFilter])

  useEffect(() => {
    void fetchCourses()
    void fetchAssignments()
  }, [fetchAssignments, fetchCourses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingAssignment && !canEditAssignment) {
      toast.error('You do not have permission to edit assignments')
      return
    }
    if (!editingAssignment && !canCreateAssignment) {
      toast.error('You do not have permission to create assignments')
      return
    }

    if (!formData.title || !formData.course || !formData.due_date) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      if (editingAssignment) {
        await apiService.updateAssignment(editingAssignment.id, formData)
        toast.success('Assignment updated successfully!')
      } else {
        await apiService.createAssignment(formData)
        toast.success('Assignment created successfully!')
      }
      setShowModal(false)
      resetForm()
      void fetchAssignments()
    } catch (error) {
      console.error('Error saving assignment:', error)
      toast.error('Failed to save assignment')
    }
  }

  const handleEdit = (assignment: Assignment) => {
    if (!canEditAssignment) {
      toast.error('You do not have permission to edit assignments')
      return
    }
    setEditingAssignment(assignment)
    setFormData({
      course: assignment.course.toString(),
      title: assignment.title,
      description: assignment.description || '',
      instructions: assignment.instructions || '',
      due_date: assignment.due_date ? assignment.due_date.split('T')[0] : '',
      max_score: assignment.max_score || 100,
      is_published: assignment.is_published,
      allow_late_submission: assignment.allow_late_submission
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number, title: string) => {
    if (!canDeleteAssignment) {
      toast.error('You do not have permission to delete assignments')
      return
    }
    if (!confirm(`Are you sure you want to delete "${title}"? All submissions will also be deleted.`)) {
      return
    }

    try {
      await apiService.deleteAssignment(id)
      toast.success('Assignment deleted successfully')
      void fetchAssignments()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast.error('Failed to delete assignment')
    }
  }

  const resetForm = () => {
    setFormData({
      course: '',
      title: '',
      description: '',
      instructions: '',
      due_date: '',
      max_score: 100,
      is_published: false,
      allow_late_submission: false
    })
    setEditingAssignment(null)
  }

  const filteredAssignments = assignments.filter(assignment =>
    assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const isDueSoon = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24))
    return diffDays <= 3 && diffDays >= 0
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Assignments 📝</h1>
        <p className="text-text-secondary">Create and manage student assignments</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Course Filter */}
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="all">All Courses</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => {
            if (!canCreateAssignment) return
            resetForm()
            setShowModal(true)
          }}
          disabled={!canCreateAssignment}
          title={!canCreateAssignment ? 'You do not have permission to create assignments' : undefined}
          className={`flex items-center gap-2 ${canCreateAssignment ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'}`}
        >
          <Plus className="h-5 w-5" />
          Create Assignment
        </button>
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading assignments...</p>
          </div>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-secondary text-lg mb-4">No assignments found</p>
          <button
            onClick={() => {
              if (!canCreateAssignment) return
              resetForm()
              setShowModal(true)
            }}
            disabled={!canCreateAssignment}
            className={`btn-primary ${!canCreateAssignment ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Create Your First Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Assignment Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">{assignment.title}</h3>
                    {assignment.is_published ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        Published
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-text-secondary">
                        Draft
                      </span>
                    )}
                    {assignment.due_date && isDueSoon(assignment.due_date) && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due Soon
                      </span>
                    )}
                    {assignment.due_date && isOverdue(assignment.due_date) && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-error/10 text-error">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-3">
                    {assignment.description || 'No description'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm text-text-secondary">
                    {assignment.course_name && <span>Course: {assignment.course_name}</span>}
                    {assignment.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </span>
                    )}
                    <span>Max Score: {assignment.max_score}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {assignment.submission_count || 0} submissions
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {assignment.graded_count || 0} graded
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/lms/assignments/${assignment.id}/submissions`)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
                    title="View Submissions"
                  >
                    <Users className="h-4 w-4" />
                    Submissions
                  </button>
                  <button
                    onClick={() => handleEdit(assignment)}
                    disabled={!canEditAssignment}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-surface text-text hover:bg-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canEditAssignment ? 'You do not have permission to edit assignments' : 'Edit'}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(assignment.id, assignment.title)}
                    disabled={!canDeleteAssignment}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canDeleteAssignment ? 'You do not have permission to delete assignments' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Course Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Course <span className="text-error">*</span>
                  </label>
                  <select
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">Select a course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Assignment Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Python Programming Final Project"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Brief overview of the assignment..."
                    rows={3}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium mb-2">Instructions</label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Detailed instructions for students..."
                    rows={6}
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Due Date <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                {/* Max Score */}
                <div>
                  <label className="block text-sm font-medium mb-2">Max Score</label>
                  <input
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    min="0"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_published"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="w-5 h-5 rounded border-border bg-background"
                    />
                    <label htmlFor="is_published" className="text-sm font-medium">
                      Publish assignment (make visible to students)
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="allow_late_submission"
                      checked={formData.allow_late_submission}
                      onChange={(e) => setFormData({ ...formData, allow_late_submission: e.target.checked })}
                      className="w-5 h-5 rounded border-border bg-background"
                    />
                    <label htmlFor="allow_late_submission" className="text-sm font-medium">
                      Allow late submissions
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-3 bg-surface text-text rounded-xl hover:bg-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editingAssignment ? !canEditAssignment : !canCreateAssignment}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingAssignment ? 'Update Assignment' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

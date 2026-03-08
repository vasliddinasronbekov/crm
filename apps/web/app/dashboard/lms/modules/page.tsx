'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { Search, Plus, Edit, Trash2, BookOpen, MoveUp, MoveDown, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

interface Module {
  id: number
  course: number
  course_name?: string
  title: string
  description: string
  order: number
  is_published: boolean
  estimated_duration_hours: number
  lesson_count?: number
  created_at: string
}

interface Course {
  id: number
  name: string
}

export default function ModulesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateModule = permissionState.hasPermission('modules.create')
  const canEditModule = permissionState.hasPermission('modules.edit')
  const canDeleteModule = permissionState.hasPermission('modules.delete')
  const [modules, setModules] = useState<Module[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<number | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [formData, setFormData] = useState({
    course: '',
    title: '',
    description: '',
    estimated_duration_hours: 0,
    is_published: false
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

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (selectedCourse !== 'all') {
        params.course = selectedCourse
      }
      const response = await apiService.getModules(params)
      setModules(response.results || [])
    } catch (error: any) {
      console.error('Error fetching modules:', error)
      toast.error(`Failed to load modules. Server responded with ${error.response?.status || 'an error'}.`)
    } finally {
      setLoading(false)
    }
  }, [selectedCourse])

  useEffect(() => {
    void fetchCourses()
    void fetchModules()
  }, [fetchCourses, fetchModules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingModule && !canEditModule) {
      toast.error('You do not have permission to edit modules')
      return
    }
    if (!editingModule && !canCreateModule) {
      toast.error('You do not have permission to create modules')
      return
    }

    if (!formData.title || !formData.course) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      if (editingModule) {
        await apiService.updateModule(editingModule.id, formData)
        toast.success('Module updated successfully!')
      } else {
        await apiService.createModule(formData)
        toast.success('Module created successfully!')
      }
      setShowModal(false)
      resetForm()
      void fetchModules()
    } catch (error) {
      console.error('Error saving module:', error)
      toast.error('Failed to save module')
    }
  }

  const handleEdit = (module: Module) => {
    if (!canEditModule) {
      toast.error('You do not have permission to edit modules')
      return
    }
    setEditingModule(module)
    setFormData({
      course: module.course.toString(),
      title: module.title,
      description: module.description || '',
      estimated_duration_hours: module.estimated_duration_hours || 0,
      is_published: module.is_published
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number, title: string) => {
    if (!canDeleteModule) {
      toast.error('You do not have permission to delete modules')
      return
    }
    if (!confirm(`Are you sure you want to delete "${title}"? This will also delete all lessons in this module.`)) {
      return
    }

    try {
      await apiService.deleteModule(id)
      toast.success('Module deleted successfully')
      void fetchModules()
    } catch (error) {
      console.error('Error deleting module:', error)
      toast.error('Failed to delete module')
    }
  }

  const resetForm = () => {
    setFormData({
      course: '',
      title: '',
      description: '',
      estimated_duration_hours: 0,
      is_published: false
    })
    setEditingModule(null)
  }

  const filteredModules = modules.filter(module =>
    module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    module.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Course Modules 📚</h1>
        <p className="text-text-secondary">Organize your course content into modules</p>
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

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => {
            if (!canCreateModule) return
            resetForm()
            setShowModal(true)
          }}
          disabled={!canCreateModule}
          title={!canCreateModule ? 'You do not have permission to create modules' : undefined}
          className={`flex items-center gap-2 ${canCreateModule ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'}`}
        >
          <Plus className="h-5 w-5" />
          Create Module
        </button>
      </div>

      {/* Modules List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading modules...</p>
          </div>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-secondary text-lg mb-4">No modules found</p>
          <button
            onClick={() => {
              if (!canCreateModule) return
              resetForm()
              setShowModal(true)
            }}
            disabled={!canCreateModule}
            className={`btn-primary ${!canCreateModule ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Create Your First Module
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredModules.map((module) => (
            <div key={module.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Module Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">{module.title}</h3>
                    {module.is_published ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        Published
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-text-secondary">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{module.description || 'No description'}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm text-text-secondary">
                    <span>Order: {module.order}</span>
                    <span>Lessons: {module.lesson_count || 0}</span>
                    <span>Duration: {module.estimated_duration_hours}h</span>
                    {module.course_name && <span>Course: {module.course_name}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/lms/modules/${module.id}/lessons`)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
                    title="View Lessons"
                  >
                    <Eye className="h-4 w-4" />
                    Lessons
                  </button>
                  <button
                    onClick={() => handleEdit(module)}
                    disabled={!canEditModule}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-surface text-text hover:bg-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canEditModule ? 'You do not have permission to edit modules' : 'Edit'}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(module.id, module.title)}
                    disabled={!canDeleteModule}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canDeleteModule ? 'You do not have permission to delete modules' : 'Delete'}
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
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingModule ? 'Edit Module' : 'Create New Module'}
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
                    Module Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Introduction to Programming"
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
                    placeholder="Module overview and objectives..."
                    rows={4}
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium mb-2">Estimated Duration (hours)</label>
                  <input
                    type="number"
                    value={formData.estimated_duration_hours}
                    onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    min="0"
                  />
                </div>

                {/* Published */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="w-5 h-5 rounded border-border bg-background"
                  />
                  <label htmlFor="is_published" className="text-sm font-medium">
                    Publish module (make visible to students)
                  </label>
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
                    disabled={editingModule ? !canEditModule : !canCreateModule}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingModule ? 'Update Module' : 'Create Module'}
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

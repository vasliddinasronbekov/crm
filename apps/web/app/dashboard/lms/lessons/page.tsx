'use client'

import { useState, useEffect, useCallback } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import { Search, Plus, Edit, Trash2, FileText, Video, Link as LinkIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/lib/permissions'

interface Lesson {
  id: number
  module: number
  module_name?: string
  title: string
  description: string
  content: string
  lesson_type: 'video' | 'text' | 'mixed'
  video_url?: string
  duration_minutes: number
  order: number
  is_published: boolean
  is_free_preview: boolean
  created_at: string
}

interface ApiLesson {
  id: number
  module: number
  module_title?: string
  title: string
  description: string
  content: string
  lesson_type: string
  video_url?: string
  video_duration_seconds?: number
  order: number
  is_published: boolean
  is_free_preview: boolean
  created_at: string
}

interface Module {
  id: number
  title: string
  course_name?: string
}

export default function LessonsPage() {
  const { user } = useAuth()
  const permissionState = usePermissions(user)
  const canCreateLesson = permissionState.hasPermission('lessons.create')
  const canEditLesson = permissionState.hasPermission('lessons.edit')
  const canDeleteLesson = permissionState.hasPermission('lessons.delete')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModule, setSelectedModule] = useState<number | 'all'>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [formData, setFormData] = useState({
    module: '',
    title: '',
    description: '',
    content: '',
    lesson_type: 'text' as 'video' | 'text' | 'mixed',
    video_url: '',
    duration_minutes: 0,
    is_published: false,
    is_free_preview: false
  })

  const mapApiLessonTypeToUi = useCallback((lessonType: string, content?: string): 'video' | 'text' | 'mixed' => {
    if (lessonType === 'article') {
      return 'text'
    }
    if (lessonType === 'video' && content?.trim()) {
      return 'mixed'
    }
    return 'video'
  }, [])

  const mapLessonFromApi = useCallback((lesson: ApiLesson): Lesson => ({
    id: lesson.id,
    module: lesson.module,
    module_name: lesson.module_title,
    title: lesson.title,
    description: lesson.description || '',
    content: lesson.content || '',
    lesson_type: mapApiLessonTypeToUi(lesson.lesson_type, lesson.content),
    video_url: lesson.video_url || '',
    duration_minutes: Math.round((lesson.video_duration_seconds || 0) / 60),
    order: lesson.order,
    is_published: lesson.is_published,
    is_free_preview: lesson.is_free_preview,
    created_at: lesson.created_at
  }), [mapApiLessonTypeToUi])

  const buildLessonPayload = () => {
    const uiType = formData.lesson_type
    const resolvedLessonType = uiType === 'text' ? 'article' : 'video'

    return {
      module: parseInt(formData.module, 10),
      title: formData.title,
      description: formData.description,
      content: formData.content,
      lesson_type: resolvedLessonType,
      video_url: formData.video_url || '',
      video_duration_seconds: formData.duration_minutes * 60,
      is_published: formData.is_published,
      is_free_preview: formData.is_free_preview
    }
  }

  const fetchModules = useCallback(async () => {
    try {
      const response = await apiService.getModules()
      setModules(response.results || response || [])
    } catch (error) {
      console.error('Error fetching modules:', error)
      toast.error('Failed to load modules')
    }
  }, [])

  const fetchLessons = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (selectedModule !== 'all') {
        params.module_id = selectedModule
      }
      const response = await apiService.getLessons(params)
      const results = response.results || response || []
      setLessons(results.map(mapLessonFromApi))
    } catch (error) {
      console.error('Error fetching lessons:', error)
      toast.error('Failed to load lessons')
    } finally {
      setLoading(false)
    }
  }, [mapLessonFromApi, selectedModule])

  useEffect(() => {
    void fetchModules()
    void fetchLessons()
  }, [fetchLessons, fetchModules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingLesson && !canEditLesson) {
      toast.error('You do not have permission to edit lessons')
      return
    }
    if (!editingLesson && !canCreateLesson) {
      toast.error('You do not have permission to create lessons')
      return
    }

    if (!formData.title || !formData.module) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.lesson_type === 'text' && !formData.content.trim()) {
      toast.error('Text lessons require content')
      return
    }

    if ((formData.lesson_type === 'video' || formData.lesson_type === 'mixed') && !formData.video_url.trim()) {
      toast.error('Video and mixed lessons require a video URL')
      return
    }

    try {
      const payload = buildLessonPayload()
      if (editingLesson) {
        await apiService.updateLesson(editingLesson.id, payload)
        toast.success('Lesson updated successfully!')
      } else {
        await apiService.createLesson(payload)
        toast.success('Lesson created successfully!')
      }
      setShowModal(false)
      resetForm()
      void fetchLessons()
    } catch (error: any) {
      console.error('Error saving lesson:', error)
      const responseData = error?.response?.data
      const message =
        typeof responseData === 'string'
          ? responseData
          : responseData?.detail ||
            Object.values(responseData || {}).flat().join(' ') ||
            'Failed to save lesson'
      toast.error(message)
    }
  }

  const handleEdit = (lesson: Lesson) => {
    if (!canEditLesson) {
      toast.error('You do not have permission to edit lessons')
      return
    }
    setEditingLesson(lesson)
    setFormData({
      module: lesson.module.toString(),
      title: lesson.title,
      description: lesson.description || '',
      content: lesson.content || '',
      lesson_type: lesson.lesson_type,
      video_url: lesson.video_url || '',
      duration_minutes: lesson.duration_minutes || 0,
      is_published: lesson.is_published,
      is_free_preview: lesson.is_free_preview
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number, title: string) => {
    if (!canDeleteLesson) {
      toast.error('You do not have permission to delete lessons')
      return
    }
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }

    try {
      await apiService.deleteLesson(id)
      toast.success('Lesson deleted successfully')
      void fetchLessons()
    } catch (error) {
      console.error('Error deleting lesson:', error)
      toast.error('Failed to delete lesson')
    }
  }

  const resetForm = () => {
    setFormData({
      module: '',
      title: '',
      description: '',
      content: '',
      lesson_type: 'text',
      video_url: '',
      duration_minutes: 0,
      is_published: false,
      is_free_preview: false
    })
    setEditingLesson(null)
  }

  const filteredLessons = lessons.filter(lesson =>
    (selectedType === 'all' || lesson.lesson_type === selectedType) &&
    (
      lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-5 w-5 text-purple-500" />
      case 'text':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'mixed':
        return <LinkIcon className="h-5 w-5 text-green-500" />
      default:
        return <FileText className="h-5 w-5 text-text-secondary" />
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Lessons 📖</h1>
        <p className="text-text-secondary">Create and manage lesson content</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Module Filter */}
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="all">All Modules</option>
          {modules.map(module => (
            <option key={module.id} value={module.id}>
              {module.title} {module.course_name && `(${module.course_name})`}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary"
        >
          <option value="all">All Types</option>
          <option value="video">Video</option>
          <option value="text">Text</option>
          <option value="mixed">Mixed</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search lessons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => {
            if (!canCreateLesson) return
            resetForm()
            setShowModal(true)
          }}
          disabled={!canCreateLesson}
          title={!canCreateLesson ? 'You do not have permission to create lessons' : undefined}
          className={`flex items-center gap-2 ${canCreateLesson ? 'btn-primary' : 'btn-secondary opacity-70 cursor-not-allowed'}`}
        >
          <Plus className="h-5 w-5" />
          Create Lesson
        </button>
      </div>

      {/* Lessons List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading lessons...</p>
          </div>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-secondary text-lg mb-4">No lessons found</p>
          <button
            onClick={() => {
              if (!canCreateLesson) return
              resetForm()
              setShowModal(true)
            }}
            disabled={!canCreateLesson}
            className={`btn-primary ${!canCreateLesson ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Create Your First Lesson
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => (
            <div key={lesson.id} className="card hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getLessonIcon(lesson.lesson_type)}
                  <span className="text-xs font-medium capitalize text-text-secondary">
                    {lesson.lesson_type}
                  </span>
                </div>
                <div className="flex gap-2">
                  {lesson.is_published ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface text-text-secondary">
                      Draft
                    </span>
                  )}
                  {lesson.is_free_preview && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      Free
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-2 line-clamp-2">{lesson.title}</h3>
              <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                {lesson.description || 'No description'}
              </p>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-text-secondary mb-4">
                <span>Order: {lesson.order}</span>
                <span>Duration: {lesson.duration_minutes}m</span>
              </div>

              {lesson.module_name && (
                <div className="text-xs text-text-secondary mb-4 truncate">
                  Module: {lesson.module_name}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-border pt-4 flex gap-2">
                <button
                  onClick={() => handleEdit(lesson)}
                  disabled={!canEditLesson}
                  title={!canEditLesson ? 'You do not have permission to edit lessons' : undefined}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(lesson.id, lesson.title)}
                  disabled={!canDeleteLesson}
                  title={!canDeleteLesson ? 'You do not have permission to delete lessons' : undefined}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingLesson ? 'Edit Lesson' : 'Create New Lesson'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Module Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Module <span className="text-error">*</span>
                  </label>
                  <select
                    value={formData.module}
                    onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">Select a module</option>
                    {modules.map(module => (
                      <option key={module.id} value={module.id}>
                        {module.title} {module.course_name && `(${module.course_name})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Lesson Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Getting Started with Variables"
                    required
                  />
                </div>

                {/* Lesson Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Lesson Type <span className="text-error">*</span>
                  </label>
                  <select
                    value={formData.lesson_type}
                    onChange={(e) => setFormData({ ...formData, lesson_type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                  >
                    <option value="text">Text</option>
                    <option value="video">Video</option>
                    <option value="mixed">Mixed (Text + Video)</option>
                  </select>
                </div>

                {/* Video URL (if video or mixed) */}
                {(formData.lesson_type === 'video' || formData.lesson_type === 'mixed') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Video URL</label>
                    <input
                      type="url"
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Lesson overview..."
                    rows={3}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium mb-2">Content</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Full lesson content (supports markdown)..."
                    rows={8}
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value, 10) || 0 })}
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
                      Publish lesson (make visible to students)
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_free_preview"
                      checked={formData.is_free_preview}
                      onChange={(e) => setFormData({ ...formData, is_free_preview: e.target.checked })}
                      className="w-5 h-5 rounded border-border bg-background"
                    />
                    <label htmlFor="is_free_preview" className="text-sm font-medium">
                      Free preview (accessible without enrollment)
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
                    disabled={editingLesson ? !canEditLesson : !canCreateLesson}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingLesson ? 'Update Lesson' : 'Create Lesson'}
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

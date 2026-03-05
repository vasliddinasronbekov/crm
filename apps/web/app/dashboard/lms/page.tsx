'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Edit, Trash2, BookOpen, Video, FileText, Headphones, File, Sparkles, Code2, ClipboardList } from 'lucide-react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import LoadingScreen from '@/components/LoadingScreen'

interface Course {
  id: number
  name: string
  description?: string
  duration_weeks?: number
  level?: string
  is_published?: boolean
  created_at: string
}

interface LessonSummary {
  id: number
  lesson_type: string
}

interface ContentStat {
  key: string
  title: string
  description: string
  count: number
  icon: any
  accent: string
}

interface ContentDefinition {
  key: string
  title: string
  description: string
  icon: any
  accent: string
  lessonTypes: string[]
}

export default function LMSPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddingCourse, setIsAddingCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newCourse, setNewCourse] = useState({
    name: '',
    description: '',
    duration_weeks: 12,
    level: 'Beginner',
    price: 0,
  })

  useEffect(() => {
    loadLMSData()
  }, [])

  const contentDefinitions: ContentDefinition[] = [
    {
      key: 'video',
      title: 'Videos',
      description: 'Recorded video lessons and walkthroughs',
      icon: Video,
      accent: 'text-purple-500 bg-purple-500/10',
      lessonTypes: ['video'],
    },
    {
      key: 'book',
      title: 'Books & PDFs',
      description: 'Books, reading packs, and downloadable PDFs',
      icon: BookOpen,
      accent: 'text-emerald-500 bg-emerald-500/10',
      lessonTypes: ['book'],
    },
    {
      key: 'article',
      title: 'Articles',
      description: 'Text lessons, reading content, and guides',
      icon: FileText,
      accent: 'text-blue-500 bg-blue-500/10',
      lessonTypes: ['article'],
    },
    {
      key: 'audio',
      title: 'Audio',
      description: 'Listening practice, podcasts, and audio lectures',
      icon: Headphones,
      accent: 'text-orange-500 bg-orange-500/10',
      lessonTypes: ['audio'],
    },
    {
      key: 'assessment',
      title: 'Assessments',
      description: 'Embedded quiz and assignment lesson content',
      icon: ClipboardList,
      accent: 'text-pink-500 bg-pink-500/10',
      lessonTypes: ['quiz', 'assignment'],
    },
    {
      key: 'interactive',
      title: 'Interactive',
      description: 'Flashcards, activities, and interactive exercises',
      icon: Sparkles,
      accent: 'text-cyan-500 bg-cyan-500/10',
      lessonTypes: ['interactive', 'flashcards', 'live_session'],
    },
    {
      key: 'code',
      title: 'Code Labs',
      description: 'Coding exercises and technical practice content',
      icon: Code2,
      accent: 'text-indigo-500 bg-indigo-500/10',
      lessonTypes: ['code_exercise'],
    },
    {
      key: 'file',
      title: 'Downloads',
      description: 'Files, worksheets, templates, and other resources',
      icon: File,
      accent: 'text-amber-500 bg-amber-500/10',
      lessonTypes: ['file'],
    },
  ]

  const contentStats: ContentStat[] = contentDefinitions.map((definition) => ({
    key: definition.key,
    title: definition.title,
    description: definition.description,
    count: lessons.filter((lesson) => definition.lessonTypes.includes(lesson.lesson_type)).length,
    icon: definition.icon,
    accent: definition.accent,
  }))

  const loadLMSData = async () => {
    try {
      const [coursesData, lessonsData, dashboardStats] = await Promise.all([
        apiService.getCourses().catch(() => ({ results: [] })),
        apiService.getLessons().catch(() => ({ results: [] })),
        apiService.getDashboardStats().catch(() => ({})),
      ])

      setCourses(coursesData.results || coursesData || [])
      setLessons((lessonsData.results || lessonsData || []).map((lesson: any) => ({
        id: lesson.id,
        lesson_type: lesson.lesson_type,
      })))
      setStats(dashboardStats)
    } catch (error) {
      console.error('Failed to load LMS data:', error)
      toast.error('Failed to load LMS data:')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCourse = async () => {
    if (!newCourse.name) {
      toast.warning('Please fill in course name')
      return
    }

    try {
      const created = await apiService.createCourse(newCourse)
      setCourses([...courses, created])
      setIsAddingCourse(false)
      setNewCourse({
        name: '',
        description: '',
        duration_weeks: 12,
        level: 'Beginner',
        price: 0,
      })
      toast.success('Course created successfully')
      loadLMSData()
    } catch (error: any) {
      console.error('Failed to create course:', error)
      toast.error(error.response?.data?.detail || 'Failed to create course')
    }
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
  }

  const handleSaveEdit = async () => {
    if (!editingCourse) return

    try {
      const updated = await apiService.updateCourse(editingCourse.id, {
        name: editingCourse.name,
        description: editingCourse.description,
        duration_weeks: editingCourse.duration_weeks,
        level: editingCourse.level,
      })
      setCourses(courses.map((c) => (c.id === editingCourse.id ? { ...c, ...updated } : c)))
      setEditingCourse(null)
      toast.success('Course updated successfully')
    } catch (error: any) {
      console.error('Failed to update course:', error)
      toast.error(error.response?.data?.detail || 'Failed to update course')
    }
  }

  const handleDelete = async (course: Course) => {
    if (!confirm(`Are you sure you want to delete course "${course.name}"?`)) {
      return
    }

    setIsDeleting(true)
    try {
      await apiService.deleteCourse(course.id)
      setCourses(courses.filter((c) => c.id !== course.id))
      toast.success('Course deleted successfully')
    } catch (error: any) {
      console.error('Failed to delete course:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete course')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredCourses = courses.filter((course) => {
    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'published' && course.is_published !== false) ||
      (filterStatus === 'draft' && course.is_published === false)
    const query = searchQuery.toLowerCase()
    const matchesSearch = query === '' ||
      course.name.toLowerCase().includes(query) ||
      course.description?.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  })

  if (isLoading) {
    return <LoadingScreen message="Loading courses..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">LMS Dashboard 🎓</h1>
        <p className="text-text-secondary">Manage courses, lessons, and learning content</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Add Button */}
        <button
          onClick={() => setIsAddingCourse(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Course
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-value">{courses.length}</div>
          <div className="stat-label">Total Courses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.total_groups || 0}</div>
          <div className="stat-label">Active Groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.total_students || 0}</div>
          <div className="stat-label">Enrolled Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{lessons.length}</div>
          <div className="stat-label">Content Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.total_teachers || 0}</div>
          <div className="stat-label">Teachers</div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <button
          onClick={() => window.location.href = '/dashboard/lms/modules'}
          className="card hover:shadow-lg transition-shadow text-left p-6 bg-gradient-to-br from-success/10 to-success/5"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
            <h3 className="text-xl font-bold">Modules</h3>
          </div>
          <p className="text-text-secondary text-sm mb-3">Organize content into structured modules</p>
          <div className="text-success font-medium text-sm">Manage Modules →</div>
        </button>

        <button
          onClick={() => window.location.href = '/dashboard/lms/lessons'}
          className="card hover:shadow-lg transition-shadow text-left p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <span className="text-2xl">📖</span>
            </div>
            <h3 className="text-xl font-bold">Lessons</h3>
          </div>
          <p className="text-text-secondary text-sm mb-3">Create video, text, and mixed lessons</p>
          <div className="text-blue-500 font-medium text-sm">Manage Lessons →</div>
        </button>

        <button
          onClick={() => window.location.href = '/dashboard/quizzes'}
          className="card hover:shadow-lg transition-shadow text-left p-6 bg-gradient-to-br from-primary/10 to-primary/5"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <h3 className="text-xl font-bold">Quizzes</h3>
          </div>
          <p className="text-text-secondary text-sm mb-3">Create and manage quizzes for assessments</p>
          <div className="text-primary font-medium text-sm">Manage Quizzes →</div>
        </button>

        <button
          onClick={() => window.location.href = '/dashboard/lms/assignments'}
          className="card hover:shadow-lg transition-shadow text-left p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-xl font-bold">Assignments</h3>
          </div>
          <p className="text-text-secondary text-sm mb-3">Create and track student assignments</p>
          <div className="text-purple-500 font-medium text-sm">Manage Assignments →</div>
        </button>
      </div>

      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Content Library</h2>
          <p className="text-sm text-text-secondary mt-1">
            LMS content types available across books, videos, articles, practice, and downloadable resources.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {contentStats.map((item) => {
            const Icon = item.icon

            return (
              <div key={item.key} className="card border border-border/80">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${item.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-bold">{item.count}</span>
                </div>
                <div className="font-semibold mb-1">{item.title}</div>
                <p className="text-sm text-text-secondary">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex gap-2">
          {['all', 'published', 'draft'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === filter
                  ? 'bg-primary text-background'
                  : 'bg-surface text-text-secondary hover:bg-border'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Courses List */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">
          All Courses ({filteredCourses.length})
        </h2>
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div key={course.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold">{course.name}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-lg ${
                        course.is_published === false
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {course.is_published === false ? 'Draft' : 'Published'}
                    </span>
                    <button
                      onClick={() => handleEdit(course)}
                      className="p-2 hover:bg-background rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4 text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(course)}
                      disabled={isDeleting}
                      className="p-2 hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </button>
                  </div>
                </div>

                {course.description && (
                  <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                    {course.description}
                  </p>
                )}

                <div className="space-y-2 mb-3 text-sm text-text-secondary">
                  <div className="flex justify-between">
                    <span>
                      Duration: {course.duration_weeks || 'N/A'} weeks
                    </span>
                    {course.level && <span>Level: {course.level}</span>}
                  </div>
                </div>

                <div className="text-xs text-text-secondary">
                  Created: {new Date(course.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-text-secondary text-lg mb-2">No courses found</p>
            <p className="text-text-secondary text-sm">
              Create your first course to get started
            </p>
          </div>
        )}
      </div>

      {/* Add Course Modal */}
      {isAddingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-2xl font-semibold mb-4">Create New Course</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Course Name *</label>
                <input
                  type="text"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  placeholder="e.g., Web Development Bootcamp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  rows={3}
                  placeholder="Course description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Duration (weeks)</label>
                <input
                  type="number"
                  value={newCourse.duration_weeks}
                  onChange={(e) => setNewCourse({ ...newCourse, duration_weeks: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Level</label>
                <select
                  value={newCourse.level}
                  onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Price (USD)</label>
                <input
                  type="number"
                  value={newCourse.price}
                  onChange={(e) => setNewCourse({ ...newCourse, price: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="0"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleAddCourse} className="btn-primary flex-1">
                  Create Course
                </button>
                <button
                  onClick={() => {
                    setIsAddingCourse(false)
                    setNewCourse({
                      name: '',
                      description: '',
                      duration_weeks: 12,
                      level: 'Beginner',
                      price: 0,
                    })
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

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-2xl font-semibold mb-4">Edit Course</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Course Name</label>
                <input
                  type="text"
                  value={editingCourse.name}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={editingCourse.description || ''}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, description: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Duration (weeks)</label>
                <input
                  type="number"
                  value={editingCourse.duration_weeks || 12}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, duration_weeks: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Level</label>
                <select
                  value={editingCourse.level || 'Beginner'}
                  onChange={(e) =>
                    setEditingCourse({ ...editingCourse, level: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleSaveEdit} className="btn-primary flex-1">
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingCourse(null)}
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
  )
}
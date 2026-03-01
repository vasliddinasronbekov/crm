'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Megaphone, Plus, Search, Edit, Trash2, X, Users, GraduationCap, UserCircle2 } from 'lucide-react'

interface Announcement {
  id: number
  title: string
  text: string
  for_teachers: boolean
  for_students: boolean
  created_by: number
  created_by_name?: string
  created_at: string
}

export default function AnnouncementsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // States
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  // Form state
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    text: '',
    for_teachers: false,
    for_students: false,
  })

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [targetFilter, setTargetFilter] = useState<string>('all')

  // Load data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!user.is_staff && !user.is_superuser && !user.is_teacher) {
        router.push('/dashboard')
        toast.error('Access denied')
      } else {
        loadData()
      }
    }
  }, [user, authLoading, router])

  const loadData = async () => {
    try {
      setLoading(true)
      await loadAnnouncements()
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadAnnouncements = async () => {
    try {
      const data = await apiService.getInformation()
      setAnnouncements(data.results || data)
    } catch (error) {
      console.error('Failed to load announcements:', error)
    }
  }

  // CRUD operations
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.createInformation(announcementForm)
      toast.success('Announcement created successfully')
      setShowModal(false)
      resetForm()
      loadAnnouncements()
    } catch (error) {
      console.error('Failed to create announcement:', error)
      toast.error('Failed to create announcement')
    }
  }

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAnnouncement) return

    try {
      await apiService.updateInformation(editingAnnouncement.id, announcementForm)
      toast.success('Announcement updated successfully')
      setShowModal(false)
      setEditingAnnouncement(null)
      resetForm()
      loadAnnouncements()
    } catch (error) {
      console.error('Failed to update announcement:', error)
      toast.error('Failed to update announcement')
    }
  }

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      await apiService.deleteInformation(id)
      toast.success('Announcement deleted successfully')
      loadAnnouncements()
    } catch (error) {
      console.error('Failed to delete announcement:', error)
      toast.error('Failed to delete announcement')
    }
  }

  const resetForm = () => {
    setAnnouncementForm({
      title: '',
      text: '',
      for_teachers: false,
      for_students: false
    })
  }

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({
      title: announcement.title,
      text: announcement.text,
      for_teachers: announcement.for_teachers,
      for_students: announcement.for_students
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingAnnouncement(null)
    resetForm()
    setShowModal(true)
  }

  // Filter announcements
  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.text.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesTarget = true;
    if (targetFilter === 'teachers') {
      matchesTarget = announcement.for_teachers;
    } else if (targetFilter === 'students') {
      matchesTarget = announcement.for_students;
    } else if (targetFilter === 'all') {
      matchesTarget = announcement.for_teachers || announcement.for_students; // Assuming 'all' means visible to either
    }

    return matchesSearch && matchesTarget
  })

  // Statistics
  const stats = {
    total: announcements.length,
    forAll: announcements.filter(a => a.for_teachers && a.for_students).length, // Assuming 'forAll' means both
    forTeachers: announcements.filter(a => a.for_teachers && !a.for_students).length, // Only for teachers
    forStudents: announcements.filter(a => !a.for_teachers && a.for_students).length // Only for students
  }

  const getTargetColor = (forTeachers: boolean, forStudents: boolean) => {
    if (forTeachers && forStudents) {
      return 'bg-primary/20 text-primary' // All
    } else if (forTeachers) {
      return 'bg-info/20 text-info' // Teachers only
    } else if (forStudents) {
      return 'bg-success/20 text-success' // Students only
    } else {
      return 'bg-text-secondary/20 text-text-secondary' // Fallback
    }
  }

  const getTargetIcon = (forTeachers: boolean, forStudents: boolean) => {
    if (forTeachers && forStudents) {
      return <Users className="h-4 w-4" /> // All
    } else if (forTeachers) {
      return <GraduationCap className="h-4 w-4" /> // Teachers only
    } else if (forStudents) {
      return <UserCircle2 className="h-4 w-4" /> // Students only
    } else {
      return <Users className="h-4 w-4" /> // Fallback
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading announcements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-primary" />
            Announcements
          </h1>
          <p className="text-text-secondary">Create and manage announcements for teachers and students</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total</p>
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-text-secondary mt-1">All announcements</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">For Everyone</p>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.forAll}</p>
            <p className="text-xs text-text-secondary mt-1">All users</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">For Teachers</p>
              <GraduationCap className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">{stats.forTeachers}</p>
            <p className="text-xs text-text-secondary mt-1">Teachers only</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">For Students</p>
              <UserCircle2 className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">{stats.forStudents}</p>
            <p className="text-xs text-text-secondary mt-1">Students only</p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Targets</option>
                <option value="teachers">Teachers</option>
                <option value="students">Students</option>
              </select>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                New Announcement
              </button>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{announcement.title}</h3>
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${getTargetColor(announcement.for_teachers, announcement.for_students)}`}>
                      {getTargetIcon(announcement.for_teachers, announcement.for_students)}
                      {announcement.for_teachers && announcement.for_students ? 'All' : announcement.for_teachers ? 'Teachers' : announcement.for_students ? 'Students' : 'Unknown'}
                    </span>
                  </div>
                  <p className="text-text-secondary mb-4 whitespace-pre-wrap">{announcement.text}</p>
                  <div className="flex items-center gap-4 text-sm text-text-secondary">
                    <span>By: {announcement.created_by_name || `User #${announcement.created_by}`}</span>
                    <span>•</span>
                    <span>{new Date(announcement.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => openEditModal(announcement)}
                    className="p-2 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                    className="p-2 hover:bg-error/20 text-error rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAnnouncements.length === 0 && (
          <div className="text-center py-12">
            <Megaphone className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
            <p className="text-text-secondary">No announcements found</p>
          </div>
        )}
      </div>

      {/* Create/Edit Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">
                {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingAnnouncement(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingAnnouncement ? handleUpdateAnnouncement : handleCreateAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Announcement title..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Text</label>
                <textarea
                  value={announcementForm.text}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, text: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={6}
                  placeholder="Write your announcement text..."
                  required
                />
              </div>

              {/* Target Audience Checkboxes */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcementForm.for_teachers}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, for_teachers: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">For Teachers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcementForm.for_students}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, for_students: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">For Students</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingAnnouncement(null)
                    resetForm()
                  }}
                  className="flex-1 px-6 py-3 bg-background border border-border text-text-primary rounded-xl hover:bg-border/50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium"
                >
                  {editingAnnouncement ? 'Update Announcement' : 'Create Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

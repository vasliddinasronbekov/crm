'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import { Calendar, Plus, Search, Edit, Trash2, X, Users, MapPin, Clock, Image as ImageIcon, Upload } from 'lucide-react'

interface Event {
  id: number
  title: string
  description: string
  event_type: string
  start_time: string
  end_time: string | null
  is_all_day: boolean
  location: string
  course: number | null
  group: number | null
  students: number[]
  created_by: number
  created_by_name?: string
  photo: string | null
  color: string
  created_at: string
  updated_at: string
}

interface Student {
  id: number
  first_name: string
  last_name: string
  username: string
}

export default function EventsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // States
  const [events, setEvents] = useState<Event[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid')

  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'other',
    start_time: '',
    end_time: null as string | null,
    is_all_day: false,
    location: '',
    course: null as number | null,
    group: null as number | null,
    students: [] as number[],
    photo: null as string | null,
    color: '#3b82f6',
  })

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all')

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
      await Promise.all([loadEvents(), loadStudents()])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const data = await apiService.getEvents()
      setEvents(data.results || data)
    } catch (error) {
      console.error('Failed to load events:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents()
      setStudents(data.results || data)
    } catch (error) {
      console.error('Failed to load students:', error)
    }
  }

  // CRUD operations
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.createEvent(eventForm)
      toast.success('Event created successfully')
      setShowModal(false)
      resetForm()
      loadEvents()
    } catch (error) {
      console.error('Failed to create event:', error)
      toast.error('Failed to create event')
    }
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent) return

    try {
      await apiService.updateEvent(editingEvent.id, eventForm)
      toast.success('Event updated successfully')
      setShowModal(false)
      setEditingEvent(null)
      resetForm()
      loadEvents()
    } catch (error) {
      console.error('Failed to update event:', error)
      toast.error('Failed to update event')
    }
  }

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      await apiService.deleteEvent(id)
      toast.success('Event deleted successfully')
      loadEvents()
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Failed to delete event')
    }
  }

  const resetForm = () => {
    setEventForm({
      title: '',
      description: '',
      event_type: 'other',
      start_time: '',
      end_time: null,
      is_all_day: false,
      location: '',
      course: null,
      group: null,
      students: [],
      photo: null,
      color: '#3b82f6',
    })
  }

  const openEditModal = (event: Event) => {
    setEditingEvent(event)
    setEventForm({
      title: event.title,
      description: event.description,
      event_type: event.event_type,
      start_time: event.start_time.split('T')[0], // Extract date only for date input
      end_time: event.end_time ? event.end_time.split('T')[0] : null,
      is_all_day: event.is_all_day,
      location: event.location,
      course: event.course,
      group: event.group,
      students: event.students || [],
      photo: event.photo,
      color: event.color,
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingEvent(null)
    resetForm()
    setShowModal(true)
  }

  const toggleStudent = (studentId: number) => {
    setEventForm(prev => ({
      ...prev,
      students: prev.students.includes(studentId)
        ? prev.students.filter(id => id !== studentId)
        : [...prev.students, studentId]
    }))
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase())

    const eventDate = new Date(event.start_time)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const matchesDate = dateFilter === 'all' ||
                       (dateFilter === 'upcoming' && eventDate >= today) ||
                       (dateFilter === 'past' && eventDate < today)

    return matchesSearch && matchesDate
  })

  // Sort events by date (upcoming first)
  const sortedEvents = [...filteredEvents].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  // Statistics
  const stats = {
    total: events.length,
    upcoming: events.filter(e => new Date(e.start_time) >= new Date()).length,
    past: events.filter(e => new Date(e.start_time) < new Date()).length,
    totalParticipants: events.reduce((sum, e) => sum + (e.students?.length || 0), 0)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading events...</p>
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
            <Calendar className="h-8 w-8 text-primary" />
            Events Management
          </h1>
          <p className="text-text-secondary">Organize and manage school events and activities</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Events</p>
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-text-secondary mt-1">All time</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Upcoming</p>
              <Clock className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">{stats.upcoming}</p>
            <p className="text-xs text-text-secondary mt-1">Future events</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Past Events</p>
              <Calendar className="h-5 w-5 text-text-secondary" />
            </div>
            <p className="text-3xl font-bold">{stats.past}</p>
            <p className="text-xs text-text-secondary mt-1">Completed</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Participants</p>
              <Users className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">{stats.totalParticipants}</p>
            <p className="text-xs text-text-secondary mt-1">Total registered</p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Events</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Add Event
              </button>
            </div>
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedEvents.map((event) => {
            const eventDate = new Date(event.start_time)
            const isUpcoming = eventDate >= new Date()
            const isPast = eventDate < new Date()

            return (
              <div
                key={event.id}
                className={`bg-surface border rounded-2xl overflow-hidden hover:border-primary/50 transition-colors ${
                  isUpcoming ? 'border-success/30' : isPast ? 'border-border' : 'border-border'
                }`}
              >
                {/* Event Image */}
                <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
                  {event.photo ? (
                    <img src={event.photo} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <Calendar className="h-16 w-16 text-primary/40" />
                  )}
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-lg text-xs font-medium ${
                    isUpcoming ? 'bg-success/20 text-success' : 'bg-text-secondary/20 text-text-secondary'
                  }`}>
                    {isUpcoming ? 'Upcoming' : 'Past'}
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-6">
                  <h3 className="font-bold text-lg mb-2">{event.title}</h3>
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">{event.description}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{new Date(event.start_time).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-error" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-info" />
                      <span>{event.students?.length || 0} participants</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(event)}
                      className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="px-4 py-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {sortedEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
            <p className="text-text-secondary">No events found</p>
          </div>
        )}
      </div>

      {/* Create/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingEvent(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter event title..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={4}
                  placeholder="Describe the event..."
                  required
                />
              </div>

              {/* New: Event Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Event Type</label>
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="other">Other</option>
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="quiz">Quiz</option>
                  <option value="meeting">Meeting</option>
                  <option value="holiday">Holiday</option>
                  <option value="class">Class Session</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date & Time</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                    <input
                      type="datetime-local"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">End Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={eventForm.end_time || ''}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value || null })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.is_all_day}
                    onChange={(e) => setEventForm({ ...eventForm, is_all_day: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">All Day Event</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-error" />
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Event location..."
                  />
                </div>
              </div>

              {/* New: Course and Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Course (Optional)</label>
                  <select
                    value={eventForm.course || ''}
                    onChange={(e) => setEventForm({ ...eventForm, course: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a course...</option>
                    {/* Assuming you have a list of courses */}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Group (Optional)</label>
                  <select
                    value={eventForm.group || ''}
                    onChange={(e) => setEventForm({ ...eventForm, group: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a group...</option>
                    {/* Assuming you have a list of groups */}
                  </select>
                </div>
              </div>
              
              {/* New: Photo and Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Photo (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                    <input
                      type="text" // Change to type="file" for actual upload
                      value={eventForm.photo || ''}
                      onChange={(e) => setEventForm({ ...eventForm, photo: e.target.value || null })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Image URL or upload..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Color</label>
                  <input
                    type="color"
                    value={eventForm.color}
                    onChange={(e) => setEventForm({ ...eventForm, color: e.target.value })}
                    className="w-full h-12 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Students ({eventForm.students.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto bg-background border border-border rounded-xl p-4 space-y-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 hover:bg-surface rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={eventForm.students.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-sm">
                        {student.first_name} {student.last_name} ({student.username})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingEvent(null)
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
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

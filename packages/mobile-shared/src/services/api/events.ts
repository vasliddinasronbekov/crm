/**
 * Events API - Calendar and event management endpoints
 * Backend endpoint: /api/v1/student-profile/events/
 */

import { apiClient } from './client'

export interface Event {
  id: number
  title: string
  description?: string
  event_type: 'exam' | 'holiday' | 'meeting' | 'class' | 'other'
  start_time: string
  end_time: string
  date: string
  location?: string
  course?: number
  course_name?: string
  group?: number
  group_name?: string
  participants?: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface EventFilters {
  event_type?: 'exam' | 'holiday' | 'meeting' | 'class' | 'other'
  date?: string
  date_from?: string
  date_to?: string
  course?: number
  group?: number
}

export const eventsApi = {
  /**
   * Get all events
   * GET /api/v1/student-profile/events/
   */
  getEvents: async (filters?: EventFilters): Promise<Event[]> => {
    const params = new URLSearchParams()
    if (filters) {
      if (filters.event_type) params.append('event_type', filters.event_type)
      if (filters.date) params.append('date', filters.date)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.course) params.append('course', filters.course.toString())
      if (filters.group) params.append('group', filters.group.toString())
    }

    const queryString = params.toString()
    const url = queryString ? `/api/v1/student-profile/events/?${queryString}` : '/api/v1/student-profile/events/'

    const result = await apiClient.get(url)
    return Array.isArray(result) ? result : []
  },

  /**
   * Get event details
   * GET /api/v1/student-profile/events/{id}/
   */
  getEventDetail: async (eventId: number): Promise<Event> => {
    return await apiClient.get(`/api/v1/student-profile/events/${eventId}/`)
  },

  /**
   * Get upcoming events
   */
  getUpcomingEvents: async (limit: number = 5): Promise<Event[]> => {
    const today = new Date().toISOString().split('T')[0]
    const events = await apiClient.get(
      `/api/v1/student-profile/events/?date_from=${today}&ordering=date,start_time`
    )
    return Array.isArray(events) ? events.slice(0, limit) : []
  },

  /**
   * Get events for a specific date
   */
  getEventsByDate: async (date: string): Promise<Event[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/events/?date=${date}`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Get events for a date range
   */
  getEventsByDateRange: async (startDate: string, endDate: string): Promise<Event[]> => {
    const result = await apiClient.get(
      `/api/v1/student-profile/events/?date_from=${startDate}&date_to=${endDate}`
    )
    return Array.isArray(result) ? result : []
  },

  /**
   * Get events by type
   */
  getEventsByType: async (
    eventType: 'exam' | 'holiday' | 'meeting' | 'class' | 'other'
  ): Promise<Event[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/events/?event_type=${eventType}`)
    return Array.isArray(result) ? result : []
  },
}

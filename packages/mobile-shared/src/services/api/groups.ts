/**
 * Groups API - Student groups and classes
 * Backend endpoint: /api/v1/student-profile/group/
 */

import { apiClient } from './client'

export interface Group {
  id: number
  name: string
  course: number
  course_name: string
  teacher: number
  teacher_name: string
  students_count: number
  schedule?: string
  start_date?: string
  end_date?: string
  level?: string
  room?: string
  description?: string
  created_at: string
}

export interface GroupSchedule {
  day: string
  start_time: string
  end_time: string
}

export interface GroupStudent {
  id: number
  name: string
  email: string
  phone?: string
  attendance_rate?: number
}

export const groupsApi = {
  /**
   * Get student's enrolled groups
   * GET /api/v1/student-profile/group/
   */
  getMyGroups: async (): Promise<Group[]> => {
    const result = await apiClient.get('/api/v1/student-profile/group/')
    return Array.isArray(result) ? result : []
  },

  /**
   * Get group details
   * GET /api/v1/student-profile/group/{id}/
   */
  getGroupDetail: async (groupId: number): Promise<Group> => {
    return await apiClient.get(`/api/v1/student-profile/group/${groupId}/`)
  },

  /**
   * Get group schedule
   */
  getGroupSchedule: async (groupId: number): Promise<GroupSchedule[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/group/${groupId}/schedule/`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Get group students (if endpoint exists)
   */
  getGroupStudents: async (groupId: number): Promise<GroupStudent[]> => {
    const result = await apiClient.get(`/api/v1/student-profile/group/${groupId}/students/`)
    return Array.isArray(result) ? result : []
  },
}

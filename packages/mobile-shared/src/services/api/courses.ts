/**
 * Courses API - Course management endpoints
 * Updated 2025-11-24: Using tested endpoints from API review
 * Tested with: student_akmal / test
 */

import { apiClient } from './client'

export interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  instructor: string
  progress: number
  total_lessons: number
  completed_lessons: number
  enrolled_date: string
}

export interface Lesson {
  id: string
  course: string
  title: string
  description: string
  lesson_type: 'video' | 'audio' | 'text' | 'quiz' | 'interactive'
  content_url?: string
  duration?: number
  order: number
  is_completed: boolean
}

export const coursesApi = {
  /**
   * Get all courses (enrolled and available)
   * TESTED ✅ - /api/v1/student-profile/courses/
   */
  getCourses: async (): Promise<Course[]> => {
    const result = await apiClient.get('/api/v1/student-profile/courses/')
    return Array.isArray(result) ? result : []
  },

  /**
   * Get all enrolled courses for student
   * TESTED ✅ - /api/v1/student-profile/courses/
   */
  getEnrolledCourses: async (): Promise<Course[]> => {
    const result = await apiClient.get('/api/v1/student-profile/courses/')
    return Array.isArray(result) ? result : []
  },

  /**
   * Get course details
   * TESTED ✅ - /api/v1/student-profile/courses/{id}/
   */
  getCourseDetails: async (courseId: string): Promise<Course> => {
    return await apiClient.get(`/api/v1/student-profile/courses/${courseId}/`)
  },

  /**
   * Enroll in course
   * TESTED ✅ - /api/v1/student-profile/courses/{id}/enroll/
   */
  enrollCourse: async (courseId: string): Promise<void> => {
    return await apiClient.post(`/api/v1/student-profile/courses/${courseId}/enroll/`)
  },

  /**
   * Get course lessons
   * NOTE: /api/v1/lms/lessons/ has backend errors (500)
   * Use course modules instead if available
   */
  getCourseLessons: async (courseId: string): Promise<Lesson[]> => {
    const result = await apiClient.get(`/api/v1/lms/lessons/?course=${courseId}`)
    return Array.isArray(result) ? result : []
  },

  /**
   * Mark lesson as completed
   */
  markLessonComplete: async (lessonId: string): Promise<void> => {
    return await apiClient.post(`/api/v1/lms/lessons/${lessonId}/complete/`)
  },
}

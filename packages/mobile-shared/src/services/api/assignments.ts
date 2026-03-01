/**
 * Assignments API - Assignment management endpoints
 * Updated 2025-11-24: Using tested endpoints from API review
 * Tested with: student_akmal / test
 */

import { apiClient } from './client'

export interface Assignment {
  id: string
  title: string
  description: string
  course: string
  course_name: string
  due_date: string
  max_score: number
  submission_type: 'text' | 'file' | 'both'
  status: 'pending' | 'submitted' | 'graded'
  created_at: string
}

export interface AssignmentSubmission {
  id: string
  assignment: string
  student: string
  submitted_text?: string
  submitted_file?: string
  submitted_at: string
  grade?: number
  feedback?: string
  status: 'submitted' | 'graded'
}

export const assignmentsApi = {
  /**
   * Get all assignments for student
   * TESTED ✅ - /api/v1/lms/assignments/
   */
  getAssignments: async (status?: string): Promise<Assignment[]> => {
    const params = status ? `?status=${status}` : ''
    const result = await apiClient.get(`/api/v1/lms/assignments/${params}`)
    // Ensure we always return an array
    return Array.isArray(result) ? result : []
  },

  /**
   * Get assignment details
   * TESTED ✅ - /api/v1/lms/assignments/{id}/
   */
  getAssignmentDetails: async (assignmentId: string): Promise<Assignment> => {
    return await apiClient.get(`/api/v1/lms/assignments/${assignmentId}/`)
  },

  /**
   * Get assignment submissions
   * TESTED ✅ - /api/v1/lms/assignment-submissions/
   */
  getSubmissions: async (): Promise<AssignmentSubmission[]> => {
    const result = await apiClient.get('/api/v1/lms/assignment-submissions/')
    return Array.isArray(result) ? result : []
  },

  /**
   * Submit assignment
   * TESTED ✅ - /api/v1/lms/assignment-submissions/
   */
  submitAssignment: async (
    assignmentId: string,
    submittedText?: string,
    submittedFile?: File
  ): Promise<AssignmentSubmission> => {
    const formData = new FormData()
    formData.append('assignment', assignmentId)
    if (submittedText) {
      formData.append('submitted_text', submittedText)
    }
    if (submittedFile) {
      formData.append('submitted_file', submittedFile)
    }

    return await apiClient.post('/api/v1/lms/assignment-submissions/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * Get assignment submission by ID
   */
  getSubmission: async (submissionId: string): Promise<AssignmentSubmission> => {
    return await apiClient.get(`/api/v1/lms/assignment-submissions/${submissionId}/`)
  },

  /**
   * Get graded assignments
   */
  getGradedAssignments: async (): Promise<Assignment[]> => {
    return await apiClient.get('/api/v1/lms/assignments/?status=graded')
  },
}

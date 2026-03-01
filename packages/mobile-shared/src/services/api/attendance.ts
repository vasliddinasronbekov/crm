/**
 * Attendance API - Attendance tracking endpoints
 * Updated 2025-11-24: Using tested endpoints from API review
 * Tested with: student_akmal / test
 */

import { apiClient } from './client'

export interface AttendanceRecord {
  id: string
  group: string
  group_name: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  check_in_time?: string
  notes?: string
}

export interface AttendanceStats {
  total_classes: number
  present: number
  absent: number
  late: number
  excused: number
  attendance_rate: number
}

export const attendanceApi = {
  /**
   * Get attendance records
   * TESTED ✅ - /api/v1/student-profile/attendance/
   */
  getAttendanceRecords: async (
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceRecord[]> => {
    let params = ''
    if (startDate && endDate) {
      params = `?start_date=${startDate}&end_date=${endDate}`
    }
    return await apiClient.get(`/api/v1/student-profile/attendance/${params}`)
  },

  /**
   * Get attendance detail
   * TESTED ✅ - /api/v1/student-profile/attendance/{id}/
   */
  getAttendanceDetail: async (attendanceId: string): Promise<AttendanceRecord> => {
    return await apiClient.get(`/api/v1/student-profile/attendance/${attendanceId}/`)
  },

  /**
   * Get attendance statistics
   */
  getAttendanceStats: async (): Promise<AttendanceStats> => {
    return await apiClient.get('/api/v1/student-profile/attendance/stats/')
  },

  /**
   * Check-in with QR code
   */
  checkInWithQR: async (qrCode: string): Promise<AttendanceRecord> => {
    return await apiClient.post('/api/v1/student-profile/attendance/check-in/', {
      qr_code: qrCode,
    })
  },

  /**
   * Submit absence explanation
   */
  submitAbsenceExplanation: async (
    attendanceId: string,
    explanation: string
  ): Promise<void> => {
    return await apiClient.post(`/api/v1/student-profile/attendance/${attendanceId}/explain/`, {
      notes: explanation,
    })
  },
}

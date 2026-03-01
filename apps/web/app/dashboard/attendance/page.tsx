'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Download,
  Search,
  TrendingUp,
  AlertCircle,
  BarChart3
} from 'lucide-react'

interface AttendanceRecord {
  id: number
  student_id: number
  student_name: string
  group_id: number
  group_name: string
  date: string
  is_present: boolean
  status: 'present' | 'absent' | 'absence'
  marked_at: string
}

interface Student {
  id: number
  first_name: string
  last_name: string
  username: string
}

interface Group {
  id: number
  name: string
  students: number[]
}

const parseListPayload = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

const normalizeAttendanceRecord = (raw: any): AttendanceRecord => {
  const studentObject = typeof raw?.student === 'object' && raw?.student !== null ? raw.student : null
  const groupObject = typeof raw?.group === 'object' && raw?.group !== null ? raw.group : null
  const studentId = Number(studentObject?.id || raw?.student || 0)
  const groupId = Number(groupObject?.id || raw?.group || 0)
  const studentName =
    `${studentObject?.first_name || ''} ${studentObject?.last_name || ''}`.trim() ||
    studentObject?.username ||
    'Unknown student'
  const groupName = groupObject?.name || 'N/A'
  const rawStatus = String(raw?.status || raw?.attendance_status || '').toLowerCase()
  const normalizedStatus: AttendanceRecord['status'] =
    rawStatus === 'present'
      ? 'present'
      : rawStatus === 'absence' || rawStatus === 'absence_excused' || rawStatus === 'excused'
      ? 'absence'
      : 'absent'
  const isPresent = normalizedStatus === 'present'

  return {
    id: Number(raw?.id || 0),
    student_id: studentId,
    student_name: studentName,
    group_id: groupId,
    group_name: groupName,
    date: raw?.date || '',
    is_present: isPresent,
    status: normalizedStatus,
    marked_at: raw?.created_at || raw?.updated_at || raw?.date || '',
  }
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'bulk'>('list')

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Bulk marking
  const [bulkGroup, setBulkGroup] = useState<number | ''>('')
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkAttendance, setBulkAttendance] = useState<{ [key: number]: 'present' | 'absent' | 'absence' }>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const fetchAllPages = async <T,>(
        fetchPage: (page: number) => Promise<any>,
      ): Promise<T[]> => {
        const allRecords: T[] = []
        let page = 1
        let keepLoading = true

        while (keepLoading) {
          const payload = await fetchPage(page)
          const pageResults = parseListPayload<T>(payload)
          allRecords.push(...pageResults)

          if (payload?.next) {
            page += 1
          } else {
            keepLoading = false
          }

          if (page > 200) {
            keepLoading = false
          }
        }

        return allRecords
      }

      const [attendanceArray, studentsArray, groupsArray] = await Promise.all([
        fetchAllPages<any>((page) => apiService.getAttendance({ page })),
        fetchAllPages<Student>((page) => apiService.getStudents({ page })),
        fetchAllPages<Group>((page) => apiService.getGroups({ page })),
      ])

      setAttendance(attendanceArray.map(normalizeAttendanceRecord))
      setStudents(studentsArray)
      setGroups(groupsArray)
    } catch (error) {
      console.error('Failed to load attendance:', error)
      toast.error('Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkMark = async () => {
    if (!bulkGroup || Object.keys(bulkAttendance).length === 0) {
      toast.warning('Please select a group and mark attendance')
      return
    }

    try {
      const attendanceList = Object.entries(bulkAttendance).map(([studentId, status]) => ({
        student: parseInt(studentId),
        group: bulkGroup,
        date: bulkDate,
        status,
        is_present: status === 'present',
      }))

      await apiService.bulkMarkAttendance(attendanceList)
      toast.success(`Attendance marked for ${attendanceList.length} students!`)
      setBulkAttendance({})
      loadData()
    } catch (error: any) {
      console.error('Failed to mark attendance:', error)
      toast.error(error.response?.data?.detail || 'Failed to mark attendance')
    }
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Student', 'Group', 'Status']
    const rows = filteredAttendance.map(a => [
      a.date,
      a.student_name,
      a.group_name,
      a.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Attendance exported to CSV')
  }

  // Filter attendance
  const filteredAttendance = attendance.filter(att => {
    const matchesDateFrom = !dateFrom || att.date >= dateFrom
    const matchesDateTo = !dateTo || att.date <= dateTo
    const matchesGroup = !selectedGroup || att.group_id === selectedGroup
    const matchesSearch = !searchTerm || att.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' ||
      att.status === statusFilter

    return matchesDateFrom && matchesDateTo && matchesGroup && matchesSearch && matchesStatus
  })

  // Calculate statistics
  const stats = {
    totalRecords: filteredAttendance.length,
    presentCount: filteredAttendance.filter(a => a.status === 'present').length,
    absentCount: filteredAttendance.filter(a => a.status === 'absent').length,
    excusedCount: filteredAttendance.filter(a => a.status === 'absence').length,
    attendanceRate: filteredAttendance.length > 0
      ? (filteredAttendance.filter(a => a.status === 'present').length / filteredAttendance.length * 100).toFixed(1)
      : 0
  }

  // Get students for selected group (bulk marking)
  const selectedGroupStudents = bulkGroup
    ? students.filter(s => {
        const group = groups.find(g => g.id === bulkGroup)
        return group?.students?.includes(s.id)
      })
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading attendance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="h-10 w-10 text-primary" />
          Attendance Management
        </h1>
        <p className="text-text-secondary">Track and manage student attendance</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="stat-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Records</p>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{stats.totalRecords}</p>
          <p className="text-xs text-text-secondary mt-2">All time</p>
        </div>

        <div className="stat-card border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Present</p>
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">{stats.presentCount}</p>
          <p className="text-xs text-text-secondary mt-2">{stats.attendanceRate}% attendance rate</p>
        </div>

        <div className="stat-card border-l-4 border-l-error">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Absent (Unexcused)</p>
            <XCircle className="h-5 w-5 text-error" />
          </div>
          <p className="text-3xl font-bold text-error">{stats.absentCount}</p>
          <p className="text-xs text-text-secondary mt-2">Students marked unexcused absent</p>
        </div>

        <div className="stat-card border-l-4 border-l-info">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Absence (Excused)</p>
            <AlertCircle className="h-5 w-5 text-info" />
          </div>
          <p className="text-3xl font-bold text-info">{stats.excusedCount}</p>
          <p className="text-xs text-text-secondary mt-2">Students marked excused</p>
        </div>

        <div className="stat-card border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Attendance Rate</p>
            <TrendingUp className="h-5 w-5 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning">{stats.attendanceRate}%</p>
          <p className="text-xs text-text-secondary mt-2">Overall average</p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('list')}
          className={`px-6 py-3 rounded-xl font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-primary text-background'
              : 'bg-surface text-text-secondary hover:bg-background'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          List View
        </button>
        <button
          onClick={() => setViewMode('bulk')}
          className={`px-6 py-3 rounded-xl font-medium transition-colors ${
            viewMode === 'bulk'
              ? 'bg-primary text-background'
              : 'bg-surface text-text-secondary hover:bg-background'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Bulk Mark
        </button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="card mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Group Filter */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : '')}
                className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Groups</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="absence">Absence (Excused)</option>
              </select>

              {/* Date Range */}
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="To"
                />
              </div>

              {/* Export Button */}
              <button
                onClick={exportToCSV}
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <Download className="h-5 w-5" />
                Export
              </button>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold">Date</th>
                    <th className="text-left p-4 font-semibold">Student</th>
                    <th className="text-left p-4 font-semibold">Group</th>
                    <th className="text-center p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Marked At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((att) => (
                    <tr key={att.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                      <td className="p-4 font-medium">
                        {new Date(att.date).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                            att.status === 'present'
                              ? 'bg-success/10 text-success'
                              : att.status === 'absence'
                              ? 'bg-info/10 text-info'
                              : 'bg-error/10 text-error'
                          }`}>
                            {att.student_name?.charAt(0) || 'S'}
                          </div>
                          <span className="font-medium">{att.student_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-text-secondary">{att.group_name}</td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
                            att.status === 'present'
                              ? 'bg-success/10 text-success'
                              : att.status === 'absence'
                              ? 'bg-info/10 text-info'
                              : 'bg-error/10 text-error'
                          }`}>
                            {att.status === 'present' ? (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                Present
                              </>
                            ) : att.status === 'absence' ? (
                              <>
                                <AlertCircle className="h-4 w-4" />
                                Absence (Excused)
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                Absent (Unexcused)
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text-secondary">
                        {new Date(att.marked_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredAttendance.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                  <p className="text-text-secondary text-lg">No attendance records found</p>
                  <p className="text-text-secondary text-sm mt-1">
                    {searchTerm || selectedGroup || dateFrom ? 'Try adjusting your filters' : 'Start marking attendance to see records'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bulk Mark View */}
      {viewMode === 'bulk' && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Bulk Attendance Marking</h2>
            <p className="text-text-secondary">Mark attendance for an entire group at once</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Group *</label>
              <select
                value={bulkGroup}
                onChange={(e) => {
                  setBulkGroup(e.target.value ? Number(e.target.value) : '')
                  setBulkAttendance({})
                }}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a group...</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.students?.length || 0} students)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date *</label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {bulkGroup && selectedGroupStudents.length > 0 ? (
            <>
              <div className="space-y-2 mb-6">
                {selectedGroupStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-background rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {student.first_name?.charAt(0) || student.username.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-text-secondary">{student.username}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setBulkAttendance({ ...bulkAttendance, [student.id]: 'present' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          bulkAttendance[student.id] === 'present'
                            ? 'bg-success text-white'
                            : 'bg-success/10 text-success hover:bg-success/20'
                        }`}
                      >
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        Present
                      </button>
                      <button
                        onClick={() => setBulkAttendance({ ...bulkAttendance, [student.id]: 'absence' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          bulkAttendance[student.id] === 'absence'
                            ? 'bg-info text-white'
                            : 'bg-info/10 text-info hover:bg-info/20'
                        }`}
                      >
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        Absence
                      </button>
                      <button
                        onClick={() => setBulkAttendance({ ...bulkAttendance, [student.id]: 'absent' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          bulkAttendance[student.id] === 'absent'
                            ? 'bg-error text-white'
                            : 'bg-error/10 text-error hover:bg-error/20'
                        }`}
                      >
                        <XCircle className="h-4 w-4 inline mr-1" />
                        Absent
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const allPresent: { [key: number]: 'present' | 'absent' | 'absence' } = {}
                    selectedGroupStudents.forEach(s => { allPresent[s.id] = 'present' })
                    setBulkAttendance(allPresent)
                  }}
                  className="btn-secondary flex-1"
                >
                  Mark All Present
                </button>
                <button
                  onClick={handleBulkMark}
                  className="btn-primary flex-1"
                  disabled={Object.keys(bulkAttendance).length === 0}
                >
                  Save Attendance ({Object.keys(bulkAttendance).length} marked)
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
              <p className="text-text-secondary text-lg">Select a group to mark attendance</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

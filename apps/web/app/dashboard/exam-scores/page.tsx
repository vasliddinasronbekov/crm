'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import toast from '@/lib/toast'
import {
  Award,
  Plus,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Search,
  X,
  Calendar,
  Download,
  CheckCircle,
  UserCheck,
  BarChart3
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'

interface Student {
  id: number
  username: string
  first_name?: string
  last_name?: string
}

interface Teacher {
  id: number
  username: string
  first_name?: string
  last_name?: string
}

interface Group {
  id: number
  name: string
}

interface ExamScore {
  id: number
  student: number
  score: number
  date: string
  group?: number | null
  examiner?: number | null
  main_teacher?: number | null
  student_details?: Student
  group_details?: Group
  examiner_details?: Teacher
}

export default function ExamScoresPage() {
  const [scores, setScores] = useState<ExamScore[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [editingScore, setEditingScore] = useState<ExamScore | null>(null)

  // Forms
  const [formData, setFormData] = useState({
    student: '',
    score: '',
    date: new Date().toISOString().split('T')[0],
    group: '',
    examiner: '',
    main_teacher: ''
  })

  const [bulkScores, setBulkScores] = useState<{ [studentId: string]: string }>({})
  const [bulkGroup, setBulkGroup] = useState<string>('')
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkExaminer, setBulkExaminer] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [scoresData, studentsData, teachersData, groupsData] = await Promise.all([
        apiService.getExamScores(),
        apiService.getStudents(),
        apiService.getTeachers(),
        apiService.getGroups()
      ])

      const scoresList = scoresData.results || scoresData || []
      const studentsList = studentsData.results || studentsData || []
      const teachersList = teachersData.results || teachersData || []
      const groupsList = groupsData.results || groupsData || []

      // Enrich scores with details
      const enrichedScores = scoresList.map((score: ExamScore) => ({
        ...score,
        student_details: studentsList.find((s: Student) => s.id === score.student),
        group_details: groupsList.find((g: Group) => g.id === score.group),
        examiner_details: teachersList.find((t: Teacher) => t.id === score.examiner)
      }))

      setScores(enrichedScores)
      setStudents(studentsList)
      setTeachers(teachersList)
      setGroups(groupsList)
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load exam scores')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.student || !formData.score || !formData.date) {
      toast.warning('Please fill in all required fields')
      return
    }

    try {
      await apiService.createExamScore({
        student: Number(formData.student),
        score: Number(formData.score),
        date: formData.date,
        group: formData.group ? Number(formData.group) : null,
        examiner: formData.examiner ? Number(formData.examiner) : null,
        main_teacher: formData.main_teacher ? Number(formData.main_teacher) : null
      })
      toast.success('Exam score created successfully!')
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Failed to create exam score:', error)
      toast.error(error.response?.data?.detail || 'Failed to create exam score')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingScore) return

    try {
      await apiService.updateExamScore(editingScore.id, {
        student: Number(formData.student),
        score: Number(formData.score),
        date: formData.date,
        group: formData.group ? Number(formData.group) : null,
        examiner: formData.examiner ? Number(formData.examiner) : null,
        main_teacher: formData.main_teacher ? Number(formData.main_teacher) : null
      })
      toast.success('Exam score updated successfully!')
      setShowModal(false)
      setEditingScore(null)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Failed to update exam score:', error)
      toast.error(error.response?.data?.detail || 'Failed to update exam score')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exam score?')) return

    try {
      await apiService.deleteExamScore(id)
      toast.success('Exam score deleted successfully')
      loadData()
    } catch (error: any) {
      console.error('Failed to delete exam score:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete exam score')
    }
  }

  const handleBulkEntry = async () => {
    if (!bulkGroup || Object.keys(bulkScores).length === 0) {
      toast.warning('Please select a group and enter scores')
      return
    }

    try {
      const promises = Object.entries(bulkScores).map(([studentId, score]) => {
        if (!score || score === '') return null
        return apiService.createExamScore({
          student: parseInt(studentId),
          score: Number(score),
          date: bulkDate,
          group: parseInt(bulkGroup),
          examiner: bulkExaminer ? Number(bulkExaminer) : null,
          main_teacher: null
        })
      }).filter(p => p !== null)

      await Promise.all(promises)
      toast.success(`Successfully recorded ${promises.length} exam scores!`)
      setShowBulkModal(false)
      setBulkScores({})
      setBulkGroup('')
      loadData()
    } catch (error: any) {
      console.error('Failed to bulk enter scores:', error)
      toast.error(error.response?.data?.detail || 'Failed to enter exam scores')
    }
  }

  const openEditModal = (score: ExamScore) => {
    setEditingScore(score)
    setFormData({
      student: score.student.toString(),
      score: score.score.toString(),
      date: score.date,
      group: score.group?.toString() || '',
      examiner: score.examiner?.toString() || '',
      main_teacher: score.main_teacher?.toString() || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      student: '',
      score: '',
      date: new Date().toISOString().split('T')[0],
      group: '',
      examiner: '',
      main_teacher: ''
    })
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Student', 'Group', 'Score', 'Examiner']
    const rows = filteredScores.map(s => [
      s.date,
      s.student_details ? `${s.student_details.first_name || ''} ${s.student_details.last_name || ''}`.trim() || s.student_details.username : 'Unknown',
      s.group_details?.name || 'N/A',
      s.score.toString(),
      s.examiner_details ? s.examiner_details.username : 'N/A'
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `exam-scores_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Exam scores exported to CSV')
  }

  const filteredScores = scores.filter(score => {
    const student = score.student_details
    const studentName = student
      ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username
      : ''

    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGroup = selectedGroup ? score.group === parseInt(selectedGroup) : true
    const matchesDateFrom = dateFrom ? new Date(score.date) >= new Date(dateFrom) : true
    const matchesDateTo = dateTo ? new Date(score.date) <= new Date(dateTo) : true

    return matchesSearch && matchesGroup && matchesDateFrom && matchesDateTo
  })

  // Statistics
  const totalScores = filteredScores.length
  const averageScore = totalScores > 0
    ? Math.round(filteredScores.reduce((sum, s) => sum + s.score, 0) / totalScores)
    : 0
  const highestScore = totalScores > 0
    ? Math.max(...filteredScores.map(s => s.score))
    : 0
  const passRate = totalScores > 0
    ? Math.round((filteredScores.filter(s => s.score >= 60).length / totalScores) * 100)
    : 0

  // Grade distribution
  const gradeA = filteredScores.filter(s => s.score >= 90).length
  const gradeB = filteredScores.filter(s => s.score >= 80 && s.score < 90).length
  const gradeC = filteredScores.filter(s => s.score >= 70 && s.score < 80).length
  const gradeD = filteredScores.filter(s => s.score >= 60 && s.score < 70).length
  const gradeF = filteredScores.filter(s => s.score < 60).length

  // Get students in selected bulk group
  const bulkGroupStudents = bulkGroup
    ? students.filter(s => {
        // This would ideally come from group membership data
        // For now, showing all students
        return true
      })
    : []

  if (loading) {
    return <LoadingScreen message="Loading exam scores..." />
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Award className="h-10 w-10 text-primary" />
          Exam Scores Management
        </h1>
        <p className="text-text-secondary">Track and manage student exam performance</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Total Scores</p>
            <Award className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold">{totalScores}</p>
          <p className="text-xs text-text-secondary mt-2">Exam records</p>
        </div>

        <div className="stat-card border-l-4 border-l-info">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Average Score</p>
            <TrendingUp className="h-5 w-5 text-info" />
          </div>
          <p className="text-3xl font-bold text-info">{averageScore}%</p>
          <p className="text-xs text-text-secondary mt-2">Overall performance</p>
        </div>

        <div className="stat-card border-l-4 border-l-warning">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Highest Score</p>
            <BarChart3 className="h-5 w-5 text-warning" />
          </div>
          <p className="text-3xl font-bold text-warning">{highestScore}%</p>
          <p className="text-xs text-text-secondary mt-2">Best performance</p>
        </div>

        <div className="stat-card border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-secondary text-sm font-medium">Pass Rate</p>
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">{passRate}%</p>
          <p className="text-xs text-text-secondary mt-2">≥60% passing</p>
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="card mb-6">
        <h3 className="text-lg font-bold mb-4">Grade Distribution</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="h-2 bg-success rounded-full mb-2"></div>
            <p className="text-2xl font-bold text-success">{gradeA}</p>
            <p className="text-xs text-text-secondary">A (90-100%)</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-info rounded-full mb-2"></div>
            <p className="text-2xl font-bold text-info">{gradeB}</p>
            <p className="text-xs text-text-secondary">B (80-89%)</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-primary rounded-full mb-2"></div>
            <p className="text-2xl font-bold text-primary">{gradeC}</p>
            <p className="text-xs text-text-secondary">C (70-79%)</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-warning rounded-full mb-2"></div>
            <p className="text-2xl font-bold text-warning">{gradeD}</p>
            <p className="text-xs text-text-secondary">D (60-69%)</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-error rounded-full mb-2"></div>
            <p className="text-2xl font-bold text-error">{gradeF}</p>
            <p className="text-xs text-text-secondary">F (&lt;60%)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Groups</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="From Date"
          />

          {/* Date To */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="To Date"
          />

          {/* Export */}
          <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => {
            setEditingScore(null)
            resetForm()
            setShowModal(true)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Single Score
        </button>

        <button
          onClick={() => setShowBulkModal(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Users className="h-5 w-5" />
          Bulk Entry
        </button>
      </div>

      {/* Scores Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Student</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Group</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Score</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Grade</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Examiner</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScores.map(score => {
              const student = score.student_details
              const studentName = student
                ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username
                : 'Unknown'

              let gradeLabel = 'F'
              let gradeColor = 'text-error'
              if (score.score >= 90) { gradeLabel = 'A'; gradeColor = 'text-success' }
              else if (score.score >= 80) { gradeLabel = 'B'; gradeColor = 'text-info' }
              else if (score.score >= 70) { gradeLabel = 'C'; gradeColor = 'text-primary' }
              else if (score.score >= 60) { gradeLabel = 'D'; gradeColor = 'text-warning' }

              return (
                <tr key={score.id} className="border-b border-border hover:bg-background/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-secondary" />
                      {new Date(score.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium">{studentName}</td>
                  <td className="py-3 px-4 text-text-secondary">
                    {score.group_details?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-lg font-bold">{score.score}%</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-lg font-bold ${gradeColor}`}>{gradeLabel}</span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {score.examiner_details?.username || 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(score)}
                        className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(score.id)}
                        className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredScores.length === 0 && (
          <div className="text-center py-12">
            <Award className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
            <p className="text-text-secondary text-lg">No exam scores found</p>
            <p className="text-text-secondary text-sm mt-1">
              {searchTerm || selectedGroup || dateFrom || dateTo
                ? 'Try adjusting your filters'
                : 'Add your first exam score to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Single Score Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingScore ? 'Edit Exam Score' : 'Add Exam Score'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingScore(null)
                  resetForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingScore ? handleUpdate : handleCreate} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Student *</label>
                  <select
                    value={formData.student}
                    onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Student</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.first_name && student.last_name
                          ? `${student.first_name} ${student.last_name}`
                          : student.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Score (%) *</label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="85"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Group</label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Examiner</label>
                <select
                  value={formData.examiner}
                  onChange={(e) => setFormData({ ...formData, examiner: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Examiner</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name && teacher.last_name
                        ? `${teacher.first_name} ${teacher.last_name}`
                        : teacher.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingScore(null)
                    resetForm()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingScore ? 'Update Score' : 'Add Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Entry Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-2xl font-bold">Bulk Exam Score Entry</h2>
              <button
                onClick={() => {
                  setShowBulkModal(false)
                  setBulkScores({})
                  setBulkGroup('')
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Group *</label>
                  <select
                    value={bulkGroup}
                    onChange={(e) => setBulkGroup(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Exam Date *</label>
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Examiner</label>
                  <select
                    value={bulkExaminer}
                    onChange={(e) => setBulkExaminer(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Examiner</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name && teacher.last_name
                          ? `${teacher.first_name} ${teacher.last_name}`
                          : teacher.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {bulkGroup && (
                <>
                  <div className="border-t border-border pt-4">
                    <h3 className="text-lg font-bold mb-4">Enter Scores for Students</h3>
                    <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {students.slice(0, 20).map(student => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-background rounded-xl">
                          <UserCheck className="h-5 w-5 text-text-secondary" />
                          <div className="flex-1">
                            <p className="font-medium">
                              {student.first_name && student.last_name
                                ? `${student.first_name} ${student.last_name}`
                                : student.username}
                            </p>
                          </div>
                          <input
                            type="number"
                            value={bulkScores[student.id] || ''}
                            onChange={(e) => setBulkScores({ ...bulkScores, [student.id]: e.target.value })}
                            className="w-20 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center"
                            placeholder="0-100"
                            min="0"
                            max="100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkModal(false)
                        setBulkScores({})
                        setBulkGroup('')
                      }}
                      className="flex-1 btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkEntry}
                      className="flex-1 btn-primary"
                      disabled={Object.keys(bulkScores).length === 0}
                    >
                      Save {Object.keys(bulkScores).length} Scores
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
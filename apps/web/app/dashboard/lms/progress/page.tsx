'use client'

import { useState, useEffect } from 'react'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import {
  BookOpen, TrendingUp, Award, Clock, Video, CheckCircle,
  Target, BarChart3, Users, Calendar, Search, Filter,
  Eye, Play, Pause, ChevronRight, TrendingDown, Activity
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'

interface StudentProgress {
  id: number
  student: any
  course: any
  module: any
  lesson: any
  completed: boolean
  progress_percentage: number
  time_spent_minutes: number
  last_accessed: string
  created_at: string
}

interface ModuleProgress {
  module: any
  total_lessons: number
  completed_lessons: number
  progress_percentage: number
  time_spent: number
}

export default function ProgressPage() {
  const [progressData, setProgressData] = useState<StudentProgress[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed'>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [progressResponse, studentsResponse] = await Promise.all([
        apiService.getStudentProgress().catch(() => ({ results: [] })),
        apiService.getStudents().catch(() => ({ results: [] }))
      ])

      setProgressData(progressResponse.results || progressResponse || [])
      setStudents(studentsResponse.results || studentsResponse || [])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load progress data')
    } finally {
      setIsLoading(false)
    }
  }

  const getStudentProgress = (studentId: number) => {
    return progressData.filter(p => p.student?.id === studentId)
  }

  const calculateStudentStats = (studentId: number) => {
    const progress = getStudentProgress(studentId)
    const totalItems = progress.length
    const completedItems = progress.filter(p => p.completed).length
    const totalTime = progress.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0)
    const avgProgress = totalItems > 0
      ? progress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / totalItems
      : 0

    return {
      totalItems,
      completedItems,
      completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
      totalTime,
      avgProgress: Math.round(avgProgress)
    }
  }

  const getModuleProgress = (studentId: number): ModuleProgress[] => {
    const progress = getStudentProgress(studentId)
    const moduleMap = new Map<number, ModuleProgress>()

    progress.forEach(p => {
      if (p.module) {
        const existing = moduleMap.get(p.module.id)
        if (existing) {
          existing.total_lessons++
          if (p.completed) existing.completed_lessons++
          existing.time_spent += p.time_spent_minutes || 0
        } else {
          moduleMap.set(p.module.id, {
            module: p.module,
            total_lessons: 1,
            completed_lessons: p.completed ? 1 : 0,
            progress_percentage: 0,
            time_spent: p.time_spent_minutes || 0
          })
        }
      }
    })

    return Array.from(moduleMap.values()).map(m => ({
      ...m,
      progress_percentage: m.total_lessons > 0
        ? (m.completed_lessons / m.total_lessons) * 100
        : 0
    }))
  }

  const filteredStudents = students.filter(student => {
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      student.username?.toLowerCase().includes(query) ||
      student.first_name?.toLowerCase().includes(query) ||
      student.last_name?.toLowerCase().includes(query)

    if (!matchesSearch) return false

    if (filterStatus === 'all') return true

    const stats = calculateStudentStats(student.id)
    if (filterStatus === 'completed') return stats.completionRate === 100
    if (filterStatus === 'in-progress') return stats.completionRate > 0 && stats.completionRate < 100

    return true
  })

  const overallStats = {
    totalStudents: students.length,
    activeStudents: students.filter(s => {
      const stats = calculateStudentStats(s.id)
      return stats.totalItems > 0
    }).length,
    avgCompletion: students.length > 0
      ? students.reduce((sum, s) => {
          const stats = calculateStudentStats(s.id)
          return sum + stats.completionRate
        }, 0) / students.length
      : 0,
    totalTime: progressData.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0)
  }

  if (isLoading) {
    return <LoadingScreen message="Loading progress data..." />
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              Learning Progress Tracking
            </h1>
            <p className="text-text-secondary">Monitor student progress across courses and modules</p>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{overallStats.totalStudents}</p>
              <p className="text-sm text-text-secondary">Total Students</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{overallStats.activeStudents}</p>
              <p className="text-sm text-text-secondary">Active Learners</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-info" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{Math.round(overallStats.avgCompletion)}%</p>
              <p className="text-sm text-text-secondary">Avg Completion</p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{Math.round(overallStats.totalTime / 60)}h</p>
              <p className="text-sm text-text-secondary">Total Study Time</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full md:w-auto relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-primary text-background'
                      : 'bg-background border border-border hover:bg-border/50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('in-progress')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filterStatus === 'in-progress'
                      ? 'bg-primary text-background'
                      : 'bg-background border border-border hover:bg-border/50'
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-primary text-background'
                      : 'bg-background border border-border hover:bg-border/50'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          {/* Student Progress List */}
          <div className="space-y-4">
            {filteredStudents.map((student) => {
              const stats = calculateStudentStats(student.id)
              const moduleProgress = getModuleProgress(student.id)
              const isExpanded = selectedStudent?.id === student.id

              return (
                <div key={student.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
                  {/* Student Header */}
                  <div
                    className="p-6 cursor-pointer hover:bg-background transition-colors"
                    onClick={() => setSelectedStudent(isExpanded ? null : student)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/20">
                          {student.first_name?.[0]}{student.last_name?.[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="text-sm text-text-secondary">@{student.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{stats.completedItems}/{stats.totalItems}</p>
                          <p className="text-xs text-text-secondary">Completed</p>
                        </div>

                        <div className="text-center">
                          <p className="text-2xl font-bold">{Math.round(stats.completionRate)}%</p>
                          <p className="text-xs text-text-secondary">Progress</p>
                        </div>

                        <div className="text-center">
                          <p className="text-2xl font-bold text-warning">{Math.round(stats.totalTime / 60)}h</p>
                          <p className="text-xs text-text-secondary">Time Spent</p>
                        </div>

                        <ChevronRight
                          className={`h-6 w-6 text-text-secondary transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="w-full bg-background rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            stats.completionRate === 100
                              ? 'bg-success'
                              : stats.completionRate > 50
                              ? 'bg-primary'
                              : 'bg-warning'
                          }`}
                          style={{ width: `${stats.completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-6 bg-background border-t border-border">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Module Progress
                      </h4>

                      {moduleProgress.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {moduleProgress.map((mp) => (
                            <div
                              key={mp.module.id}
                              className="bg-surface border border-border rounded-xl p-4"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h5 className="font-semibold mb-1">{mp.module.title || mp.module.name}</h5>
                                  <p className="text-xs text-text-secondary">
                                    {mp.completed_lessons} of {mp.total_lessons} lessons completed
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-primary">
                                    {Math.round(mp.progress_percentage)}%
                                  </p>
                                </div>
                              </div>

                              <div className="w-full bg-background rounded-full h-2 mb-2">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${mp.progress_percentage}%` }}
                                ></div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-text-secondary">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{Math.round(mp.time_spent)} min</span>
                                </div>
                                {mp.progress_percentage === 100 && (
                                  <div className="flex items-center gap-1 text-success">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>Complete</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-text-secondary">
                          <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No learning activity recorded</p>
                        </div>
                      )}

                      {/* Recent Activity */}
                      <div className="mt-6">
                        <h4 className="font-bold mb-3 flex items-center gap-2">
                          <Activity className="h-5 w-5 text-primary" />
                          Recent Activity
                        </h4>
                        <div className="space-y-2">
                          {getStudentProgress(student.id)
                            .sort((a, b) =>
                              new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime()
                            )
                            .slice(0, 5)
                            .map((progress, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-surface rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  {progress.completed ? (
                                    <CheckCircle className="h-5 w-5 text-success" />
                                  ) : (
                                    <Play className="h-5 w-5 text-warning" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{progress.lesson?.title || 'Lesson'}</p>
                                    <p className="text-xs text-text-secondary">
                                      {progress.module?.title || 'Module'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{progress.progress_percentage}%</p>
                                  <p className="text-xs text-text-secondary">
                                    {new Date(progress.last_accessed).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {filteredStudents.length === 0 && (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <Users className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary text-lg mb-2">No students found</p>
                <p className="text-sm text-text-secondary">
                  {searchQuery ? 'Try adjusting your search' : 'No progress data available'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
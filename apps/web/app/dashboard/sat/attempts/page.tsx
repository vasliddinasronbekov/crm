'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'react-hot-toast'
import LoadingScreen from '@/components/LoadingScreen'

interface SATAttempt {
  id: number
  student: {
    id: number
    username: string
    first_name: string
    last_name: string
  }
  exam: {
    id: number
    title: string
    is_official: boolean
  }
  status: 'payment_pending' | 'in_progress' | 'completed' | 'evaluated'
  total_score: number | null
  reading_writing_score: number | null
  math_score: number | null
  rw_correct: number
  math_correct: number
  coins_paid: number
  coins_refunded: number
  started_at: string
  completed_at: string | null
  refund_eligible: boolean
}

interface Stats {
  total_attempts: number
  completed_attempts: number
  in_progress_attempts: number
  average_score: number
  highest_score: number
  total_coins_collected: number
  total_coins_refunded: number
}

export default function SATAttemptsPage() {
  const router = useRouter()
  const [attempts, setAttempts] = useState<SATAttempt[]>([])
  const [filteredAttempts, setFilteredAttempts] = useState<SATAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total_attempts: 0,
    completed_attempts: 0,
    in_progress_attempts: 0,
    average_score: 0,
    highest_score: 0,
    total_coins_collected: 0,
    total_coins_refunded: 0,
  })

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')

  useEffect(() => {
    loadAttempts()
  }, [])

  useEffect(() => {
    filterAttempts()
  }, [attempts, statusFilter, searchQuery, sortBy])

  const loadAttempts = async () => {
    setLoading(true)
    try {
      // Note: This endpoint needs to be created for staff to view all attempts
      const response = await api.get('/v1/student-profile/sat/attempts/')
      const attemptsData = response.data.results || response.data || []
      setAttempts(attemptsData)
      calculateStats(attemptsData)
    } catch (error: any) {
      console.error('Failed to load attempts:', error)
      toast.error('Failed to load SAT attempts')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (attemptsData: SATAttempt[]) => {
    const completed = attemptsData.filter((a) => a.status === 'evaluated' || a.status === 'completed')
    const inProgress = attemptsData.filter((a) => a.status === 'in_progress')

    const avgScore =
      completed.length > 0
        ? completed.reduce((sum, a) => sum + (a.total_score || 0), 0) / completed.length
        : 0

    const highestScore = Math.max(...completed.map((a) => a.total_score || 0), 0)

    const coinsCollected = attemptsData.reduce((sum, a) => sum + a.coins_paid, 0)
    const coinsRefunded = attemptsData.reduce((sum, a) => sum + a.coins_refunded, 0)

    setStats({
      total_attempts: attemptsData.length,
      completed_attempts: completed.length,
      in_progress_attempts: inProgress.length,
      average_score: Math.round(avgScore),
      highest_score: highestScore,
      total_coins_collected: coinsCollected,
      total_coins_refunded: coinsRefunded,
    })
  }

  const filterAttempts = () => {
    let filtered = [...attempts]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((attempt) => attempt.status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (attempt) =>
          attempt.student.username.toLowerCase().includes(query) ||
          attempt.student.first_name.toLowerCase().includes(query) ||
          attempt.student.last_name.toLowerCase().includes(query) ||
          attempt.exam.title.toLowerCase().includes(query)
      )
    }

    // Sort
    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    } else if (sortBy === 'score') {
      filtered.sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
    }

    setFilteredAttempts(filtered)
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      payment_pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      completed: 'bg-green-500/20 text-green-400 border-green-500/50',
      evaluated: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    }
    return badges[status as keyof typeof badges] || 'bg-slate-700 text-slate-300'
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-slate-400'
    if (score >= 1400) return 'text-green-400'
    if (score >= 1200) return 'text-blue-400'
    if (score >= 1000) return 'text-yellow-400'
    return 'text-red-400'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleViewDetails = (attemptId: number) => {
    router.push(`/dashboard/sat/attempts/${attemptId}`)
  }

  if (loading) {
    return <LoadingScreen message="Loading SAT attempts..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">SAT Attempts Dashboard</h1>
        <p className="text-slate-400 mt-1">Monitor all student SAT exam attempts and performance</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Attempts</span>
            <span className="text-2xl">📝</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.total_attempts}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.completed_attempts} completed, {stats.in_progress_attempts} in progress
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Average Score</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{stats.average_score}/1600</p>
          <p className="text-xs text-slate-500 mt-1">Across all completed attempts</p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Highest Score</span>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{stats.highest_score}/1600</p>
          <p className="text-xs text-slate-500 mt-1">Best performance record</p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Coins Revenue</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">
            {stats.total_coins_collected - stats.total_coins_refunded}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Collected: {stats.total_coins_collected}, Refunded: {stats.total_coins_refunded}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by student name or exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="evaluated">Evaluated</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="date">Sort by Date</option>
            <option value="score">Sort by Score</option>
          </select>
        </div>

        <div className="mt-3 text-sm text-slate-400">
          Showing {filteredAttempts.length} of {attempts.length} attempts
        </div>
      </div>

      {/* Attempts Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {filteredAttempts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-white mb-2">No attempts found</h3>
            <p className="text-slate-400">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Students will appear here once they start taking SAT exams'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Total Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    RW Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Math Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Coins
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredAttempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => handleViewDetails(attempt.id)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">
                          {attempt.student.first_name} {attempt.student.last_name}
                        </p>
                        <p className="text-xs text-slate-400">@{attempt.student.username}</p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white">{attempt.exam.title}</p>
                        {attempt.exam.is_official && (
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            Official
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded border ${getStatusBadge(attempt.status)}`}
                      >
                        {attempt.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${getScoreColor(attempt.total_score)}`}>
                        {attempt.total_score || '-'}/1600
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-white font-medium">
                        {attempt.reading_writing_score || '-'}/800
                      </span>
                      <p className="text-xs text-slate-400">{attempt.rw_correct} correct</p>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-white font-medium">
                        {attempt.math_score || '-'}/800
                      </span>
                      <p className="text-xs text-slate-400">{attempt.math_correct} correct</p>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-red-400">-{attempt.coins_paid}</p>
                        {attempt.coins_refunded > 0 && (
                          <p className="text-green-400">+{attempt.coins_refunded}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-white">{formatDate(attempt.started_at)}</p>
                        {attempt.completed_at && (
                          <p className="text-xs text-slate-400">
                            Completed: {formatDate(attempt.completed_at)}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails(attempt.id)
                        }}
                        className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import apiService from '@/lib/api'
import { handleApiError, safeAsync } from '@/lib/utils/errorHandler'
import { getBalanceStatus } from '@/lib/utils/money'
import { cachedFetch, invalidateEntityCache, CACHE_KEYS, CACHE_TTL } from '@/lib/utils/cache'
import { toast } from 'react-hot-toast'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Mail, Phone, Calendar,
  DollarSign, TrendingUp, CheckCircle, AlertCircle,
  Clock, Award, Target, Users, ArrowLeft, Edit,
  Activity, BarChart3, AlertTriangle, Coins
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen'

interface StudentDetailData {
  // Personal info (flat structure from backend)
  id: number
  username: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone?: string
  photo?: string
  parents_phone?: string
  gender?: string
  birthday?: string
  date_joined: string
  last_login?: string
  rank?: number

  // Groups
  groups: Array<{
    id: number
    name: string
    branch?: string
    course?: string
    course_price?: number
    room?: string
    main_teacher?: string
    assistant_teacher?: string
    start_day: string
    end_day: string
    start_time: string
    end_time: string
    days: string
    is_active: boolean
  }>
  current_group?: any

  // Payments
  payments: {
    total_paid: number
    pending_amount: number
    payment_count: number
    last_payment_date?: string
    last_payment_amount?: number
  }
  account?: {
    status: 'active' | 'frozen' | 'deactivated' | string
    balance_tiyin: number
    balance: number
  }
  recent_payments: Array<{
    id: number
    date: string
    amount: number
    status: string
    group?: string
    payment_type?: string
    detail?: string
  }>

  // Attendance
  attendance: {
    attendance_rate_30days: number
    total_days_30days: number
    present_days_30days: number
    absent_days_30days: number
    total_class_days: number
  }
  recent_attendance: Array<{
    id: number
    date: string
    is_present: boolean
    status: string
    group?: string
  }>

  // Exams
  exams: {
    average_score: number
    exam_count: number
  }
  recent_exams: Array<{
    id: number
    date: string
    score: number
    group?: string
    examiner?: string
  }>

  // Coins
  coins: {
    total_coins: number
    recent_transactions: Array<{
      id: number
      amount: number
      reason: string
      date: string
    }>
  }

  // Risk Assessment
  risk_assessment: {
    risk_score: number
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    risk_factors: string[]
  }
}

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { formatCurrency } = useSettings()
  const studentId = parseInt(params.id as string)

  const [student, setStudent] = useState<StudentDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudentDetail()
  }, [studentId])

  const loadStudentDetail = async () => {
    setLoading(true)
    const result = await safeAsync(
      async () => {
        const data = await cachedFetch(
          `${CACHE_KEYS.STUDENTS_LIST}_detail_${studentId}`,
          () => apiService.getStudentDetail(studentId),
          CACHE_TTL.MEDIUM
        )
        return data
      },
      (error) => handleApiError(error, 'Failed to load student details'),
      (data) => setStudent(data)
    )

    if (!result) {
      router.push('/dashboard/students')
    }
    setLoading(false)
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-error bg-error/10 border-error'
      case 'medium': return 'text-warning bg-warning/10 border-warning'
      case 'low': return 'text-success bg-success/10 border-success'
      default: return 'text-text-secondary bg-surface border-border'
    }
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-success'
    if (rate >= 75) return 'text-warning'
    return 'text-error'
  }

  const getAttendanceStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-success/10 text-success border-success/30'
      case 'absent': return 'bg-error/10 text-error border-error/30'
      case 'late': return 'bg-warning/10 text-warning border-warning/30'
      case 'excused': return 'bg-info/10 text-info border-info/30'
      default: return 'bg-surface text-text-secondary border-border'
    }
  }

  const getInitials = () => {
    if (!student) return '?'
    const { first_name, last_name, username } = student
    const f = first_name && first_name.length > 0 ? first_name[0] : ''
    const l = last_name && last_name.length > 0 ? last_name[0] : ''
    return (f + l).toUpperCase() || (username ? username[0].toUpperCase() : '?')
  }

  if (loading) {
    return <LoadingScreen message="Loading student details..." />
  }

  if (!student) {
    return null
  }

  const {
    first_name, last_name, username, email, phone, photo,
    groups, payments, recent_payments,
    attendance, recent_attendance,
    exams, recent_exams,
    coins, risk_assessment, account
  } = student
  const balanceStatus = getBalanceStatus(payments.pending_amount)
  const accountStatus = account?.status || 'active'
  const normalizedExamScore = Math.min(Math.max(exams.average_score || 0, 0), 100)
  const engagementIndex = Math.round((attendance.attendance_rate_30days * 0.6) + (normalizedExamScore * 0.4))
  const engagementTone =
    engagementIndex >= 85
      ? { label: 'Strong', classes: 'text-success bg-success/10 border-success/30' }
      : engagementIndex >= 70
      ? { label: 'Stable', classes: 'text-warning bg-warning/10 border-warning/30' }
      : { label: 'At Risk', classes: 'text-error bg-error/10 border-error/30' }
  const recommendations = [
    attendance.attendance_rate_30days < 75 ? 'Schedule attendance follow-up' : null,
    payments.pending_amount > 0 ? 'Review payment plan and outstanding balance' : null,
    !email || !phone ? 'Complete missing contact information' : null,
  ].filter(Boolean) as string[]
  const accountStatusMeta =
    accountStatus === 'deactivated'
      ? { label: 'Deactivated', classes: 'bg-error/10 text-error border-error/30' }
      : accountStatus === 'frozen'
      ? { label: 'Frozen', classes: 'bg-warning/10 text-warning border-warning/30' }
      : { label: 'Active', classes: 'bg-success/10 text-success border-success/30' }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push('/dashboard/students')}
            className="mb-6 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Students
          </button>

          {/* Header with Student Info */}
          <div className="bg-surface rounded-2xl border border-border p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-3xl border-4 border-primary/20">
                  {photo ? (
                    <img src={photo} alt={first_name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>

                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    {first_name} {last_name}
                  </h1>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-text-secondary">@{username}</p>
                    <span className={`px-3 py-1 rounded-lg border text-xs font-medium ${accountStatusMeta.classes}`}>
                      {accountStatusMeta.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{email}</span>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Risk Assessment Badge */}
              <div className={`px-6 py-3 rounded-xl border-2 ${getRiskColor(risk_assessment.risk_level)}`}>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase mb-1">Risk Level</p>
                  <p className="text-2xl font-bold capitalize">{risk_assessment.risk_level}</p>
                  <p className="text-xs mt-1">Score: {risk_assessment.risk_score}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => toast.success('Messaging module coming online for this student.')}
                className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Message Student
              </button>
              <button
                onClick={() => toast.success('New schedule entry prepared.')}
                className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 transition-colors text-sm"
              >
                Schedule Follow-up
              </button>
              <button
                onClick={() => toast.success('Payment workflow queued.')}
                className="px-4 py-2 bg-background border border-border rounded-xl hover:bg-border/50 transition-colors text-sm"
              >
                Record Payment
              </button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {/* Payment Status */}
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
                {balanceStatus.status === 'paid' ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-error" />
                )}
              </div>
              <p className="text-3xl font-bold mb-1">{formatCurrency(payments.total_paid)}</p>
              <p className="text-sm text-text-secondary mb-2">Total Paid</p>
              <div className={`text-xs font-medium ${balanceStatus.color}`}>
                Debt: {formatCurrency(payments.pending_amount)}
              </div>
              {account && (
                <div className="text-xs text-text-secondary mt-1">
                  Internal balance: {formatCurrency(account.balance)}
                </div>
              )}
            </div>

            {/* Attendance Rate */}
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-info/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <Activity className="h-5 w-5 text-info" />
              </div>
              <p className={`text-3xl font-bold mb-1 ${getAttendanceColor(attendance.attendance_rate_30days)}`}>
                {attendance.attendance_rate_30days.toFixed(1)}%
              </p>
              <p className="text-sm text-text-secondary">Attendance Rate</p>
              <p className="text-xs text-text-secondary mt-2">{attendance.total_days_30days} days tracked</p>
            </div>

            {/* Average Score */}
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-warning/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-warning" />
                </div>
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <p className="text-3xl font-bold mb-1 text-warning">
                {exams.average_score.toFixed(1)}
              </p>
              <p className="text-sm text-text-secondary">Average Score</p>
              <p className="text-xs text-text-secondary mt-2">{exams.exam_count} exams taken</p>
            </div>

            {/* Coins */}
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl font-bold mb-1">{coins.total_coins}</p>
              <p className="text-sm text-text-secondary">Total Coins</p>
              <p className="text-xs text-text-secondary mt-2">{coins.recent_transactions.length} transactions</p>
            </div>

            {/* Engagement Index */}
            <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${engagementTone.classes}`}>
                  {engagementTone.label}
                </span>
              </div>
              <p className="text-3xl font-bold mb-1">{engagementIndex}</p>
              <p className="text-sm text-text-secondary">Engagement Index</p>
              <p className="text-xs text-text-secondary mt-2">Attendance + exam performance</p>
            </div>
          </div>

          {/* Risk + Recommendations */}
          {(risk_assessment.risk_factors.length > 0 || recommendations.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                  Risk Factors
                </h2>
                {risk_assessment.risk_factors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {risk_assessment.risk_factors.map((factor, index) => (
                      <span
                        key={`${factor}-${index}`}
                        className="px-3 py-2 rounded-xl bg-background border border-border text-sm"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">No active risk indicators.</p>
                )}
              </div>
              <div className="bg-surface rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Target className="h-6 w-6 text-primary" />
                  Recommended Actions
                </h2>
                {recommendations.length > 0 ? (
                  <ul className="space-y-3 text-sm">
                    {recommendations.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-success mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-secondary text-sm">No immediate interventions recommended.</p>
                )}
              </div>
            </div>
          )}

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Groups */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Enrolled Groups ({groups.length})
              </h2>
              <div className="space-y-3">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <div key={group.id} className="p-4 bg-background rounded-xl border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{group.name}</h3>
                          {group.course && <p className="text-sm text-text-secondary">{group.course}</p>}
                        </div>
                        {group.course_price && (
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                            {formatCurrency(group.course_price)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {group.days}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {group.start_time.slice(0, 5)} - {group.end_time.slice(0, 5)}
                        </div>
                      </div>
                      {group.main_teacher && (
                        <div className="mt-2 text-xs text-text-secondary">
                          Teacher: {group.main_teacher}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No groups enrolled</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-success" />
                Recent Payments
              </h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recent_payments.length > 0 ? (
                  recent_payments.map((payment) => (
                    <div key={payment.id} className="p-4 bg-background rounded-xl border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-success">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-text-secondary">{payment.group || 'N/A'}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {payment.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span>{payment.payment_type}</span>
                        <span>{new Date(payment.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No payments recorded</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Recent Attendance */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-info" />
                Recent Attendance
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recent_attendance.length > 0 ? (
                  recent_attendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-background rounded-xl">
                      <div>
                        <p className="text-sm font-medium">{new Date(record.date).toLocaleDateString()}</p>
                        <p className="text-xs text-text-secondary">{record.group || 'N/A'}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getAttendanceStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No attendance records</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Exams */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="h-6 w-6 text-warning" />
                Recent Exams
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recent_exams.length > 0 ? (
                  recent_exams.map((exam) => (
                    <div key={exam.id} className="p-3 bg-background rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium">{exam.group || 'Exam'}</p>
                          {exam.examiner && <p className="text-xs text-text-secondary">By: {exam.examiner}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-warning">{exam.score}</p>
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary">{new Date(exam.date).toLocaleDateString()}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No exam records</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Coin Transactions */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Coins className="h-6 w-6 text-primary" />
                Coin History
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {coins.recent_transactions.length > 0 ? (
                  coins.recent_transactions.map((transaction) => (
                    <div key={transaction.id} className="p-3 bg-background rounded-xl">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium">{transaction.reason}</p>
                        <span className={`text-lg font-bold ${transaction.amount > 0 ? 'text-success' : 'text-error'}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">{new Date(transaction.date).toLocaleDateString()}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary">
                    <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No coin transactions</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import apiService from '@/lib/api'
import { handleApiError, safeAsync } from '@/lib/utils/errorHandler'
import { getBalanceStatus } from '@/lib/utils/money'
import { resolveApiAssetUrl } from '@/lib/utils/url'
import { cachedFetch, invalidateEntityCache, CACHE_KEYS, CACHE_TTL } from '@/lib/utils/cache'
import { toast } from 'react-hot-toast'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchContext } from '@/contexts/BranchContext'
import {
  Mail, Phone, Calendar,
  DollarSign, TrendingUp, CheckCircle, AlertCircle,
  Clock, Award, Target, Users, ArrowLeft,
  Activity, BarChart3, AlertTriangle, Coins,
  UserCheck, PauseCircle, UserX
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import BranchScopeChip from '@/components/BranchScopeChip'
import LoadingScreen from '@/components/LoadingScreen'
import { usePermissions } from '@/lib/permissions'

type StudentAccountStatus = 'active' | 'frozen' | 'deactivated'
const TIYIN_PER_UZS = 100

const normalizeStudentAccountStatus = (value: unknown): StudentAccountStatus => {
  if (value === 'frozen' || value === 'deactivated') {
    return value
  }
  return 'active'
}

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
    course_price_tiyin?: number
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
    total_paid_tiyin?: number
    total_paid: number
    pending_amount_tiyin?: number
    pending_amount: number
    payment_count: number
    last_payment_date?: string
    last_payment_amount_tiyin?: number
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
    amount_tiyin?: number
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

interface StudentEditForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  branch_ids: number[]
  primary_branch_id: number | null
}

interface StudentProfileRecord {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  branch_ids?: number[]
  primary_branch_id?: number | null
}

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { branches, activeBranchId, isGlobalScope } = useBranchContext()
  const permissionState = usePermissions(user)
  const { formatCurrencyFromMinor } = useSettings()
  const studentId = parseInt(params.id as string)
  const canEditStudent = permissionState.hasPermission('students.edit')
  const canManageAccountStatus = permissionState.hasPermission('students.edit')
  const activeBranchName = useMemo(() => {
    if (activeBranchId === null) {
      return isGlobalScope ? 'All branches' : 'Your branch scope'
    }
    return branches.find((branch) => branch.id === activeBranchId)?.name || `Branch #${activeBranchId}`
  }, [activeBranchId, branches, isGlobalScope])

  const [student, setStudent] = useState<StudentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusAction, setStatusAction] = useState<StudentAccountStatus | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLoadingEditProfile, setIsLoadingEditProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [editForm, setEditForm] = useState<StudentEditForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    branch_ids: [],
    primary_branch_id: null,
  })

  const loadStudentDetail = useCallback(async () => {
    setLoading(true)
    const result = await safeAsync(
      async () => {
        const data = await cachedFetch(
          `${CACHE_KEYS.STUDENTS_LIST}_detail_${studentId}_b${activeBranchId ?? 'all'}`,
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
  }, [router, studentId, activeBranchId])

  useEffect(() => {
    void loadStudentDetail()
  }, [loadStudentDetail])

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

  const resolveMoneyTiyin = (explicitTiyin: unknown, fallbackUzs: unknown): number => {
    const explicit = Number(explicitTiyin)
    if (Number.isFinite(explicit)) {
      return Math.round(explicit)
    }

    const fallback = Number(fallbackUzs)
    if (Number.isFinite(fallback)) {
      return Math.round(fallback * TIYIN_PER_UZS)
    }

    return 0
  }

  const setStudentAccountStatus = (nextStatus: StudentAccountStatus) => {
    setStudent((prev) => {
      if (!prev) return prev
      const account = prev.account || { status: 'active', balance_tiyin: 0, balance: 0 }
      return {
        ...prev,
        account: {
          ...account,
          status: nextStatus,
        },
      }
    })
  }

  const handleAccountStatusChange = async (nextStatus: StudentAccountStatus) => {
    if (!student) return

    if (!canManageAccountStatus) {
      toast.error('You do not have permission to manage student account status')
      return
    }

    const currentStatus = normalizeStudentAccountStatus(student.account?.status)
    if (currentStatus === nextStatus) {
      return
    }

    const fullName = `${student.first_name} ${student.last_name}`.trim() || student.username
    const confirmed = confirm(
      `Change ${fullName} account status from ${currentStatus} to ${nextStatus}?`,
    )
    if (!confirmed) return

    try {
      setStatusAction(nextStatus)
      let response: any
      if (nextStatus === 'active') {
        response = await apiService.activateStudentAccount(student.id)
      } else if (nextStatus === 'frozen') {
        response = await apiService.freezeStudentAccount(student.id)
      } else {
        response = await apiService.deactivateStudentAccount(student.id)
      }

      const returnedStatus = normalizeStudentAccountStatus(response?.account_status || nextStatus)
      setStudentAccountStatus(returnedStatus)
      invalidateEntityCache(CACHE_KEYS.STUDENTS_LIST)
      toast.success(response?.detail || `Student account marked as ${returnedStatus}`)
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to update student account status'
      toast.error(message)
    } finally {
      setStatusAction(null)
    }
  }

  const withToggledBranch = (branchIds: number[] | undefined, branchId: number, checked: boolean): number[] => {
    const current = new Set(branchIds || [])
    if (checked) {
      current.add(branchId)
    } else {
      current.delete(branchId)
    }
    return Array.from(current)
  }

  const openEditModal = async () => {
    if (!canEditStudent) {
      toast.error('You do not have permission to edit students')
      return
    }

    setIsLoadingEditProfile(true)
    try {
      const profile = await apiService.getStudent(studentId) as StudentProfileRecord
      const fallbackBranchIds = activeBranchId !== null ? [activeBranchId] : []
      const branchIds = profile.branch_ids || (profile.primary_branch_id ? [profile.primary_branch_id] : fallbackBranchIds)
      const primaryBranchId =
        profile.primary_branch_id ??
        (branchIds.length > 0 ? branchIds[0] : null)

      setEditForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        branch_ids: branchIds,
        primary_branch_id: primaryBranchId,
      })
      setIsEditModalOpen(true)
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Failed to load student profile'
      toast.error(message)
    } finally {
      setIsLoadingEditProfile(false)
    }
  }

  const saveStudentProfile = async () => {
    if (!canEditStudent) {
      toast.error('You do not have permission to edit students')
      return
    }

    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      toast.error('First name and last name are required')
      return
    }

    if (!editForm.branch_ids || editForm.branch_ids.length === 0) {
      toast.error('Assign at least one branch for this student')
      return
    }

    setIsSavingProfile(true)
    try {
      await apiService.updateStudent(studentId, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        branch_ids: editForm.branch_ids,
        primary_branch_id: editForm.primary_branch_id,
      })
      toast.success('Student profile updated successfully')
      setIsEditModalOpen(false)
      invalidateEntityCache(CACHE_KEYS.STUDENTS_LIST)
      void loadStudentDetail()
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Failed to update student profile'
      toast.error(message)
    } finally {
      setIsSavingProfile(false)
    }
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
  const totalPaidTiyin = resolveMoneyTiyin(payments.total_paid_tiyin, payments.total_paid)
  const pendingAmountTiyin = resolveMoneyTiyin(payments.pending_amount_tiyin, payments.pending_amount)
  const accountBalanceTiyin = resolveMoneyTiyin(account?.balance_tiyin, account?.balance)

  const balanceStatus = getBalanceStatus(pendingAmountTiyin)
  const accountStatus = normalizeStudentAccountStatus(account?.status)
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
    pendingAmountTiyin > 0 ? 'Review payment plan and outstanding balance' : null,
    !email || !phone ? 'Complete missing contact information' : null,
  ].filter(Boolean) as string[]
  const accountStatusMeta =
    accountStatus === 'deactivated'
      ? { label: 'Deactivated', classes: 'bg-error/10 text-error border-error/30' }
      : accountStatus === 'frozen'
      ? { label: 'Frozen', classes: 'bg-warning/10 text-warning border-warning/30' }
      : { label: 'Active', classes: 'bg-success/10 text-success border-success/30' }
  const isStatusMutationRunning = statusAction !== null
  const studentPhotoUrl = resolveApiAssetUrl(photo)

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/4 right-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 h-72 w-72 rounded-full bg-warning/20 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push('/dashboard/students')}
            className="mb-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 glass-chip text-sm font-medium text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Students
          </button>

          {/* Header with Student Info */}
          <div className="glass-panel-strong rounded-3xl p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-3xl border-4 border-primary/20 overflow-hidden">
                  {studentPhotoUrl ? (
                    <NextImage
                      src={studentPhotoUrl}
                      alt={first_name}
                      fill
                      sizes="96px"
                      className="rounded-full object-cover"
                    />
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
                    <BranchScopeChip scopeName={activeBranchName} />
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
              <div className={`px-6 py-3 rounded-xl border-2 shadow-lg ${getRiskColor(risk_assessment.risk_level)}`}>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase mb-1">Risk Level</p>
                  <p className="text-2xl font-bold capitalize">{risk_assessment.risk_level}</p>
                  <p className="text-xs mt-1">Score: {risk_assessment.risk_score}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void openEditModal()}
                disabled={!canEditStudent || isLoadingEditProfile}
                title={!canEditStudent ? 'You do not have permission to edit students' : undefined}
                className={`px-4 py-2 rounded-xl border transition-colors text-sm font-medium ${
                  canEditStudent && !isLoadingEditProfile
                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                    : 'glass-chip border-border text-text-secondary/70 cursor-not-allowed'
                }`}
              >
                {isLoadingEditProfile ? 'Loading profile...' : 'Edit Profile'}
              </button>
              <button
                onClick={() => handleAccountStatusChange('active')}
                disabled={!canManageAccountStatus || accountStatus === 'active' || isStatusMutationRunning}
                title={!canManageAccountStatus ? 'You do not have permission to manage student account status' : undefined}
                className={`px-4 py-2 rounded-xl border transition-colors text-sm font-medium flex items-center gap-2 ${
                  canManageAccountStatus && accountStatus !== 'active' && !isStatusMutationRunning
                    ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                    : 'glass-chip border-border text-text-secondary/70 cursor-not-allowed'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Activate
              </button>
              <button
                onClick={() => handleAccountStatusChange('frozen')}
                disabled={!canManageAccountStatus || accountStatus === 'frozen' || isStatusMutationRunning}
                title={!canManageAccountStatus ? 'You do not have permission to manage student account status' : undefined}
                className={`px-4 py-2 rounded-xl border transition-colors text-sm font-medium flex items-center gap-2 ${
                  canManageAccountStatus && accountStatus !== 'frozen' && !isStatusMutationRunning
                    ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                    : 'glass-chip border-border text-text-secondary/70 cursor-not-allowed'
                }`}
              >
                <PauseCircle className="h-4 w-4" />
                Freeze
              </button>
              <button
                onClick={() => handleAccountStatusChange('deactivated')}
                disabled={!canManageAccountStatus || accountStatus === 'deactivated' || isStatusMutationRunning}
                title={!canManageAccountStatus ? 'You do not have permission to manage student account status' : undefined}
                className={`px-4 py-2 rounded-xl border transition-colors text-sm font-medium flex items-center gap-2 ${
                  canManageAccountStatus && accountStatus !== 'deactivated' && !isStatusMutationRunning
                    ? 'bg-error/10 text-error border-error/30 hover:bg-error/20'
                    : 'glass-chip border-border text-text-secondary/70 cursor-not-allowed'
                }`}
              >
                <UserX className="h-4 w-4" />
                Deactivate
              </button>
              <button
                onClick={() => toast.success('Messaging module coming online for this student.')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-background hover:opacity-95 transition-opacity text-sm font-medium"
              >
                Message Student
              </button>
              <button
                onClick={() => toast.success('New schedule entry prepared.')}
                className="px-4 py-2 glass-chip rounded-xl hover:bg-border/50 transition-colors text-sm"
              >
                Schedule Follow-up
              </button>
              <button
                onClick={() => toast.success('Payment workflow queued.')}
                className="px-4 py-2 glass-chip rounded-xl hover:bg-border/50 transition-colors text-sm"
              >
                Record Payment
              </button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {/* Payment Status */}
            <div className="glass-panel-strong p-6 rounded-2xl hover:border-primary/50 transition-all">
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
              <p className="text-3xl font-bold mb-1">{formatCurrencyFromMinor(totalPaidTiyin)}</p>
              <p className="text-sm text-text-secondary mb-2">Total Paid</p>
              <div className={`text-xs font-medium ${balanceStatus.color}`}>
                Debt: {formatCurrencyFromMinor(pendingAmountTiyin)}
              </div>
              {account && (
                <div className="text-xs text-text-secondary mt-1">
                  Internal balance: {formatCurrencyFromMinor(accountBalanceTiyin)}
                </div>
              )}
            </div>

            {/* Attendance Rate */}
            <div className="glass-panel p-6 rounded-2xl hover:border-info/50 transition-all">
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
            <div className="glass-panel p-6 rounded-2xl hover:border-warning/50 transition-all">
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
            <div className="glass-panel p-6 rounded-2xl hover:border-primary/50 transition-all">
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
            <div className="glass-panel p-6 rounded-2xl hover:border-primary/50 transition-all">
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
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                  Risk Factors
                </h2>
                {risk_assessment.risk_factors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {risk_assessment.risk_factors.map((factor, index) => (
                      <span
                        key={`${factor}-${index}`}
                        className="px-3 py-2 rounded-xl glass-chip text-sm"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">No active risk indicators.</p>
                )}
              </div>
              <div className="glass-panel rounded-2xl p-6">
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
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Enrolled Groups ({groups.length})
              </h2>
              <div className="space-y-3">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <div key={group.id} className="p-4 rounded-xl glass-chip">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{group.name}</h3>
                          {group.course && <p className="text-sm text-text-secondary">{group.course}</p>}
                        </div>
                        {resolveMoneyTiyin(group.course_price_tiyin, group.course_price) > 0 && (
                          <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                            {formatCurrencyFromMinor(resolveMoneyTiyin(group.course_price_tiyin, group.course_price))}
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
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-success" />
                Recent Payments
              </h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recent_payments.length > 0 ? (
                  recent_payments.map((payment) => (
                    <div key={payment.id} className="p-4 rounded-xl glass-chip">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-success">
                            {formatCurrencyFromMinor(resolveMoneyTiyin(payment.amount_tiyin, payment.amount))}
                          </p>
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
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-info" />
                Recent Attendance
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recent_attendance.length > 0 ? (
                  recent_attendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 rounded-xl glass-chip">
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
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="h-6 w-6 text-warning" />
                Recent Exams
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recent_exams.length > 0 ? (
                  recent_exams.map((exam) => (
                    <div key={exam.id} className="p-3 rounded-xl glass-chip">
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
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Coins className="h-6 w-6 text-primary" />
                Coin History
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {coins.recent_transactions.length > 0 ? (
                  coins.recent_transactions.map((transaction) => (
                    <div key={transaction.id} className="p-3 rounded-xl glass-chip">
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

          {isEditModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Edit Student Profile</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, first_name: event.target.value }))}
                      className="px-4 py-3 rounded-xl border border-border bg-background"
                      placeholder="First name"
                    />
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, last_name: event.target.value }))}
                      className="px-4 py-3 rounded-xl border border-border bg-background"
                      placeholder="Last name"
                    />
                  </div>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                    placeholder="Email"
                  />
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                    placeholder="Phone"
                  />

                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-sm font-semibold">Branch assignment</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Keep this student visible only in selected branches.
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {branches.map((branch) => {
                        const checked = (editForm.branch_ids || []).includes(branch.id)
                        return (
                          <label
                            key={branch.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <span>{branch.name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextBranchIds = withToggledBranch(
                                  editForm.branch_ids,
                                  branch.id,
                                  event.target.checked,
                                )
                                const nextPrimary =
                                  nextBranchIds.length === 0
                                    ? null
                                    : editForm.primary_branch_id &&
                                        nextBranchIds.includes(editForm.primary_branch_id)
                                      ? editForm.primary_branch_id
                                      : nextBranchIds[0]

                                setEditForm((prev) => ({
                                  ...prev,
                                  branch_ids: nextBranchIds,
                                  primary_branch_id: nextPrimary,
                                }))
                              }}
                            />
                          </label>
                        )
                      })}
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium mb-2">Primary branch</label>
                      <select
                        value={editForm.primary_branch_id ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          const nextPrimary = value ? Number(value) : null
                          setEditForm((prev) => ({
                            ...prev,
                            primary_branch_id: nextPrimary,
                          }))
                        }}
                        disabled={(editForm.branch_ids || []).length === 0}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                      >
                        <option value="">Select primary branch</option>
                        {(editForm.branch_ids || []).map((branchId) => {
                          const branch = branches.find((item) => item.id === branchId)
                          return (
                            <option key={branchId} value={branchId}>
                              {branch?.name || `Branch #${branchId}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => void saveStudentProfile()}
                    disabled={isSavingProfile}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-background font-semibold disabled:opacity-60"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-border bg-background font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}

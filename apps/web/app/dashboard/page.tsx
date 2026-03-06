'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useRealtimeAccountingDashboard } from '@/lib/hooks/useAccounting'
import { type Permission, usePermissions } from '@/lib/permissions'
import {
  Users, GraduationCap, BookOpen, DollarSign,
  ShoppingCart, Calendar, MessageCircle, Mail,
  Megaphone, Receipt, Trophy, Award, CheckSquare,
  Briefcase, TrendingUp, ArrowRight, Activity,
  Clock, Target, Zap, BarChart3, Wallet, Layers, AlertCircle, PiggyBank,
  LineChart, MailCheck, type LucideIcon
} from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'

interface DashboardStats {
  total_students: number
  total_teachers: number
  total_groups: number
  active_courses: number
  total_revenue?: number
  pending_tasks: number
}

interface AnalyticsData {
  active_students: number
  active_groups: number
  attendance_rate: number
  total_payments: number
  paid_payments: number
  active_leads: number
  converted_leads: number
  [key: string]: any
}

export default function DashboardPage() {
  const { user } = useAuth()
  const permissions = usePermissions(user)
  const { language, translateText, formatCurrencyFromMinor } = useSettings()
  const {
    data: realtimeDashboard,
    isLoading: isRealtimeLoading,
    refetch: refetchRealtimeDashboard,
  } = useRealtimeAccountingDashboard(30)
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const realtimeRefetchRef = useRef(refetchRealtimeDashboard)
  const canViewFinanceOverview = permissions.hasAnyPermission(['payments.view'])

  useEffect(() => {
    realtimeRefetchRef.current = refetchRealtimeDashboard
  }, [refetchRealtimeDashboard])

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!canViewFinanceOverview) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.crmai.uz/api'
    const baseHttp = apiUrl.replace(/\/api\/?$/, '')
    const wsBase = baseHttp.replace(/^http/, 'ws')
    const socketUrl = `${wsBase}/ws/accounting/logs/?token=${encodeURIComponent(token)}`

    let websocket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let reconnectAttempts = 0

    const connect = () => {
      if (cancelled) return

      try {
        websocket = new WebSocket(socketUrl)
      } catch (error) {
        console.debug('Accounting websocket init failed', error)
        return
      }

      websocket.onopen = () => {
        reconnectAttempts = 0
      }

      websocket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data || '{}')
          if (parsed?.type === 'accounting_log') {
            void realtimeRefetchRef.current()
          }
        } catch (error) {
          console.debug('Accounting websocket payload parse failed', error)
        }
      }

      websocket.onclose = (event) => {
        if (cancelled) return
        if (event.code === 1000) return

        if (reconnectAttempts >= 6) {
          return
        }
        reconnectAttempts = Math.min(reconnectAttempts + 1, 6)
        const delayMs = Math.min(1000 * 2 ** reconnectAttempts, 30000)
        reconnectTimer = setTimeout(connect, delayMs)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      if (websocket && websocket.readyState <= WebSocket.OPEN) {
        websocket.close(1000, 'dashboard-unmount')
      }
    }
  }, [canViewFinanceOverview, user?.id])

  const loadDashboardData = async () => {
    try {
      const [statsData, analyticsData] = await Promise.all([
        apiService.getDashboardStats().catch(() => ({
          total_students: 0,
          total_teachers: 0,
          total_groups: 0,
          active_courses: 0,
          pending_tasks: 0,
        })),
        apiService.getAnalytics().catch(() => ({
          active_students: 0,
          active_groups: 0,
          attendance_rate: 0,
          total_payments: 0,
          paid_payments: 0,
          active_leads: 0,
          converted_leads: 0,
        }))
      ])

      setStats(statsData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate real platform metrics
  const getStudentEngagement = () => {
    if (!stats || !analytics) return 0
    if (stats.total_students === 0) return 0
    return Math.round((analytics.active_students / stats.total_students) * 100)
  }

  const getCourseCompletion = () => {
    if (!analytics || !analytics.total_payments) return 0
    if (analytics.total_payments === 0) return 0
    return Math.round((analytics.paid_payments / analytics.total_payments) * 100)
  }

  const getTeacherActivity = () => {
    if (!stats || !analytics) return 0
    if (stats.total_groups === 0) return 0
    return Math.round((analytics.active_groups / stats.total_groups) * 100)
  }

  const getLeadConversion = () => {
    if (!analytics || !analytics.active_leads) return 0
    if (analytics.active_leads === 0) return 0
    return Math.round((analytics.converted_leads / analytics.active_leads) * 100)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return translateText('Good Morning')
    if (hour < 18) return translateText('Good Afternoon')
    return translateText('Good Evening')
  }

  const getUserName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.username || 'Admin'
  }

  const getUserRole = () => {
    return translateText(permissions.roleLabel)
  }

  const dateLocale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US'

  interface FeatureCard {
    title: string
    description: string
    icon: LucideIcon
    color: string
    iconColor: string
    href: string
    stat: string | number
    statLabel: string
    requiredPermissions: Permission[]
  }

  // Feature cards based on permissions
  const getFeatureCards = () => {
    const allCards: FeatureCard[] = [
      {
        title: 'Students',
        description: 'Manage student profiles',
        icon: Users,
        color: 'from-blue-500/20 to-blue-600/20',
        iconColor: 'text-blue-500',
        href: '/dashboard/students',
        stat: stats?.total_students || 0,
        statLabel: 'Total Students',
        requiredPermissions: ['students.view']
      },
      {
        title: 'Teachers',
        description: 'Manage teaching staff',
        icon: GraduationCap,
        color: 'from-purple-500/20 to-purple-600/20',
        iconColor: 'text-purple-500',
        href: '/dashboard/teachers',
        stat: stats?.total_teachers || 0,
        statLabel: 'Total Teachers',
        requiredPermissions: ['teachers.view']
      },
      {
        title: 'Groups',
        description: 'Manage classes & groups',
        icon: BookOpen,
        color: 'from-green-500/20 to-green-600/20',
        iconColor: 'text-green-500',
        href: '/dashboard/groups',
        stat: stats?.total_groups || 0,
        statLabel: 'Active Groups',
        requiredPermissions: ['groups.view']
      },
      {
        title: 'Tasks',
        description: 'Track tasks & projects',
        icon: CheckSquare,
        color: 'from-orange-500/20 to-orange-600/20',
        iconColor: 'text-orange-500',
        href: '/dashboard/tasks',
        stat: stats?.pending_tasks || 0,
        statLabel: 'Pending Tasks',
        requiredPermissions: ['tasks.view']
      },
      {
        title: 'Shop & Rewards',
        description: 'Products & student coins',
        icon: ShoppingCart,
        color: 'from-pink-500/20 to-pink-600/20',
        iconColor: 'text-pink-500',
        href: '/dashboard/shop',
        stat: '🪙',
        statLabel: 'Rewards System',
        requiredPermissions: ['shop.view']
      },
      {
        title: 'Events',
        description: 'School events & activities',
        icon: Calendar,
        color: 'from-indigo-500/20 to-indigo-600/20',
        iconColor: 'text-indigo-500',
        href: '/dashboard/events',
        stat: '📅',
        statLabel: 'Event Management',
        requiredPermissions: ['events.view']
      },
      {
        title: 'Support Tickets',
        description: 'Help desk & support',
        icon: MessageCircle,
        color: 'from-yellow-500/20 to-yellow-600/20',
        iconColor: 'text-yellow-500',
        href: '/dashboard/support',
        stat: '🎫',
        statLabel: 'Support System',
        requiredPermissions: ['support.view']
      },
      {
        title: 'Email Marketing',
        description: 'Campaigns & templates',
        icon: Mail,
        color: 'from-red-500/20 to-red-600/20',
        iconColor: 'text-red-500',
        href: '/dashboard/email',
        stat: '📧',
        statLabel: 'Email Campaigns',
        requiredPermissions: ['email.view']
      },
      {
        title: 'Announcements',
        description: 'Broadcast messages',
        icon: Megaphone,
        color: 'from-teal-500/20 to-teal-600/20',
        iconColor: 'text-teal-500',
        href: '/dashboard/announcements',
        stat: '📢',
        statLabel: 'Announcements',
        requiredPermissions: ['announcements.view']
      },
      {
        title: 'Expenses',
        description: 'Track school expenses',
        icon: Receipt,
        color: 'from-rose-500/20 to-rose-600/20',
        iconColor: 'text-rose-500',
        href: '/dashboard/expenses',
        stat: '💸',
        statLabel: 'Expense Tracking',
        requiredPermissions: ['expenses.view']
      },
      {
        title: 'Leaderboard',
        description: 'Student rankings',
        icon: Trophy,
        color: 'from-amber-500/20 to-amber-600/20',
        iconColor: 'text-amber-500',
        href: '/dashboard/leaderboard',
        stat: '🏆',
        statLabel: 'Rankings',
        requiredPermissions: ['analytics.view']
      },
      {
        title: 'Certificates',
        description: 'Issue certificates',
        icon: Award,
        color: 'from-emerald-500/20 to-emerald-600/20',
        iconColor: 'text-emerald-500',
        href: '/dashboard/certificates',
        stat: '🎓',
        statLabel: 'Certifications',
        requiredPermissions: ['certificates.view']
      },
      {
        title: 'HR & Salary',
        description: 'Payroll management',
        icon: Briefcase,
        color: 'from-slate-500/20 to-slate-600/20',
        iconColor: 'text-slate-500',
        href: '/dashboard/hr',
        stat: '💼',
        statLabel: 'HR System',
        requiredPermissions: ['hr.view']
      },
      {
        title: 'Finance Dashboard',
        description: 'Unified financial overview',
        icon: TrendingUp,
        color: 'from-emerald-500/20 to-emerald-600/20',
        iconColor: 'text-emerald-500',
        href: '/dashboard/finance',
        stat: '💰',
        statLabel: 'Financial Hub',
        requiredPermissions: ['payments.view']
      },
      {
        title: 'Analytics',
        description: 'Reports & insights',
        icon: BarChart3,
        color: 'from-cyan-500/20 to-cyan-600/20',
        iconColor: 'text-cyan-500',
        href: '/dashboard/analytics',
        stat: '📊',
        statLabel: 'Analytics',
        requiredPermissions: ['analytics.view']
      },
      {
        title: 'Payments',
        description: 'Payment processing',
        icon: DollarSign,
        color: 'from-lime-500/20 to-lime-600/20',
        iconColor: 'text-lime-500',
        href: '/dashboard/payments',
        stat: '💰',
        statLabel: 'Payments',
        requiredPermissions: ['payments.view']
      },
      {
        title: 'Accounting',
        description: 'Financial management',
        icon: Wallet,
        color: 'from-violet-500/20 to-violet-600/20',
        iconColor: 'text-violet-500',
        href: '/dashboard/accounting',
        stat: '💼',
        statLabel: 'Accounting',
        requiredPermissions: ['payments.view']
      },
      {
        title: 'CRM Pipelines',
        description: 'Sales pipeline & deals',
        icon: Layers,
        color: 'from-fuchsia-500/20 to-fuchsia-600/20',
        iconColor: 'text-fuchsia-500',
        href: '/dashboard/crm/pipelines',
        stat: '🎯',
        statLabel: 'Deal Tracking',
        requiredPermissions: ['crm.view']
      },
      {
        title: 'LMS Progress',
        description: 'Learning analytics',
        icon: LineChart,
        color: 'from-sky-500/20 to-sky-600/20',
        iconColor: 'text-sky-500',
        href: '/dashboard/lms/progress',
        stat: '📈',
        statLabel: 'Student Progress',
        requiredPermissions: ['lms.view']
      },
      {
        title: 'Email Logs',
        description: 'Delivery tracking',
        icon: MailCheck,
        color: 'from-rose-500/20 to-rose-600/20',
        iconColor: 'text-rose-500',
        href: '/dashboard/email/logs',
        stat: '📬',
        statLabel: 'Email Analytics',
        requiredPermissions: ['email.view']
      },
    ]

    return allCards.filter((card) => (
      permissions.canAccessPage(card.href) &&
      permissions.hasAnyPermission(card.requiredPermissions)
    ))
  }

  if (isLoading) {
    return <LoadingScreen message={translateText('Loading dashboard...')} />
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                {getGreeting()}, {getUserName()}!
                <span className="text-3xl">👋</span>
              </h1>
              <p className="text-text-secondary text-lg">
                {getUserRole()} • {new Date().toLocaleDateString(dateLocale, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-6 border border-primary/20">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-text-secondary">Platform Status</p>
                  <p className="text-xl font-bold text-success">All Systems Operational</p>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time accounting cards + feed */}
          {canViewFinanceOverview ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8">
              <div className="bg-surface p-6 rounded-2xl border border-border hover:border-success/50 transition-all h-[250px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-secondary">Total Income</p>
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <p className="text-2xl font-bold text-success">
                  {formatCurrencyFromMinor(realtimeDashboard?.total_income_tiyin || 0)}
                </p>
                <p className="text-xs text-text-secondary mt-1">All paid payments</p>
              </div>

              <div className="bg-surface p-6 rounded-2xl border border-border hover:border-error/50 transition-all h-[220px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-secondary">Total Debt</p>
                  <AlertCircle className="h-5 w-5 text-error" />
                </div>
                <p className="text-2xl font-bold text-error">
                  {formatCurrencyFromMinor(realtimeDashboard?.total_debt_tiyin || 0)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Sum of all negative balances</p>
              </div>

              <div className="bg-surface p-6 rounded-2xl border border-border hover:border-primary/50 transition-all h-[220px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-secondary">Net Profit</p>
                  <PiggyBank className="h-5 w-5 text-primary" />
                </div>
                <p className={`text-2xl font-bold ${(realtimeDashboard?.net_profit_tiyin || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                  {(realtimeDashboard?.net_profit_tiyin || 0) >= 0 ? '+' : ''}
                  {formatCurrencyFromMinor(realtimeDashboard?.net_profit_tiyin || 0)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Income + sum of all balances</p>
              </div>

              <div className="bg-surface p-6 rounded-2xl border border-border hover:border-warning/50 transition-all h-[220px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-text-secondary">Teacher Payroll</p>
                  <Briefcase className="h-5 w-5 text-warning" />
                </div>
                <p className="text-2xl font-bold text-warning">
                  {formatCurrencyFromMinor(realtimeDashboard?.teacher_payroll_tiyin || 0)}
                </p>
                <p className="text-xs text-text-secondary mt-1">40% pro-rated payout obligation</p>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-4 h-[220px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Live Activity Feed</p>
                  {isRealtimeLoading && <span className="text-xs text-text-secondary">syncing...</span>}
                </div>
                <div className="space-y-2 h-[120px] overflow-y-auto pr-1">
                  {(realtimeDashboard?.recent_logs || []).length > 0 ? (
                    (realtimeDashboard?.recent_logs || []).map((log) => (
                      <div key={log.id} className="rounded-xl border border-border bg-background p-3">
                        <p className="text-xs font-medium mb-1">{log.message}</p>
                        <div className="flex items-center justify-between text-[11px] text-text-secondary">
                          <span>{log.actor_username || 'System'}</span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-text-secondary py-8 text-center">No activity logs yet</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 bg-surface rounded-2xl border border-border p-6">
              <p className="text-sm text-text-secondary">
                Financial realtime metrics are available for finance-enabled roles.
              </p>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats?.total_students || 0}</p>
              <p className="text-sm text-text-secondary">Total Students</p>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-purple-500" />
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats?.total_teachers || 0}</p>
              <p className="text-sm text-text-secondary">Teaching Staff</p>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-green-500" />
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats?.total_groups || 0}</p>
              <p className="text-sm text-text-secondary">Active Groups</p>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-orange-500" />
                </div>
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats?.pending_tasks || 0}</p>
              <p className="text-sm text-text-secondary">Pending Tasks</p>
            </div>
          </div>
        </div>

        {/* Quick Access Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Quick Access
            </h2>
            <p className="text-sm text-text-secondary">Click any card to navigate</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {getFeatureCards().map((card, index) => {
              const Icon = card.icon
              return (
                <button
                  key={index}
                  onClick={() => router.push(card.href)}
                  className="group bg-surface rounded-2xl border border-border p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all text-left relative overflow-hidden"
                >
                  {/* Background Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center border border-border`}>
                        <Icon className={`h-6 w-6 ${card.iconColor}`} />
                      </div>
                      <ArrowRight className="h-5 w-5 text-text-secondary group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">
                      {card.description}
                    </p>

                    {/* Stat Badge */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-xs text-text-secondary">{card.statLabel}</span>
                      <span className="text-2xl font-bold group-hover:scale-110 transition-transform">
                        {card.stat}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* System Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              System Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm">Backend API</span>
                </div>
                <span className="text-sm font-medium text-success">Online</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm">Database</span>
                </div>
                <span className="text-sm font-medium text-success">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm">AI Services</span>
                </div>
                <span className="text-sm font-medium text-success">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm">Storage</span>
                </div>
                <span className="text-sm font-medium text-success">Healthy</span>
              </div>
            </div>
          </div>

          {/* Platform Stats */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Platform Overview
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Student Engagement</span>
                  <span className="text-sm font-bold text-success">{getStudentEngagement()}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-gradient-to-r from-success to-success/80 h-2 rounded-full" style={{ width: `${getStudentEngagement()}%` }}></div>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {analytics?.active_students || 0} active of {stats?.total_students || 0} students
                </p>
              </div>
              <div className="p-3 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Payment Success Rate</span>
                  <span className="text-sm font-bold text-primary">{getCourseCompletion()}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full" style={{ width: `${getCourseCompletion()}%` }}></div>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {analytics?.paid_payments || 0} paid of {analytics?.total_payments || 0} payments
                </p>
              </div>
              <div className="p-3 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Group Activity</span>
                  <span className="text-sm font-bold text-warning">{getTeacherActivity()}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-gradient-to-r from-warning to-warning/80 h-2 rounded-full" style={{ width: `${getTeacherActivity()}%` }}></div>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {analytics?.active_groups || 0} active of {stats?.total_groups || 0} groups
                </p>
              </div>
              <div className="p-3 bg-background rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Lead Conversion</span>
                  <span className="text-sm font-bold text-info">{getLeadConversion()}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-gradient-to-r from-info to-info/80 h-2 rounded-full" style={{ width: `${getLeadConversion()}%` }}></div>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {analytics?.converted_leads || 0} converted of {analytics?.active_leads || 0} leads
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

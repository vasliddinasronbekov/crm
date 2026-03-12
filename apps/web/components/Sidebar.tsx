'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  BarChart3,
  Users,
  GraduationCap,
  Settings,
  LogOut,
  UserCircle2,
  BookOpen,
  MessageSquare,
  FileText,
  DollarSign,
  CheckSquare,
  Briefcase,
  ShoppingCart,
  Calendar,
  Mail,
  Megaphone,
  Receipt,
  Trophy,
  Award,
  MessageCircle,
  Wallet,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { usePermissions } from '@/lib/permissions'

type NavSection = 'core' | 'academic' | 'engagement' | 'finance' | 'system'

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  section: NavSection
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, section: 'core' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, section: 'core' },
  { name: 'Students', href: '/dashboard/students', icon: UserCircle2, section: 'academic' },
  { name: 'Teachers', href: '/dashboard/teachers', icon: Users, section: 'academic' },
  { name: 'Group Management', href: '/dashboard/groups', icon: BookOpen, section: 'academic' },
  { name: 'Schedule Board', href: '/dashboard/schedule', icon: Calendar, section: 'academic' },
  { name: 'CRM', href: '/dashboard/crm', icon: Layers, section: 'core' },
  { name: 'LMS', href: '/dashboard/lms', icon: GraduationCap, section: 'academic' },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, section: 'engagement' },
  { name: 'Shop', href: '/dashboard/shop', icon: ShoppingCart, section: 'engagement' },
  { name: 'Events', href: '/dashboard/events', icon: Calendar, section: 'engagement' },
  { name: 'Support', href: '/dashboard/support', icon: MessageCircle, section: 'engagement' },
  { name: 'Email', href: '/dashboard/email', icon: Mail, section: 'engagement' },
  { name: 'Announcements', href: '/dashboard/announcements', icon: Megaphone, section: 'engagement' },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy, section: 'engagement' },
  { name: 'Certificates', href: '/dashboard/certificates', icon: Award, section: 'engagement' },
  { name: 'Messaging', href: '/dashboard/messaging', icon: MessageSquare, section: 'engagement' },
  { name: 'Finance', href: '/dashboard/finance', icon: Wallet, section: 'finance' },
  { name: 'Payments', href: '/dashboard/payments', icon: DollarSign, section: 'finance' },
  { name: 'Accounting', href: '/dashboard/accounting', icon: Wallet, section: 'finance' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt, section: 'finance' },
  { name: 'HR & Salary', href: '/dashboard/hr', icon: Briefcase, section: 'finance' },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText, section: 'system' },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, section: 'system' },
]

const sectionLabels: Record<NavSection, string> = {
  core: 'Core',
  academic: 'Academic',
  engagement: 'Engagement',
  finance: 'Finance',
  system: 'System',
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { translateText } = useSettings()
  const permissions = usePermissions(user)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const getInitials = () => {
    const firstInitial = user?.first_name?.trim()?.charAt(0)
    const lastInitial = user?.last_name?.trim()?.charAt(0)

    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`.toUpperCase()
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    return '??'
  }

  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.username || translateText('User')
  }

  if (!user || !permissions.isStaffSideRole) return null

  const visibleNavigation = navigation.filter((item) => permissions.canAccessPage(item.href))

  return (
    <div className="flex h-screen w-72 flex-col bg-surface border-r border-border">
      <div className="flex h-16 items-center justify-between px-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">EDUOS</h1>
        <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
          {permissions.roleLabel}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {Object.entries(sectionLabels).map(([sectionKey, label]) => {
          const sectionItems = visibleNavigation.filter((item) => item.section === sectionKey)
          if (!sectionItems.length) {
            return null
          }

          return (
            <div key={sectionKey} className="mb-4">
              <p className="px-3 pb-2 text-[11px] uppercase tracking-wide text-text-secondary font-semibold">
                {translateText(label)}
              </p>
              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-text-secondary hover:bg-background hover:text-text-primary'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{translateText(item.name)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="bg-background rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-background font-bold">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getDisplayName()}</p>
              <p className="text-xs text-text-secondary">{permissions.roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            {translateText('Logout')}
          </button>
        </div>
      </div>
    </div>
  )
}

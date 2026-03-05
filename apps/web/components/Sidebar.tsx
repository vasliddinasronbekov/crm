'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, BarChart3, Users, GraduationCap, Settings, LogOut, UserCircle2, BookOpen, MessageSquare, FileText, DollarSign, CheckSquare, Briefcase, ShoppingCart, Calendar, Mail, Megaphone, Receipt, Trophy, Award, MessageCircle, Wallet, Layers } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'

// Navigation items with role-based access
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'teacher', 'staff'] },
  { name: 'Finance', href: '/dashboard/finance', icon: Wallet, roles: ['admin'] },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, roles: ['admin'] },
  { name: 'Students', href: '/dashboard/students', icon: UserCircle2, roles: ['admin', 'staff'] },
  { name: 'Teachers', href: '/dashboard/teachers', icon: Users, roles: ['admin'] },
  { name: 'Group Management', href: '/dashboard/groups', icon: BookOpen, roles: ['admin', 'teacher', 'staff'] },
  { name: 'Schedule Board', href: '/dashboard/schedule', icon: Calendar, roles: ['admin', 'teacher', 'staff'] },
  { name: 'CRM', href: '/dashboard/crm', icon: Layers, roles: ['admin', 'staff'] },
  { name: 'LMS', href: '/dashboard/lms', icon: GraduationCap, roles: ['admin', 'teacher'] },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, roles: ['admin', 'teacher', 'staff'] },
  { name: 'HR & Salary', href: '/dashboard/hr', icon: Briefcase, roles: ['admin'] },
  { name: 'Shop', href: '/dashboard/shop', icon: ShoppingCart, roles: ['admin', 'staff'] },
  { name: 'Events', href: '/dashboard/events', icon: Calendar, roles: ['admin', 'teacher', 'staff'] },
  { name: 'Support', href: '/dashboard/support', icon: MessageCircle, roles: ['admin', 'staff'] },
  { name: 'Email', href: '/dashboard/email', icon: Mail, roles: ['admin', 'staff'] },
  { name: 'Announcements', href: '/dashboard/announcements', icon: Megaphone, roles: ['admin', 'teacher'] },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt, roles: ['admin'] },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy, roles: ['admin', 'teacher', 'staff'] },
  { name: 'Payments', href: '/dashboard/payments', icon: DollarSign, roles: ['admin', 'staff'] },
  { name: 'Certificates', href: '/dashboard/certificates', icon: Award, roles: ['admin', 'teacher'] },
  { name: 'Accounting', href: '/dashboard/accounting', icon: Wallet, roles: ['admin'] },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText, roles: ['admin'] },
  { name: 'Messaging', href: '/dashboard/messaging', icon: MessageSquare, roles: ['admin', 'staff', 'teacher'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['admin', 'teacher', 'staff'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAdmin, isTeacher, isStaff } = useAuth()
  const { translateText } = useSettings()

  // Determine user role for filtering
  const userRole = isAdmin ? 'admin' : isTeacher ? 'teacher' : isStaff ? 'staff' : null

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Get user initials
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    return '??'
  }

  // Get user display name
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user?.username || translateText('User')
  }

  // Get user role label
  const getRoleLabel = () => {
    if (user?.is_superuser) return translateText('Superuser')
    if (user?.is_staff) return translateText('Administrator')
    if (user?.is_teacher) return translateText('Teacher')
    return translateText('Staff')
  }

  if (!userRole) return null

  return (
    <div className="flex h-screen w-64 flex-col bg-surface border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          EDUOS
        </h1>
      </div>

      {/* Navigation - Role-Based */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navigation
          .filter(item => item.roles.includes(userRole))
          .map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-text-secondary hover:bg-background hover:text-text-primary'
                }`}
              >
                <Icon className="h-5 w-5" />
                {translateText(item.name)}
              </Link>
            )
          })}
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-4">
        <div className="bg-background rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-background font-bold">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getDisplayName()}</p>
              <p className="text-xs text-text-secondary">{getRoleLabel()}</p>
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

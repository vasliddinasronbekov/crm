'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Menu } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import HandsFreeAIControl from '@/components/HandsFreeAIControl'
import GlobalSearch from '@/components/GlobalSearch'
import DateCalendar from '@/components/DateCalendar'
import AIModeButton from '@/components/AIModeButton'
import InboxNotificationButton from '@/components/InboxNotificationButton'
import BranchSwitcher from '@/components/BranchSwitcher'
import LoadingScreen from '@/components/LoadingScreen'
import { getDashboardRouteAccess, usePermissions } from '@/lib/permissions'

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'dashboard.sidebar.collapsed'

export default function DashboardLayout({
  children,
}: {
  children: unknown
}) {
  const router = useRouter()
  const pathname = usePathname() || '/dashboard'
  const { user, isAuthenticated, isLoading } = useAuth()
  const permissions = usePermissions(user)
  const { currency, language, theme, translateText } = useSettings()
  const [aiModeEnabled, setAiModeEnabled] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const content = children as ReactNode
  const showSidebar = permissions.isStaffSideRole
  const canAccessBranchesPage = permissions.canAccessPage('/dashboard/branches')
  const routeAccess = useMemo(
    () => getDashboardRouteAccess(permissions.role, pathname),
    [pathname, permissions.role],
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
      return
    }

    if (!isLoading && isAuthenticated && !routeAccess.allowed && routeAccess.fallbackPath && routeAccess.fallbackPath !== pathname) {
      router.replace(routeAccess.fallbackPath)
    }
  }, [isAuthenticated, isLoading, pathname, routeAccess.allowed, routeAccess.fallbackPath, router])

  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY)
      if (storedValue !== null) {
        setIsSidebarCollapsed(storedValue === 'true')
      }
    } catch {
      // Ignore storage access failures and keep default state.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(isSidebarCollapsed))
    } catch {
      // Ignore storage write failures.
    }
  }, [isSidebarCollapsed])

  const handleAIModeToggle = (enabled: boolean) => {
    setAiModeEnabled(enabled)
    console.log('AI Mode:', enabled ? 'ENABLED' : 'DISABLED')

    // HANDS-FREE CONTROL MODE
    // When enabled, the full-screen AI control interface appears
    // Features:
    // - Voice-first hands-free control (no typing needed)
    // - Real-time STT → Intent → NER → Action → TTS pipeline
    // - Detailed process visualization (shows each step)
    // - Hybrid search (keyword + semantic with pgvector)
    // - Navigation, data retrieval, and confirmed actions
    // - Conversation context maintained in Redis
  }

  const handleCloseAI = () => {
    setAiModeEnabled(false)
    localStorage.setItem('aiModeEnabled', 'false')
  }

  if (isLoading) {
    return <LoadingScreen message={translateText('Loading...')} />
  }

  if (!isAuthenticated) {
    return null
  }

  if (!routeAccess.allowed) {
    if (routeAccess.fallbackPath && routeAccess.fallbackPath !== pathname) {
      return null
    }

    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">Access denied</p>
          <p className="mt-2 text-sm text-text-secondary">Your role cannot open this dashboard route.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen overflow-hidden" key={`${theme}-${language}-${currency}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-8 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-72 w-72 rounded-full bg-success/15 blur-3xl" />
      </div>
      {showSidebar && (
        <Sidebar
          collapsed={isSidebarCollapsed}
          mobileOpen={isMobileSidebarOpen}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      )}
      {showSidebar && isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label={translateText('Close sidebar')}
        />
      )}
      <div
        className={`flex flex-1 flex-col overflow-hidden transition-[padding-left] duration-300 ${
          showSidebar ? (isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72') : ''
        }`}
      >
        {/* Top Bar with Search, Inbox, AI Mode, and Date Calendar */}
        <div className="glass-panel-strong sticky top-0 z-[60] h-16 border-b border-border/70 shadow-[0_10px_30px_rgba(0,0,0,0.08)] supports-[backdrop-filter]:bg-background/55 flex items-center justify-between px-4 md:px-6 gap-4">
          {/* Left: Global Search */}
          <div className="flex flex-1 items-center gap-3">
            {showSidebar && (
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-background hover:text-text-primary lg:hidden"
                aria-label={translateText('Open sidebar')}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1 max-w-2xl">
              <GlobalSearch />
            </div>
          </div>

          {/* Right: Inbox Button + AI Mode Button + Date Calendar */}
          <div className="flex items-center gap-3">
            {showSidebar && canAccessBranchesPage && (
              <Link
                href="/dashboard/branches"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/70 bg-background/55 px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-background/80 hover:text-text-primary"
                title={translateText('Branches')}
              >
                <Building2 className="h-4 w-4 text-primary" />
                <span className="hidden lg:inline">{translateText('Branches')}</span>
              </Link>
            )}
            <div className="hidden md:block">
              <BranchSwitcher />
            </div>
            <InboxNotificationButton />
            <AIModeButton onToggle={handleAIModeToggle} />
            <div className="hidden sm:block">
              <DateCalendar />
            </div>
          </div>
        </div>

        <main className="relative z-0 flex-1 overflow-y-auto bg-background/60">
          {content}
        </main>
      </div>

      {/* Hands-Free AI Control - Full Screen Voice Interface */}
      <HandsFreeAIControl
        isOpen={aiModeEnabled}
        onClose={handleCloseAI}
      />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import HandsFreeAIControl from '@/components/HandsFreeAIControl'
import GlobalSearch from '@/components/GlobalSearch'
import DateCalendar from '@/components/DateCalendar'
import AIModeButton from '@/components/AIModeButton'
import InboxNotificationButton from '@/components/InboxNotificationButton'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { currency, language, theme, translateText } = useSettings()
  const [aiModeEnabled, setAiModeEnabled] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">{translateText('Loading...')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden" key={`${theme}-${language}-${currency}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Search, Inbox, AI Mode, and Date Calendar */}
        <div className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 gap-4">
          {/* Left: Global Search */}
          <div className="flex-1 max-w-2xl">
            <GlobalSearch />
          </div>

          {/* Right: Inbox Button + AI Mode Button + Date Calendar */}
          <div className="flex items-center gap-3">
            <InboxNotificationButton />
            <AIModeButton onToggle={handleAIModeToggle} />
            <DateCalendar />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-background">
          {children}
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

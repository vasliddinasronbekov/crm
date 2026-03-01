import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { QueryProvider } from '@/contexts/QueryProvider'
import { ToasterProvider } from '@/components/ToasterProvider'
import { AIProvider } from '@/lib/hooks/useAI'
import GlobalLanguageBridge from '@/components/GlobalLanguageBridge'

export const metadata: Metadata = {
  title: 'EDU Admin - Dashboard',
  description: 'Educational Platform Administration',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>
          <SettingsProvider>
            <AuthProvider>
              <AIProvider>
                <GlobalLanguageBridge />
                {children}
                <ToasterProvider />
              </AIProvider>
            </AuthProvider>
          </SettingsProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

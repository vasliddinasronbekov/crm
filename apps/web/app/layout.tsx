import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { QueryProvider } from '@/contexts/QueryProvider'
import { ToasterProvider } from '@/components/ToasterProvider'
import { AIProvider } from '@/lib/hooks/useAI'
import GlobalLanguageBridge from '@/components/GlobalLanguageBridge'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'EDUOS - Dashboard',
  description: 'Educational Platform Administration',
  icons: {
    icon: '/logo2.png',
    shortcut: '/logo2.png',
    apple: '/logo2.png',
  },

}

export default function RootLayout({
  children,
}: {
  children: unknown
}) {
  const content = children as ReactNode

  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>
          <SettingsProvider>
            <AuthProvider>
              <AIProvider>
                <GlobalLanguageBridge />
                {content}
                <ToasterProvider />
              </AIProvider>
            </AuthProvider>
          </SettingsProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  )
}

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Time until data is considered stale (1 minute)
            staleTime: 60 * 1000,
            // Time until inactive queries are garbage collected (5 minutes)
            gcTime: 5 * 60 * 1000,
            // Refetch on window focus for fresh data
            refetchOnWindowFocus: true,
            // Refetch on mount if data is stale
            refetchOnMount: true,
            // Refetch on network reconnection
            refetchOnReconnect: true,
            // Retry failed requests once
            retry: 1,
            // Don't retry on 404s
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools can be added later via browser extension or import when needed */}
    </QueryClientProvider>
  )
}

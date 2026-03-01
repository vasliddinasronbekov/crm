'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useVoiceRouter } from './useVoiceRouter'

type AIHook = ReturnType<typeof useVoiceRouter>

const AIContext = createContext<AIHook | null>(null)

export const AIProvider = ({ children }: { children: ReactNode }) => {
  const ai = useVoiceRouter()
  return <AIContext.Provider value={ai}>{children}</AIContext.Provider>
}

export const useAI = () => {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}

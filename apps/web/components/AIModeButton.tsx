'use client'

import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'

interface AIModeButtonProps {
  onToggle?: (enabled: boolean) => void
}

export default function AIModeButton({ onToggle }: AIModeButtonProps) {
  const [aiModeEnabled, setAiModeEnabled] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Load AI mode state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aiModeEnabled')
    if (saved) {
      setAiModeEnabled(saved === 'true')
    }
  }, [])

  const toggleAIMode = () => {
    setIsAnimating(true)
    const newState = !aiModeEnabled

    setAiModeEnabled(newState)
    localStorage.setItem('aiModeEnabled', String(newState))

    // Trigger callback
    if (onToggle) {
      onToggle(newState)
    }

    // Remove animation after duration
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <button
      onClick={toggleAIMode}
      className={`
        group relative inline-flex h-10 items-center gap-2 px-3 rounded-xl border font-medium
        transition-all duration-300 ease-in-out
        ${aiModeEnabled
          ? 'border-primary/40 bg-gradient-to-r from-blue-500/90 to-purple-600/90 text-white shadow-lg shadow-blue-500/30'
          : 'border-border/70 bg-background/40 text-text-secondary hover:text-text-primary hover:bg-primary/5 hover:border-primary/40'
        }
        ${isAnimating ? 'scale-95' : 'scale-100'}
        hover:scale-105 active:scale-95
      `}
      title={aiModeEnabled ? 'AI Mode: ON' : 'AI Mode: OFF'}
    >
      {/* Icon */}
      <div className={`
        transition-all duration-300
        ${isAnimating ? 'rotate-12' : 'rotate-0'}
        ${!aiModeEnabled ? 'opacity-50' : 'opacity-100'}
      `}>
        <Bot className="w-5 h-5" />
      </div>

      {/* Text */}
      <span className="text-sm font-semibold">
        AI Mode
      </span>

      {/* Status Indicator */}
      {aiModeEnabled && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      )}

      {/* Glow effect when enabled */}
      {aiModeEnabled && (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400 to-purple-600 opacity-0 group-hover:opacity-20 transition-opacity blur-xl"></div>
      )}
    </button>
  )
}

/**
 * Theme Provider
 * Provides theme context and handles system theme changes
 */

import React, { createContext, useContext, useEffect } from 'react'
import { Appearance } from 'react-native'
import { useThemeStore } from '../stores/themeStore'
import { ExtendedTheme, ThemeMode, createTheme } from '../theme'

interface ThemeContextType {
  theme: ExtendedTheme
  isDark: boolean
  mode: ThemeMode
  toggleTheme: () => void
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children?: any }> = ({ children }) => {
  const { mode, theme, setMode, toggleTheme } = useThemeStore()

  useEffect(() => {
    // Listen to system theme changes when mode is 'system'
    if (mode === 'system') {
      const subscription = Appearance.addChangeListener(() => {
        // Trigger re-evaluation of system theme
        setMode('system')
      })

      return () => subscription.remove()
    }

    return undefined
  }, [mode, setMode])

  // Initialize theme on mount to respect system preference
  useEffect(() => {
    setMode(mode)
  }, [])

  // Determine if current theme is dark by checking background color
  const isDark = theme?.background === '#0a0a0a'

  const value: ThemeContextType = {
    theme: theme || createTheme(false), // Fallback to light theme if undefined
    isDark,
    mode,
    toggleTheme,
    setMode,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

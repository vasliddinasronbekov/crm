/**
 * Theme Store - Manages app theme (light/dark/system)
 * Uses Zustand with AsyncStorage persistence
 */

import React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance } from 'react-native'
import { ThemeMode, createTheme, ExtendedTheme } from '../theme'

interface ThemeState {
  mode: ThemeMode
  theme: ExtendedTheme

  // Actions
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  getEffectiveTheme: () => ExtendedTheme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      theme: createTheme(false),

      setMode: (mode: ThemeMode) => {
        const systemColorScheme = Appearance.getColorScheme()
        const effectiveMode = mode === 'system'
          ? (systemColorScheme || 'light')
          : mode

        const isDark = effectiveMode === 'dark'

        set({
          mode,
          theme: createTheme(isDark),
        })
      },

      toggleTheme: () => {
        const { mode } = get()
        let newMode: ThemeMode

        if (mode === 'system') {
          const systemColorScheme = Appearance.getColorScheme()
          newMode = systemColorScheme === 'dark' ? 'light' : 'dark'
        } else {
          newMode = mode === 'light' ? 'dark' : 'light'
        }

        get().setMode(newMode)
      },

      getEffectiveTheme: () => {
        const { mode } = get()
        const systemColorScheme = Appearance.getColorScheme()
        const isDark = mode === 'system'
          ? systemColorScheme === 'dark'
          : mode === 'dark'

        return createTheme(isDark)
      },
    }),
    {
      name: 'eduvoice-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

// Hook to listen to system theme changes
export const useSystemTheme = () => {
  const { mode, setMode } = useThemeStore()

  React.useEffect(() => {
    if (mode === 'system') {
      const subscription = Appearance.addChangeListener(() => {
        setMode('system') // Re-apply system mode to update theme
      })

      return () => subscription.remove()
    }

    return undefined
  }, [mode, setMode])
}

/**
 * Theme Context
 *
 * Manages dark/light theme state and provides theme colors throughout the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  // Background colors
  background: string;
  surface: string;
  card: string;

  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Border colors
  border: string;
  borderLight: string;

  // Other
  shadow: string;
  overlay: string;

  // Status bar
  statusBarStyle: 'light' | 'dark';
}

const lightTheme: Theme = {
  background: '#f5f5f5',
  surface: '#ffffff',
  card: '#ffffff',

  text: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',

  primary: '#3b82f6',
  primaryLight: '#93c5fd',
  primaryDark: '#1e40af',

  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',

  statusBarStyle: 'dark',
};

const darkTheme: Theme = {
  background: '#111827',
  surface: '#1f2937',
  card: '#374151',

  text: '#f9fafb',
  textSecondary: '#d1d5db',
  textTertiary: '#9ca3af',

  primary: '#60a5fa',
  primaryLight: '#93c5fd',
  primaryDark: '#2563eb',

  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',

  border: '#4b5563',
  borderLight: '#374151',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',

  statusBarStyle: 'light',
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Determine actual theme based on mode
  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDark,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

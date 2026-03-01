/**
 * Color system for EduVoice mobile apps
 * Production-ready color palette with light and dark themes
 */

export const palette = {
  // Primary (Brand)
  primary50: '#eff6ff',
  primary100: '#dbeafe',
  primary200: '#bfdbfe',
  primary300: '#93c5fd',
  primary400: '#60a5fa',
  primary500: '#3b82f6',
  primary600: '#2563eb',
  primary700: '#1d4ed8',
  primary800: '#1e40af',
  primary900: '#1e3a8a',

  // Secondary (Success/Green)
  secondary50: '#f0fdf4',
  secondary100: '#dcfce7',
  secondary200: '#bbf7d0',
  secondary300: '#86efac',
  secondary400: '#4ade80',
  secondary500: '#22c55e',
  secondary600: '#16a34a',
  secondary700: '#15803d',
  secondary800: '#166534',
  secondary900: '#14532d',

  // Neutral/Gray
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Semantic colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Special
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const

export const lightTheme = {
  // Backgrounds
  background: palette.gray50,
  surface: palette.white,
  surfaceVariant: palette.gray100,
  surfaceDisabled: palette.gray200,

  // Primary
  primary: palette.primary500,
  primaryContainer: palette.primary100,
  onPrimary: palette.white,
  onPrimaryContainer: palette.primary900,

  // Secondary
  secondary: palette.secondary500,
  secondaryContainer: palette.secondary100,
  onSecondary: palette.white,
  onSecondaryContainer: palette.secondary900,

  // Text
  text: palette.gray900,
  textSecondary: palette.gray600,
  textMuted: palette.gray400,
  textDisabled: palette.gray300,
  onSurface: palette.gray900,

  // Borders & Dividers
  border: palette.gray200,
  borderFocus: palette.primary500,
  divider: palette.gray200,

  // Semantic
  success: palette.success,
  successContainer: palette.secondary100,
  onSuccess: palette.white,

  warning: palette.warning,
  warningContainer: '#fef3c7',
  onWarning: palette.white,

  error: palette.error,
  errorContainer: '#fee2e2',
  onError: palette.white,

  info: palette.info,
  infoContainer: palette.primary100,
  onInfo: palette.white,

  // Shadow
  shadow: palette.black,
} as const

export const darkTheme = {
  // Backgrounds
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceVariant: '#2d2d2d',
  surfaceDisabled: '#3a3a3a',

  // Primary
  primary: palette.primary400,
  primaryContainer: palette.primary900,
  onPrimary: palette.gray900,
  onPrimaryContainer: palette.primary100,

  // Secondary
  secondary: palette.secondary400,
  secondaryContainer: palette.secondary900,
  onSecondary: palette.gray900,
  onSecondaryContainer: palette.secondary100,

  // Text
  text: palette.gray50,
  textSecondary: palette.gray400,
  textMuted: palette.gray600,
  textDisabled: palette.gray700,
  onSurface: palette.gray50,

  // Borders & Dividers
  border: palette.gray800,
  borderFocus: palette.primary400,
  divider: palette.gray800,

  // Semantic
  success: palette.success,
  successContainer: palette.secondary900,
  onSuccess: palette.white,

  warning: palette.warning,
  warningContainer: '#78350f',
  onWarning: palette.white,

  error: palette.error,
  errorContainer: '#7f1d1d',
  onError: palette.white,

  info: palette.info,
  infoContainer: palette.primary900,
  onInfo: palette.white,

  // Shadow
  shadow: palette.black,
} as const

export type Theme = typeof lightTheme
export type ThemeMode = 'light' | 'dark' | 'system'

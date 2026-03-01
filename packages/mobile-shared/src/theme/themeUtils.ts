/**
 * Theme Utilities
 * Converts mobile-shared theme to mobile-ui compatible format
 */

import { lightTheme as lightColors, darkTheme as darkColors, palette } from './colors'
import { typography } from './typography'
import { spacing } from './spacing'
import { shadows } from './shadows'

// Extended theme with both old and new formats for compatibility
export const createTheme = (isDark: boolean) => {
  const colors = isDark ? darkColors : lightColors

  return {
    // New semantic color system
    ...colors,

    // Legacy color system (for backward compatibility with existing screens)
    colors: {
      // Map new theme to old palette-based system
      ...palette,

      // Override with theme-specific colors
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.textSecondary,
      border: colors.border,

      // Keep existing success/warning/error that screens use
      success: colors.success,
      success50: palette.secondary50,
      success100: palette.secondary100,
      success200: palette.secondary200,
      success500: palette.secondary500,
      success700: palette.secondary700,

      warning: colors.warning,
      warning50: '#FFF8E1',
      warning100: '#FFECB3',
      warning200: '#FFE082',
      warning500: '#FFC107',
      warning700: '#FFA000',

      error: colors.error,
      error100: '#FFCDD2',
      error200: '#EF9A9A',
      error500: '#EF4444',
      error700: '#D32F2F',
    },

    typography,
    spacing,
    shadows,

    // Border radius
    borderRadius: {
      xs: 2,
      sm: 4,
      md: 8,
      lg: 12,
      full: 9999,
    },
  }
}

export type ExtendedTheme = ReturnType<typeof createTheme>

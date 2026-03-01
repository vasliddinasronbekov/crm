/**
 * Typography system for EduVoice mobile apps
 * Material Design 3 inspired typography scale
 */

export const typography = {
  // Display styles (largest)
  displayLarge: {
    fontFamily: 'System',
    fontWeight: '700' as const,
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
  },
  displayMedium: {
    fontFamily: 'System',
    fontWeight: '700' as const,
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
  },
  displaySmall: {
    fontFamily: 'System',
    fontWeight: '700' as const,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0,
  },

  // Headlines
  h1: {
    fontFamily: 'System',
    fontWeight: '700' as const,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: 'System',
    fontWeight: '700' as const,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h3: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  },
  h4: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  h5: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
  },
  h6: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },

  // Body text
  body1: {
    fontFamily: 'System',
    fontWeight: '400' as const,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  body2: {
    fontFamily: 'System',
    fontWeight: '400' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },

  // Labels
  labelLarge: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: 'System',
    fontWeight: '500' as const,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
  },

  // Button
  button: {
    fontFamily: 'System',
    fontWeight: '600' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },

  // Caption
  caption: {
    fontFamily: 'System',
    fontWeight: '400' as const,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },

  // Overline
  overline: {
    fontFamily: 'System',
    fontWeight: '500' as const,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
  },

  // Additional font weights (for React Navigation compatibility)
  regular: {
    fontFamily: 'System',
    fontWeight: '400' as const,
  },
  medium: {
    fontFamily: 'System',
    fontWeight: '500' as const,
  },
  bold: {
    fontFamily: 'System',
    fontWeight: '700' as const,
  },
  heavy: {
    fontFamily: 'System',
    fontWeight: '900' as const,
  },
} as const

export type Typography = typeof typography
export type TypographyVariant = keyof typeof typography

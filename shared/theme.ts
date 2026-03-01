/**
 * GitHub Dark Theme for Mobile & Web Apps
 * Consistent design system across all platforms
 */

export const GitHubDarkTheme = {
  // Background colors
  colors: {
    // Backgrounds
    canvas: {
      default: '#0d1117',
      overlay: '#161b22',
      inset: '#010409',
      subtle: '#161b22',
    },

    // Borders
    border: {
      default: '#30363d',
      muted: '#21262d',
      subtle: '#21262d',
    },

    // Text
    fg: {
      default: '#c9d1d9',
      muted: '#8b949e',
      subtle: '#6e7681',
      onEmphasis: '#ffffff',
    },

    // Accent colors
    accent: {
      fg: '#58a6ff',
      emphasis: '#1f6feb',
      muted: 'rgba(56, 139, 253, 0.4)',
      subtle: 'rgba(56, 139, 253, 0.15)',
    },

    // Success
    success: {
      fg: '#3fb950',
      emphasis: '#238636',
      muted: 'rgba(46, 160, 67, 0.4)',
      subtle: 'rgba(46, 160, 67, 0.15)',
    },

    // Danger
    danger: {
      fg: '#f85149',
      emphasis: '#da3633',
      muted: 'rgba(248, 81, 73, 0.4)',
      subtle: 'rgba(248, 81, 73, 0.15)',
    },

    // Warning
    attention: {
      fg: '#d29922',
      emphasis: '#9e6a03',
      muted: 'rgba(187, 128, 9, 0.4)',
      subtle: 'rgba(187, 128, 9, 0.15)',
    },

    // Neutral
    neutral: {
      emphasisPlus: '#6e7681',
      emphasis: '#6e7681',
      muted: 'rgba(110, 118, 129, 0.4)',
      subtle: 'rgba(110, 118, 129, 0.1)',
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border radius
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    full: 9999,
  },

  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      mono: 'Courier New',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
};

// Helper function to get color with opacity
export const withOpacity = (color: string, opacity: number): string => {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
};

// Export for TypeScript
export type Theme = typeof GitHubDarkTheme;

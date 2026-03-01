// Theme Colors - Matching Web App Design
// Web app uses dark theme with cyan/electric blue accent

export const colors = {
  // Background Colors (Dark Theme)
  background: '#0F172A',      // Main background (dark navy) - matches web
  surface: '#1E293B',         // Card/surface background - matches web
  surfaceLight: '#334155',    // Lighter surface for hover states

  // Primary Colors
  primary: '#00D4FF',         // Cyan/Electric Blue - matches web exactly!
  primaryLight: '#33DDFF',    // Lighter cyan for hover
  primaryDark: '#00A8CC',     // Darker cyan
  primaryAlpha10: 'rgba(0, 212, 255, 0.1)',   // 10% opacity
  primaryAlpha20: 'rgba(0, 212, 255, 0.2)',   // 20% opacity

  // Status Colors
  success: '#10B981',         // Green - matches web
  warning: '#F59E0B',         // Orange/Amber - matches web
  error: '#EF4444',          // Red - matches web
  info: '#00D4FF',           // Same as primary

  // Text Colors
  textPrimary: '#FFFFFF',     // White text - matches web
  textSecondary: '#94A3B8',   // Muted gray text - matches web
  textMuted: '#64748B',       // Even more muted - matches web
  textOnPrimary: '#0F172A',   // Dark text on primary background

  // Border Colors
  border: '#334155',          // Border color - matches web
  borderLight: '#475569',     // Lighter border

  // Semantic Colors (for specific uses)
  badge: {
    default: '#334155',
    primary: 'rgba(0, 212, 255, 0.1)',
    success: 'rgba(16, 185, 129, 0.1)',
    warning: 'rgba(245, 158, 11, 0.1)',
    error: 'rgba(239, 68, 68, 0.1)',
  },

  // Old colors for backward compatibility (will be phased out)
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#059669',  // Old primary - now replaced by cyan
    700: '#047857',
  },

  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#475569',
    700: '#374151',
    800: '#1F2937',
    900: '#0F172A',  // Now same as background
  },

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
}

export default colors

// packages/mobile-ui/src/theme.ts

import { DefaultTheme } from '@react-navigation/native';

export const Colors = {
  // Primary (Red for Student App)
  primary50: '#ffebee',
  primary100: '#ffcdd2',
  primary200: '#ef9a9a',
  primary300: '#e57373',
  primary400: '#ef5350',
  primary500: '#f44336', // Main Red
  primary600: '#e53935',
  primary700: '#d32f2f',
  primary800: '#c62828',
  primary900: '#b71c1c',

  // Accent (e.g., for interactive elements, secondary actions)
  accent500: '#4CAF50', // Green
  secondary500: '#4CAF50',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Feedback - Success (Green)
  success: '#4CAF50',
  success50: '#E8F5E9',
  success100: '#C8E6C9',
  success200: '#A5D6A7',
  success500: '#4CAF50',
  success700: '#388E3C',

  // Feedback - Warning (Amber/Yellow)
  warning: '#FFC107',
  warning50: '#FFF8E1',
  warning100: '#FFECB3',
  warning200: '#FFE082',
  warning500: '#FFC107',
  warning700: '#FFA000',

  // Feedback - Error (Red)
  error: '#F44336',
  error50: '#FFEBEE',
  error100: '#FFCDD2',
  error200: '#EF9A9A',
  error500: '#F44336',
  error700: '#D32F2F',

  // Feedback - Info (Blue)
  info: '#2196F3',
  info500: '#2196F3',
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: Colors.gray900,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.gray900,
  },
  h3: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.gray900,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.gray900,
  },
  body: {
    fontSize: 16,
    color: Colors.gray700,
  },
  body1: {
    fontSize: 16,
    color: Colors.gray700,
  },
  body2: {
    fontSize: 14,
    color: Colors.gray600,
  },
  small: {
    fontSize: 14,
    color: Colors.gray600,
  },
  caption: {
    fontSize: 12,
    color: Colors.gray500,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  round: 999,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

// Custom theme for React Navigation
export const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary500, // Primary color for navigation headers, etc.
    background: Colors.gray50, // Default background for screens
    card: Colors.white, // Background for cards, modals
    text: Colors.gray900,
    border: Colors.gray300,
    notification: Colors.accent500,
  },
};

export type Theme = {
  colors: typeof Colors;
  typography: typeof Typography;
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
  shadows: typeof Shadows;
  navigationTheme: typeof NavigationTheme;
};

export const theme: Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  navigationTheme: NavigationTheme,
};

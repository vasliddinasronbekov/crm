// packages/mobile-ui/src/green-theme.ts

import { DefaultTheme } from '@react-navigation/native';
import { Colors as BaseColors, Typography, Spacing, BorderRadius, Shadows } from './theme';

export const GreenColors = {
  ...BaseColors,
  // Primary (Green for Staff App)
  primary50: '#e8f5e9',
  primary100: '#c8e6c9',
  primary200: '#a5d6a7',
  primary300: '#81c784',
  primary400: '#66bb6a',
  primary500: '#4caf50', // Main Green
  primary600: '#43a047',
  primary700: '#388e3c',
  primary800: '#2e7d32',
  primary900: '#1b5e20',
};

// Custom theme for React Navigation
export const GreenNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: GreenColors.primary500,
    background: GreenColors.gray50,
    card: GreenColors.white,
    text: GreenColors.gray900,
    border: GreenColors.gray300,
    notification: GreenColors.accent500,
  },
};

export const greenTheme = {
  colors: GreenColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  navigationTheme: GreenNavigationTheme,
};

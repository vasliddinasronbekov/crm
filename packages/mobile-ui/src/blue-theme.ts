// packages/mobile-ui/src/blue-theme.ts

import { DefaultTheme } from '@react-navigation/native';
import { Colors as BaseColors, Typography, Spacing, BorderRadius, Shadows } from './theme';

export const BlueColors = {
  ...BaseColors,
  // Primary (Blue for Parent App)
  primary50: '#e3f2fd',
  primary100: '#bbdefb',
  primary200: '#90caf9',
  primary300: '#64b5f6',
  primary400: '#42a5f5',
  primary500: '#2196f3', // Main Blue
  primary600: '#1e88e5',
  primary700: '#1976d2',
  primary800: '#1565c0',
  primary900: '#0d47a1',
};

// Custom theme for React Navigation
export const BlueNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BlueColors.primary500,
    background: BlueColors.gray50,
    card: BlueColors.white,
    text: BlueColors.gray900,
    border: BlueColors.gray300,
    notification: BlueColors.accent500,
  },
};

export const blueTheme = {
  colors: BlueColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  navigationTheme: BlueNavigationTheme,
};

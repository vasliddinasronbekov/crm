/**
 * Button Component - Production-ready button with variants
 */

import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native'
import { useThemeStore } from '../../stores'
import { typography, spacing } from '../../theme'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'small' | 'medium' | 'large'

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  style?: ViewStyle
  textStyle?: TextStyle
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  onPress,
  ...props
}) => {
  const { theme } = useThemeStore()

  const isDisabled = disabled || loading

  // Get button styles based on variant
  const getButtonStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: variant === 'outline' ? 1 : 0,
    }

    // Size styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        minHeight: 32,
      },
      medium: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        minHeight: 44,
      },
      large: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minHeight: 52,
      },
    }

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: isDisabled ? theme.surfaceDisabled : theme.primary,
        borderColor: 'transparent',
      },
      secondary: {
        backgroundColor: isDisabled ? theme.surfaceDisabled : theme.secondary,
        borderColor: 'transparent',
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: isDisabled ? theme.borderFocus : theme.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
      danger: {
        backgroundColor: isDisabled ? theme.surfaceDisabled : theme.error,
        borderColor: 'transparent',
      },
    }

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...(isDisabled && { opacity: 0.5 }),
    }
  }

  // Get text styles based on variant
  const getTextStyles = (): TextStyle => {
    const baseTextStyles: TextStyle = {
      ...typography.button,
      fontWeight: '600',
    }

    // Size text styles
    const sizeTextStyles: Record<ButtonSize, TextStyle> = {
      small: { fontSize: 12 },
      medium: { fontSize: 14 },
      large: { fontSize: 16 },
    }

    // Variant text colors
    const variantTextColors: Record<ButtonVariant, string> = {
      primary: theme.onPrimary,
      secondary: theme.onSecondary,
      outline: theme.primary,
      ghost: theme.primary,
      danger: theme.onError,
    }

    return {
      ...baseTextStyles,
      ...sizeTextStyles[size],
      color: variantTextColors[variant],
    }
  }

  return (
    <TouchableOpacity
      style={[getButtonStyles(), style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={variant === 'outline' || variant === 'ghost' ? theme.primary : theme.onPrimary}
        />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text style={[getTextStyles(), textStyle, !!leftIcon && { marginLeft: spacing.xs }]}>
            {children}
          </Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  )
}

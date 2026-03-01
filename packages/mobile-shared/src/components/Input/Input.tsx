/**
 * Input Component - Production-ready text input with validation
 */

import React, { useState } from 'react'
import {
  View,
  TextInput,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
} from 'react-native'
import { useThemeStore } from '../../stores'
import { typography, spacing } from '../../theme'

export interface InputProps extends TextInputProps {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconPress?: () => void
  containerStyle?: ViewStyle
  inputStyle?: TextStyle
  disabled?: boolean
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  disabled = false,
  ...props
}) => {
  const { theme } = useThemeStore()
  const [isFocused, setIsFocused] = useState(false)

  const hasError = !!error

  const containerStyles: ViewStyle = {
    marginBottom: spacing.md,
  }

  const labelStyles: TextStyle = {
    ...typography.labelMedium,
    color: theme.text,
    marginBottom: spacing.xs,
  }

  const inputContainerStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: hasError
      ? theme.error
      : isFocused
      ? theme.borderFocus
      : theme.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  }

  const inputStyles: TextStyle = {
    ...typography.body1,
    flex: 1,
    color: theme.text,
    paddingVertical: spacing.sm,
  }

  const helperTextStyles: TextStyle = {
    ...typography.caption,
    color: hasError ? theme.error : theme.textSecondary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  }

  return (
    <View style={[containerStyles, containerStyle]}>
      {label && <Text style={labelStyles}>{label}</Text>}

      <View style={[inputContainerStyles, disabled && { opacity: 0.5 }]}>
        {leftIcon && <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>}

        <TextInput
          style={[inputStyles, inputStyle]}
          placeholderTextColor={theme.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          {...props}
        />

        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={{ marginLeft: spacing.sm }}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {(error || helperText) && (
        <Text style={helperTextStyles}>{error || helperText}</Text>
      )}
    </View>
  )
}

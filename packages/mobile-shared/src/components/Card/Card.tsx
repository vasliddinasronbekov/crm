/**
 * Card Component - Production-ready card container
 */

import React from 'react'
import { View, ViewStyle, ViewProps } from 'react-native'
import { useThemeStore } from '../../stores'
import { spacing, shadows, ShadowKey } from '../../theme'

export interface CardProps extends ViewProps {
  children: React.ReactNode
  elevation?: ShadowKey
  padding?: keyof typeof spacing
  style?: ViewStyle
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'md',
  padding = 'md',
  style,
  ...props
}) => {
  const { theme } = useThemeStore()

  const cardStyles: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: spacing[padding],
    ...shadows[elevation],
  }

  return (
    <View style={[cardStyles, style]} {...props}>
      {children}
    </View>
  )
}

import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'elevated' | 'bordered'
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const cardStyles = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    variant === 'bordered' && styles.bordered,
    style,
  ]

  return <View style={cardStyles}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bordered: {
    borderWidth: 1,
    borderColor: '#334155',
  },
})

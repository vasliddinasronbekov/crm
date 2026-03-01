// packages/mobile-ui/src/components/WidgetCard.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

interface WidgetCardProps extends TouchableOpacityProps {
  title: string;
  iconName: string;
  color?: string;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  iconName,
  color = theme.colors.primary500,
  ...props
}) => {
  return (
    <TouchableOpacity style={styles.container} {...props}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={iconName as any} size={32} color={theme.colors.white} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%', // Two cards per row
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  iconContainer: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.round,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.body,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

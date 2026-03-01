import React, { useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from './GlassCard';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface FeatureCardProps {
  title: string;
  description: string;
  icon: IconName;
  accentColor: string;
  badge?: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  accentColor,
  badge,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassCard onPress={onPress} style={[styles.card, style, { borderColor: `${accentColor}30` }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
          <MaterialCommunityIcons name={icon} size={22} color={accentColor} />
        </View>
        {badge ? <Text style={[styles.badge, { color: accentColor }]}>{badge}</Text> : null}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.footer}>
        <Text style={[styles.openLabel, { color: accentColor }]}>Open</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color={accentColor} />
      </View>
    </GlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      padding: theme.spacing.md,
      borderWidth: 1,
      minHeight: 156,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      fontSize: 12,
      fontWeight: '700',
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
      marginTop: theme.spacing.md,
    },
    description: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: theme.spacing.sm,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: theme.spacing.md,
    },
    openLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
  });

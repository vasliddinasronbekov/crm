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
    <GlassCard onPress={onPress} style={[styles.card, style, { borderColor: `${accentColor}40` }]}>
      <View style={[styles.accentBar, { backgroundColor: `${accentColor}26` }]} />
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
          <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
        </View>
        {typeof badge === 'string' && badge.length > 0 ? (
          <View style={[styles.badgeWrap, { backgroundColor: `${accentColor}1c` }]}>
            <Text style={[styles.badge, { color: accentColor }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.footer}>
        <Text style={[styles.openLabel, { color: accentColor }]}>Open</Text>
        <View style={[styles.arrowWrap, { backgroundColor: `${accentColor}1a` }]}>
          <MaterialCommunityIcons name="arrow-right" size={16} color={accentColor} />
        </View>
      </View>
    </GlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      padding: theme.spacing.md,
      borderWidth: 1,
      minHeight: 166,
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    accentBar: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 42,
      height: 6,
      borderRadius: 999,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${theme.border}99`,
    },
    badgeWrap: {
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      alignItems: 'center',
    },
    badge: {
      fontSize: 12,
      fontWeight: '700',
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 2,
    },
    description: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
    },
    openLabel: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    arrowWrap: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

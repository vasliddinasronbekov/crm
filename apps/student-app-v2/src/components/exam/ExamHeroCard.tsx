import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../app/GlassCard';

interface HeroMetric {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}

interface ExamHeroCardProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  accentColor: string;
  progress?: number;
  metrics?: HeroMetric[];
}

export const ExamHeroCard: React.FC<ExamHeroCardProps> = ({
  eyebrow,
  title,
  subtitle,
  accentColor,
  progress = 0,
  metrics = [],
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark, accentColor), [theme, isDark, accentColor]);
  const progressWidth = `${Math.max(0, Math.min(100, progress))}%` as DimensionValue;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.eyebrowChip}>
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {metrics.length > 0 && (
        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <View key={`${metric.label}-${metric.value}`} style={styles.metricChip}>
              <MaterialCommunityIcons name={metric.icon} size={15} color={accentColor} />
              <View style={styles.metricTextWrap}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </GlassCard>
  );
};

const createStyles = (theme: any, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    card: {
      padding: 18,
      borderRadius: 28,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    eyebrowChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: `${accentColor}20`,
      borderWidth: 1,
      borderColor: `${accentColor}44`,
    },
    eyebrowText: {
      ...theme.typography.caption,
      color: accentColor,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    title: {
      ...theme.typography.h2,
      color: theme.text,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricChip: {
      minWidth: '31%',
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
    },
    metricTextWrap: {
      flexShrink: 1,
    },
    metricLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricValue: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: accentColor,
    },
  });

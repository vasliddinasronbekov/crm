import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../app/GlassCard';

interface QuestionPaletteProps {
  total: number;
  currentIndex: number;
  answeredIndexes: number[];
  accentColor: string;
  onSelect: (index: number) => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  total,
  currentIndex,
  answeredIndexes,
  accentColor,
  onSelect,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark, accentColor), [theme, isDark, accentColor]);
  const answered = new Set(answeredIndexes);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Question palette</Text>
        <Text style={styles.caption}>{answered.size}/{total} answered</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {Array.from({ length: total }, (_, index) => {
          const active = index === currentIndex;
          const done = answered.has(index);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.item, active && styles.itemActive, done && !active && styles.itemDone]}
              onPress={() => onSelect(index)}
              activeOpacity={0.85}
            >
              <Text style={[styles.itemText, active && styles.itemTextActive]}>{index + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </GlassCard>
  );
};

const createStyles = (theme: any, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    card: {
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 24,
      gap: 10,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...theme.typography.h4,
      color: theme.text,
    },
    caption: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    row: {
      gap: 8,
      paddingRight: 6,
    },
    item: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.82)',
    },
    itemActive: {
      backgroundColor: accentColor,
      borderColor: accentColor,
    },
    itemDone: {
      borderColor: `${accentColor}66`,
    },
    itemText: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
    },
    itemTextActive: {
      color: '#ffffff',
    },
  });

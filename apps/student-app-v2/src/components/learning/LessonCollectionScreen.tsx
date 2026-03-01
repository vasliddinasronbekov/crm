import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../app/GlassCard';
import type { AppStackParamList } from '../../navigation/types';
import type { Lesson } from '../../types';
import {
  fetchLessonCollection,
  formatDuration,
  getLessonCompletion,
  getLessonDurationSeconds,
  getLessonModuleTitle,
  stripHtml,
  type LessonCollectionKind,
} from '../../lib/lms';

type ContentFilter = 'all' | 'in-progress' | 'completed' | 'not-started';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface LessonCollectionScreenProps {
  kind: LessonCollectionKind;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor: string;
}

export const LessonCollectionScreen: React.FC<LessonCollectionScreenProps> = ({
  kind,
  title,
  subtitle,
  icon,
  accentColor,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark, accentColor), [theme, isDark, accentColor]);
  const [filter, setFilter] = useState<ContentFilter>('all');

  const query = useQuery({
    queryKey: ['lesson-collection', kind],
    queryFn: () => fetchLessonCollection(kind),
  });

  const lessons = query.data || [];
  const filteredLessons = lessons.filter((lesson) => {
    const completion = getLessonCompletion(lesson);

    switch (filter) {
      case 'completed':
        return completion >= 100;
      case 'in-progress':
        return completion > 0 && completion < 100;
      case 'not-started':
        return completion === 0;
      default:
        return true;
    }
  });

  const renderCard = ({ item }: { item: Lesson }) => {
    const completion = getLessonCompletion(item);
    const preview = stripHtml(item.content || item.description).slice(0, 110);
    const secondaryMeta =
      kind === 'video'
        ? formatDuration(getLessonDurationSeconds(item))
        : kind === 'book'
        ? `${item.total_pages || 0} pages`
        : item.is_free_preview
        ? 'Free preview'
        : 'Reading lesson';

    return (
      <GlassCard
        style={styles.card}
        onPress={() => navigation.navigate('LessonViewer', { lessonId: item.id, initialType: kind })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={icon} size={24} color={accentColor} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardModule} numberOfLines={1}>
              {getLessonModuleTitle(item)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
        </View>

        <Text style={styles.cardPreview} numberOfLines={2}>
          {preview || 'Open this lesson to continue learning.'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{secondaryMeta}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons
              name={completion >= 100 ? 'check-circle' : completion > 0 ? 'progress-clock' : 'play-circle-outline'}
              size={14}
              color={completion >= 100 ? theme.colors.success500 : accentColor}
            />
            <Text style={styles.metaText}>{completion}%</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completion}%` as const }]} />
        </View>
      </GlassCard>
    );
  };

  if (query.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={styles.stateText}>Loading {title.toLowerCase()}...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={filteredLessons}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderCard}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
          tintColor={accentColor}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name={icon} size={28} color={accentColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{lessons.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{lessons.filter((lesson) => getLessonCompletion(lesson) > 0 && getLessonCompletion(lesson) < 100).length}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{lessons.filter((lesson) => getLessonCompletion(lesson) >= 100).length}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </GlassCard>
          </View>
          <View style={styles.filterRow}>
            {(['all', 'in-progress', 'completed', 'not-started'] as ContentFilter[]).map((item) => {
              const active = item === filter;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(item)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {item.replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.stateContainer}>
          <MaterialCommunityIcons name={icon} size={56} color={theme.textMuted} />
          <Text style={styles.stateTitle}>Nothing here yet</Text>
          <Text style={styles.stateText}>Try another filter or come back after new lessons are published.</Text>
        </View>
      }
    />
  );
};

const createStyles = (theme: any, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
      gap: 14,
    },
    header: {
      gap: 14,
      marginBottom: 8,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
    },
    title: {
      ...theme.typography.h1,
      color: theme.text,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      padding: 14,
      borderRadius: 18,
    },
    statValue: {
      ...theme.typography.h3,
      color: theme.text,
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.86)',
    },
    filterChipActive: {
      backgroundColor: accentColor,
      borderColor: accentColor,
    },
    filterChipText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    filterChipTextActive: {
      color: '#ffffff',
    },
    card: {
      padding: 16,
      borderRadius: 24,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.54)',
    },
    cardBody: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    cardModule: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    cardPreview: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 21,
      marginTop: 14,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
    },
    metaText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      marginTop: 14,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: accentColor,
    },
    stateContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
      gap: 10,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    stateText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

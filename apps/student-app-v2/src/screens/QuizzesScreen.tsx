import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import {
  listRuntimeQuizzes,
  type RuntimeQuizSummary,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type QuizFilter = 'all' | 'practice' | 'graded' | 'exam' | 'survey';

export const QuizzesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [filter, setFilter] = useState<QuizFilter>('all');

  const quizzesQuery = useQuery({
    queryKey: ['runtime-quizzes', filter],
    queryFn: () => listRuntimeQuizzes(filter),
  });

  const filters: { key: QuizFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
    { key: 'all', label: 'All', icon: 'view-grid-outline', color: theme.colors.primary500 },
    { key: 'practice', label: 'Practice', icon: 'pencil-outline', color: '#2563eb' },
    { key: 'graded', label: 'Graded', icon: 'check-decagram-outline', color: '#d97706' },
    { key: 'exam', label: 'Exam', icon: 'file-document-outline', color: '#dc2626' },
    { key: 'survey', label: 'Survey', icon: 'clipboard-list-outline', color: '#0f766e' },
  ];

  const quizzes = quizzesQuery.data || [];
  const stats = {
    total: quizzes.length,
    available: quizzes.filter((quiz) => quiz.maxAttempts === 0 || quiz.userAttemptsCount < quiz.maxAttempts).length,
    passed: quizzes.filter((quiz) => quiz.bestAttempt?.passed).length,
  };

  if (quizzesQuery.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading quizzes...</Text>
      </View>
    );
  }

  if (quizzesQuery.isError) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Quiz feed unavailable</Text>
        <Text style={styles.stateText}>The quiz list could not be loaded right now.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => quizzesQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={quizzesQuery.isRefetching}
          onRefresh={() => {
            void quizzesQuery.refetch();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="text-box-check-outline" size={28} color="#7c3aed" />
        </View>
        <Text style={styles.heroTitle}>Quiz Center</Text>
        <Text style={styles.heroSubtitle}>
          Practice, graded, and exam-style quizzes with attempt tracking and review.
        </Text>
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.available}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.passed}</Text>
            <Text style={styles.statLabel}>Passed</Text>
          </GlassCard>
        </View>
      </GlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterChip,
                active && { backgroundColor: item.color, borderColor: item.color },
              ]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={18}
                color={active ? theme.colors.white : item.color}
              />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {quizzes.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="clipboard-search-outline" size={52} color={theme.textMuted} />
          <Text style={styles.stateTitle}>No quizzes found</Text>
          <Text style={styles.stateText}>Try another filter or come back after quizzes are published.</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onPress={() => navigation.navigate('QuizPlayer', { quizId: quiz.id })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const QuizCard = ({
  quiz,
  onPress,
}: {
  quiz: RuntimeQuizSummary;
  onPress: () => void;
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const accentColor =
    quiz.quizType === 'graded'
      ? '#d97706'
      : quiz.quizType === 'exam'
      ? '#dc2626'
      : quiz.quizType === 'survey'
      ? '#0f766e'
      : '#2563eb';

  const maxAttemptsReached = quiz.maxAttempts > 0 && quiz.userAttemptsCount >= quiz.maxAttempts;

  return (
    <GlassCard style={styles.quizCard} onPress={maxAttemptsReached ? undefined : onPress}>
      <View style={styles.quizHeader}>
        <View style={[styles.quizIcon, { backgroundColor: `${accentColor}18` }]}>
          <MaterialCommunityIcons
            name={quiz.quizType === 'exam' ? 'file-document-outline' : 'text-box-check-outline'}
            size={22}
            color={accentColor}
          />
        </View>
        <View style={styles.quizHeaderCopy}>
          <Text style={styles.quizTitle}>{quiz.title}</Text>
          <Text style={styles.quizMeta}>
            {quiz.questionCount} questions • {quiz.totalPoints} pts
          </Text>
        </View>
        <View style={[styles.quizTypeBadge, { backgroundColor: `${accentColor}18` }]}>
          <Text style={[styles.quizTypeText, { color: accentColor }]}>{quiz.quizType}</Text>
        </View>
      </View>

      {quiz.description ? <Text style={styles.quizDescription}>{quiz.description}</Text> : null}

      <View style={styles.quizMetaRow}>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="history" size={14} color={theme.textSecondary} />
          <Text style={styles.metaChipText}>
            {quiz.userAttemptsCount}/{quiz.maxAttempts || '∞'} attempts
          </Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.metaChipText}>
            {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : 'Open time'}
          </Text>
        </View>
      </View>

      {quiz.bestAttempt ? (
        <View style={styles.bestAttemptRow}>
          <Text style={styles.bestAttemptText}>
            Best: {quiz.bestAttempt.percentageScore.toFixed(0)}% • {quiz.bestAttempt.passed ? 'Passed' : 'Not yet passed'}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.startButton, maxAttemptsReached && styles.startButtonDisabled]}
        onPress={onPress}
        disabled={maxAttemptsReached}
      >
        <Text style={styles.startButtonText}>{maxAttemptsReached ? 'Attempts used' : 'Start quiz'}</Text>
        <MaterialCommunityIcons
          name={maxAttemptsReached ? 'lock-outline' : 'arrow-right'}
          size={18}
          color={theme.colors.white}
        />
      </TouchableOpacity>
    </GlassCard>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: 20,
      gap: 14,
      paddingBottom: 40,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: 24,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 12,
    },
    stateText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 14,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.primary500,
    },
    retryText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
    heroCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)',
    },
    heroTitle: {
      ...theme.typography.h1,
      color: theme.text,
    },
    heroSubtitle: {
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
    },
    filterRow: {
      gap: 10,
      paddingRight: 4,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.76)',
    },
    filterText: {
      ...theme.typography.button,
      color: theme.text,
    },
    filterTextActive: {
      color: '#ffffff',
    },
    list: {
      gap: 14,
    },
    emptyCard: {
      padding: 24,
      borderRadius: 28,
      alignItems: 'center',
      gap: 8,
    },
    quizCard: {
      padding: 18,
      borderRadius: 24,
      gap: 14,
    },
    quizHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    quizIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quizHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    quizTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    quizMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    quizTypeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    quizTypeText: {
      ...theme.typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    quizDescription: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    quizMetaRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.64)',
    },
    metaChipText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    bestAttemptRow: {
      paddingHorizontal: 2,
    },
    bestAttemptText: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '600',
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    startButtonDisabled: {
      backgroundColor: theme.textMuted,
    },
    startButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
  });

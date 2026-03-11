/* eslint-disable react-native/no-unused-styles */
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
import type { ExtendedTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import {
  getRuntimeQuizInsights,
  listRuntimeQuizzes,
  type RuntimeQuizInsights,
  type RuntimeQuizSummary,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type QuizFilter = 'all' | 'practice' | 'graded' | 'exam' | 'survey';

const quizTypeColor = (
  type: RuntimeQuizSummary['quizType'],
  primaryColor: string,
) => {
  const quizTypeColors: Partial<Record<RuntimeQuizSummary['quizType'], string>> = {
    practice: '#2563eb',
    graded: '#d97706',
    exam: '#dc2626',
    survey: '#0f766e',
  };

  return quizTypeColors[type] ?? primaryColor;
};

const safeNumber = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
};

export const QuizzesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [filter, setFilter] = useState<QuizFilter>('all');

  const quizzesQuery = useQuery<RuntimeQuizSummary[]>({
    queryKey: ['runtime-quizzes', filter],
    queryFn: async () => listRuntimeQuizzes(filter),
  });

  const insightsQuery = useQuery<RuntimeQuizInsights>({
    queryKey: ['runtime-quiz-insights'],
    queryFn: async () => getRuntimeQuizInsights(),
  });

  const filters: {
    key: QuizFilter;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
  }[] = [
    { key: 'all', label: 'All', icon: 'view-grid-outline', color: theme.colors.primary500 },
    { key: 'practice', label: 'Practice', icon: 'pencil-outline', color: '#2563eb' },
    { key: 'graded', label: 'Graded', icon: 'check-decagram-outline', color: '#d97706' },
    { key: 'exam', label: 'Exam', icon: 'file-document-outline', color: '#dc2626' },
    { key: 'survey', label: 'Survey', icon: 'clipboard-list-outline', color: '#0f766e' },
  ];

  const quizzes = quizzesQuery.data ?? [];
  const insights: RuntimeQuizInsights | undefined = insightsQuery.data;
  const stats = {
    total: quizzes.length,
    available: quizzes.filter((quiz) => quiz.maxAttempts === 0 || quiz.userAttemptsCount < quiz.maxAttempts).length,
    passed: insights?.passedAttempts ?? quizzes.filter((quiz) => quiz.bestAttempt?.passed).length,
    averageScore: insights?.averageScore ?? 0,
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
        <GlassCard style={styles.stateCard}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={56}
            color={theme.colors.error500}
          />
          <Text style={styles.stateTitle}>Quiz feed unavailable</Text>
          <Text style={styles.stateText}>The quiz list could not be loaded right now.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void quizzesQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </GlassCard>
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
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name="text-box-check-outline"
              size={16}
              color={theme.colors.primary500}
            />
            <Text style={styles.heroBadgeText}>Quiz Center</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Quiz Workspace</Text>
        <Text style={styles.heroSubtitle}>
          Practice, graded, and exam-style quizzes with attempt review in one place.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.total}</Text>
            <Text style={styles.heroStatLabel}>Total</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.available}</Text>
            <Text style={styles.heroStatLabel}>Available</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.passed}</Text>
            <Text style={styles.heroStatLabel}>Passed</Text>
          </View>
        </View>

        <View style={styles.heroInsightsRow}>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>Avg Score</Text>
            <Text style={styles.heroInsightValue}>{safeNumber(stats.averageScore).toFixed(1)}%</Text>
          </View>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>Pass Rate</Text>
            <Text style={styles.heroInsightValue}>{safeNumber(insights?.passRate).toFixed(1)}%</Text>
          </View>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>Weak Subject</Text>
            <Text style={styles.heroInsightValue}>
              {insights?.weakSubject?.subject !== undefined
                ? insights.weakSubject.subject.toUpperCase()
                : '—'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {insightsQuery.isLoading ? (
        <GlassCard style={styles.insightsLoadingCard}>
          <ActivityIndicator size="small" color={theme.colors.primary500} />
          <Text style={styles.insightsLoadingText}>Preparing personalized quiz insights...</Text>
        </GlassCard>
      ) : insights !== undefined && insights.recentAttempts.length > 0 ? (
        <GlassCard style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsTitle}>Recent Attempts</Text>
            <Text style={styles.insightsCaption}>Open review directly from your latest runs.</Text>
          </View>
          <View style={styles.insightsList}>
            {insights.recentAttempts.slice(0, 3).map((attempt) => (
              <TouchableOpacity
                key={attempt.attemptId}
                style={styles.insightItem}
                onPress={() => navigation.navigate('QuizAttemptReview', { attemptId: attempt.attemptId })}
                activeOpacity={0.88}
              >
                <View style={styles.insightItemMain}>
                  <Text style={styles.insightQuizTitle} numberOfLines={1}>
                    {attempt.quizTitle}
                  </Text>
                  <Text style={styles.insightMeta} numberOfLines={1}>
                    {attempt.subject.toUpperCase()} • {attempt.difficultyLevel.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.insightScoreWrap}>
                  <Text
                    style={[
                      styles.insightScore,
                      attempt.passed ? styles.insightScorePassed : styles.insightScoreFailed,
                    ]}
                  >
                    {attempt.score.toFixed(0)}%
                  </Text>
                  <Text style={styles.insightStatus}>{attempt.passed ? 'Passed' : 'Retry'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterChip,
                active ? { backgroundColor: item.color, borderColor: item.color } : null,
              ]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={18}
                color={active ? '#ffffff' : item.color}
              />
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {quizzes.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="clipboard-search-outline"
            size={52}
            color={theme.textMuted}
          />
          <Text style={styles.stateTitle}>No quizzes found</Text>
          <Text style={styles.stateText}>Try another filter or come back after quizzes are published.</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {quizzes.map((quiz) => {
            const bestAttemptId = quiz.bestAttempt?.id;
            return (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onPress={() => navigation.navigate('QuizPlayer', { quizId: quiz.id })}
                onOpenReview={
                  bestAttemptId !== undefined
                    ? () => navigation.navigate('QuizAttemptReview', { attemptId: bestAttemptId })
                    : undefined
                }
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const QuizCard = ({
  quiz,
  onPress,
  onOpenReview,
}: {
  quiz: RuntimeQuizSummary;
  onPress: () => void;
  onOpenReview?: () => void;
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const accentColor = quizTypeColor(quiz.quizType, theme.colors.primary500);
  const maxAttemptsReached = quiz.maxAttempts > 0 && quiz.userAttemptsCount >= quiz.maxAttempts;

  return (
    <GlassCard style={styles.quizCard} onPress={maxAttemptsReached ? undefined : onPress}>
      <View style={styles.quizHeader}>
        <View style={[styles.quizIcon, { backgroundColor: `${accentColor}1a` }]}>
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

      {typeof quiz.description === 'string' && quiz.description.length > 0 ? (
        <Text style={styles.quizDescription}>{quiz.description}</Text>
      ) : null}

      <View style={styles.quizMetaRow}>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.metaChipText}>{quiz.subjectDisplay}</Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="stairs" size={14} color={theme.textSecondary} />
          <Text style={styles.metaChipText}>{quiz.difficultyLevelDisplay}</Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="history" size={14} color={theme.textSecondary} />
          <Text style={styles.metaChipText}>
            {quiz.userAttemptsCount}/{quiz.maxAttempts > 0 ? quiz.maxAttempts : '∞'} attempts
          </Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.metaChipText}>
            {quiz.timeLimitMinutes !== undefined ? `${quiz.timeLimitMinutes} min` : 'Open time'}
          </Text>
        </View>
      </View>

      {quiz.bestAttempt !== undefined ? (
        <View style={styles.bestAttemptRow}>
          <Text style={styles.bestAttemptText}>
            Best: {quiz.bestAttempt.percentageScore.toFixed(0)}% •{' '}
            {quiz.bestAttempt.passed ? 'Passed' : 'Not yet passed'}
          </Text>
          {quiz.bestAttempt.submittedAt !== undefined ? (
            <Text style={styles.bestAttemptDate}>
              Last attempt: {new Date(quiz.bestAttempt.submittedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.startButton, maxAttemptsReached ? styles.startButtonDisabled : null]}
        onPress={onPress}
        disabled={maxAttemptsReached}
      >
        <Text style={styles.startButtonText}>
          {maxAttemptsReached ? 'Attempts used' : 'Start quiz'}
        </Text>
        <MaterialCommunityIcons
          name={maxAttemptsReached ? 'lock-outline' : 'arrow-right'}
          size={18}
          color="#ffffff"
        />
      </TouchableOpacity>

      {onOpenReview !== undefined ? (
        <TouchableOpacity style={styles.reviewButton} onPress={onOpenReview}>
          <MaterialCommunityIcons
            name="clipboard-text-search-outline"
            size={17}
            color={theme.text}
          />
          <Text style={styles.reviewButtonText}>Review best attempt</Text>
        </TouchableOpacity>
      ) : null}
    </GlassCard>
  );
};

const createStyles = (theme: ExtendedTheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxxl,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: theme.spacing.lg,
    },
    stateCard: {
      width: '100%',
      padding: theme.spacing.lg,
      borderRadius: 24,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 8,
    },
    stateText: {
      ...theme.typography.body2,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.primary500,
    },
    retryText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    heroCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(233,213,255,0.66)',
    },
    heroBadgeText: {
      color: '#7c3aed',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    heroTitle: {
      ...theme.typography.h1,
      color: theme.text,
    },
    heroSubtitle: {
      ...theme.typography.body2,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroStat: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(248,250,252,0.9)',
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    heroStatValue: {
      ...theme.typography.h4,
      color: theme.text,
      fontWeight: '800',
    },
    heroStatLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 4,
    },
    heroInsightsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    heroInsightPill: {
      flex: 1,
      minWidth: 100,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
    },
    heroInsightLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    heroInsightValue: {
      ...theme.typography.body2,
      marginTop: 2,
      color: theme.text,
      fontWeight: '700',
    },
    insightsLoadingCard: {
      padding: 16,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    insightsLoadingText: {
      ...theme.typography.body2,
      color: theme.textSecondary,
    },
    insightsCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
    },
    insightsHeader: {
      gap: 2,
    },
    insightsTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    insightsCaption: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    insightsList: {
      gap: 10,
    },
    insightItem: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
    },
    insightItemMain: {
      flex: 1,
      gap: 2,
    },
    insightQuizTitle: {
      ...theme.typography.body2,
      color: theme.text,
      fontWeight: '700',
    },
    insightMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    insightScoreWrap: {
      alignItems: 'flex-end',
      minWidth: 66,
    },
    insightScore: {
      ...theme.typography.body2,
      fontWeight: '800',
    },
    insightScorePassed: {
      color: '#16a34a',
    },
    insightScoreFailed: {
      color: theme.colors.error500,
    },
    insightStatus: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
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
      ...theme.typography.body2,
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
      ...theme.typography.body2,
      color: theme.text,
      fontWeight: '600',
    },
    bestAttemptDate: {
      ...theme.typography.caption,
      marginTop: 3,
      color: theme.textSecondary,
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
    reviewButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.78)',
    },
    reviewButtonText: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
    },
  });

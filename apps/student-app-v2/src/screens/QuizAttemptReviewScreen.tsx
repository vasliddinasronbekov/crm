import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { getRuntimeQuizAttemptReview } from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList, 'QuizAttemptReview'>;

type QuestionFilter = 'all' | 'focus' | 'correct';

const FILTERS: Array<{ key: QuestionFilter; label: string }> = [
  { key: 'all', label: 'All Questions' },
  { key: 'focus', label: 'Needs Focus' },
  { key: 'correct', label: 'Correct Only' },
];

const statusPalette = (status: string, isDark: boolean) => {
  switch (status) {
    case 'correct':
      return {
        bg: 'rgba(22,163,74,0.16)',
        border: 'rgba(22,163,74,0.5)',
        text: '#16a34a',
        icon: 'check-circle' as const,
      };
    case 'pending_manual':
      return {
        bg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)',
        border: 'rgba(245,158,11,0.48)',
        text: '#f59e0b',
        icon: 'clock-outline' as const,
      };
    case 'incorrect':
      return {
        bg: isDark ? 'rgba(220,38,38,0.18)' : 'rgba(220,38,38,0.14)',
        border: 'rgba(220,38,38,0.5)',
        text: '#dc2626',
        icon: 'close-circle' as const,
      };
    default:
      return {
        bg: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.18)',
        border: isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.35)',
        text: isDark ? '#cbd5e1' : '#475569',
        icon: 'help-circle-outline' as const,
      };
  }
};

export const QuizAttemptReviewScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [filter, setFilter] = useState<QuestionFilter>('all');

  const { attemptId } = route.params;
  const reviewQuery = useQuery({
    queryKey: ['runtime-quiz-attempt-review', attemptId],
    queryFn: () => getRuntimeQuizAttemptReview(attemptId),
  });

  if (reviewQuery.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading attempt review...</Text>
      </View>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Review unavailable</Text>
        <Text style={styles.stateText}>We could not load this attempt review.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => reviewQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const review = reviewQuery.data;
  const filteredQuestions = review.questions.filter((question) => {
    if (filter === 'focus') {
      return question.needsFocus;
    }
    if (filter === 'correct') {
      return question.status === 'correct';
    }
    return true;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ExamHeroCard
        eyebrow="Attempt Review"
        title={`${review.attempt.percentageScore.toFixed(0)}%`}
        subtitle={review.quiz.title}
        accentColor={review.attempt.passed ? '#16a34a' : '#dc2626'}
        progress={review.attempt.percentageScore}
        metrics={[
          { icon: 'check-circle-outline', label: 'Status', value: review.attempt.passed ? 'Passed' : 'Needs Work' },
          { icon: 'target', label: 'Accuracy', value: `${review.metrics.accuracyRate.toFixed(1)}%` },
          { icon: 'clock-outline', label: 'Time', value: `${Math.floor(review.attempt.timeTakenSeconds / 60)}m` },
        ]}
      />

      <GlassCard style={styles.quickMetricsCard}>
        <View style={styles.quickMetricItem}>
          <Text style={styles.quickMetricLabel}>Correct</Text>
          <Text style={[styles.quickMetricValue, { color: '#16a34a' }]}>
            {review.metrics.correctQuestions}
          </Text>
        </View>
        <View style={styles.quickMetricItem}>
          <Text style={styles.quickMetricLabel}>Incorrect</Text>
          <Text style={[styles.quickMetricValue, { color: theme.colors.error500 }]}>
            {review.metrics.incorrectQuestions}
          </Text>
        </View>
        <View style={styles.quickMetricItem}>
          <Text style={styles.quickMetricLabel}>Pending</Text>
          <Text style={[styles.quickMetricValue, { color: '#f59e0b' }]}>
            {review.metrics.pendingManualQuestions}
          </Text>
        </View>
        <View style={styles.quickMetricItem}>
          <Text style={styles.quickMetricLabel}>Completion</Text>
          <Text style={styles.quickMetricValue}>{review.metrics.completionRate.toFixed(0)}%</Text>
        </View>
      </GlassCard>

      {review.focusQuestions.length > 0 ? (
        <GlassCard style={styles.focusCard}>
          <Text style={styles.sectionTitle}>Focus Queue</Text>
          <View style={styles.focusList}>
            {review.focusQuestions.map((item) => (
              <View key={item.questionId} style={styles.focusItem}>
                <Text style={styles.focusItemTitle}>Q{item.order}</Text>
                <Text style={styles.focusItemReason}>{item.reason}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.tipsCard}>
        <Text style={styles.sectionTitle}>Coach Tips</Text>
        <View style={styles.tipsList}>
          {review.tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#f59e0b" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <GlassCard style={styles.questionsCard}>
        <Text style={styles.sectionTitle}>Per-Question Drilldown</Text>
        <View style={styles.questionList}>
          {filteredQuestions.map((question) => {
            const palette = statusPalette(question.status, isDark);
            return (
              <View key={question.questionId} style={styles.questionItem}>
                <View style={styles.questionHeader}>
                  <View>
                    <Text style={styles.questionOrder}>Question {question.order}</Text>
                    <Text style={styles.questionType}>{question.questionTypeDisplay}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name={palette.icon} size={14} color={palette.text} />
                    <Text style={[styles.statusPillText, { color: palette.text }]}>
                      {question.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.questionPrompt}>{question.questionText}</Text>
                <Text style={styles.answerRow}>
                  <Text style={styles.answerLabel}>Your answer: </Text>
                  {question.selectedAnswer || 'No answer'}
                </Text>
                {question.correctAnswer ? (
                  <Text style={styles.correctAnswer}>
                    Correct answer: {question.correctAnswer}
                  </Text>
                ) : null}
                {question.feedback ? <Text style={styles.feedbackText}>Feedback: {question.feedback}</Text> : null}
                {question.explanation ? (
                  <Text style={styles.explanationText}>Explanation: {question.explanation}</Text>
                ) : null}
                <Text style={styles.pointsText}>
                  Score: {question.pointsEarned}/{question.points}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.replace('QuizPlayer', { quizId: review.quiz.id })}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.white} />
          <Text style={styles.primaryActionText}>Retake Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryActionText}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
      paddingBottom: 32,
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
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: theme.colors.primary500,
    },
    retryText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
    quickMetricsCard: {
      padding: 16,
      borderRadius: 22,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickMetricItem: {
      width: '47%',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
      borderRadius: 14,
      padding: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    },
    quickMetricLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    quickMetricValue: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 4,
    },
    focusCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
    },
    focusList: {
      gap: 8,
    },
    focusItem: {
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.22)',
      backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : 'rgba(220,38,38,0.08)',
    },
    focusItemTitle: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
    },
    focusItemReason: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    tipsCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    tipsList: {
      gap: 8,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tipText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      flex: 1,
    },
    filterRow: {
      gap: 8,
      paddingRight: 10,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    },
    filterChipActive: {
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.16)',
    },
    filterChipText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
    },
    filterChipTextActive: {
      color: '#5b21b6',
    },
    questionsCard: {
      padding: 16,
      borderRadius: 22,
      gap: 12,
    },
    questionList: {
      gap: 12,
    },
    questionItem: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
      borderRadius: 14,
      padding: 12,
      gap: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)',
    },
    questionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    questionOrder: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
    },
    questionType: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusPillText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    questionPrompt: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '600',
      lineHeight: 21,
    },
    answerRow: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    answerLabel: {
      color: theme.text,
      fontWeight: '700',
    },
    correctAnswer: {
      ...theme.typography.body,
      color: '#16a34a',
      lineHeight: 20,
    },
    feedbackText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    explanationText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    pointsText: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
      marginTop: 4,
    },
    actionsRow: {
      gap: 12,
      marginTop: 2,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    primaryActionText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    secondaryAction: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
    },
    secondaryActionText: {
      ...theme.typography.button,
      color: theme.text,
    },
  });

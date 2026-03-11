/* eslint-disable react-native/no-unused-styles */
import React, { useMemo } from 'react';
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
import type { ExtendedTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { getRuntimeAssignmentSubmissionReview, type RuntimeAssignmentSubmissionReview } from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList, 'AssignmentReview'>;
const hasValue = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'graded':
      return '#16a34a';
    case 'returned':
      return '#dc2626';
    case 'submitted':
      return '#2563eb';
    default:
      return '#d97706';
  }
};

export const AssignmentReviewScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { submissionId } = route.params;

  const reviewQuery = useQuery<RuntimeAssignmentSubmissionReview>({
    queryKey: ['runtime-assignment-review', submissionId],
    queryFn: async () => getRuntimeAssignmentSubmissionReview(submissionId),
  });

  if (reviewQuery.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading submission review...</Text>
      </View>
    );
  }

  if (reviewQuery.isError || reviewQuery.data === undefined) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Review unavailable</Text>
        <Text style={styles.stateText}>We could not load this submission review.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { void reviewQuery.refetch(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const review = reviewQuery.data;
  const statusColor = getStatusColor(review.submission.status);
  const score = review.grading.percentageScore ?? 0;
  const passed = review.grading.passed === true;
  const percentageScore = review.grading.percentageScore ?? null;
  const subtitle = hasValue(review.assignment.moduleTitle)
    ? review.assignment.moduleTitle
    : review.assignment.assignmentTypeDisplay;
  const scoreLabel =
    review.grading.pointsEarned === null
      ? 'Pending'
      : `${review.grading.pointsEarned}/${review.grading.pointsAvailable}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ExamHeroCard
        eyebrow="Assignment Review"
        title={review.assignment.title}
        subtitle={subtitle}
        accentColor={statusColor}
        progress={score}
        metrics={[
          { icon: 'clipboard-check-outline', label: 'Status', value: review.submission.statusDisplay },
          { icon: 'star-outline', label: 'Score', value: scoreLabel },
          {
            icon: 'check-circle-outline',
            label: 'Result',
            value: review.grading.passed === null ? 'Pending' : passed ? 'Passed' : 'Needs Work',
          },
        ]}
      />

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Status Overview</Text>
        <Text style={styles.sectionBody}>{review.statusReason}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="counter" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>Attempt #{review.submission.attemptNumber}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons
              name={review.submission.isLate ? 'alert-circle-outline' : 'clock-outline'}
              size={14}
              color={review.submission.isLate ? theme.colors.error500 : theme.textSecondary}
            />
            <Text
              style={[
                styles.metaText,
                review.submission.isLate ? { color: theme.colors.error500 } : null,
              ]}
            >
              {review.submission.isLate ? 'Late submission' : 'On time'}
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Grading Details</Text>
        <View style={styles.gradingRow}>
          <Text style={styles.gradingLabel}>Points</Text>
          <Text style={styles.gradingValue}>{scoreLabel}</Text>
        </View>
        <View style={styles.gradingRow}>
          <Text style={styles.gradingLabel}>Passing threshold</Text>
          <Text style={styles.gradingValue}>{review.assignment.passingPoints} pts</Text>
        </View>
        <View style={styles.gradingRow}>
          <Text style={styles.gradingLabel}>Percentage</Text>
          <Text style={styles.gradingValue}>
            {percentageScore === null ? 'Pending' : `${percentageScore.toFixed(1)}%`}
          </Text>
        </View>
        {hasValue(review.grading.gradedByName) ? (
          <View style={styles.gradingRow}>
            <Text style={styles.gradingLabel}>Graded by</Text>
            <Text style={styles.gradingValue}>{review.grading.gradedByName}</Text>
          </View>
        ) : null}
        {hasValue(review.grading.feedback) ? (
          <View style={styles.feedbackWrap}>
            <Text style={styles.feedbackTitle}>Teacher Feedback</Text>
            <Text style={styles.feedbackText}>{review.grading.feedback}</Text>
          </View>
        ) : null}
      </GlassCard>

      {hasValue(review.submission.textContent) ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your Submission</Text>
          <Text style={styles.sectionBody}>{review.submission.textContent}</Text>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
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

      <View style={styles.actionsRow}>
        {review.assignment.allowResubmission ? (
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.replace('AssignmentDetail', { assignmentId: review.assignment.id })}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.white} />
            <Text style={styles.primaryActionText}>Resubmit</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryActionText}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: ExtendedTheme, isDark: boolean) =>
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
      ...theme.typography.body2,
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
    sectionCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    sectionBody: {
      ...theme.typography.body2,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    },
    metaText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    gradingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    gradingLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    gradingValue: {
      ...theme.typography.body2,
      color: theme.text,
      fontWeight: '700',
    },
    feedbackWrap: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.28)',
      borderRadius: 14,
      padding: 10,
      backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)',
      gap: 5,
    },
    feedbackTitle: {
      ...theme.typography.caption,
      color: '#2563eb',
      fontWeight: '700',
    },
    feedbackText: {
      ...theme.typography.body2,
      color: theme.text,
      lineHeight: 20,
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
      ...theme.typography.body2,
      color: theme.textSecondary,
      flex: 1,
    },
    actionsRow: {
      gap: 12,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#0f766e',
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

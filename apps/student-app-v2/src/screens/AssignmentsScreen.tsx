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
  getRuntimeAssignmentsInsights,
  listRuntimeAssignments,
  type RuntimeAssignmentInsights,
  type RuntimeAssignmentSummary,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type AssignmentFilter = 'all' | 'pending' | 'submitted' | 'graded';
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
const hasValue = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const AssignmentsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [filter, setFilter] = useState<AssignmentFilter>('all');

  const assignmentsQuery = useQuery<RuntimeAssignmentSummary[]>({
    queryKey: ['runtime-assignments', filter],
    queryFn: async () => listRuntimeAssignments(filter),
  });

  const insightsQuery = useQuery<RuntimeAssignmentInsights>({
    queryKey: ['runtime-assignment-insights'],
    queryFn: async () => getRuntimeAssignmentsInsights(),
  });

  const assignments = assignmentsQuery.data ?? [];
  const insights: RuntimeAssignmentInsights | undefined = insightsQuery.data;
  const stats = {
    total: insights?.totalAssignments ?? assignments.length,
    pending: insights?.awaitingGradeCount ?? assignments.filter((assignment) => assignment.status === 'pending').length,
    graded: insights?.gradedCount ?? assignments.filter((assignment) => assignment.status === 'graded').length,
    completionRate: insights?.completionRate ?? 0,
  };

  const filters: { key: AssignmentFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: theme.colors.primary500 },
    { key: 'pending', label: 'Pending', color: '#d97706' },
    { key: 'submitted', label: 'Submitted', color: '#2563eb' },
    { key: 'graded', label: 'Graded', color: '#16a34a' },
  ];

  if (assignmentsQuery.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading assignments...</Text>
      </View>
    );
  }

  if (assignmentsQuery.isError) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Assignments unavailable</Text>
        <Text style={styles.stateText}>The assignment feed could not be loaded.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { void assignmentsQuery.refetch(); }}>
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
          refreshing={assignmentsQuery.isRefetching}
          onRefresh={() => {
            void assignmentsQuery.refetch();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={28} color="#0f766e" />
        </View>
        <Text style={styles.heroTitle}>Assignment Desk</Text>
        <Text style={styles.heroSubtitle}>
          Track deadlines, submit work, and review teacher feedback from one place.
        </Text>
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statValue}>{stats.graded}</Text>
            <Text style={styles.statLabel}>Graded</Text>
          </GlassCard>
        </View>
        <View style={styles.heroInsightsRow}>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>Completion</Text>
            <Text style={styles.heroInsightValue}>{stats.completionRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>On-Time Rate</Text>
            <Text style={styles.heroInsightValue}>{(insights?.onTimeRate ?? 0).toFixed(1)}%</Text>
          </View>
          <View style={styles.heroInsightPill}>
            <Text style={styles.heroInsightLabel}>Avg Score</Text>
            <Text style={styles.heroInsightValue}>{(insights?.averageScore ?? 0).toFixed(1)}</Text>
          </View>
        </View>
      </GlassCard>

      {insightsQuery.isLoading ? (
        <GlassCard style={styles.insightsLoadingCard}>
          <ActivityIndicator size="small" color={theme.colors.primary500} />
          <Text style={styles.insightsLoadingText}>Preparing assignment insights...</Text>
        </GlassCard>
      ) : insights !== undefined && insights.recentSubmissions.length > 0 ? (
        <GlassCard style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent Submissions</Text>
          <View style={styles.recentList}>
            {insights.recentSubmissions.slice(0, 3).map((submission) => (
              <TouchableOpacity
                key={submission.submissionId}
                style={styles.recentItem}
                onPress={() => navigation.navigate('AssignmentReview', { submissionId: submission.submissionId })}
                activeOpacity={0.88}
              >
                <View style={styles.recentItemMain}>
                  <Text style={styles.recentItemTitle} numberOfLines={1}>
                    {submission.assignmentTitle}
                  </Text>
                  <Text style={styles.recentItemMeta}>
                    {submission.status.toUpperCase()} • {submission.isLate ? 'LATE' : 'ON TIME'}
                  </Text>
                </View>
                <Text style={styles.recentItemScore}>
                  {submission.pointsEarned === null || submission.pointsEarned === undefined
                    ? 'Pending'
                    : `${submission.pointsEarned}/${submission.maxPoints}`}
                </Text>
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
                active && { backgroundColor: item.color, borderColor: item.color },
              ]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.9}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {assignments.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="clipboard-search-outline" size={52} color={theme.textMuted} />
          <Text style={styles.stateTitle}>No assignments found</Text>
          <Text style={styles.stateText}>Try another filter or check back later.</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {assignments.map((assignment) => {
            const submissionId = assignment.userSubmission?.id;
            return (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: assignment.id })}
                onOpenReview={
                  typeof submissionId === 'number'
                    ? () => navigation.navigate('AssignmentReview', { submissionId })
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

const AssignmentCard = ({
  assignment,
  onPress,
  onOpenReview,
}: {
  assignment: RuntimeAssignmentSummary;
  onPress: () => void;
  onOpenReview?: () => void;
}) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const statusColor =
    assignment.status === 'graded'
      ? '#16a34a'
      : assignment.status === 'submitted'
      ? '#2563eb'
      : '#d97706';

  return (
    <GlassCard style={styles.assignmentCard} onPress={onPress}>
      <View style={styles.assignmentHeader}>
        <View style={[styles.assignmentIcon, { backgroundColor: `${statusColor}18` }]}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={statusColor} />
        </View>
        <View style={styles.assignmentCopy}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.assignmentSubtitle}>
            {hasValue(assignment.moduleTitle)
              ? assignment.moduleTitle
              : hasValue(assignment.assignmentType)
              ? assignment.assignmentType
              : 'Assignment'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{assignment.status}</Text>
        </View>
      </View>

      {hasValue(assignment.description) ? (
        <Text style={styles.assignmentDescription} numberOfLines={2}>
          {assignment.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.metaText}>
            {hasValue(assignment.dueDate) ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons name="star-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.metaText}>{assignment.maxPoints} pts</Text>
        </View>
      </View>
      {onOpenReview !== undefined ? (
        <TouchableOpacity style={styles.reviewButton} onPress={onOpenReview}>
          <MaterialCommunityIcons name="clipboard-text-search-outline" size={17} color={theme.text} />
          <Text style={styles.reviewButtonText}>Open Submission Review</Text>
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
      ...theme.typography.body2,
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,118,110,0.12)',
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
    statsRow: {
      flexDirection: 'row',
      gap: 10,
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
      paddingHorizontal: 16,
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
    recentCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
    },
    recentTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    recentList: {
      gap: 10,
    },
    recentItem: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
    },
    recentItemMain: {
      flex: 1,
      gap: 2,
    },
    recentItemTitle: {
      ...theme.typography.body2,
      color: theme.text,
      fontWeight: '700',
    },
    recentItemMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    recentItemScore: {
      ...theme.typography.body2,
      color: theme.text,
      fontWeight: '700',
    },
    assignmentCard: {
      padding: 18,
      borderRadius: 24,
      gap: 14,
    },
    assignmentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    assignmentIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assignmentCopy: {
      flex: 1,
      gap: 2,
    },
    assignmentTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    assignmentSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusText: {
      ...theme.typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    assignmentDescription: {
      ...theme.typography.body2,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    metaRow: {
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
    metaText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    reviewButton: {
      marginTop: 6,
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

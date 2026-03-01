import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useTheme, lessonService, coursesApi } from '@eduvoice/mobile-shared';

import { FeatureCard } from '../components/app/FeatureCard';
import { GlassCard } from '../components/app/GlassCard';
import {
  getBackendContinueLearningLesson,
  getBookmarkedLessonSummaries,
  getContinueLearningLesson,
  getRecentLessonSummaries,
  listRuntimeAssignments,
  listRuntimeQuizzes,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const LearnHubScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const lessonsQuery = useQuery({
    queryKey: ['learn-hub-lessons'],
    queryFn: async () => {
      const response = await lessonService.getLessons({ page_size: 1000 });
      return response.results || [];
    },
  });

  const coursesQuery = useQuery({
    queryKey: ['learn-hub-courses'],
    queryFn: coursesApi.getEnrolledCourses,
  });

  const quizzesQuery = useQuery({
    queryKey: ['learn-hub-quizzes'],
    queryFn: () => listRuntimeQuizzes('all'),
  });

  const assignmentsQuery = useQuery({
    queryKey: ['learn-hub-assignments'],
    queryFn: () => listRuntimeAssignments('all'),
  });

  const continueQuery = useQuery({
    queryKey: ['learn-hub-runtime', 'continue'],
    queryFn: () => getContinueLearningLesson(),
  });

  const backendContinueQuery = useQuery({
    queryKey: ['learn-hub-runtime', 'continue-backend'],
    queryFn: () => getBackendContinueLearningLesson(),
  });

  const recentQuery = useQuery({
    queryKey: ['learn-hub-runtime', 'recent'],
    queryFn: () => getRecentLessonSummaries(3),
  });

  const bookmarkQuery = useQuery({
    queryKey: ['learn-hub-runtime', 'bookmarks'],
    queryFn: () => getBookmarkedLessonSummaries(3),
  });

  useFocusEffect(
    React.useCallback(() => {
      void continueQuery.refetch();
      void backendContinueQuery.refetch();
      void recentQuery.refetch();
      void bookmarkQuery.refetch();
    }, [backendContinueQuery, bookmarkQuery, continueQuery, recentQuery])
  );

  const isLoading =
    lessonsQuery.isLoading ||
    coursesQuery.isLoading ||
    quizzesQuery.isLoading ||
    assignmentsQuery.isLoading;

  const isRefreshing =
    lessonsQuery.isRefetching ||
    coursesQuery.isRefetching ||
    quizzesQuery.isRefetching ||
    assignmentsQuery.isRefetching ||
    backendContinueQuery.isRefetching ||
    continueQuery.isRefetching ||
    recentQuery.isRefetching ||
    bookmarkQuery.isRefetching;

  const continueLesson = backendContinueQuery.data
    ? {
        lessonId: backendContinueQuery.data.id,
        title: backendContinueQuery.data.title,
        moduleTitle: backendContinueQuery.data.module_title || 'Module',
        lessonType: backendContinueQuery.data.lesson_type,
        completion: backendContinueQuery.data.student_progress?.completion_percentage || 0,
      }
    : continueQuery.data;
  const recentLessons = recentQuery.data || [];
  const bookmarkedLessons = bookmarkQuery.data || [];

  const getViewerType = (lessonType?: string) =>
    lessonType === 'book' || lessonType === 'video' || lessonType === 'article'
      ? lessonType
      : undefined;

  const lessonCounts = useMemo(() => {
    const summary = {
      book: 0,
      video: 0,
      article: 0,
      audio: 0,
      interactive: 0,
    };

    for (const lesson of lessonsQuery.data || []) {
      if (lesson.lesson_type === 'text') {
        summary.article += 1;
        continue;
      }

      if (lesson.lesson_type in summary) {
        summary[lesson.lesson_type as keyof typeof summary] += 1;
      }
    }

    return summary;
  }, [lessonsQuery.data]);

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>Loading your learning space...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void lessonsQuery.refetch();
            void coursesQuery.refetch();
            void quizzesQuery.refetch();
            void assignmentsQuery.refetch();
            void backendContinueQuery.refetch();
            void continueQuery.refetch();
            void recentQuery.refetch();
            void bookmarkQuery.refetch();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="book-education-outline" size={28} color={theme.colors.primary500} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Learn</Text>
          <Text style={styles.heroSubtitle}>
            Courses, books, videos, quizzes, and assignments in one clean flow.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(coursesQuery.data || []).length}</Text>
          <Text style={styles.statLabel}>Enrolled Courses</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(quizzesQuery.data || []).length}</Text>
          <Text style={styles.statLabel}>Quizzes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(assignmentsQuery.data || []).length}</Text>
          <Text style={styles.statLabel}>Assignments</Text>
        </View>
      </View>

      {continueLesson ? (
        <GlassCard style={styles.continueCardPremium}>
          <View style={styles.continueHeader}>
            <View style={styles.continueBadge}>
              <MaterialCommunityIcons name="play-circle-outline" size={22} color={theme.colors.primary500} />
            </View>
            <View style={styles.continueMeta}>
              <Text style={styles.continueTitle}>Continue Learning</Text>
              <Text style={styles.continueSubtitle}>
                {continueLesson.title} • {continueLesson.moduleTitle}
              </Text>
            </View>
          </View>
          <View style={styles.continueFooter}>
            <Text style={styles.continueProgress}>{continueLesson.completion}% complete</Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() =>
                navigation.navigate('LessonViewer', {
                  lessonId: continueLesson.lessonId,
                  initialType: getViewerType(continueLesson.lessonType),
                })
              }
            >
              <Text style={styles.continueButtonText}>Resume</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : null}

      {recentLessons.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently Viewed</Text>
            <Text style={styles.sectionSubtitle}>Jump back into your latest study sessions.</Text>
          </View>
          <View style={styles.recentList}>
            {recentLessons.map((lesson) => (
              <TouchableOpacity
                key={lesson.lessonId}
                style={styles.recentCard}
                onPress={() =>
                  navigation.navigate('LessonViewer', {
                    lessonId: lesson.lessonId,
                    initialType: getViewerType(lesson.lessonType),
                  })
                }
                activeOpacity={0.9}
              >
                <Text style={styles.recentCardTitle} numberOfLines={1}>{lesson.title}</Text>
                <Text style={styles.recentCardMeta} numberOfLines={1}>{lesson.moduleTitle}</Text>
                <Text style={styles.recentCardProgress}>{lesson.completion}% complete</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core Learning</Text>
          <Text style={styles.sectionSubtitle}>Start from your active study paths.</Text>
        </View>

        <View style={styles.grid}>
          <FeatureCard
            title="Courses"
            description="Open enrolled courses, continue lessons, and track progress."
            icon="school-outline"
            accentColor={theme.colors.primary500}
            badge={`${(coursesQuery.data || []).length}`}
            onPress={() => navigation.navigate('Courses')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Library"
            description="Browse every lesson type from one organized content hub."
            icon="library-shelves"
            accentColor={theme.colors.warning500}
            onPress={() => navigation.navigate('Library')}
            style={styles.gridItem}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Content Formats</Text>
          <Text style={styles.sectionSubtitle}>Jump directly into the format you need.</Text>
        </View>

        <View style={styles.grid}>
          <FeatureCard
            title="Books"
            description="Read PDF and book lessons with progress-aware access."
            icon="book-open-page-variant-outline"
            accentColor="#16a34a"
            badge={`${lessonCounts.book}`}
            onPress={() => navigation.navigate('Books')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Videos"
            description="Continue watching lesson videos and resume where you stopped."
            icon="play-box-multiple-outline"
            accentColor="#dc2626"
            badge={`${lessonCounts.video}`}
            onPress={() => navigation.navigate('Videos')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Articles"
            description="Open article-based lessons, reading passages, and quick notes."
            icon="text-box-multiple-outline"
            accentColor="#7c3aed"
            badge={`${lessonCounts.article}`}
            onPress={() => navigation.navigate('Articles')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Quizzes"
            description="Practice graded, exam, and survey-style assessments."
            icon="text-box-check-outline"
            accentColor="#7c3aed"
            badge={`${(quizzesQuery.data || []).length}`}
            onPress={() => navigation.navigate('Quizzes')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Assignments"
            description="View deadlines, submit work, and track evaluation status."
            icon="clipboard-text-outline"
            accentColor="#0f766e"
            badge={`${(assignmentsQuery.data || []).length}`}
            onPress={() => navigation.navigate('Assignments')}
            style={styles.gridItem}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.continueCard} onPress={() => navigation.navigate('Courses')}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={24} color={theme.colors.primary500} />
        <View style={styles.continueCopy}>
          <Text style={styles.continueTitle}>Continue Learning</Text>
          <Text style={styles.continueSubtitle}>
            {bookmarkedLessons.length > 0
              ? `${bookmarkedLessons.length} bookmarked lessons ready for review.`
              : 'Go back to your active courses and keep your momentum.'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      padding: theme.spacing.lg,
    },
    loadingText: {
      marginTop: theme.spacing.md,
      color: theme.textSecondary,
      fontSize: 15,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      flex: 1,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statValue: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 6,
    },
    continueCardPremium: {
      marginHorizontal: theme.spacing.lg,
      padding: theme.spacing.md,
      borderRadius: 24,
      gap: theme.spacing.md,
    },
    continueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    continueBadge: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primaryContainer,
    },
    continueMeta: {
      flex: 1,
    },
    continueFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    continueProgress: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    continueButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.colors.primary500,
    },
    continueButtonText: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: '700',
    },
    section: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    sectionHeader: {
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    recentList: {
      gap: theme.spacing.sm,
    },
    recentCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    recentCardTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    recentCardMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    recentCardProgress: {
      color: theme.colors.primary500,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 10,
    },
    gridItem: {
      width: '48.6%',
    },
    continueCard: {
      margin: theme.spacing.lg,
      marginTop: theme.spacing.xl,
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    continueCopy: {
      flex: 1,
    },
    continueTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    continueSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
  });

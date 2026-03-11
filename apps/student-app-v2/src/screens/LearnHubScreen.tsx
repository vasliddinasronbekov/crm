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
import { useTranslation } from 'react-i18next';

import { coursesApi, lessonService, useTheme } from '@eduvoice/mobile-shared';

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

type ContinueLessonView = {
  lessonId: number;
  title: string;
  moduleTitle: string;
  lessonType?: string;
  completion: number;
};

const getViewerType = (lessonType?: string) =>
  lessonType === 'book' || lessonType === 'video' || lessonType === 'article'
    ? lessonType
    : undefined;

export const LearnHubScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const lessonsQuery = useQuery({
    queryKey: ['learn-hub-lessons'],
    queryFn: async () => {
      const response = await lessonService.getLessons({ page_size: 1000 });
      return response.results ?? [];
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
    }, [backendContinueQuery, bookmarkQuery, continueQuery, recentQuery]),
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

  const backendContinue = backendContinueQuery.data;
  const localContinue = continueQuery.data;

  let continueLesson: ContinueLessonView | null = null;

  if (backendContinue !== null && backendContinue !== undefined) {
    continueLesson = {
      lessonId: backendContinue.id,
      title: backendContinue.title,
      moduleTitle:
        backendContinue.module_title !== undefined && backendContinue.module_title !== null
          ? backendContinue.module_title
          : 'Module',
      lessonType: backendContinue.lesson_type,
      completion: backendContinue.student_progress?.completion_percentage ?? 0,
    };
  } else if (localContinue !== null && localContinue !== undefined) {
    continueLesson = {
      lessonId: localContinue.lessonId,
      title: localContinue.title,
      moduleTitle: localContinue.moduleTitle,
      lessonType: localContinue.lessonType,
      completion: localContinue.completion,
    };
  }

  const recentLessons = recentQuery.data ?? [];
  const bookmarkedLessons = bookmarkQuery.data ?? [];

  const lessonCounts = useMemo(() => {
    const summary = {
      book: 0,
      video: 0,
      article: 0,
      audio: 0,
      interactive: 0,
    };

    for (const lesson of lessonsQuery.data ?? []) {
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

  const quickLaunch = useMemo(
    () => [
      {
        key: 'courses',
        label: t('widgets.courses'),
        icon: 'school-outline',
        onPress: () => navigation.navigate('Courses'),
      },
      {
        key: 'library',
        label: t('widgets.library'),
        icon: 'library-shelves',
        onPress: () => navigation.navigate('Library'),
      },
      {
        key: 'quizzes',
        label: t('widgets.quizzes'),
        icon: 'text-box-check-outline',
        onPress: () => navigation.navigate('Quizzes'),
      },
      {
        key: 'assignments',
        label: t('assignments.assignments'),
        icon: 'clipboard-text-outline',
        onPress: () => navigation.navigate('Assignments'),
      },
    ],
    [navigation, t],
  );

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
      contentContainerStyle={styles.content}
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
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name="book-education-outline"
              size={16}
              color={theme.colors.primary500}
            />
            <Text style={styles.heroBadgeText}>Learn Workspace</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Learn</Text>
        <Text style={styles.heroSubtitle}>
          Courses, videos, assignments, and practice tools in one operational flow.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{(coursesQuery.data ?? []).length}</Text>
            <Text style={styles.heroStatLabel}>Courses</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{(quizzesQuery.data ?? []).length}</Text>
            <Text style={styles.heroStatLabel}>Quizzes</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{(assignmentsQuery.data ?? []).length}</Text>
            <Text style={styles.heroStatLabel}>Assignments</Text>
          </View>
        </View>
      </GlassCard>

      {continueLesson !== null ? (
        <GlassCard style={styles.spotlightCard}>
          <View style={styles.spotlightHeader}>
            <View style={styles.spotlightIcon}>
              <MaterialCommunityIcons
                name="play-circle-outline"
                size={20}
                color={theme.colors.primary500}
              />
            </View>
            <View style={styles.spotlightMeta}>
              <Text style={styles.spotlightTitle}>Continue learning</Text>
              <Text style={styles.spotlightSubtitle} numberOfLines={1}>
                {continueLesson.title}
              </Text>
              <Text style={styles.spotlightModule} numberOfLines={1}>
                {continueLesson.moduleTitle}
              </Text>
            </View>
          </View>

          <View style={styles.spotlightFooter}>
            <Text style={styles.spotlightProgress}>{continueLesson.completion}% complete</Text>
            <TouchableOpacity
              style={styles.spotlightButton}
              onPress={() =>
                navigation.navigate('LessonViewer', {
                  lessonId: continueLesson.lessonId,
                  initialType: getViewerType(continueLesson.lessonType),
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.spotlightButtonText}>Resume</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : null}

      <View style={styles.quickLaunchRow}>
        {quickLaunch.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={item.onPress}
            style={styles.quickLaunchCard}
            activeOpacity={0.86}
          >
            <View style={styles.quickLaunchIcon}>
              <MaterialCommunityIcons
                name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={17}
                color={theme.colors.primary500}
              />
            </View>
            <Text style={styles.quickLaunchLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {recentLessons.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently Viewed</Text>
            <Text style={styles.sectionSubtitle}>
              Jump back to your latest lessons in one tap.
            </Text>
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
                activeOpacity={0.88}
              >
                <View style={styles.recentTopRow}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
                <Text style={styles.recentMeta} numberOfLines={1}>
                  {lesson.moduleTitle}
                </Text>
                <Text style={styles.recentProgress}>{lesson.completion}% complete</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core Learning</Text>
          <Text style={styles.sectionSubtitle}>Start from high-impact daily workflows.</Text>
        </View>

        <View style={styles.grid}>
          <FeatureCard
            title="Courses"
            description="Track modules and continue your assigned learning path."
            icon="school-outline"
            accentColor={theme.colors.primary500}
            badge={`${(coursesQuery.data ?? []).length}`}
            onPress={() => navigation.navigate('Courses')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Library"
            description="Open books, videos, and articles from one organized feed."
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
          <Text style={styles.sectionSubtitle}>Pick the format that matches your session.</Text>
        </View>

        <View style={styles.grid}>
          <FeatureCard
            title="Books"
            description="Read PDF and book lessons with progress checkpoints."
            icon="book-open-page-variant-outline"
            accentColor="#16a34a"
            badge={`${lessonCounts.book}`}
            onPress={() => navigation.navigate('Books')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Videos"
            description="Resume lesson videos from your last watched position."
            icon="play-box-multiple-outline"
            accentColor="#dc2626"
            badge={`${lessonCounts.video}`}
            onPress={() => navigation.navigate('Videos')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Articles"
            description="Read article lessons and practice passage-based study."
            icon="text-box-multiple-outline"
            accentColor="#7c3aed"
            badge={`${lessonCounts.article}`}
            onPress={() => navigation.navigate('Articles')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Quizzes"
            description="Run graded and practice quizzes by topic and level."
            icon="text-box-check-outline"
            accentColor="#8b5cf6"
            badge={`${(quizzesQuery.data ?? []).length}`}
            onPress={() => navigation.navigate('Quizzes')}
            style={styles.gridItem}
          />
          <FeatureCard
            title="Assignments"
            description="Submit work, monitor status, and check grading updates."
            icon="clipboard-text-outline"
            accentColor="#0f766e"
            badge={`${(assignmentsQuery.data ?? []).length}`}
            onPress={() => navigation.navigate('Assignments')}
            style={styles.gridItem}
          />
        </View>
      </View>

      <GlassCard style={styles.focusCard}>
        <View style={styles.focusHeader}>
          <MaterialCommunityIcons
            name="bookmark-check-outline"
            size={18}
            color={theme.colors.primary500}
          />
          <Text style={styles.focusTitle}>Focus Queue</Text>
        </View>
        <Text style={styles.focusSubtitle}>
          {bookmarkedLessons.length > 0
            ? `${bookmarkedLessons.length} bookmarked lessons are ready for your next study block.`
            : 'Bookmark key lessons to build a focused review queue.'}
        </Text>
      </GlassCard>
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxxl,
      gap: theme.spacing.md,
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
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.85)',
    },
    heroBadgeText: {
      color: theme.colors.primary500,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
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
      marginTop: -4,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: theme.spacing.xs,
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
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    heroStatLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
    spotlightCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    spotlightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    spotlightIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.88)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    spotlightMeta: {
      flex: 1,
    },
    spotlightTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    spotlightSubtitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    spotlightModule: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    spotlightFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    spotlightProgress: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    spotlightButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: theme.colors.primary500,
    },
    spotlightButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    quickLaunchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    quickLaunchCard: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.86)',
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    quickLaunchIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(219,234,254,0.85)',
    },
    quickLaunchLabel: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionHeader: {
      marginTop: theme.spacing.sm,
      gap: 4,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    gridItem: {
      width: '47%',
    },
    recentList: {
      gap: theme.spacing.sm,
    },
    recentCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.86)',
      padding: theme.spacing.md,
    },
    recentTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    recentTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    recentMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    recentProgress: {
      color: theme.colors.primary500,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 8,
    },
    focusCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    focusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    focusTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    focusSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
  });

/* eslint-disable react-native/no-unused-styles */
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
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Course, coursesApi, useTheme } from '@eduvoice/mobile-shared';
import type { ExtendedTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import type { AppStackParamList } from '../navigation/types';

type CoursesNavigationProp = NativeStackNavigationProp<AppStackParamList>;

const normalizedProgress = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const toNumber = (value: string | number) => (typeof value === 'string' ? Number(value) : value);

const deriveInstructor = (course: Course) => {
  if (typeof course.instructor === 'string' && course.instructor.length > 0) {
    return course.instructor;
  }
  return 'Instructor';
};

const deriveLevel = (course: Course) => {
  if (typeof course.level === 'string' && course.level.length > 0) {
    return course.level;
  }
  return 'general';
};

export const CoursesScreen = () => {
  const { t } = useTranslation();
  const tr = (key: string) => String(t(key));
  const navigation = useNavigation<CoursesNavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const {
    data: courses,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['enrolledCourses'],
    queryFn: coursesApi.getEnrolledCourses,
    retry: 2,
  });

  const coursesList = Array.isArray(courses) ? courses : [];
  const activeCourse =
    coursesList.find((course) => {
      const progress = normalizedProgress(course.progress);
      return progress > 0 && progress < 100;
    }) ?? coursesList[0];

  const completedCourses = coursesList.filter((course) => normalizedProgress(course.progress) >= 100).length;
  const averageProgress = coursesList.length > 0
    ? coursesList.reduce((acc, course) => acc + normalizedProgress(course.progress), 0) / coursesList.length
    : 0;

  if (isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>{tr('courses.loadingCourses')}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.stateContainer}>
        <GlassCard style={styles.stateCard}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={52}
            color={theme.colors.error500}
          />
          <Text style={styles.stateTitle}>{tr('courses.errorLoadingCourses')}</Text>
          <Text style={styles.stateText}>
            {error instanceof Error ? error.message : tr('courses.errorLoadingCourses')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
            <Text style={styles.retryButtonText}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  if (coursesList.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <GlassCard style={styles.stateCard}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={56}
            color={theme.textMuted}
          />
          <Text style={styles.stateTitle}>{tr('courses.noCourses')}</Text>
          <Text style={styles.stateText}>
            Your learning manager has not enrolled courses yet.
          </Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name="school-outline"
              size={16}
              color={theme.colors.primary500}
            />
            <Text style={styles.heroBadgeText}>{tr('courses.myCourses')}</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>{coursesList.length} Active Learning Tracks</Text>
        <Text style={styles.heroSubtitle}>
          Keep your course workflow focused with progress-first visibility.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{coursesList.length}</Text>
            <Text style={styles.heroStatLabel}>Enrolled</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{completedCourses}</Text>
            <Text style={styles.heroStatLabel}>Completed</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{Math.round(averageProgress)}%</Text>
            <Text style={styles.heroStatLabel}>Avg progress</Text>
          </View>
        </View>
      </GlassCard>

      {activeCourse !== undefined ? (
        <GlassCard style={styles.spotlightCard}>
          <View style={styles.spotlightHeader}>
            <View style={styles.spotlightIcon}>
              <MaterialCommunityIcons
                name="rocket-launch-outline"
                size={20}
                color={theme.colors.primary500}
              />
            </View>
            <View style={styles.spotlightCopy}>
              <Text style={styles.spotlightTitle}>Continue now</Text>
              <Text style={styles.spotlightCourse} numberOfLines={1}>
                {activeCourse.title}
              </Text>
              <Text style={styles.spotlightInstructor} numberOfLines={1}>
                {deriveInstructor(activeCourse)}
              </Text>
            </View>
          </View>
          <View style={styles.spotlightFooter}>
            <Text style={styles.spotlightProgress}>
              {normalizedProgress(activeCourse.progress).toFixed(0)}% complete
            </Text>
            <TouchableOpacity
              style={styles.spotlightButton}
              onPress={() =>
                navigation.navigate('CourseDetail', { courseId: toNumber(activeCourse.id) })
              }
              activeOpacity={0.86}
            >
              <Text style={styles.spotlightButtonText}>{tr('courses.continueCourse')}</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr('courses.enrolledCourses')}</Text>
        <Text style={styles.sectionSubtitle}>Open any course and continue from current progress.</Text>
      </View>

      <View style={styles.list}>
        {coursesList.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onPress={() => navigation.navigate('CourseDetail', { courseId: toNumber(course.id) })}
          />
        ))}
      </View>
    </ScrollView>
  );
};

interface CourseCardProps {
  course: Course;
  onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onPress }) => {
  const { t } = useTranslation();
  const tr = (key: string) => String(t(key));
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const progress = normalizedProgress(course.progress);
  const accent = progress >= 100 ? '#16a34a' : theme.colors.primary500;

  return (
    <GlassCard style={styles.courseCard} onPress={onPress}>
      <View style={styles.courseHeader}>
        <View style={[styles.courseIcon, { backgroundColor: `${accent}1c` }]}>
          <MaterialCommunityIcons
            name={progress >= 100 ? 'check-decagram-outline' : 'book-open-page-variant-outline'}
            size={21}
            color={accent}
          />
        </View>

        <View style={styles.courseHeaderCopy}>
          <Text style={styles.courseTitle} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={styles.courseInstructor} numberOfLines={1}>
            {deriveInstructor(course)}
          </Text>
        </View>

        <View style={[styles.courseLevelBadge, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.courseLevelText, { color: accent }]}>{deriveLevel(course)}</Text>
        </View>
      </View>

      {typeof course.description === 'string' && course.description.length > 0 ? (
        <Text style={styles.courseDescription} numberOfLines={2}>
          {course.description}
        </Text>
      ) : null}

      <View style={styles.courseMetaRow}>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons
            name="book-open-page-variant"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.metaChipText}>
            {course.completed_lessons}/{course.total_lessons} {tr('courses.lessons')}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialCommunityIcons
            name="calendar-range"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.metaChipText}>{tr('courses.enrolled')}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} />
        </View>
        <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
      </View>

      <TouchableOpacity style={[styles.courseAction, { borderColor: `${accent}40` }]} onPress={onPress}>
        <Text style={[styles.courseActionText, { color: accent }]}>
          {progress > 0 ? tr('courses.continueCourse') : tr('courses.startCourse')}
        </Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={accent} />
      </TouchableOpacity>
    </GlassCard>
  );
};

const createStyles = (theme: ExtendedTheme, isDark: boolean) =>
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
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
      backgroundColor: theme.background,
    },
    stateCard: {
      width: '100%',
      borderRadius: 24,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 6,
      textAlign: 'center',
    },
    stateText: {
      ...theme.typography.body2,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: theme.spacing.sm,
      borderRadius: 12,
      backgroundColor: theme.colors.primary500,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    retryButtonText: {
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
      fontSize: 27,
      fontWeight: '800',
      lineHeight: 33,
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
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.88)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    spotlightCopy: {
      flex: 1,
    },
    spotlightTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    spotlightCourse: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    spotlightInstructor: {
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
      borderRadius: 12,
      backgroundColor: theme.colors.primary500,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 9,
    },
    spotlightButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
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
    list: {
      gap: theme.spacing.md,
    },
    courseCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderRadius: 18,
    },
    courseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    courseIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    courseTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    courseInstructor: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    courseLevelBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    courseLevelText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    courseDescription: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    courseMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      paddingVertical: 7,
      paddingHorizontal: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    metaChipText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    progressBar: {
      flex: 1,
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(148,163,184,0.24)' : 'rgba(148,163,184,0.28)',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      minWidth: 40,
      textAlign: 'right',
    },
    courseAction: {
      marginTop: theme.spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.86)',
    },
    courseActionText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });

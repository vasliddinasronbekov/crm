// apps/student-app-v2/src/screens/CoursesScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@eduvoice/mobile-ui';
import { coursesApi, Course } from '@eduvoice/mobile-shared';
import { AppStackParamList } from '../navigation/types';

type CoursesNavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const CoursesScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<CoursesNavigationProp>();

  // Fetch enrolled courses
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

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('courses.loadingCourses')}</Text>
      </View>
    );
  }

  // Show error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={theme.colors.error500} />
        <Text style={styles.errorTitle}>{t('courses.errorLoadingCourses')}</Text>
        <Text style={styles.errorMessage}>
          {error instanceof Error ? error.message : t('courses.errorLoadingCourses')}
        </Text>
      </View>
    );
  }

  // Ensure courses is an array
  const coursesList = Array.isArray(courses) ? courses : [];

  // Show empty state
  if (coursesList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="book-open-variant" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('courses.noCourses')}</Text>
        <Text style={styles.emptyMessage}>You haven't enrolled in any courses yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.colors.primary500}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('courses.myCourses')}</Text>
        <Text style={styles.headerSubtitle}>
          {coursesList.length} {coursesList.length === 1 ? 'course' : 'courses'}
        </Text>
      </View>

      {/* Courses List */}
      <View style={styles.coursesContainer}>
        {coursesList.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onPress={() => navigation.navigate('CourseDetail', { courseId: Number(course.id) })}
          />
        ))}
      </View>
    </ScrollView>
  );
};

// Course Card Component
interface CourseCardProps {
  course: Course;
  onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onPress }) => {
  const { t } = useTranslation();

  return (
    <TouchableOpacity style={styles.courseCard} onPress={onPress} activeOpacity={0.7}>
      {/* Course Header */}
      <View style={styles.courseHeader}>
        <View style={styles.courseIcon}>
          <MaterialCommunityIcons name="school" size={32} color={theme.colors.primary500} />
        </View>
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={styles.courseInstructor} numberOfLines={1}>
            {course.instructor}
          </Text>
        </View>
      </View>

      {/* Course Description */}
      {course.description && (
        <Text style={styles.courseDescription} numberOfLines={2}>
          {course.description}
        </Text>
      )}

      {/* Course Meta */}
      <View style={styles.courseMeta}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="signal" size={16} color={theme.colors.gray600} />
          <Text style={styles.metaText}>{course.level}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="book-open-page-variant" size={16} color={theme.colors.gray600} />
          <Text style={styles.metaText}>
            {course.completed_lessons}/{course.total_lessons} {t('courses.lessons')}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(course.progress)}%</Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <Text style={styles.actionButtonText}>
          {course.progress > 0 ? t('courses.continueCourse') : t('courses.startCourse')}
        </Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.primary500} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray50,
  },
  errorTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.error500,
  },
  errorMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray50,
  },
  emptyTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.lg,
    color: theme.colors.gray700,
  },
  emptyMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    ...theme.typography.h1,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  coursesContainer: {
    padding: theme.spacing.md,
  },
  courseCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  courseHeader: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  courseIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    ...theme.typography.h3,
    marginBottom: 4,
  },
  courseInstructor: {
    ...theme.typography.body,
    color: theme.colors.gray600,
  },
  courseDescription: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.md,
  },
  courseMeta: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginLeft: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.success500,
    borderRadius: 4,
  },
  progressText: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: theme.spacing.sm,
  },
  actionButtonText: {
    ...theme.typography.body,
    color: theme.colors.primary500,
    fontWeight: '600',
    marginRight: theme.spacing.xs,
  },
});

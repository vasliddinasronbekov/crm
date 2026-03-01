import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { coursesApi, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { getCourseRoadmap, type CourseRoadmapLesson } from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type CourseDetailRouteProp = RouteProp<AppStackParamList, 'CourseDetail'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const getViewerType = (lessonType?: string) => {
  if (lessonType === 'video' || lessonType === 'book' || lessonType === 'article') {
    return lessonType;
  }
  if (lessonType === 'text') {
    return 'article';
  }
  return undefined;
};

export const CourseDetailScreen = () => {
  const route = useRoute<CourseDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { courseId } = route.params;
  const [expandedModuleId, setExpandedModuleId] = useState<number | null>(null);

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseDetails(String(courseId)),
  });

  const roadmapQuery = useQuery({
    queryKey: ['course-roadmap', courseId],
    queryFn: () => getCourseRoadmap(courseId),
  });

  const isLoading = courseQuery.isLoading || roadmapQuery.isLoading;
  const isRefreshing = courseQuery.isRefetching || roadmapQuery.isRefetching;

  const modules = roadmapQuery.data?.modules || [];
  const totalLessons = modules.reduce((sum, module) => sum + module.lesson_count, 0);
  const completedLessons = modules.reduce((sum, module) => sum + module.completed_lessons, 0);
  const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const progressWidth = `${completionPercentage}%` as DimensionValue;

  const openLesson = (lesson: CourseRoadmapLesson) => {
    if (lesson.is_locked) {
      Alert.alert('Lesson locked', lesson.unlock_reason || 'Complete the required lessons to unlock this step.');
      return;
    }

    navigation.navigate('LessonViewer', {
      lessonId: lesson.id,
      initialType: getViewerType(lesson.lesson_type),
    });
  };

  if (isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading course roadmap...</Text>
      </View>
    );
  }

  if (!roadmapQuery.data) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Course unavailable</Text>
        <Text style={styles.stateText}>The learning path could not be loaded.</Text>
      </View>
    );
  }

  const continueLesson = modules
    .flatMap((module) => module.lessons)
    .find((lesson) => lesson.id === roadmapQuery.data?.continue_lesson_id);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void courseQuery.refetch();
            void roadmapQuery.refetch();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="school-outline" size={28} color={theme.colors.primary500} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{courseQuery.data?.title || roadmapQuery.data.course_name}</Text>
            <Text style={styles.heroSubtitle}>
              {courseQuery.data?.description || 'Structured path with previews, module unlocks, and guided progress.'}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="bookmark-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.metaText}>{totalLessons} lessons</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="chart-line" size={16} color={theme.textSecondary} />
            <Text style={styles.metaText}>{completionPercentage}% complete</Text>
          </View>
          {courseQuery.data?.level ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="signal" size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>{courseQuery.data.level}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {continueLesson ? (
          <TouchableOpacity style={styles.continueButton} onPress={() => openLesson(continueLesson)} activeOpacity={0.9}>
            <MaterialCommunityIcons name="play-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.continueButtonText}>Continue learning</Text>
          </TouchableOpacity>
        ) : null}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Learning Path</Text>
        <Text style={styles.sectionSubtitle}>Modules unlock in order. Preview lessons stay open from the start.</Text>
      </View>

      {modules.map((module, index) => {
        const isExpanded = expandedModuleId === module.id || (expandedModuleId === null && index === 0);
        const moduleProgressWidth = `${Math.max(0, Math.min(100, module.completion_percentage))}%` as DimensionValue;

        return (
          <GlassCard key={module.id} style={styles.moduleCard}>
            <TouchableOpacity
              style={styles.moduleHeader}
              onPress={() => setExpandedModuleId((current) => (current === module.id ? null : module.id))}
              activeOpacity={0.9}
            >
              <View style={styles.moduleHeaderCopy}>
                <View style={styles.moduleTitleRow}>
                  <Text style={styles.moduleEyebrow}>Module {index + 1}</Text>
                  {module.is_free_preview ? (
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>Preview</Text>
                    </View>
                  ) : null}
                  {module.is_locked ? (
                    <View style={styles.lockBadge}>
                      <MaterialCommunityIcons name="lock-outline" size={14} color="#f59e0b" />
                      <Text style={styles.lockBadgeText}>Locked</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleDescription}>
                  {module.is_locked ? module.unlock_reason || 'Complete the previous module first.' : module.description || 'Module ready to study.'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.moduleStatsRow}>
              <Text style={styles.moduleStatsText}>{module.completed_lessons}/{module.lesson_count} lessons done</Text>
              <Text style={styles.moduleStatsText}>{Math.round(module.completion_percentage)}%</Text>
            </View>
            <View style={styles.progressTrackSecondary}>
              <View style={[styles.progressFillSecondary, { width: moduleProgressWidth }]} />
            </View>

            {isExpanded ? (
              <View style={styles.lessonList}>
                {module.lessons.map((lesson) => {
                  const completion = lesson.student_progress?.completion_percentage || 0;
                  const lessonProgressWidth = `${Math.max(0, Math.min(100, completion))}%` as DimensionValue;
                  const isContinueTarget = roadmapQuery.data?.continue_lesson_id === lesson.id;

                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      style={[styles.lessonRow, lesson.is_locked && styles.lessonRowLocked]}
                      onPress={() => openLesson(lesson)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.lessonIconWrap}>
                        <MaterialCommunityIcons
                          name={
                            completion >= 100
                              ? 'check-circle'
                              : lesson.is_locked
                              ? 'lock-outline'
                              : lesson.lesson_type === 'video'
                              ? 'play-circle-outline'
                              : lesson.lesson_type === 'book'
                              ? 'book-open-page-variant-outline'
                              : lesson.lesson_type === 'quiz'
                              ? 'help-circle-outline'
                              : lesson.lesson_type === 'assignment'
                              ? 'clipboard-text-outline'
                              : 'file-document-outline'
                          }
                          size={20}
                          color={completion >= 100 ? '#22c55e' : lesson.is_locked ? '#f59e0b' : theme.colors.primary500}
                        />
                      </View>
                      <View style={styles.lessonCopy}>
                        <View style={styles.lessonTitleRow}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          {lesson.is_free_preview ? <Text style={styles.lessonTag}>Preview</Text> : null}
                          {isContinueTarget ? <Text style={styles.lessonTagPrimary}>Continue</Text> : null}
                        </View>
                        <Text style={styles.lessonMeta}>
                          {lesson.is_locked
                            ? lesson.unlock_reason || 'Locked'
                            : completion >= 100
                            ? 'Completed'
                            : completion > 0
                            ? `${completion}% completed`
                            : lesson.lesson_type_display || lesson.lesson_type}
                        </Text>
                        <View style={styles.lessonProgressTrack}>
                          <View style={[styles.lessonProgressFill, { width: lessonProgressWidth }]} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </GlassCard>
        );
      })}
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
      gap: 16,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.background,
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
    heroCard: {
      padding: 20,
      borderRadius: 30,
      gap: 16,
    },
    heroHeader: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
    },
    heroCopy: {
      flex: 1,
      gap: 6,
    },
    heroTitle: {
      ...theme.typography.h2,
      color: theme.text,
    },
    heroSubtitle: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
    },
    metaText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#7c3aed',
    },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    continueButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    sectionHeader: {
      gap: 4,
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    sectionSubtitle: {
      ...theme.typography.body,
      color: theme.textSecondary,
    },
    moduleCard: {
      padding: 18,
      borderRadius: 28,
      gap: 12,
    },
    moduleHeader: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    moduleHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    moduleTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    moduleEyebrow: {
      ...theme.typography.caption,
      color: '#7c3aed',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    previewBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(34,197,94,0.16)',
    },
    previewBadgeText: {
      ...theme.typography.caption,
      color: '#16a34a',
      fontWeight: '700',
    },
    lockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(245,158,11,0.14)',
    },
    lockBadgeText: {
      ...theme.typography.caption,
      color: '#f59e0b',
      fontWeight: '700',
    },
    moduleTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    moduleDescription: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    moduleStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    moduleStatsText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    progressTrackSecondary: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    progressFillSecondary: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#7c3aed',
    },
    lessonList: {
      gap: 10,
      marginTop: 4,
    },
    lessonRow: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.68)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
    },
    lessonRowLocked: {
      opacity: 0.8,
    },
    lessonIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
    },
    lessonCopy: {
      flex: 1,
      gap: 6,
    },
    lessonTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    lessonTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
      flexShrink: 1,
    },
    lessonTag: {
      ...theme.typography.caption,
      color: '#16a34a',
      fontWeight: '700',
    },
    lessonTagPrimary: {
      ...theme.typography.caption,
      color: '#7c3aed',
      fontWeight: '700',
    },
    lessonMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    lessonProgressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    lessonProgressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#7c3aed',
    },
  });

// apps/student-app-v2/src/screens/LibraryScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { theme } from '@eduvoice/mobile-ui';
import { lessonService } from '@eduvoice/mobile-shared';
import type { AppStackParamList } from '../navigation/types';
import type { Lesson } from '../types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface ResourceCategory {
  id: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  screen: keyof AppStackParamList;
  color: string;
  count?: number;
}

export const LibraryScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Fetch lesson counts by type
  const { data: lessons, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['library-stats'],
    queryFn: async () => {
      const response = await lessonService.getLessons({ page_size: 1000 });
      return response.results || [];
    },
  });

  // Calculate counts by lesson type (memoized for performance)
  const counts = React.useMemo(() => {
    if (!lessons) return { video: 0, book: 0, article: 0 };

    // Use reduce for single-pass iteration (more efficient than 3 filters)
    return lessons.reduce(
      (acc: { video: number; book: number; article: number }, lesson: Lesson) => {
        if (lesson.lesson_type === 'video') acc.video++;
        else if (lesson.lesson_type === 'book') acc.book++;
        else if (lesson.lesson_type === 'article' || lesson.lesson_type === 'text') acc.article++;
        return acc;
      },
      { video: 0, book: 0, article: 0 }
    );
  }, [lessons]);

  const categories: ResourceCategory[] = [
    {
      id: 'courses',
      title: 'Courses',
      icon: 'school',
      screen: 'Courses',
      color: theme.colors.primary500,
    },
    {
      id: 'books',
      title: 'Books & eBooks',
      icon: 'book-open-variant',
      screen: 'Books',
      color: theme.colors.success500,
      count: counts.book,
    },
    {
      id: 'videos',
      title: 'Video Library',
      icon: 'video-box',
      screen: 'Videos',
      color: theme.colors.error500,
      count: counts.video,
    },
    {
      id: 'articles',
      title: 'Articles & Notes',
      icon: 'text-box-multiple-outline',
      screen: 'Articles',
      color: '#7c3aed',
      count: counts.article,
    },
    {
      id: 'quizzes',
      title: 'Practice Quizzes',
      icon: 'forum',
      screen: 'Quizzes',
      color: theme.colors.warning500,
    },
    {
      id: 'assignments',
      title: 'Assignments',
      icon: 'file-document-edit',
      screen: 'Assignments',
      color: theme.colors.secondary500,
    },
    {
      id: 'ielts',
      title: 'IELTS Preparation',
      icon: 'certificate',
      screen: 'IELTSPrep',
      color: '#0066CC',
    },
    {
      id: 'sat',
      title: 'SAT Preparation',
      icon: 'school-outline',
      screen: 'SATPrep',
      color: '#00A86B',
    },
  ];

  const handleCategoryPress = (screen: keyof AppStackParamList) => {
    navigation.navigate(screen as any);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>Loading library...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="library" size={40} color={theme.colors.primary500} />
        <Text style={styles.title}>Learning Library</Text>
        <Text style={styles.subtitle}>
          Explore courses, books, videos, and more
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={24}
            color={theme.colors.primary500}
          />
          <Text style={styles.statValue}>{counts.book}</Text>
          <Text style={styles.statLabel}>Books</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons
            name="video-box"
            size={24}
            color={theme.colors.error500}
          />
          <Text style={styles.statValue}>{counts.video}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons
            name="text"
            size={24}
            color={theme.colors.secondary500}
          />
          <Text style={styles.statValue}>{counts.article}</Text>
          <Text style={styles.statLabel}>Articles</Text>
        </View>
      </View>

      <View style={styles.categoriesContainer}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>

        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { borderLeftColor: category.color }]}
            onPress={() => handleCategoryPress(category.screen)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.categoryIconContainer, { backgroundColor: `${category.color}20` }]}
            >
              <MaterialCommunityIcons
                name={category.icon}
                size={32}
                color={category.color}
              />
            </View>

            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              {category.count !== undefined && (
                <Text style={styles.categoryCount}>
                  {category.count} {category.count === 1 ? 'item' : 'items'}
                </Text>
              )}
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.quickAccessContainer}>
        <Text style={styles.sectionTitle}>Quick Access</Text>

        <TouchableOpacity
          style={styles.quickAccessCard}
          onPress={() => navigation.navigate('IELTSPrep' as any)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="certificate"
            size={24}
            color={theme.colors.primary500}
          />
          <View style={styles.quickAccessInfo}>
            <Text style={styles.quickAccessTitle}>Continue IELTS Practice</Text>
            <Text style={styles.quickAccessSubtitle}>
              Pick up where you left off
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAccessCard}
          onPress={() => navigation.navigate('SATPrep' as any)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="school-outline"
            size={24}
            color={theme.colors.success500}
          />
          <View style={styles.quickAccessInfo}>
            <Text style={styles.quickAccessTitle}>Continue SAT Practice</Text>
            <Text style={styles.quickAccessSubtitle}>
              Prepare for your test
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    ...theme.typography.body1,
    color: theme.colors.gray600,
    marginTop: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.gray900,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body2,
    color: theme.colors.gray600,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
    marginTop: theme.spacing.xs,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: theme.spacing.xs / 2,
  },
  categoriesContainer: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    ...theme.shadows.sm,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
  },
  categoryCount: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: theme.spacing.xs / 2,
  },
  quickAccessContainer: {
    padding: theme.spacing.md,
  },
  quickAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  quickAccessInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  quickAccessTitle: {
    ...theme.typography.body1,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  quickAccessSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: theme.spacing.xs / 2,
  },
});

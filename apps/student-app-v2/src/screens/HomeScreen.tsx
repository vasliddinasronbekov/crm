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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { coursesApi, useAuthStore, useTheme } from '@eduvoice/mobile-shared';

import apiClient from '../api/apiClient';
import { FeatureCard } from '../components/app/FeatureCard';
import { GlassCard } from '../components/app/GlassCard';
import type { AppStackParamList } from '../navigation/types';

type HomeScreenNavigationProp = NativeStackNavigationProp<AppStackParamList>;

type HomeEvent = {
  id: number | string;
  title: string;
  date: string;
  time_start?: string;
  time_end?: string;
  location?: string | null;
};

const extractResults = (payload: any): HomeEvent[] => {
  if (Array.isArray(payload)) {
    return payload as HomeEvent[];
  }
  if (Array.isArray(payload?.results)) {
    return payload.results as HomeEvent[];
  }
  if (Array.isArray(payload?.data?.results)) {
    return payload.data.results as HomeEvent[];
  }
  return [];
};

const getEventTimestamp = (event: HomeEvent | undefined) => {
  if (event === undefined || event.date.length === 0) return Number.NaN;
  const startTime = event.time_start !== undefined && event.time_start.length > 0
    ? event.time_start
    : '00:00:00';
  const dateTime = `${event.date}T${startTime}`;
  return new Date(dateTime).getTime();
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuthStore();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const {
    data: events = [],
    refetch: refetchEvents,
    isRefetching,
    isLoading: eventsLoading,
  } = useQuery({
    queryKey: ['home-events'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/student-profile/events/');
      return extractResults(response.data);
    },
  });

  const { data: studentStats = {}, isLoading: studentStatsLoading } = useQuery({
    queryKey: ['home-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/student-profile/student/statistics/');
      return response.data ?? {};
    },
  });

  const { data: enrolledCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['home-courses'],
    queryFn: coursesApi.getEnrolledCourses,
  });

  const { data: profile = {} } = useQuery({
    queryKey: ['home-gamification-profile'],
    queryFn: async () => {
      try {
        const response = await apiClient.getGamificationProfile();
        return response.data ?? {};
      } catch (error) {
        return {};
      }
    },
  });

  const isLoading = eventsLoading || studentStatsLoading || coursesLoading;
  const coins = studentStats?.total_coins ?? profile?.coins ?? 0;
  const level = profile?.level ?? studentStats?.level ?? 1;
  const attendance = studentStats?.attendance_percentage ?? 0;

  const sortedEvents = useMemo(
    () =>
      [...events]
        .filter((event: HomeEvent) => !Number.isNaN(getEventTimestamp(event)))
        .sort((a: HomeEvent, b: HomeEvent) => getEventTimestamp(a) - getEventTimestamp(b)),
    [events],
  );

  const now = Date.now();
  const nextEvent = sortedEvents.find((event: HomeEvent) => getEventTimestamp(event) >= now) ?? sortedEvents[0];

  const quickActions = useMemo(
    () => [
      {
        title: t('home.studyFlow'),
        description: t('home.openLearn'),
        icon: 'book-education-outline' as const,
        accentColor: theme.colors.primary500,
        onPress: () => navigation.navigate('Courses'),
      },
      {
        title: t('home.examFlow'),
        description: t('home.openExams'),
        icon: 'clipboard-text-clock-outline' as const,
        accentColor: theme.colors.warning500,
        onPress: () => navigation.navigate('SATPrep'),
      },
      {
        title: t('home.groupsAction'),
        description: t('home.groupsActionCopy'),
        icon: 'account-group-outline' as const,
        accentColor: '#0ea5e9',
        onPress: () => navigation.navigate('Groups'),
      },
      {
        title: t('home.paymentsAction'),
        description: t('home.paymentsActionCopy'),
        icon: 'wallet-outline' as const,
        accentColor: '#16a34a',
        onPress: () => navigation.navigate('Payments'),
      },
    ],
    [navigation, t, theme.colors.primary500, theme.colors.warning500],
  );

  const miniActions = useMemo(
    () => [
      {
        key: 'library',
        label: t('widgets.library'),
        icon: 'library-shelves',
        onPress: () => navigation.navigate('Library'),
      },
      {
        key: 'ranking',
        label: t('home.rankingAction'),
        icon: 'trophy-outline',
        onPress: () => navigation.navigate('Ranking'),
      },
      {
        key: 'courses',
        label: t('widgets.courses'),
        icon: 'school-outline',
        onPress: () => navigation.navigate('Courses'),
      },
      {
        key: 'events',
        label: t('widgets.events'),
        icon: 'calendar-month-outline',
        onPress: () => navigation.navigate('Events'),
      },
    ],
    [navigation, t],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('home.loadingDashboard')}</Text>
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
            void refetchEvents();
          }}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={18}
              color={theme.colors.primary500}
            />
            <Text style={styles.heroBadgeText}>{t('home.dashboard')}</Text>
          </View>
          <View style={styles.heroAttendance}>
            <MaterialCommunityIcons
              name="check-decagram-outline"
              size={14}
              color={attendance >= 85 ? '#16a34a' : theme.colors.warning500}
            />
            <Text style={styles.heroAttendanceText}>{attendance}%</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          {t('home.hello', { name: user?.full_name ?? t('settings.studentRole') })}
        </Text>
        <Text style={styles.heroSubtitle}>{t('home.readyTitle')}</Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{level}</Text>
            <Text style={styles.heroStatLabel}>{t('home.levelLabel')}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{coins}</Text>
            <Text style={styles.heroStatLabel}>{t('home.coinsAvailable')}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{enrolledCourses.length}</Text>
            <Text style={styles.heroStatLabel}>{t('home.activeCourses')}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.nextCard}>
        <View style={styles.sectionInlineHeader}>
          <Text style={styles.sectionInlineTitle}>{t('home.upcomingEvents')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Events')} activeOpacity={0.9}>
            <Text style={styles.sectionInlineAction}>{t('common.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {nextEvent !== undefined ? (
          <View style={styles.nextEventBody}>
            <View style={styles.nextEventDate}>
              <Text style={styles.nextEventDay}>{new Date(nextEvent.date).getDate()}</Text>
              <Text style={styles.nextEventMonth}>
                {new Date(nextEvent.date).toLocaleString(undefined, { month: 'short' })}
              </Text>
            </View>
            <View style={styles.nextEventMeta}>
              <Text style={styles.nextEventTitle} numberOfLines={1}>
                {nextEvent.title}
              </Text>
              <Text style={styles.nextEventTime} numberOfLines={1}>
                {nextEvent.time_start} - {nextEvent.time_end}
              </Text>
              <Text style={styles.nextEventLocation} numberOfLines={1}>
                {nextEvent.location ?? t('home.eventOnline')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.nextEventOpen}
              onPress={() => navigation.navigate('Events')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.primary500}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyNextEvent}>
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={20}
              color={theme.textSecondary}
            />
            <Text style={styles.emptyNextEventText}>{t('home.noUpcomingEvents')}</Text>
          </View>
        )}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <Text style={styles.sectionSubtitle}>{t('home.readySubtitle')}</Text>
      </View>

      <View style={styles.quickActionGrid}>
        {quickActions.map((action) => (
          <FeatureCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            accentColor={action.accentColor}
            onPress={action.onPress}
            style={styles.quickActionItem}
          />
        ))}
      </View>

      <View style={styles.miniActionRow}>
        {miniActions.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={item.onPress}
            style={styles.miniAction}
            activeOpacity={0.85}
          >
            <View style={styles.miniActionIcon}>
              <MaterialCommunityIcons
                name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={18}
                color={theme.colors.primary500}
              />
            </View>
            <Text style={styles.miniActionLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
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
      backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(219,234,254,0.82)',
    },
    heroBadgeText: {
      color: theme.colors.primary500,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    heroAttendance: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(30,41,59,0.64)' : 'rgba(241,245,249,0.95)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    heroAttendanceText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    heroTitle: {
      color: theme.text,
      fontSize: 27,
      fontWeight: '800',
      lineHeight: 34,
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
      backgroundColor: isDark ? 'rgba(15,23,42,0.56)' : 'rgba(248,250,252,0.9)',
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
    nextCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    sectionInlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionInlineTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    sectionInlineAction: {
      color: theme.colors.primary500,
      fontSize: 13,
      fontWeight: '700',
    },
    nextEventBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(2,6,23,0.36)' : 'rgba(248,250,252,0.85)',
      padding: theme.spacing.md,
    },
    nextEventDate: {
      width: 58,
      height: 58,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.88)',
    },
    nextEventDay: {
      color: theme.colors.primary500,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 21,
    },
    nextEventMonth: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginTop: 2,
    },
    nextEventMeta: {
      flex: 1,
    },
    nextEventTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    nextEventTime: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    nextEventLocation: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    nextEventOpen: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.88)',
    },
    emptyNextEvent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: theme.spacing.lg,
    },
    emptyNextEventText: {
      color: theme.textSecondary,
      fontSize: 14,
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
    quickActionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    quickActionItem: {
      width: '47%',
    },
    miniActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    miniAction: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(15,23,42,0.58)' : 'rgba(255,255,255,0.85)',
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    miniActionIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(219,234,254,0.85)',
    },
    miniActionLabel: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
  });

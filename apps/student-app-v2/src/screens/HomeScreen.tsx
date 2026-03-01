import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

const extractResults = (payload: any) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.data?.results)) {
    return payload.data.results;
  }
  return [];
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      return response.data || {};
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
        return response.data || {};
      } catch (error) {
        return {};
      }
    },
  });

  const isLoading = eventsLoading || studentStatsLoading || coursesLoading;
  const coins = studentStats?.total_coins ?? profile?.coins ?? 0;
  const level = profile?.level ?? studentStats?.level ?? 1;
  const rank = profile?.rank ?? '--';
  const attendance = studentStats?.attendance_percentage ?? 0;

  const quickActions = [
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
      accentColor: '#0891b2',
      onPress: () => navigation.navigate('Groups'),
    },
    {
      title: t('home.rankingAction'),
      description: t('home.rankingActionCopy'),
      icon: 'trophy-outline' as const,
      accentColor: '#7c3aed',
      onPress: () => navigation.navigate('Ranking'),
    },
    {
      title: t('home.paymentsAction'),
      description: t('home.paymentsActionCopy'),
      icon: 'wallet-outline' as const,
      accentColor: '#16a34a',
      onPress: () => navigation.navigate('Payments'),
    },
    {
      title: t('home.libraryAction'),
      description: t('home.libraryActionCopy'),
      icon: 'library-shelves' as const,
      accentColor: '#ea580c',
      onPress: () => navigation.navigate('Library'),
    },
  ];

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
          onRefresh={refetchEvents}
          tintColor={theme.colors.primary500}
        />
      }
    >
      <GlassCard style={styles.hero}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons
            name="school-outline"
            size={28}
            color={theme.colors.primary500}
          />
        </View>
        <Text style={styles.greeting}>
          {t('home.hello', { name: user?.full_name || t('settings.studentRole') })}
        </Text>
        <Text style={styles.subtitle}>{t('home.readyTitle')}</Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaPill}>
            <Text style={styles.heroMetaValue}>{level}</Text>
            <Text style={styles.heroMetaLabel}>{t('home.levelLabel')}</Text>
          </View>
          <View style={styles.heroMetaPill}>
            <Text style={styles.heroMetaValue}>#{rank}</Text>
            <Text style={styles.heroMetaLabel}>{t('home.yourRank')}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.statsGrid}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{enrolledCourses.length}</Text>
          <Text style={styles.statLabel}>{t('home.activeCourses')}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{coins}</Text>
          <Text style={styles.statLabel}>{t('home.coinsAvailable')}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{events.length}</Text>
          <Text style={styles.statLabel}>{t('home.scheduledEvents')}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{attendance}%</Text>
          <Text style={styles.statLabel}>{t('home.attendanceLabel')}</Text>
        </GlassCard>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <Text style={styles.sectionSubtitle}>{t('home.readySubtitle')}</Text>
      </View>

      <View style={styles.actionGrid}>
        {quickActions.map((action) => (
          <FeatureCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            accentColor={action.accentColor}
            onPress={action.onPress}
            style={styles.actionItem}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.upcomingEvents')}</Text>
        <Text style={styles.sectionSubtitle}>{t('home.eventsSubtitle')}</Text>
      </View>

      <View style={styles.eventsList}>
        {events.length > 0 ? (
          events.slice(0, 3).map((event: any) => (
            <GlassCard key={event.id} style={styles.eventCard}>
              <View style={styles.eventDateBadge}>
                <Text style={styles.eventDay}>{new Date(event.date).getDate()}</Text>
                <Text style={styles.eventMonth}>
                  {new Date(event.date).toLocaleString(undefined, { month: 'short' })}
                </Text>
              </View>
              <View style={styles.eventContent}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {event.time_start} - {event.time_end}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {event.location || t('home.eventOnline')}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyEvents}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={32}
              color={theme.textSecondary}
            />
            <Text style={styles.emptyEventsText}>{t('home.noUpcomingEvents')}</Text>
          </GlassCard>
        )}
      </View>

      <GlassCard style={styles.footerCard}>
        <Text style={styles.footerTitle}>{t('home.keepMomentumTitle')}</Text>
        <Text style={styles.footerSubtitle}>{t('home.keepMomentum')}</Text>
        <View style={styles.footerActions}>
          <FeatureCard
            title={t('home.studyFlow')}
            description={t('home.openLearn')}
            icon="school-outline"
            accentColor={theme.colors.primary500}
            onPress={() => navigation.navigate('Courses')}
            style={styles.footerAction}
          />
          <FeatureCard
            title={t('home.examFlow')}
            description={t('home.openExams')}
            icon="timer-outline"
            accentColor={theme.colors.warning500}
            onPress={() => navigation.navigate('SATPrep')}
            style={styles.footerAction}
          />
        </View>
      </GlassCard>
    </ScrollView>
  );
};

const createStyles = (theme: any) =>
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
    hero: {
      padding: theme.spacing.lg,
    },
    heroBadge: {
      width: 56,
      height: 56,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primaryContainer,
      marginBottom: theme.spacing.md,
    },
    greeting: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: theme.spacing.sm,
    },
    heroMetaRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    heroMetaPill: {
      flex: 1,
      padding: theme.spacing.md,
      borderRadius: 18,
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(59,130,246,0.18)',
    },
    heroMetaValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    heroMetaLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    statCard: {
      width: '47%',
      padding: theme.spacing.md,
    },
    statValue: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 6,
    },
    sectionHeader: {
      marginTop: theme.spacing.sm,
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
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    actionItem: {
      width: '47%',
    },
    eventsList: {
      gap: theme.spacing.md,
    },
    eventCard: {
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    eventDateBadge: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: theme.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventDay: {
      color: theme.colors.primary500,
      fontSize: 20,
      fontWeight: '800',
    },
    eventMonth: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    eventContent: {
      flex: 1,
    },
    eventTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    eventMeta: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    emptyEvents: {
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    emptyEventsText: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    footerCard: {
      padding: theme.spacing.lg,
    },
    footerTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    footerSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: theme.spacing.sm,
    },
    footerActions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    footerAction: {
      flex: 1,
    },
  });

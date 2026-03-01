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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@eduvoice/mobile-shared';

import apiClient from '../api/apiClient';
import { FeatureCard } from '../components/app/FeatureCard';
import { GlassCard } from '../components/app/GlassCard';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

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

export const ExamsHubScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const studentStatsQuery = useQuery({
    queryKey: ['exam-hub-stats'],
    queryFn: async () => {
      const response = await apiClient.getStudentStatistics();
      return response.data || {};
    },
  });

  const satExamsQuery = useQuery({
    queryKey: ['exam-hub-sat-exams'],
    queryFn: async () => {
      const response = await apiClient.getSATExams();
      return extractResults(response.data);
    },
  });

  const satAttemptsQuery = useQuery({
    queryKey: ['exam-hub-sat-attempts'],
    queryFn: async () => {
      const response = await apiClient.getMySATAttempts();
      return extractResults(response.data);
    },
  });

  const ieltsExamsQuery = useQuery({
    queryKey: ['exam-hub-ielts-exams'],
    queryFn: async () => {
      const response = await apiClient.getIELTSExams();
      return extractResults(response.data);
    },
  });

  const ieltsAttemptsQuery = useQuery({
    queryKey: ['exam-hub-ielts-attempts'],
    queryFn: async () => {
      const response = await apiClient.getIELTSAttempts();
      return extractResults(response.data);
    },
  });

  const isLoading =
    studentStatsQuery.isLoading ||
    satExamsQuery.isLoading ||
    satAttemptsQuery.isLoading ||
    ieltsExamsQuery.isLoading ||
    ieltsAttemptsQuery.isLoading;

  const isRefreshing =
    studentStatsQuery.isRefetching ||
    satExamsQuery.isRefetching ||
    satAttemptsQuery.isRefetching ||
    ieltsExamsQuery.isRefetching ||
    ieltsAttemptsQuery.isRefetching;

  const firstIELTSExamBySection = useMemo(() => {
    const map: Record<string, any> = {};
    for (const exam of ieltsExamsQuery.data || []) {
      if (!map[exam.section]) {
        map[exam.section] = exam;
      }
    }
    return map;
  }, [ieltsExamsQuery.data]);

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const totalAttempts =
    (satAttemptsQuery.data || []).length + (ieltsAttemptsQuery.data || []).length;

  const openIELTSSection = (
    section: 'reading' | 'listening' | 'writing' | 'speaking'
  ) => {
    const exam = firstIELTSExamBySection[section];

    if (!exam) {
      navigation.navigate('IELTSPrep');
      return;
    }

    if (section === 'reading') {
      navigation.navigate('IELTSReading', { examId: exam.id });
      return;
    }
    if (section === 'listening') {
      navigation.navigate('IELTSListening', { examId: exam.id });
      return;
    }
    if (section === 'writing') {
      navigation.navigate('IELTSWriting', { examId: exam.id });
      return;
    }

    navigation.navigate('IELTSSpeaking', { examId: exam.id });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void studentStatsQuery.refetch();
            void satExamsQuery.refetch();
            void satAttemptsQuery.refetch();
            void ieltsExamsQuery.refetch();
            void ieltsAttemptsQuery.refetch();
          }}
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
        <Text style={styles.heroTitle}>{t('exams.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('exams.subtitle')}</Text>
        <View style={styles.metricRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricValue}>{studentStatsQuery.data?.total_coins || 0}</Text>
            <Text style={styles.metricLabel}>{t('exams.coins')}</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricValue}>{totalAttempts}</Text>
            <Text style={styles.metricLabel}>{t('exams.attempts')}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{(satExamsQuery.data || []).length}</Text>
          <Text style={styles.statLabel}>{t('exams.availableSAT')}</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{(ieltsExamsQuery.data || []).length}</Text>
          <Text style={styles.statLabel}>{t('exams.availableIELTS')}</Text>
        </GlassCard>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('exams.fullMock')}</Text>
        <Text style={styles.sectionSubtitle}>{t('exams.atmosphereHint')}</Text>
      </View>

      <View style={styles.grid}>
        <FeatureCard
          title={t('exams.satFullMock')}
          description={t('exams.satDescription')}
          icon="timer-sand-complete"
          accentColor={theme.colors.primary500}
          badge={`${(satExamsQuery.data || []).length}`}
          onPress={() => navigation.navigate('SATPrep')}
          style={styles.gridItem}
        />
        <FeatureCard
          title={t('exams.ieltsTitle')}
          description={t('exams.ieltsDescription')}
          icon="headphones-box"
          accentColor={theme.colors.warning500}
          badge={`${(ieltsExamsQuery.data || []).length}`}
          onPress={() => navigation.navigate('IELTSPrep')}
          style={styles.gridItem}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('exams.sectionPractice')}</Text>
        <Text style={styles.sectionSubtitle}>{t('exams.realAtmosphere')}</Text>
      </View>

      <View style={styles.grid}>
        <FeatureCard
          title={t('exams.reading')}
          description={t('exams.sectionReadingCopy')}
          icon="book-open-page-variant-outline"
          accentColor="#2563eb"
          onPress={() => openIELTSSection('reading')}
          style={styles.gridItem}
        />
        <FeatureCard
          title={t('exams.listening')}
          description={t('exams.sectionListeningCopy')}
          icon="headphones"
          accentColor="#0891b2"
          onPress={() => openIELTSSection('listening')}
          style={styles.gridItem}
        />
        <FeatureCard
          title={t('exams.writing')}
          description={t('exams.sectionWritingCopy')}
          icon="pencil-box-outline"
          accentColor="#7c3aed"
          onPress={() => openIELTSSection('writing')}
          style={styles.gridItem}
        />
        <FeatureCard
          title={t('exams.speaking')}
          description={t('exams.sectionSpeakingCopy')}
          icon="microphone-outline"
          accentColor="#ea580c"
          onPress={() => openIELTSSection('speaking')}
          style={styles.gridItem}
        />
      </View>

      <GlassCard style={styles.atmosphereCard}>
        <View style={styles.atmosphereHeader}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={20}
            color={theme.colors.primary500}
          />
          <Text style={styles.atmosphereTitle}>{t('exams.realAtmosphere')}</Text>
        </View>
        <Text style={styles.atmosphereItem}>- {t('exams.atmosphereRuleTiming')}</Text>
        <Text style={styles.atmosphereItem}>- {t('exams.atmosphereRuleRecovery')}</Text>
        <Text style={styles.atmosphereItem}>- {t('exams.atmosphereRuleAdaptive')}</Text>
      </GlassCard>

      <GlassCard style={styles.attemptsCard}>
        <View style={styles.atmosphereHeader}>
          <MaterialCommunityIcons name="history" size={20} color={theme.colors.primary500} />
          <Text style={styles.atmosphereTitle}>{t('exams.attempts')}</Text>
        </View>
        <Text style={styles.attemptsValue}>{totalAttempts}</Text>
        <Text style={styles.attemptsHint}>
          {totalAttempts > 0 ? t('exams.attemptsReady') : t('exams.noAttemptsYet')}
        </Text>
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
    heroTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: theme.spacing.sm,
    },
    metricRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    metricPill: {
      flex: 1,
      borderRadius: 18,
      padding: theme.spacing.md,
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(59,130,246,0.16)',
    },
    metricValue: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    statCard: {
      flex: 1,
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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    gridItem: {
      width: '47%',
    },
    atmosphereCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    atmosphereHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    atmosphereTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    atmosphereItem: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    attemptsCard: {
      padding: theme.spacing.lg,
    },
    attemptsValue: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
      marginTop: theme.spacing.sm,
    },
    attemptsHint: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      marginTop: theme.spacing.xs,
    },
  });

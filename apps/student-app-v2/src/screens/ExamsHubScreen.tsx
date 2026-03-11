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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@eduvoice/mobile-shared';

import apiClient from '../api/apiClient';
import { FeatureCard } from '../components/app/FeatureCard';
import { GlassCard } from '../components/app/GlassCard';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type IELTSSection = 'reading' | 'listening' | 'writing' | 'speaking';

type ExamSummary = {
  id: number;
  title?: string;
  section?: IELTSSection;
  question_count?: number;
  total_points?: number;
};

const extractResults = (payload: any): ExamSummary[] => {
  if (Array.isArray(payload)) {
    return payload as ExamSummary[];
  }
  if (Array.isArray(payload?.results)) {
    return payload.results as ExamSummary[];
  }
  if (Array.isArray(payload?.data?.results)) {
    return payload.data.results as ExamSummary[];
  }
  return [];
};

export const ExamsHubScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const studentStatsQuery = useQuery({
    queryKey: ['exam-hub-stats'],
    queryFn: async () => {
      const response = await apiClient.getStudentStatistics();
      return response.data ?? {};
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
    const map: Partial<Record<IELTSSection, ExamSummary>> = {};

    for (const exam of ieltsExamsQuery.data ?? []) {
      if (exam.section === undefined) continue;
      const sectionKey = exam.section;
      if (map[sectionKey] === undefined) {
        map[sectionKey] = exam;
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

  const satExams = satExamsQuery.data ?? [];
  const ieltsExams = ieltsExamsQuery.data ?? [];
  const satAttempts = satAttemptsQuery.data ?? [];
  const ieltsAttempts = ieltsAttemptsQuery.data ?? [];

  const totalAttempts = satAttempts.length + ieltsAttempts.length;
  const coins = studentStatsQuery.data?.total_coins ?? 0;

  const openIELTSSection = (section: IELTSSection) => {
    const exam = firstIELTSExamBySection[section];

    if (exam === undefined) {
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
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={16}
              color={theme.colors.primary500}
            />
            <Text style={styles.heroBadgeText}>Exam Workspace</Text>
          </View>
          <View style={styles.coinPill}>
            <MaterialCommunityIcons
              name="star-circle-outline"
              size={14}
              color={theme.colors.warning500}
            />
            <Text style={styles.coinPillText}>{coins}</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>{t('exams.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('exams.subtitle')}</Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{satExams.length}</Text>
            <Text style={styles.heroStatLabel}>SAT exams</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{ieltsExams.length}</Text>
            <Text style={styles.heroStatLabel}>IELTS sections</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{totalAttempts}</Text>
            <Text style={styles.heroStatLabel}>{t('exams.attempts')}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.readinessCard}>
        <View style={styles.readinessHeader}>
          <View style={styles.readinessIcon}>
            <MaterialCommunityIcons
              name="rocket-launch-outline"
              size={18}
              color={theme.colors.primary500}
            />
          </View>
          <View style={styles.readinessCopy}>
            <Text style={styles.readinessTitle}>Next best action</Text>
            <Text style={styles.readinessSubtitle}>
              {satExams.length > 0
                ? 'Start a SAT full mock with strict timing.'
                : 'Open IELTS section practice and build momentum.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.readinessButton}
          onPress={() => {
            if (satExams.length > 0) {
              navigation.navigate('SATPrep');
              return;
            }
            navigation.navigate('IELTSPrep');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.readinessButtonText}>Open now</Text>
        </TouchableOpacity>
      </GlassCard>

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
          badge={`${satExams.length}`}
          onPress={() => navigation.navigate('SATPrep')}
          style={styles.gridItem}
        />
        <FeatureCard
          title={t('exams.ieltsTitle')}
          description={t('exams.ieltsDescription')}
          icon="headphones-box"
          accentColor={theme.colors.warning500}
          badge={`${ieltsExams.length}`}
          onPress={() => navigation.navigate('IELTSPrep')}
          style={styles.gridItem}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('exams.sectionPractice')}</Text>
        <Text style={styles.sectionSubtitle}>Open a section directly and keep exam rhythm.</Text>
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

      <GlassCard style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={18}
            color={theme.colors.primary500}
          />
          <Text style={styles.insightTitle}>{t('exams.realAtmosphere')}</Text>
        </View>
        <Text style={styles.insightItem}>- {t('exams.atmosphereRuleTiming')}</Text>
        <Text style={styles.insightItem}>- {t('exams.atmosphereRuleRecovery')}</Text>
        <Text style={styles.insightItem}>- {t('exams.atmosphereRuleAdaptive')}</Text>
      </GlassCard>

      <GlassCard style={styles.attemptCard}>
        <View style={styles.insightHeader}>
          <MaterialCommunityIcons
            name="history"
            size={18}
            color={theme.colors.primary500}
          />
          <Text style={styles.insightTitle}>{t('exams.attempts')}</Text>
        </View>
        <Text style={styles.attemptValue}>{totalAttempts}</Text>
        <Text style={styles.attemptHint}>
          {totalAttempts > 0 ? t('exams.attemptsReady') : t('exams.noAttemptsYet')}
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
    coinPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(30,41,59,0.62)' : 'rgba(241,245,249,0.92)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    coinPillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    heroTitle: {
      color: theme.text,
      fontSize: 27,
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
    readinessCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    readinessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    readinessIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(219,234,254,0.88)',
      borderWidth: 1,
      borderColor: theme.border,
    },
    readinessCopy: {
      flex: 1,
    },
    readinessTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    readinessSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    readinessButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: theme.colors.primary500,
    },
    readinessButtonText: {
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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    gridItem: {
      width: '47%',
    },
    insightCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    insightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    insightTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    insightItem: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    attemptCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    attemptValue: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
      marginTop: 4,
    },
    attemptHint: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
  });

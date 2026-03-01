import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ieltsApi, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import type { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList, 'IELTSResults'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const formatCriterionLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const IELTSResultsScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { attemptId } = route.params;

  const attemptQuery = useQuery({
    queryKey: ['ielts-attempt', attemptId],
    queryFn: () => ieltsApi.getAttempt(attemptId),
    refetchInterval: (query) => {
      const attempt = query.state.data;
      return attempt?.is_pending_evaluation ? 5000 : false;
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => ieltsApi.requestRefund(attemptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ielts-attempt', attemptId] });
      await queryClient.invalidateQueries({ queryKey: ['ielts-attempts'] });
    },
  });

  if (attemptQuery.isLoading || !attemptQuery.data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('exams.ieltsResults.loading')}</Text>
      </View>
    );
  }

  const attempt = attemptQuery.data;
  const section = attempt.exam_details.section;
  const sectionLabel = t(`exams.${section}`);
  const sectionColorMap: Record<string, string> = {
    reading: '#2E7D32',
    listening: '#1976D2',
    writing: '#7B1FA2',
    speaking: '#E65100',
  };
  const accentColor = sectionColorMap[section] || theme.colors.primary500;
  const strengths = attempt.strengths_list || [];
  const weaknesses = attempt.weaknesses_list || [];
  const recommendations = attempt.recommendations_list || [];
  const rubricCards = attempt.rubric_cards || [];
  const feedbackItems = attempt.question_feedback || [];
  const responseFeedback = attempt.response_feedback || [];
  const numericBand = Number.parseFloat(attempt.band_score || '0');
  const passingBand = Number.parseFloat(attempt.exam_details.passing_band_score || '0');
  const gapToRefund = Number.isFinite(numericBand) && Number.isFinite(passingBand)
    ? Number((passingBand - numericBand).toFixed(1))
    : 0;
  const passed = !attempt.is_pending_evaluation && numericBand >= passingBand;
  const resultTone = passed ? '#22c55e' : gapToRefund <= 0.5 ? '#f59e0b' : '#ef4444';
  const resultCopy = attempt.is_pending_evaluation
    ? t('exams.ieltsResults.statusPendingBody')
    : passed
      ? t('exams.ieltsResults.statusPassedBody', { band: attempt.exam_details.passing_band_score })
      : t('exams.ieltsResults.statusGapBody', { gap: Math.abs(gapToRefund).toFixed(1) });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ExamHeroCard
        eyebrow={t('exams.ieltsResults.eyebrow', { section: sectionLabel })}
        title={attempt.is_pending_evaluation ? t('exams.ieltsResults.heroPending') : t('exams.ieltsResults.heroBand', { score: attempt.band_score })}
        subtitle={attempt.exam_details.title}
        accentColor={accentColor}
        progress={attempt.is_pending_evaluation ? 45 : (parseFloat(attempt.band_score || '0') / 9) * 100}
        metrics={[
          { icon: 'chart-line', label: t('exams.ieltsResults.metricBand'), value: attempt.is_pending_evaluation ? t('exams.ieltsResults.metricPending') : `${attempt.band_score}/9` },
          { icon: 'clock-outline', label: t('exams.ieltsResults.metricTime'), value: `${Math.max(1, Math.floor((attempt.time_taken_seconds || 0) / 60))} min` },
          { icon: 'hand-coin', label: t('exams.ieltsResults.metricRefund'), value: attempt.coins_refunded > 0 ? `+${attempt.coins_refunded}` : attempt.can_refund ? t('exams.ieltsResults.metricAvailable') : t('exams.ieltsResults.metricLocked') },
        ]}
      />

      {attempt.is_pending_evaluation ? (
        <GlassCard style={styles.pendingCard}>
          <MaterialCommunityIcons name="robot-outline" size={28} color={accentColor} />
          <Text style={styles.pendingTitle}>{t('exams.ieltsResults.pendingTitle')}</Text>
          <Text style={styles.pendingText}>{t('exams.ieltsResults.pendingBody')}</Text>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.statusCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="target" size={22} color={resultTone} />
          <Text style={styles.cardTitle}>{t('exams.ieltsResults.statusTitle')}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: `${resultTone}18`, borderColor: `${resultTone}33` }]}>
            <Text style={[styles.statusPillText, { color: resultTone }]}>
              {attempt.is_pending_evaluation
                ? t('exams.ieltsResults.statusEvaluating')
                : passed
                  ? t('exams.ieltsResults.statusUnlocked')
                  : t('exams.ieltsResults.statusNeedsPush')}
            </Text>
          </View>
          {!attempt.is_pending_evaluation ? (
            <View style={styles.statusMetricWrap}>
              <Text style={styles.statusMetricLabel}>{t('exams.ieltsResults.statusTarget')}</Text>
              <Text style={styles.statusMetricValue}>{attempt.exam_details.passing_band_score}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardBody}>{resultCopy}</Text>
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="text-box-check-outline" size={22} color={accentColor} />
          <Text style={styles.cardTitle}>{t('exams.ieltsResults.overallFeedbackTitle')}</Text>
        </View>
        <Text style={styles.cardBody}>
          {attempt.overall_feedback || attempt.recommendations || t('exams.ieltsResults.overallPlaceholder')}
        </Text>
      </GlassCard>

      {rubricCards.length > 0 ? (
        <View style={styles.grid}>
          {rubricCards.map((card) => (
            <GlassCard key={card.key} style={styles.rubricCard}>
              <Text style={styles.rubricLabel}>{card.label}</Text>
              <Text style={[styles.rubricScore, { color: accentColor }]}>{Number(card.score || 0).toFixed(1)}</Text>
              <Text style={styles.rubricSummary}>{card.summary || t('exams.ieltsResults.feedbackPlaceholder')}</Text>
            </GlassCard>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        <GlassCard style={styles.feedbackListCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="star-outline" size={22} color="#22c55e" />
            <Text style={styles.cardTitle}>{t('exams.ieltsResults.strengthsTitle')}</Text>
          </View>
          {strengths.length > 0 ? strengths.map((item) => (
            <Text key={item} style={styles.listItem}>• {item}</Text>
          )) : <Text style={styles.cardBody}>{t('exams.ieltsResults.strengthsPlaceholder')}</Text>}
        </GlassCard>

        <GlassCard style={styles.feedbackListCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="alert-outline" size={22} color="#f97316" />
            <Text style={styles.cardTitle}>{t('exams.ieltsResults.weaknessesTitle')}</Text>
          </View>
          {weaknesses.length > 0 ? weaknesses.map((item) => (
            <Text key={item} style={styles.listItem}>• {item}</Text>
          )) : <Text style={styles.cardBody}>{t('exams.ieltsResults.weaknessesPlaceholder')}</Text>}
        </GlassCard>
      </View>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color="#f59e0b" />
          <Text style={styles.cardTitle}>{t('exams.ieltsResults.practicePlanTitle')}</Text>
        </View>
        {recommendations.length > 0 ? recommendations.map((item, index) => (
          <Text key={`${index}-${item}`} style={styles.listItem}>{index + 1}. {item}</Text>
        )) : <Text style={styles.cardBody}>{t('exams.ieltsResults.practicePlanPlaceholder')}</Text>}
      </GlassCard>

      {responseFeedback.length > 0 ? (
        <GlassCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={accentColor} />
            <Text style={styles.cardTitle}>{t('exams.ieltsResults.examinerBreakdownTitle')}</Text>
          </View>
          <View style={styles.responseStack}>
            {responseFeedback.map((item) => (
              <View key={`${item.label}-${item.question_id}`} style={styles.responseCard}>
                <View style={styles.responseHeader}>
                  <View>
                    <Text style={styles.responseTitle}>{item.label}</Text>
                    <Text style={styles.responseSubtitle}>{t('exams.ieltsResults.questionId', { id: item.question_id })}</Text>
                  </View>
                  {typeof item.band_score === 'number' ? (
                    <View style={styles.bandBadge}>
                      <Text style={styles.bandBadgeText}>{t('exams.ieltsResults.bandLabel', { score: Number(item.band_score).toFixed(1) })}</Text>
                    </View>
                  ) : null}
                </View>
                {item.feedback ? <Text style={styles.cardBody}>{item.feedback}</Text> : null}
                {item.strengths && item.strengths.length > 0 ? (
                  <View style={styles.miniSection}>
                    <Text style={styles.miniSectionTitle}>{t('exams.ieltsResults.workedTitle')}</Text>
                    {item.strengths.map((strength) => (
                      <Text key={strength} style={styles.miniSectionItem}>• {strength}</Text>
                    ))}
                  </View>
                ) : null}
                {item.weaknesses && item.weaknesses.length > 0 ? (
                  <View style={styles.miniSection}>
                    <Text style={styles.miniSectionTitle}>{t('exams.ieltsResults.fixTitle')}</Text>
                    {item.weaknesses.map((weakness) => (
                      <Text key={weakness} style={styles.miniSectionItem}>• {weakness}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {feedbackItems.length > 0 ? (
        <GlassCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="message-text-outline" size={22} color={accentColor} />
            <Text style={styles.cardTitle}>{t('exams.ieltsResults.questionDiagnosticsTitle')}</Text>
          </View>
          {feedbackItems.map((item) => {
            const scoreEntries = item.score && typeof item.score === 'object'
              ? Object.entries(item.score)
                  .filter(([key, value]) => key !== 'feedback' && typeof value === 'number')
                  .map(([key, value]) => ({
                    key,
                    label: formatCriterionLabel(key),
                    value: Number(value).toFixed(1),
                  }))
              : [];

            return (
              <View key={item.question_id} style={styles.feedbackItem}>
                <Text style={styles.feedbackQuestion}>{item.question_text}</Text>
                <View style={styles.feedbackMetaRow}>
                  {item.word_count ? <Text style={styles.feedbackMeta}>{t('exams.ieltsResults.wordCount', { count: item.word_count })}</Text> : null}
                  {item.transcription ? <Text style={styles.feedbackMeta}>{t('exams.ieltsResults.transcriptSaved')}</Text> : null}
                </View>
                {scoreEntries.length > 0 ? (
                  <View style={styles.scoreChipWrap}>
                    {scoreEntries.map((entry) => (
                      <View key={`${item.question_id}-${entry.key}`} style={styles.scoreChip}>
                        <Text style={styles.scoreChipLabel}>{entry.label}</Text>
                        <Text style={styles.scoreChipValue}>{entry.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.feedbackBody}>{item.feedback || t('exams.ieltsResults.feedbackPlaceholder')}</Text>
              </View>
            );
          })}
        </GlassCard>
      ) : null}

      {attempt.can_refund ? (
        <TouchableOpacity
          style={[styles.primaryButton, refundMutation.isPending && styles.buttonDisabled]}
          onPress={() => refundMutation.mutate()}
          disabled={refundMutation.isPending}
        >
          <MaterialCommunityIcons name="cash-refund" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>
            {refundMutation.isPending
              ? t('exams.ieltsResults.refundProcessing')
              : t('exams.ieltsResults.refundClaim', { coins: attempt.exam_details.coin_refund })}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('IELTSPrep')}>
          <MaterialCommunityIcons name="refresh" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>{t('exams.ieltsResults.practiceAnother')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Main', { screen: 'Exams' })}>
          <Text style={styles.secondaryButtonText}>{t('exams.ieltsResults.backToExams')}</Text>
        </TouchableOpacity>
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
    contentContainer: {
      padding: 20,
      gap: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      marginTop: 12,
    },
    pendingCard: {
      padding: 20,
      borderRadius: 28,
      gap: 10,
      alignItems: 'flex-start',
    },
    pendingTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    pendingText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    statusCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    statusPill: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusPillText: {
      ...theme.typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statusMetricWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    statusMetricLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statusMetricValue: {
      ...theme.typography.h3,
      color: theme.text,
    },
    summaryCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    cardBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    rubricCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 8,
    },
    rubricLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    rubricScore: {
      ...theme.typography.h2,
      fontWeight: '700',
    },
    rubricSummary: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    feedbackListCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 8,
    },
    listItem: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    responseStack: {
      gap: 12,
    },
    responseCard: {
      padding: 16,
      borderRadius: 22,
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
    },
    responseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    responseTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    responseSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    bandBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(124,58,237,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(124,58,237,0.22)',
    },
    bandBadgeText: {
      ...theme.typography.caption,
      color: '#7c3aed',
      fontWeight: '700',
    },
    miniSection: {
      gap: 6,
    },
    miniSectionTitle: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    miniSectionItem: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    feedbackItem: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
      gap: 8,
    },
    feedbackQuestion: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    feedbackMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    feedbackMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    scoreChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    scoreChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.68)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
      gap: 2,
    },
    scoreChipLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    scoreChipValue: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    feedbackBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    actionsRow: {
      gap: 12,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    primaryButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.text,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });

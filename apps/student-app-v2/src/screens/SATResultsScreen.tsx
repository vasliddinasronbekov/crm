import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  type DimensionValue,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  satApi,
  type SATAIFeedback,
  type SATAnswer,
  type SATTopicPerformance,
  useTheme,
} from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import type { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList & { SATResults: { attemptId: number } }, 'SATResults'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const formatTopicLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const ensureList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

const OFFICIAL_SECONDS_PER_QUESTION = Math.round((134 * 60) / 98);

const formatSecondsPace = (seconds: number) => `${Math.max(1, Math.round(seconds))} sec`;

export const SATResultsScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { attemptId } = route.params;

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['sat-attempt', attemptId],
    queryFn: () => satApi.getAttempt(attemptId),
  });

  if (isLoading || !attempt) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('exams.satResults.loading')}</Text>
      </View>
    );
  }

  const totalScore = attempt.total_score || 0;
  const examDetails = attempt.exam_details || attempt.exam_detail;
  const rwScore = attempt.reading_writing_score || 0;
  const mathScore = attempt.math_score || 0;
  const rwCorrect = attempt.rw_correct || 0;
  const mathCorrect = attempt.math_correct || 0;
  const rwTotal = examDetails?.rw_total_questions || 54;
  const mathTotal = examDetails?.math_total_questions || 44;
  const rwPercentage = Number(((rwCorrect / rwTotal) * 100).toFixed(1));
  const mathPercentage = Number(((mathCorrect / mathTotal) * 100).toFixed(1));
  const rwProgressWidth = `${rwPercentage}%` as DimensionValue;
  const mathProgressWidth = `${mathPercentage}%` as DimensionValue;
  const aiFeedback: SATAIFeedback = attempt.ai_feedback || {};
  const rwFeedback = aiFeedback.reading_writing_feedback || {};
  const mathFeedback = aiFeedback.math_feedback || {};
  const scorePotential = aiFeedback.score_potential || {};
  const studyPlan = ensureList(aiFeedback.study_plan);
  const recommendedResources = ensureList(aiFeedback.recommended_resources);
  const priorityAreas = ensureList(aiFeedback.priority_areas);
  const performanceData = aiFeedback.performance_data || {};
  const timeManagement = performanceData.time_management || {};
  const avgSecondsPerQuestion =
    timeManagement.time_per_question_avg_seconds ||
    timeManagement.time_per_question_avg ||
    (attempt.time_taken_seconds > 0 ? attempt.time_taken_seconds / Math.max(rwTotal + mathTotal, 1) : 0);
  const pacingDelta = avgSecondsPerQuestion - OFFICIAL_SECONDS_PER_QUESTION;
  const pacingStatus =
    avgSecondsPerQuestion <= OFFICIAL_SECONDS_PER_QUESTION - 6
      ? 'fast'
      : avgSecondsPerQuestion >= OFFICIAL_SECONDS_PER_QUESTION + 8
        ? 'slow'
        : 'on_track';

  const weakestTopics = [
    ...Object.entries(performanceData.reading_writing?.by_type || {}).map(([key, value]: [string, SATTopicPerformance]) => ({
      key: `rw-${key}`,
      label: `${t('exams.satResults.sectionRw')} • ${formatTopicLabel(key)}`,
      percentage: Number(value?.percentage ?? 0),
      color: '#1976D2',
    })),
    ...Object.entries(performanceData.math?.by_type || {}).map(([key, value]: [string, SATTopicPerformance]) => ({
      key: `math-${key}`,
      label: `${t('exams.satResults.sectionMath')} • ${formatTopicLabel(key)}`,
      percentage: Number(value?.percentage ?? 0),
      color: '#7B1FA2',
    })),
  ]
    .sort((left, right) => left.percentage - right.percentage)
    .slice(0, 4);

  const getScoreColor = (score: number) => {
    if (score >= 1400) return '#4CAF50';
    if (score >= 1200) return '#2196F3';
    if (score >= 1000) return '#FF9800';
    return '#F44336';
  };

  const getPercentileEstimate = (score: number) => {
    if (score >= 1500) return t('exams.satResults.percentiles.p99');
    if (score >= 1400) return t('exams.satResults.percentiles.p95');
    if (score >= 1300) return t('exams.satResults.percentiles.p87');
    if (score >= 1200) return t('exams.satResults.percentiles.p75');
    if (score >= 1100) return t('exams.satResults.percentiles.p60');
    if (score >= 1000) return t('exams.satResults.percentiles.p50');
    if (score >= 900) return t('exams.satResults.percentiles.p35');
    return t('exams.satResults.percentiles.p20');
  };

  const formatDifficulty = (difficulty?: string | null) => {
    if (!difficulty) {
      return null;
    }
    const key = difficulty.toLowerCase();
    if (key === 'easy' || key === 'medium' || key === 'hard') {
      return t(`exams.satResults.difficulty.${key}`);
    }
    return difficulty;
  };

  const renderFeedbackList = (items: string[], emptyKey: string) =>
    items.length > 0
      ? items.map((item) => (
          <Text key={item} style={styles.listItem}>• {item}</Text>
        ))
      : <Text style={styles.cardBody}>{t(emptyKey)}</Text>;

  const incorrectAnswers = (attempt.answers || [])
    .filter((answer) => !answer.is_correct)
    .slice(0, 6);

  const renderAnswerValue = (value?: string | null) => (value && value.trim().length > 0 ? value : t('exams.satResults.skipped'));

  const getPacingTitle = () => {
    if (pacingStatus === 'fast') return t('exams.satResults.paceFast');
    if (pacingStatus === 'slow') return t('exams.satResults.paceSlow');
    return t('exams.satResults.paceOnTrack');
  };

  const getPacingBody = () => {
    if (pacingStatus === 'fast') {
      return t('exams.satResults.paceSummaryFast', { seconds: Math.abs(Math.round(pacingDelta)) });
    }
    if (pacingStatus === 'slow') {
      return t('exams.satResults.paceSummarySlow', { seconds: Math.abs(Math.round(pacingDelta)) });
    }
    return t('exams.satResults.paceSummaryOnTrack');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ExamHeroCard
        eyebrow={t('exams.satResults.title')}
        title={`${totalScore} / 1600`}
        subtitle={examDetails?.title || t('exams.satResults.fallbackSubtitle')}
        accentColor={getScoreColor(totalScore)}
        progress={(totalScore / 1600) * 100}
        metrics={[
          { icon: 'chart-line', label: t('exams.satResults.metricPercentile'), value: `${getPercentileEstimate(totalScore)}` },
          { icon: 'book-open-variant', label: t('exams.satResults.metricRw'), value: `${rwScore}/800` },
          { icon: 'calculator', label: t('exams.satResults.metricMath'), value: `${mathScore}/800` },
        ]}
      />

      <GlassCard style={styles.totalScoreCard}>
        <View style={styles.totalScoreRow}>
          <View>
            <Text style={styles.totalScoreLabel}>{t('exams.satResults.compositeScore')}</Text>
            <Text style={[styles.totalScoreValue, { color: getScoreColor(totalScore) }]}>{totalScore}</Text>
          </View>
          <View style={styles.percentileBadge}>
            <Text style={styles.percentileValue}>{getPercentileEstimate(totalScore)}</Text>
            <Text style={styles.percentileLabel}>{t('exams.satResults.percentileLabel')}</Text>
          </View>
        </View>

        {attempt.refund_eligible && attempt.coins_refunded > 0 ? (
          <View style={styles.refundBadge}>
            <MaterialCommunityIcons name="cash-refund" size={18} color="#2E7D32" />
            <Text style={styles.refundText}>
              {t('exams.satResults.refundUnlocked', { coins: attempt.coins_refunded, score: examDetails?.passing_score })}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.dualColumn}>
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#E3F2FD' }]}>
              <MaterialCommunityIcons name="book-open-variant" size={22} color="#1976D2" />
            </View>
            <View style={styles.sectionMeta}>
              <Text style={styles.sectionName}>{t('exams.satResults.sectionRw')}</Text>
              <Text style={styles.sectionScore}>{rwScore} / 800</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: rwProgressWidth, backgroundColor: '#1976D2' }]} />
          </View>
          <Text style={styles.progressCaption}>{t('exams.satResults.correctSummary', { correct: rwCorrect, total: rwTotal, percentage: rwPercentage })}</Text>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F3E5F5' }]}>
              <MaterialCommunityIcons name="calculator" size={22} color="#7B1FA2" />
            </View>
            <View style={styles.sectionMeta}>
              <Text style={styles.sectionName}>{t('exams.satResults.sectionMath')}</Text>
              <Text style={styles.sectionScore}>{mathScore} / 800</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: mathProgressWidth, backgroundColor: '#7B1FA2' }]} />
          </View>
          <Text style={styles.progressCaption}>{t('exams.satResults.correctSummary', { correct: mathCorrect, total: mathTotal, percentage: mathPercentage })}</Text>
        </GlassCard>
      </View>

      <GlassCard style={styles.adaptiveCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="brain" size={22} color="#E65100" />
          <Text style={styles.cardTitle}>{t('exams.satResults.adaptiveTitle')}</Text>
        </View>
        <Text style={styles.cardBody}>{t('exams.satResults.adaptiveBody')}</Text>
        {attempt.rw_module2_difficulty ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('exams.satResults.adaptiveRw')}</Text>
            <Text style={styles.detailValue}>{formatDifficulty(attempt.rw_module2_difficulty)}</Text>
          </View>
        ) : null}
        {attempt.math_module2_difficulty ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('exams.satResults.adaptiveMath')}</Text>
            <Text style={styles.detailValue}>{formatDifficulty(attempt.math_module2_difficulty)}</Text>
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.dualColumn}>
        <GlassCard style={styles.statsCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="chart-box-outline" size={22} color="#1976D2" />
            <Text style={styles.cardTitle}>{t('exams.satResults.statsTitle')}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.timeTaken')}</Text>
            <Text style={styles.statValue}>{Math.floor(attempt.time_taken_seconds / 60)} min</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.completed')}</Text>
            <Text style={styles.statValue}>{new Date(attempt.completed_at!).toLocaleDateString()}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.coinsPaid')}</Text>
            <Text style={styles.statValue}>{attempt.coins_paid}</Text>
          </View>
          {attempt.coins_refunded > 0 ? (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t('exams.satResults.coinsRefunded')}</Text>
              <Text style={[styles.statValue, styles.statPositive]}>+{attempt.coins_refunded}</Text>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.interpretationCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="trophy-outline" size={22} color="#FFB300" />
            <Text style={styles.cardTitle}>{t('exams.satResults.scoreGuideTitle')}</Text>
          </View>
          {[
            ['#4CAF50', '1400-1600', t('exams.satResults.guideExcellent')],
            ['#2196F3', '1200-1390', t('exams.satResults.guideStrong')],
            ['#FF9800', '1000-1190', t('exams.satResults.guideAverage')],
            ['#F44336', '400-990', t('exams.satResults.guideImprove')],
          ].map(([color, range, label]) => (
            <View key={range} style={styles.guideRow}>
              <View style={[styles.guideDot, { backgroundColor: color }]} />
              <View style={styles.guideTextWrap}>
                <Text style={styles.guideRange}>{range}</Text>
                <Text style={styles.guideLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </View>

      <View style={styles.dualColumn}>
        <GlassCard style={styles.statsCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="timer-cog-outline" size={22} color="#0f766e" />
            <Text style={styles.cardTitle}>{t('exams.satResults.timeManagementTitle')}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.avgQuestionPace')}</Text>
            <Text style={styles.statValue}>{formatSecondsPace(avgSecondsPerQuestion)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.officialAvg')}</Text>
            <Text style={styles.statValue}>{formatSecondsPace(OFFICIAL_SECONDS_PER_QUESTION)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('exams.satResults.paceStatus')}</Text>
            <Text
              style={[
                styles.statValue,
                pacingStatus === 'fast'
                  ? styles.statInfo
                  : pacingStatus === 'slow'
                    ? styles.statWarning
                    : styles.statPositive,
              ]}
            >
              {getPacingTitle()}
            </Text>
          </View>
          <Text style={styles.cardBody}>{getPacingBody()}</Text>
        </GlassCard>

        <GlassCard style={styles.interpretationCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="bullseye-arrow" size={22} color="#dc2626" />
            <Text style={styles.cardTitle}>{t('exams.satResults.topCorrectionsTitle')}</Text>
          </View>
          {priorityAreas.length > 0 ? (
            priorityAreas.map((item) => (
              <Text key={item} style={styles.listItem}>• {item}</Text>
            ))
          ) : (
            <Text style={styles.cardBody}>{t('exams.satResults.weakTopicsPlaceholder')}</Text>
          )}
        </GlassCard>
      </View>

      <GlassCard style={styles.feedbackCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="robot-outline" size={22} color="#FF6F00" />
          <Text style={styles.cardTitle}>{t('exams.satResults.aiReviewTitle')}</Text>
        </View>
        <Text style={styles.cardBody}>{aiFeedback.overall_assessment || t('exams.satResults.aiReviewPlaceholder')}</Text>
        {priorityAreas.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionBlockTitle}>{t('exams.satResults.priorityAreasTitle')}</Text>
            {priorityAreas.map((item) => (
              <Text key={item} style={styles.listItem}>• {item}</Text>
            ))}
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.dualColumn}>
        <GlassCard style={styles.coachingCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color="#1976D2" />
            <Text style={styles.cardTitle}>{t('exams.satResults.rwFocusTitle')}</Text>
          </View>
          <Text style={styles.sectionSubhead}>{t('exams.satResults.strengthsTitle')}</Text>
          {renderFeedbackList(ensureList(rwFeedback.strengths), 'exams.satResults.emptyStrengths')}
          <Text style={styles.sectionSubhead}>{t('exams.satResults.weaknessesTitle')}</Text>
          {renderFeedbackList(ensureList(rwFeedback.weaknesses), 'exams.satResults.emptyWeaknesses')}
          <Text style={styles.sectionSubhead}>{t('exams.satResults.tipsTitle')}</Text>
          {renderFeedbackList(ensureList(rwFeedback.improvement_tips), 'exams.satResults.emptyTips')}
        </GlassCard>

        <GlassCard style={styles.coachingCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="calculator-variant-outline" size={22} color="#7B1FA2" />
            <Text style={styles.cardTitle}>{t('exams.satResults.mathFocusTitle')}</Text>
          </View>
          <Text style={styles.sectionSubhead}>{t('exams.satResults.strengthsTitle')}</Text>
          {renderFeedbackList(ensureList(mathFeedback.strengths), 'exams.satResults.emptyStrengths')}
          <Text style={styles.sectionSubhead}>{t('exams.satResults.weaknessesTitle')}</Text>
          {renderFeedbackList(ensureList(mathFeedback.weaknesses), 'exams.satResults.emptyWeaknesses')}
          <Text style={styles.sectionSubhead}>{t('exams.satResults.tipsTitle')}</Text>
          {renderFeedbackList(ensureList(mathFeedback.improvement_tips), 'exams.satResults.emptyTips')}
        </GlassCard>
      </View>

      {(scorePotential.current_score || scorePotential.realistic_target || scorePotential.target_breakdown || scorePotential.time_estimate) ? (
        <GlassCard style={styles.scorePotentialCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="target-variant" size={22} color="#0f766e" />
            <Text style={styles.cardTitle}>{t('exams.satResults.scorePotentialTitle')}</Text>
          </View>
          <View style={styles.dualColumn}>
            <View style={styles.metricPanel}>
              <Text style={styles.metricPanelLabel}>{t('exams.satResults.currentScore')}</Text>
              <Text style={styles.metricPanelValue}>{scorePotential.current_score ?? totalScore}</Text>
            </View>
            <View style={styles.metricPanel}>
              <Text style={styles.metricPanelLabel}>{t('exams.satResults.realisticTarget')}</Text>
              <Text style={styles.metricPanelValue}>{scorePotential.realistic_target ?? '-'}</Text>
            </View>
          </View>
          {scorePotential.target_breakdown ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionSubhead}>{t('exams.satResults.targetBreakdown')}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('exams.satResults.targetRw')}</Text>
                <Text style={styles.detailValue}>{scorePotential.target_breakdown.reading_writing ?? '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('exams.satResults.targetMath')}</Text>
                <Text style={styles.detailValue}>{scorePotential.target_breakdown.math ?? '-'}</Text>
              </View>
            </View>
          ) : null}
          {scorePotential.time_estimate ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('exams.satResults.timeEstimate')}</Text>
              <Text style={styles.detailValue}>{scorePotential.time_estimate}</Text>
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      <View style={styles.dualColumn}>
        <GlassCard style={styles.planCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="calendar-check-outline" size={22} color="#2563eb" />
            <Text style={styles.cardTitle}>{t('exams.satResults.studyPlanTitle')}</Text>
          </View>
          {studyPlan.length > 0
            ? studyPlan.map((item, index) => (
                <Text key={`${index}-${item}`} style={styles.listItem}>{index + 1}. {item}</Text>
              ))
            : <Text style={styles.cardBody}>{t('exams.satResults.studyPlanPlaceholder')}</Text>}
        </GlassCard>

        <GlassCard style={styles.planCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="bookshelf" size={22} color="#9333ea" />
            <Text style={styles.cardTitle}>{t('exams.satResults.resourcesTitle')}</Text>
          </View>
          {recommendedResources.length > 0
            ? recommendedResources.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))
            : <Text style={styles.cardBody}>{t('exams.satResults.resourcesPlaceholder')}</Text>}
        </GlassCard>
      </View>

      <GlassCard style={styles.feedbackCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="radar" size={22} color="#dc2626" />
          <Text style={styles.cardTitle}>{t('exams.satResults.weakTopicsTitle')}</Text>
        </View>
        {weakestTopics.length > 0 ? (
          <View style={styles.topicList}>
            {weakestTopics.map((topic) => (
              <View key={topic.key} style={styles.topicRow}>
                <View style={[styles.topicDot, { backgroundColor: topic.color }]} />
                <View style={styles.topicTextWrap}>
                  <Text style={styles.topicLabel}>{topic.label}</Text>
                  <Text style={styles.topicMeta}>{t('exams.satResults.topicAccuracy', { percentage: topic.percentage.toFixed(1) })}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.cardBody}>{t('exams.satResults.weakTopicsPlaceholder')}</Text>
        )}
      </GlassCard>

      <GlassCard style={styles.feedbackCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="text-box-search-outline" size={22} color="#2563eb" />
          <Text style={styles.cardTitle}>{t('exams.satResults.wrongAnswerReviewTitle')}</Text>
        </View>
        {incorrectAnswers.length > 0 ? (
          <View style={styles.reviewStack}>
            {incorrectAnswers.map((answer: SATAnswer) => {
              const question = answer.question_details;
              const typeLabel = question?.rw_type_display || question?.math_type_display || null;

              return (
                <View key={answer.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewHeaderText}>
                      <Text style={styles.reviewTitle}>
                        {t('exams.satExam.questionLabel', { number: answer.question_number })}
                      </Text>
                      {typeLabel ? (
                        <Text style={styles.reviewSubtitle}>
                          {t('exams.satResults.questionType')}: {typeLabel}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.reviewBadge}>
                      <Text style={styles.reviewBadgeTextError}>{t('exams.satResults.reviewBadgeIncorrect')}</Text>
                    </View>
                  </View>

                  {question?.question_text ? <Text style={styles.reviewPrompt}>{question.question_text}</Text> : null}

                  <View style={styles.reviewMetaRow}>
                    <Text style={styles.reviewMetaLabel}>{t('exams.satResults.yourAnswer')}</Text>
                    <Text style={styles.reviewMetaValue}>{renderAnswerValue(answer.answer_given?.answer)}</Text>
                  </View>
                  <View style={styles.reviewMetaRow}>
                    <Text style={styles.reviewMetaLabel}>{t('exams.satResults.correctAnswer')}</Text>
                    <Text style={[styles.reviewMetaValue, styles.reviewMetaValueCorrect]}>
                      {renderAnswerValue(question?.correct_answer?.answer)}
                    </Text>
                  </View>

                  {question?.explanation ? (
                    <View style={styles.reviewExplanation}>
                      <Text style={styles.reviewExplanationTitle}>{t('exams.satResults.explanation')}</Text>
                      <Text style={styles.reviewExplanationBody}>{question.explanation}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.cardBody}>{t('exams.satResults.wrongAnswerReviewPlaceholder')}</Text>
        )}
      </GlassCard>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('SATPrep')}>
          <MaterialCommunityIcons name="refresh" size={20} color="#ffffff" />
          <Text style={styles.primaryActionText}>{t('exams.satResults.actionRetake')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
        >
          <Text style={styles.secondaryActionText}>{t('exams.satResults.actionHome')}</Text>
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
    totalScoreCard: {
      padding: 20,
      borderRadius: 28,
      gap: 14,
    },
    totalScoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    totalScoreLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    totalScoreValue: {
      ...theme.typography.h1,
      fontSize: 54,
      fontWeight: '700',
      marginTop: 4,
    },
    percentileBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 88,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: '#E3F2FD',
    },
    percentileValue: {
      ...theme.typography.h3,
      color: '#1976D2',
    },
    percentileLabel: {
      ...theme.typography.caption,
      color: '#1976D2',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    refundBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 18,
      backgroundColor: 'rgba(46,125,50,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(46,125,50,0.22)',
    },
    refundText: {
      ...theme.typography.body,
      color: '#1B5E20',
      flex: 1,
      lineHeight: 21,
    },
    dualColumn: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    sectionCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sectionIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionMeta: {
      flex: 1,
      gap: 2,
    },
    sectionName: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    sectionScore: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressCaption: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    adaptiveCard: {
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
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    detailLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    statsCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 12,
    },
    interpretationCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 12,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    statLabel: {
      ...theme.typography.body,
      color: theme.textSecondary,
    },
    statValue: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    statPositive: {
      color: '#16a34a',
    },
    statWarning: {
      color: '#f97316',
    },
    statInfo: {
      color: '#2563eb',
    },
    guideRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    guideDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    guideTextWrap: {
      flex: 1,
    },
    guideRange: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    guideLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    feedbackCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    sectionBlock: {
      gap: 8,
    },
    sectionBlockTitle: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    listItem: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    coachingCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 12,
    },
    sectionSubhead: {
      ...theme.typography.caption,
      color: theme.text,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    scorePotentialCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    metricPanel: {
      width: '48%',
      padding: 14,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.68)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
      gap: 4,
    },
    metricPanelLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricPanelValue: {
      ...theme.typography.h3,
      color: theme.text,
    },
    planCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 12,
    },
    topicList: {
      gap: 12,
    },
    topicRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    topicDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
    },
    topicTextWrap: {
      flex: 1,
      gap: 2,
    },
    topicLabel: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    topicMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    reviewStack: {
      gap: 12,
    },
    reviewCard: {
      borderRadius: 22,
      padding: 16,
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    reviewHeaderText: {
      flex: 1,
      gap: 2,
    },
    reviewTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    reviewSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    reviewBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(220,38,38,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(220,38,38,0.2)',
    },
    reviewBadgeTextError: {
      ...theme.typography.caption,
      color: '#dc2626',
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    reviewPrompt: {
      ...theme.typography.body,
      color: theme.text,
      lineHeight: 21,
    },
    reviewMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    reviewMetaLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      flex: 1,
    },
    reviewMetaValue: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'right',
    },
    reviewMetaValueCorrect: {
      color: '#22c55e',
    },
    reviewExplanation: {
      gap: 6,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    reviewExplanationTitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    reviewExplanationBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    actionsContainer: {
      gap: 12,
      paddingBottom: 8,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    primaryActionText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    secondaryAction: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryActionText: {
      ...theme.typography.button,
      color: theme.text,
    },
  });

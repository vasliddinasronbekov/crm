// apps/student-app-v2/src/screens/SATPrepScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { theme } from '@eduvoice/mobile-ui';
import { satApi } from '@eduvoice/mobile-shared';
import apiClient from '../api/apiClient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppStackParamList } from '../navigation/types';

type SATPrepNavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const SATPrepScreen = () => {
  const navigation = useNavigation<SATPrepNavigationProp>();

  // Fetch student statistics for real-time coins
  const { data: studentStats } = useQuery({
    queryKey: ['student-statistics'],
    queryFn: async () => {
      const response = await apiClient.getStudentStatistics();
      return response.data;
    },
  });

  // Fetch SAT exams
  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ['sat-exams'],
    queryFn: () => satApi.getExams(),
  });

  // Fetch user attempts
  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ['sat-attempts'],
    queryFn: () => satApi.getMyAttempts(),
  });

  // Fetch SAT statistics
  const { data: statistics } = useQuery({
    queryKey: ['sat-statistics'],
    queryFn: () => satApi.getStatistics(),
    enabled: !!attempts && attempts.length > 0,
  });

  const handleStartExam = (examId: number, examTitle: string, coinCost: number) => {
    const activeAttempt = attempts?.find(
      (attempt: any) => attempt.exam === examId && (attempt.status === 'payment_pending' || attempt.status === 'in_progress')
    );
    if (activeAttempt) {
      Alert.alert(
        'Resume SAT Exam',
        'A saved SAT attempt already exists for this exam. Resume from your last synced module and timer state?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resume',
            onPress: () => navigation.navigate('SATExam', { examId }),
          },
        ]
      );
      return;
    }

    // Check if user has enough coins from real-time statistics
    const userCoins = studentStats?.total_coins || 0;
    if (userCoins < coinCost) {
      Alert.alert(
        'Insufficient Coins',
        `You need ${coinCost} coins to take this exam. You currently have ${userCoins} coins.`
      );
      return;
    }

    Alert.alert(
      'Start SAT Exam',
      `${examTitle}\n\n` +
      `Format: 2025 Digital SAT\n` +
      `• Reading & Writing: 54 questions (64 min)\n` +
      `• Math: 44 questions (70 min)\n` +
      `• Total: 98 questions (2h 14min)\n\n` +
      `Cost: ${coinCost} coins\n` +
      `Refund: 10 coins (if score ≥ 1000/1600)\n\n` +
      `The exam uses adaptive testing. Module 2 difficulty adjusts based on your Module 1 performance.\n\n` +
      `Once started, you cannot pause. Are you ready?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Exam',
          onPress: () => {
            navigation.navigate('SATExam', { examId });
          },
        },
      ]
    );
  };

  const getAttemptCount = (examId: number) => {
    if (!attempts) return 0;
    return attempts.filter((a: any) => a.exam === examId).length;
  };

  const getBestScore = (examId: number) => {
    if (!attempts) return null;
    const examAttempts = attempts.filter(
      (a: any) => a.exam === examId && a.total_score
    );
    if (examAttempts.length === 0) return null;
    return Math.max(...examAttempts.map((a: any) => a.total_score));
  };

  if (examsLoading || attemptsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>Loading SAT exams...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="school-outline" size={48} color={theme.colors.primary500} />
        <Text style={styles.title}>SAT Preparation</Text>
        <Text style={styles.subtitle}>2025 Digital SAT Format with Adaptive Testing</Text>
        <View style={styles.coinsDisplay}>
          <MaterialCommunityIcons name="hand-coin" size={24} color="#FFB300" />
          <Text style={styles.coinsText}>{studentStats?.total_coins || 0} Coins Available</Text>
        </View>
      </View>

      {/* Statistics Card */}
      {statistics && statistics.total_attempts > 0 && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Your SAT Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Best Score</Text>
              <Text style={styles.statValue}>{statistics.best_scores.total}</Text>
              <Text style={styles.statSubtext}>out of 1600</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>{statistics.average_scores.total}</Text>
              <Text style={styles.statSubtext}>across {statistics.total_attempts} attempts</Text>
            </View>
          </View>
          <View style={styles.sectionScores}>
            <View style={styles.sectionScore}>
              <MaterialCommunityIcons name="book-open-variant" size={20} color="#1976D2" />
              <Text style={styles.sectionScoreLabel}>Reading & Writing</Text>
              <Text style={styles.sectionScoreValue}>{statistics.best_scores.reading_writing}/800</Text>
            </View>
            <View style={styles.sectionScore}>
              <MaterialCommunityIcons name="calculator" size={20} color="#7B1FA2" />
              <Text style={styles.sectionScoreLabel}>Math</Text>
              <Text style={styles.sectionScoreValue}>{statistics.best_scores.math}/800</Text>
            </View>
          </View>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary500} />
          <Text style={styles.infoText}>Complete digital SAT exam: 98 questions</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="clock-outline" size={20} color="#FF6F00" />
          <Text style={styles.infoText}>Total time: 2 hours 14 minutes</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="cash-refund" size={20} color="#4CAF50" />
          <Text style={styles.infoText}>Get 10 coins back for score ≥ 1000</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="brain" size={20} color="#E65100" />
          <Text style={styles.infoText}>Adaptive testing: Module 2 adjusts to your level</Text>
        </View>
      </View>

      {/* Exam List */}
      <View style={styles.examsContainer}>
        <Text style={styles.sectionTitle}>Available SAT Exams</Text>
        {exams && exams.length > 0 ? (
          exams.map((exam: any) => {
            const attemptCount = getAttemptCount(exam.id);
            const bestScore = getBestScore(exam.id);

            return (
              <TouchableOpacity
                key={exam.id}
                style={styles.examCard}
                onPress={() => handleStartExam(exam.id, exam.title, exam.coin_cost)}
                activeOpacity={0.7}
              >
                <View style={styles.examHeader}>
                  <View style={styles.examIconContainer}>
                    <MaterialCommunityIcons name="school" size={32} color={theme.colors.white} />
                  </View>
                  <View style={styles.examTitleContainer}>
                    <Text style={styles.examTitle}>{exam.title}</Text>
                    {exam.is_official && (
                      <View style={styles.officialBadge}>
                        <MaterialCommunityIcons name="certificate" size={14} color="#FFB300" />
                        <Text style={styles.officialText}>Official Practice Test</Text>
                      </View>
                    )}
                    <Text style={styles.examDescription}>{exam.description}</Text>
                  </View>
                </View>

                <View style={styles.examDetails}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="book-open-variant" size={18} color="#1976D2" />
                      <Text style={styles.detailText}>
                        RW: {exam.rw_total_questions}q ({exam.rw_time_minutes}min)
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="calculator" size={18} color="#7B1FA2" />
                      <Text style={styles.detailText}>
                        Math: {exam.math_total_questions}q ({exam.math_time_minutes}min)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="hand-coin" size={18} color="#FFB300" />
                      <Text style={styles.detailText}>{exam.coin_cost} coins</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="trophy" size={18} color="#4CAF50" />
                      <Text style={styles.detailText}>Refund: {exam.coin_refund} coins</Text>
                    </View>
                  </View>
                </View>

                {attemptCount > 0 && (
                  <View style={styles.attemptsInfo}>
                    <Text style={styles.attemptsText}>Attempts: {attemptCount}</Text>
                    {bestScore && (
                      <Text style={styles.bestScoreText}>Best Score: {bestScore}/1600</Text>
                    )}
                  </View>
                )}

                <View style={styles.startButton}>
                  <Text style={styles.startButtonText}>Start Exam</Text>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.white} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.gray400} />
            <Text style={styles.emptyText}>No SAT exams available</Text>
            <Text style={styles.emptySubtext}>Please contact your administrator</Text>
          </View>
        )}
      </View>

      {/* Recent Attempts */}
      {attempts && attempts.length > 0 && (
        <View style={styles.attemptsContainer}>
          <Text style={styles.sectionTitle}>Recent Attempts</Text>
          {attempts.slice(0, 5).map((attempt: any) => (
            <TouchableOpacity
              key={attempt.id}
              style={styles.attemptCard}
              onPress={() => {
                if (attempt.status === 'evaluated' || attempt.status === 'completed') {
                  navigation.navigate('SATResults', { attemptId: attempt.id });
                } else if (attempt.status === 'payment_pending' || attempt.status === 'in_progress') {
                  navigation.navigate('SATExam', { examId: attempt.exam });
                }
              }}
            >
              <View style={styles.attemptHeader}>
                <Text style={styles.attemptExam}>{attempt.exam_title}</Text>
                <Text style={styles.attemptDate}>
                  {new Date(attempt.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.attemptBody}>
                <View style={styles.attemptDetail}>
                  <Text style={styles.attemptLabel}>Status:</Text>
                  <Text
                    style={[
                      styles.attemptValue,
                      {
                        color:
                          attempt.status === 'evaluated' || attempt.status === 'completed'
                            ? '#4CAF50'
                            : '#FF6F00',
                      },
                    ]}
                  >
                    {attempt.status_display}
                  </Text>
                </View>
                {attempt.total_score > 0 && (
                  <View style={styles.attemptDetail}>
                    <Text style={styles.attemptLabel}>Score:</Text>
                    <Text style={styles.attemptScore}>{attempt.total_score}/1600</Text>
                  </View>
                )}
                {attempt.total_score > 0 && (
                  <View style={styles.attemptScoreBreakdown}>
                    <Text style={styles.attemptBreakdownText}>
                      RW: {attempt.reading_writing_score}/800
                    </Text>
                    <Text style={styles.attemptBreakdownText}>
                      Math: {attempt.math_score}/800
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginTop: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  coinsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#FFF9E6',
    borderRadius: 20,
  },
  coinsText: {
    ...theme.typography.body,
    color: '#E65100',
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
  },
  statsCard: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    ...theme.shadows.md,
  },
  statsTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statItem: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  statValue: {
    ...theme.typography.h1,
    color: theme.colors.primary500,
    fontSize: 32,
    fontWeight: '700',
  },
  statSubtext: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionScores: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  sectionScore: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    gap: 4,
  },
  sectionScoreLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
    flex: 1,
    fontSize: 11,
  },
  sectionScoreValue: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
    fontSize: 13,
  },
  infoCard: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    ...theme.shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  examsContainer: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  examCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  examHeader: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  examIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  examTitleContainer: {
    flex: 1,
  },
  examTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    fontSize: 18,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  officialText: {
    ...theme.typography.caption,
    color: '#E65100',
    fontWeight: '600',
  },
  examDescription: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  examDetails: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
  },
  attemptsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginBottom: theme.spacing.sm,
  },
  attemptsText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  bestScoreText: {
    ...theme.typography.caption,
    color: '#4CAF50',
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary500,
    borderRadius: 8,
    gap: theme.spacing.sm,
  },
  startButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  attemptsContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  attemptCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  attemptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  attemptExam: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  attemptDate: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
  },
  attemptBody: {
    gap: theme.spacing.xs,
  },
  attemptDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attemptLabel: {
    ...theme.typography.body,
    color: theme.colors.gray600,
  },
  attemptValue: {
    ...theme.typography.body,
    fontWeight: '600',
  },
  attemptScore: {
    ...theme.typography.body,
    color: theme.colors.primary500,
    fontWeight: '700',
    fontSize: 16,
  },
  attemptScoreBreakdown: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  attemptBreakdownText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
});

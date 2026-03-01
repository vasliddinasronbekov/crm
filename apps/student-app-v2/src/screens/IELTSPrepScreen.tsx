// apps/student-app-v2/src/screens/IELTSPrepScreen.tsx

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
import apiClient from '../api/apiClient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppStackParamList } from '../navigation/types';

type IELTSPrepNavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface IELTSExam {
  id: number;
  section: string;
  section_display: string;
  title: string;
  description: string;
  coin_cost: number;
  coin_refund: number;
  time_limit_minutes: number;
  passing_band_score: string;
  questions_count: number;
}

export const IELTSPrepScreen = () => {
  const navigation = useNavigation<IELTSPrepNavigationProp>();

  // Fetch student statistics for real-time coins
  const { data: statistics } = useQuery({
    queryKey: ['student-statistics'],
    queryFn: async () => {
      const response = await apiClient.getStudentStatistics();
      return response.data;
    },
  });

  // Fetch IELTS exams
  const { data: exams, isLoading } = useQuery<IELTSExam[]>({
    queryKey: ['ielts-exams'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/student-profile/ielts/exams/') as any;
      return response.data.results || [];
    },
  });

  // Fetch user attempts
  const { data: attempts } = useQuery({
    queryKey: ['ielts-attempts'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/student-profile/ielts/attempts/') as any;
      return response.data.results || [];
    },
  });

  const handleStartExam = (exam: IELTSExam) => {
    // Check if user has enough coins from real-time statistics
    const userCoins = statistics?.total_coins || 0;
    if (userCoins < exam.coin_cost) {
      Alert.alert(
        'Insufficient Coins',
        `You need ${exam.coin_cost} coins to take this exam. You currently have ${userCoins} coins.`
      );
      return;
    }

    Alert.alert(
      'Start Exam',
      `${exam.section_display} Section\n\n` +
      `Cost: ${exam.coin_cost} coins\n` +
      `Refund: ${exam.coin_refund} coins (if band score ≥ ${exam.passing_band_score})\n` +
      `Time: ${exam.time_limit_minutes} minutes\n\n` +
      `Once started, the exam cannot be paused. Are you ready?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Exam',
          onPress: () => {
            // Navigate to exam screen based on section
            switch (exam.section) {
              case 'reading':
                navigation.navigate('IELTSReading', { examId: exam.id });
                break;
              case 'listening':
                navigation.navigate('IELTSListening', { examId: exam.id });
                break;
              case 'writing':
                navigation.navigate('IELTSWriting', { examId: exam.id });
                break;
              case 'speaking':
                navigation.navigate('IELTSSpeaking', { examId: exam.id });
                break;
            }
          },
        },
      ]
    );
  };

  const getAttemptCount = (section: string) => {
    if (!attempts) return 0;
    return attempts.filter((a: any) => a.exam_details?.section === section).length;
  };

  const getBestScore = (section: string) => {
    if (!attempts) return null;
    const sectionAttempts = attempts.filter(
      (a: any) => a.exam_details?.section === section && a.band_score
    );
    if (sectionAttempts.length === 0) return null;
    return Math.max(...sectionAttempts.map((a: any) => parseFloat(a.band_score)));
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'reading':
        return 'book-open-page-variant';
      case 'listening':
        return 'headphones';
      case 'writing':
        return 'pencil';
      case 'speaking':
        return 'account-voice';
      default:
        return 'file-document';
    }
  };

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'reading':
        return '#2E7D32';
      case 'listening':
        return '#1976D2';
      case 'writing':
        return '#7B1FA2';
      case 'speaking':
        return '#E65100';
      default:
        return theme.colors.primary500;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>Loading IELTS exams...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="certificate-outline" size={48} color={theme.colors.primary500} />
        <Text style={styles.title}>IELTS Preparation</Text>
        <Text style={styles.subtitle}>AI-Powered Real IELTS Exam Practice</Text>
        <View style={styles.coinsDisplay}>
          <MaterialCommunityIcons name="hand-coin" size={24} color="#FFB300" />
          <Text style={styles.coinsText}>{statistics?.total_coins || 0} Coins Available</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary500} />
          <Text style={styles.infoText}>Each section costs 50 coins</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="cash-refund" size={20} color="#4CAF50" />
          <Text style={styles.infoText}>Get 10 coins back for band score ≥ 5.0</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="robot" size={20} color="#FF6F00" />
          <Text style={styles.infoText}>AI-powered evaluation like real IELTS</Text>
        </View>
      </View>

      {/* Sections */}
      <View style={styles.sectionsContainer}>
        <Text style={styles.sectionTitle}>Choose Your Section</Text>
        {exams && exams.length > 0 ? (
          (Array.isArray(exams) ? exams : []).map((exam) => {
            const attemptCount = getAttemptCount(exam.section);
            const bestScore = getBestScore(exam.section);
            const color = getSectionColor(exam.section);

            return (
              <TouchableOpacity
                key={exam.id}
                style={[styles.examCard, { borderLeftColor: color }]}
                onPress={() => handleStartExam(exam)}
                activeOpacity={0.7}
              >
                <View style={[styles.examIconContainer, { backgroundColor: color }]}>
                  <MaterialCommunityIcons
                    name={getSectionIcon(exam.section) as any}
                    size={32}
                    color={theme.colors.white}
                  />
                </View>
                <View style={styles.examContent}>
                  <Text style={styles.examTitle}>{exam.section_display}</Text>
                  <Text style={styles.examDescription}>{exam.description}</Text>
                  <View style={styles.examDetails}>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.gray600} />
                      <Text style={styles.detailText}>{exam.time_limit_minutes} min</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="help-circle-outline" size={16} color={theme.colors.gray600} />
                      <Text style={styles.detailText}>{exam.questions_count} questions</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="hand-coin" size={16} color="#FFB300" />
                      <Text style={styles.detailText}>{exam.coin_cost} coins</Text>
                    </View>
                  </View>
                  {attemptCount > 0 && (
                    <View style={styles.statsRow}>
                      <Text style={styles.statsText}>Attempts: {attemptCount}</Text>
                      {bestScore && (
                        <Text style={styles.bestScoreText}>Best: Band {bestScore.toFixed(1)}</Text>
                      )}
                    </View>
                  )}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.gray400} />
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.gray400} />
            <Text style={styles.emptyText}>No IELTS exams available</Text>
            <Text style={styles.emptySubtext}>Please contact your administrator</Text>
          </View>
        )}
      </View>

      {/* My Attempts Section */}
      {attempts && attempts.length > 0 && (
        <View style={styles.attemptsContainer}>
          <Text style={styles.sectionTitle}>Recent Attempts</Text>
          {(Array.isArray(attempts) ? attempts : []).slice(0, 5).map((attempt: any) => (
            <TouchableOpacity
              key={attempt.id}
              style={styles.attemptCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('IELTSResults', { attemptId: attempt.id })}
            >
              <View style={styles.attemptHeader}>
                <Text style={styles.attemptSection}>{attempt.exam_details?.section_display}</Text>
                <Text style={styles.attemptDate}>
                  {new Date(attempt.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.attemptBody}>
                <View style={styles.attemptDetail}>
                  <Text style={styles.attemptLabel}>Status:</Text>
                  <Text style={[styles.attemptValue, { color: getSectionColor(attempt.status) }]}>
                    {attempt.status_display}
                  </Text>
                </View>
                {attempt.band_score > 0 && (
                  <View style={styles.attemptDetail}>
                    <Text style={styles.attemptLabel}>Band Score:</Text>
                    <Text style={styles.attemptValue}>{attempt.band_score}</Text>
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
  },
  sectionsContainer: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    ...theme.shadows.sm,
  },
  examIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  examContent: {
    flex: 1,
  },
  examTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    fontSize: 18,
  },
  examDescription: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  examDetails: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  statsText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  bestScoreText: {
    ...theme.typography.caption,
    color: '#4CAF50',
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
  attemptSection: {
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
    color: theme.colors.gray900,
    fontWeight: '600',
  },
});

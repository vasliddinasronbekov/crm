import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

interface SATExam {
  id: number;
  title: string;
  description: string;
  coin_cost: number;
  coin_refund: number;
  passing_score: number;
  rw_total_questions: number;
  rw_time_minutes: number;
  math_total_questions: number;
  math_time_minutes: number;
  is_official: boolean;
  test_number?: number;
}

interface SATAttempt {
  id: number;
  exam: number;
  status: string;
  total_score: number;
  reading_writing_score: number;
  math_score: number;
  rw_correct: number;
  math_correct: number;
  coins_paid: number;
  coins_refunded: number;
  started_at: string;
  completed_at: string | null;
}

export default function SATExamsScreen({ navigation }: any) {
  const [exams, setExams] = useState<SATExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedExam, setSelectedExam] = useState<SATExam | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [attempts, setAttempts] = useState<SATAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [userCoins, setUserCoins] = useState(0);

  useEffect(() => {
    loadExamsAndCoins();
  }, []);

  const loadExamsAndCoins = async () => {
    try {
      const [examsData, coinsData] = await Promise.all([
        apiService.getSATExams(),
        apiService.getMyCoins(),
      ]);
      setExams(examsData.results || examsData || []);
      setUserCoins(coinsData.total_coins || 0);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load SAT exams. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadExamAttempts = async (examId: number) {
    setLoadingAttempts(true);
    try {
      const data = await apiService.getMySATAttempts();
      const examAttempts = (data.results || data || []).filter(
        (attempt: SATAttempt) => attempt.exam === examId
      );
      setAttempts(examAttempts);
    } catch (error: any) {
      console.error('Failed to load attempts:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load attempt history.'
      );
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleExamPress = (exam: SATExam) => {
    setSelectedExam(exam);
    setModalVisible(true);
    loadExamAttempts(exam.id);
  };

  const handleStartExam = async () => {
    if (!selectedExam) return;

    // Check if user has enough coins
    if (userCoins < selectedExam.coin_cost) {
      Alert.alert(
        'Insufficient Coins',
        `You need ${selectedExam.coin_cost} coins to take this exam. You currently have ${userCoins} coins.`
      );
      return;
    }

    Alert.alert(
      'Start SAT Exam',
      `Are you ready to begin the SAT exam?\n\n` +
        `Cost: ${selectedExam.coin_cost} coins\n` +
        `Refund: ${selectedExam.coin_refund} coins (if score >= ${selectedExam.passing_score})\n\n` +
        `Total Questions: ${selectedExam.rw_total_questions + selectedExam.math_total_questions}\n` +
        `Total Time: ${Math.floor((selectedExam.rw_time_minutes + selectedExam.math_time_minutes) / 60)}h ${(selectedExam.rw_time_minutes + selectedExam.math_time_minutes) % 60}min`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setStartingExam(true);
            try {
              // Create attempt
              const attempt = await apiService.createSATAttempt(selectedExam.id);

              // Pay coins
              await apiService.paySATExam(attempt.id);

              setModalVisible(false);

              // Navigate to exam taking screen
              navigation.navigate('SATExamTaking', {
                examId: selectedExam.id,
                attemptId: attempt.id,
              });
            } catch (error: any) {
              console.error('Failed to start SAT exam:', error);
              Alert.alert(
                'Error',
                error?.response?.data?.detail || 'Failed to start exam. Please try again.'
              );
            } finally {
              setStartingExam(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadExamsAndCoins();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderExamCard = ({ item }: { item: SATExam }) => {
    const totalQuestions = item.rw_total_questions + item.math_total_questions;
    const totalTime = item.rw_time_minutes + item.math_time_minutes;
    const canAfford = userCoins >= item.coin_cost;

    return (
      <TouchableOpacity
        style={styles.examCard}
        onPress={() => handleExamPress(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.1)', 'rgba(139, 92, 246, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.examGradient}
        >
          <View style={styles.examHeader}>
            {item.is_official && (
              <View style={styles.officialBadge}>
                <Text style={styles.officialBadgeText}>
                  Official {item.test_number ? `#${item.test_number}` : ''}
                </Text>
              </View>
            )}
            <View style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>💰 {item.coin_cost}</Text>
            </View>
          </View>

          <Text style={styles.examTitle}>{item.title}</Text>

          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Questions</Text>
              <Text style={styles.statValue}>{totalQuestions}</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>
                {Math.floor(totalTime / 60)}h {totalTime % 60}m
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Max Score</Text>
              <Text style={styles.statValue}>1600</Text>
            </View>
          </View>

          <View style={styles.sectionsRow}>
            <View style={styles.sectionInfo}>
              <Text style={styles.sectionLabel}>Reading & Writing</Text>
              <Text style={styles.sectionValue}>
                {item.rw_total_questions}q • {item.rw_time_minutes}min
              </Text>
            </View>
            <View style={styles.sectionInfo}>
              <Text style={styles.sectionLabel}>Math</Text>
              <Text style={styles.sectionValue}>
                {item.math_total_questions}q • {item.math_time_minutes}min
              </Text>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: canAfford ? '#8b5cf6' : '#64748b' },
              ]}
            />
            <Text style={styles.statusText}>
              {canAfford ? 'Available' : `Need ${item.coin_cost - userCoins} more coins`}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderAttemptItem = ({ item }: { item: SATAttempt }) => (
    <TouchableOpacity
      style={styles.attemptCard}
      onPress={() => {
        setModalVisible(false);
        navigation.navigate('SATResults', { attemptId: item.id });
      }}
    >
      <View style={styles.attemptHeader}>
        <View style={styles.attemptInfo}>
          <Text style={styles.attemptDate}>
            {formatDate(item.started_at)}
          </Text>
          <Text style={styles.attemptStatus}>
            Status: {item.status.replace('_', ' ')}
          </Text>
        </View>
        <View style={styles.attemptScoreContainer}>
          <Text style={styles.attemptScoreText}>{item.total_score}/1600</Text>
          <View style={styles.scoreBreakdown}>
            <Text style={styles.scoreBreakdownText}>
              RW: {item.reading_writing_score}
            </Text>
            <Text style={styles.scoreBreakdownText}>
              Math: {item.math_score}
            </Text>
          </View>
        </View>
      </View>

      {item.coins_refunded > 0 && (
        <View style={styles.refundBadge}>
          <Text style={styles.refundText}>
            ✓ Refund: {item.coins_refunded} coins
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading SAT exams...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SAT Exams</Text>
        <View style={styles.coinsDisplay}>
          <Text style={styles.coinsText}>💰 {userCoins} coins</Text>
        </View>
      </View>

      <FlatList
        data={exams}
        renderItem={renderExamCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={['#8b5cf6']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No SAT exams available</Text>
            <Text style={styles.emptySubtext}>Check back later for new exams</Text>
          </View>
        }
      />

      {/* Exam Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Exam Details</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedExam && (
              <>
                <View style={styles.detailsCard}>
                  <View style={styles.detailsHeader}>
                    <Text style={styles.detailsTitle}>{selectedExam.title}</Text>
                    {selectedExam.is_official && (
                      <View style={styles.officialDetailsBadge}>
                        <Text style={styles.officialDetailsBadgeText}>
                          Official
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedExam.description && (
                    <Text style={styles.detailsDescription}>
                      {selectedExam.description}
                    </Text>
                  )}

                  <View style={styles.detailsMetaGrid}>
                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Cost</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedExam.coin_cost} coins
                      </Text>
                    </View>

                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Refund</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedExam.coin_refund} coins
                      </Text>
                    </View>

                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Passing Score</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedExam.passing_score}+
                      </Text>
                    </View>

                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Your Coins</Text>
                      <Text style={[
                        styles.detailsMetaValue,
                        { color: userCoins >= selectedExam.coin_cost ? '#10B981' : '#EF4444' }
                      ]}>
                        {userCoins}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sectionsDetail}>
                    <Text style={styles.sectionsDetailTitle}>Exam Sections</Text>
                    <View style={styles.sectionDetailItem}>
                      <Text style={styles.sectionDetailLabel}>
                        📖 Reading & Writing
                      </Text>
                      <Text style={styles.sectionDetailValue}>
                        {selectedExam.rw_total_questions} questions • {selectedExam.rw_time_minutes} min • 800 pts
                      </Text>
                    </View>
                    <View style={styles.sectionDetailItem}>
                      <Text style={styles.sectionDetailLabel}>
                        🔢 Math
                      </Text>
                      <Text style={styles.sectionDetailValue}>
                        {selectedExam.math_total_questions} questions • {selectedExam.math_time_minutes} min • 800 pts
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Attempt History */}
                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>Your Attempts</Text>

                  {loadingAttempts ? (
                    <View style={styles.historyLoading}>
                      <ActivityIndicator size="small" color="#8b5cf6" />
                      <Text style={styles.historyLoadingText}>
                        Loading attempts...
                      </Text>
                    </View>
                  ) : attempts.length === 0 ? (
                    <Text style={styles.noAttemptsText}>
                      No attempts yet. Start the exam to see your results here!
                    </Text>
                  ) : (
                    <FlatList
                      data={attempts}
                      renderItem={renderAttemptItem}
                      keyExtractor={(item) => item.id.toString()}
                      scrollEnabled={false}
                    />
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Start Exam Button */}
          {selectedExam && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.startExamButton}
                onPress={handleStartExam}
                disabled={startingExam || userCoins < selectedExam.coin_cost}
              >
                <LinearGradient
                  colors={
                    userCoins >= selectedExam.coin_cost
                      ? ['#8b5cf6', '#7c3aed']
                      : ['#64748b', '#475569']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {startingExam ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.startExamButtonText}>
                      Start SAT Exam
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  coinsDisplay: {
    backgroundColor: '#8b5cf6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  coinsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  examCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  examGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 16,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  officialBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  officialBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  coinBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  coinBadgeText: {
    fontSize: 11,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  examTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    marginRight: 20,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  sectionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  sectionInfo: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    marginBottom: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  officialDetailsBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  officialDetailsBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsDescription: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 20,
  },
  detailsMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  detailsMetaItem: {
    width: '50%',
    marginBottom: 16,
  },
  detailsMetaLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  detailsMetaValue: {
    fontSize: 16,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  sectionsDetail: {
    marginTop: 12,
  },
  sectionsDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  sectionDetailItem: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  sectionDetailLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    fontWeight: '600',
  },
  sectionDetailValue: {
    fontSize: 13,
    color: '#8b5cf6',
  },
  historySection: {
    marginBottom: 100,
  },
  historySectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  historyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  historyLoadingText: {
    color: '#94a3b8',
    marginLeft: 12,
    fontSize: 14,
  },
  noAttemptsText: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
    padding: 20,
    textAlign: 'center',
  },
  attemptCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  attemptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  attemptInfo: {
    flex: 1,
  },
  attemptDate: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  attemptStatus: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  attemptScoreContainer: {
    alignItems: 'flex-end',
  },
  attemptScoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginBottom: 4,
  },
  scoreBreakdown: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBreakdownText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  refundBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  refundText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  startExamButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    padding: 16,
    alignItems: 'center',
  },
  startExamButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

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

interface Quiz {
  id: number;
  title: string;
  description: string;
  quiz_type: string;
  time_limit_minutes: number;
  passing_score: number;
  max_attempts: number;
  questions_count?: number;
  course: {
    id: number;
    name: string;
  };
  my_attempts?: QuizAttempt[];
}

interface QuizAttempt {
  id: number;
  quiz: number;
  student: number;
  started_at: string;
  completed_at: string | null;
  time_spent: number;
  score: number;
  percentage_score: number;
  passed: boolean;
  status: string;
}

export default function QuizzesScreen({ navigation }: any) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [startingQuiz, setStartingQuiz] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const data = await apiService.getQuizzes();
      setQuizzes(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load quizzes:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load quizzes. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadQuizAttempts = async (quizId: number) => {
    setLoadingAttempts(true);
    try {
      const data = await apiService.getMyQuizAttempts(quizId);
      setAttempts(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load quiz attempts:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load quiz history.'
      );
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleQuizPress = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setModalVisible(true);
    loadQuizAttempts(quiz.id);
  };

  const handleStartQuiz = async () => {
    if (!selectedQuiz) return;

    const attemptCount = attempts.length;
    const canTakeQuiz =
      selectedQuiz.max_attempts === 0 || attemptCount < selectedQuiz.max_attempts;

    if (!canTakeQuiz) {
      Alert.alert('Limit Reached', 'You have used all available attempts for this quiz.');
      return;
    }

    Alert.alert(
      'Start Quiz',
      `Are you ready to begin "${selectedQuiz.title}"?\n\nTime limit: ${
        selectedQuiz.time_limit_minutes > 0
          ? `${selectedQuiz.time_limit_minutes} minutes`
          : 'No limit'
      }\nPassing score: ${selectedQuiz.passing_score}%`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setStartingQuiz(true);
            try {
              const attempt = await apiService.startQuizAttempt(selectedQuiz.id);
              setModalVisible(false);
              // Navigate to quiz taking screen
              navigation.navigate('QuizTaking', {
                quizId: selectedQuiz.id,
                attemptId: attempt.id,
              });
            } catch (error: any) {
              console.error('Failed to start quiz:', error);
              Alert.alert(
                'Error',
                error?.response?.data?.message || 'Failed to start quiz. Please try again.'
              );
            } finally {
              setStartingQuiz(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadQuizzes();
  };

  const getQuizTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      practice: 'Practice',
      graded: 'Graded',
      exam: 'Exam',
      survey: 'Survey',
    };
    return labels[type] || type;
  };

  const getQuizTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      practice: '#10B981',
      graded: '#F59E0B',
      exam: '#EF4444',
      survey: '#8B5CF6',
    };
    return colors[type] || '#6B7280';
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

  const renderQuizCard = ({ item }: { item: Quiz }) => {
    const attemptCount = item.my_attempts?.length || 0;
    const canTakeQuiz =
      item.max_attempts === 0 || attemptCount < item.max_attempts;
    const lastAttempt = item.my_attempts?.[0];

    return (
      <TouchableOpacity
        style={styles.quizCard}
        onPress={() => handleQuizPress(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quizGradient}
        >
          <View style={styles.quizHeader}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: getQuizTypeColor(item.quiz_type) },
              ]}
            >
              <Text style={styles.typeBadgeText}>
                {getQuizTypeLabel(item.quiz_type)}
              </Text>
            </View>

            {item.time_limit_minutes > 0 && (
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>
                  ⏱ {item.time_limit_minutes} min
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.quizTitle}>{item.title}</Text>
          <Text style={styles.courseText}>{item.course.name}</Text>

          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Passing Score</Text>
              <Text style={styles.statValue}>{item.passing_score}%</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Attempts</Text>
              <Text style={styles.statValue}>
                {attemptCount}/{item.max_attempts === 0 ? '∞' : item.max_attempts}
              </Text>
            </View>

            {item.questions_count !== undefined && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Questions</Text>
                <Text style={styles.statValue}>{item.questions_count}</Text>
              </View>
            )}
          </View>

          {lastAttempt && (
            <View style={styles.lastAttemptContainer}>
              <Text style={styles.lastAttemptLabel}>Last Result:</Text>
              <View style={styles.lastAttemptScore}>
                <Text
                  style={[
                    styles.scoreText,
                    {
                      color: lastAttempt.passed ? '#10B981' : '#EF4444',
                    },
                  ]}
                >
                  {lastAttempt.percentage_score.toFixed(1)}%
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: lastAttempt.passed ? '#10B981' : '#EF4444',
                    },
                  ]}
                >
                  {lastAttempt.passed ? '✓ Passed' : '✗ Failed'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.bottomRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: canTakeQuiz ? '#00d4ff' : '#64748b' },
              ]}
            />
            <Text style={styles.statusText}>
              {canTakeQuiz ? 'Available' : 'No attempts left'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderAttemptItem = ({ item }: { item: QuizAttempt }) => (
    <View style={styles.attemptCard}>
      <View style={styles.attemptHeader}>
        <View style={styles.attemptInfo}>
          <Text style={styles.attemptDate}>
            {formatDate(item.started_at)}
          </Text>
          <Text style={styles.attemptStatus}>
            Status: {item.status}
          </Text>
        </View>
        <View style={styles.attemptScoreContainer}>
          <Text
            style={[
              styles.attemptScoreText,
              { color: item.passed ? '#10B981' : '#EF4444' },
            ]}
          >
            {item.percentage_score.toFixed(1)}%
          </Text>
          <Text
            style={[
              styles.attemptResult,
              { color: item.passed ? '#10B981' : '#EF4444' },
            ]}
          >
            {item.passed ? '✓ Passed' : '✗ Failed'}
          </Text>
        </View>
      </View>

      {item.time_spent > 0 && (
        <Text style={styles.timeSpent}>
          Time: {Math.floor(item.time_spent / 60)} min {item.time_spent % 60} sec
        </Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading quizzes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quizzes</Text>
        <Text style={styles.subtitle}>{quizzes.length} quizzes available</Text>
      </View>

      <FlatList
        data={quizzes}
        renderItem={renderQuizCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No quizzes available</Text>
            <Text style={styles.emptySubtext}>Check back later for new quizzes</Text>
          </View>
        }
      />

      {/* Quiz Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Quiz Details</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedQuiz && (
              <>
                <View style={styles.detailsCard}>
                  <View style={styles.detailsHeader}>
                    <Text style={styles.detailsTitle}>{selectedQuiz.title}</Text>
                    <View
                      style={[
                        styles.typeDetailsBadge,
                        {
                          backgroundColor: getQuizTypeColor(selectedQuiz.quiz_type),
                        },
                      ]}
                    >
                      <Text style={styles.typeDetailsBadgeText}>
                        {getQuizTypeLabel(selectedQuiz.quiz_type)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailsCourse}>{selectedQuiz.course.name}</Text>

                  {selectedQuiz.description && (
                    <Text style={styles.detailsDescription}>
                      {selectedQuiz.description}
                    </Text>
                  )}

                  <View style={styles.detailsMetaGrid}>
                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Passing Score</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedQuiz.passing_score}%
                      </Text>
                    </View>

                    {selectedQuiz.time_limit_minutes > 0 && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Time Limit</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedQuiz.time_limit_minutes} min
                        </Text>
                      </View>
                    )}

                    {selectedQuiz.questions_count !== undefined && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Questions</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedQuiz.questions_count}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Max Attempts</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedQuiz.max_attempts === 0 ? 'Unlimited' : selectedQuiz.max_attempts}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Attempt History */}
                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>Attempt History</Text>

                  {loadingAttempts ? (
                    <View style={styles.historyLoading}>
                      <ActivityIndicator size="small" color="#00d4ff" />
                      <Text style={styles.historyLoadingText}>
                        Loading attempts...
                      </Text>
                    </View>
                  ) : attempts.length === 0 ? (
                    <Text style={styles.noAttemptsText}>
                      No attempts yet. Start the quiz to make your first attempt!
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

          {/* Start Quiz Button */}
          {selectedQuiz && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.startQuizButton}
                onPress={handleStartQuiz}
                disabled={startingQuiz}
              >
                <LinearGradient
                  colors={['#00d4ff', '#0099cc']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {startingQuiz ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.startQuizButtonText}>
                      {attempts.length > 0 ? 'Take Again' : 'Start Quiz'}
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
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
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
  quizCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quizGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 16,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  timeBadge: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  timeBadgeText: {
    fontSize: 11,
    color: '#00d4ff',
    fontWeight: '500',
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  courseText: {
    fontSize: 14,
    color: '#00d4ff',
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
    color: '#00d4ff',
  },
  lastAttemptContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.1)',
  },
  lastAttemptLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  lastAttemptScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
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
    borderColor: 'rgba(0, 212, 255, 0.2)',
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
  typeDetailsBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeDetailsBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsCourse: {
    fontSize: 14,
    color: '#00d4ff',
    marginBottom: 12,
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
    color: '#00d4ff',
    fontWeight: '600',
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
  },
  attemptScoreContainer: {
    alignItems: 'flex-end',
  },
  attemptScoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  attemptResult: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeSpent: {
    fontSize: 12,
    color: '#64748b',
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
  startQuizButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    padding: 16,
    alignItems: 'center',
  },
  startQuizButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

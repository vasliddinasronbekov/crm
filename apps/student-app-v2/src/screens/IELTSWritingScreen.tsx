// apps/student-app-v2/src/screens/IELTSWritingScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '@eduvoice/mobile-ui';
import { ieltsApi } from '@eduvoice/mobile-shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList & { IELTSWriting: { examId: number } }, 'IELTSWriting'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const IELTSWritingScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { examId } = route.params;

  const [currentTask, setCurrentTask] = useState<1 | 2>(1);
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['ielts-exam', examId],
    queryFn: () => ieltsApi.getExam(examId),
  });

  // Fetch questions
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['ielts-questions', examId],
    queryFn: () => ieltsApi.getExamQuestions(examId),
  });

  // Create attempt mutation
  const createAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.createAttempt({ exam: examId }),
    onSuccess: (data) => {
      setAttemptId(data.id);
      Alert.alert(
        'Exam Started',
        'You have 60 minutes for both tasks. Suggested time:\n• Task 1: 20 minutes (150+ words)\n• Task 2: 40 minutes (250+ words)'
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start exam');
      navigation.goBack();
    },
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: ({ questionId, essay }: { questionId: number; essay: string }) =>
      ieltsApi.submitAnswer(attemptId!, {
        question_id: questionId,
        essay_content: essay,
      }),
  });

  // Submit attempt mutation
  const submitAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.submitAttempt(attemptId!),
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['ielts-attempts'] });
      Alert.alert(
        'Submitted!',
        'Your essays have been submitted for AI evaluation. You will receive detailed feedback soon.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('IELTSResults', { attemptId: attempt.id }),
          },
        ]
      );
    },
  });

  // Initialize exam
  useEffect(() => {
    if (!attemptId && exam) {
      createAttemptMutation.mutate();
    }
  }, [exam]);

  // Timer countdown
  useEffect(() => {
    if (!attemptId) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attemptId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const task1WordCount = countWords(task1Text);
  const task2WordCount = countWords(task2Text);

  const getWordCountColor = (count: number, minimum: number) => {
    if (count === 0) return theme.colors.gray600;
    if (count < minimum) return '#D32F2F';
    if (count < minimum + 30) return '#FF6F00';
    return '#2E7D32';
  };

  const handleSubmit = () => {
    if (task1WordCount < 150 || task2WordCount < 250) {
      Alert.alert(
        'Warning',
        `Your word count is below the minimum requirement:\n• Task 1: ${task1WordCount}/150 words\n• Task 2: ${task2WordCount}/250 words\n\nYou will be penalized for incomplete answers. Do you still want to submit?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', onPress: () => setShowSubmitModal(true) },
        ]
      );
    } else {
      setShowSubmitModal(true);
    }
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);

    // Submit both tasks
    if (questions && attemptId) {
      const task1Question = questions.find(q => q.question_type.includes('task1'));
      const task2Question = questions.find(q => q.question_type.includes('task2'));

      if (task1Question && task1Text) {
        await submitAnswerMutation.mutateAsync({
          questionId: task1Question.id,
          essay: task1Text,
        });
      }

      if (task2Question && task2Text) {
        await submitAnswerMutation.mutateAsync({
          questionId: task2Question.id,
          essay: task2Text,
        });
      }

      // Submit the attempt for AI evaluation
      submitAttemptMutation.mutate();
    }
  };

  if (examLoading || questionsLoading || !questions || !exam) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>Loading exam...</Text>
      </View>
    );
  }

  const task1Question = questions.find(q => q.question_type.includes('task1'));
  const task2Question = questions.find(q => q.question_type.includes('task2'));

  const suggestedTask1Time = 20 * 60; // 20 minutes
  const task1TimeElapsed = 60 * 60 - timeRemaining;
  const shouldSwitchToTask2 = task1TimeElapsed >= suggestedTask1Time && currentTask === 1;

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow="IELTS Writing"
          title={exam.title}
          subtitle="Dual-task writing workspace with live word count and timing guidance."
          accentColor="#7B1FA2"
          progress={Math.min(100, ((task1WordCount + task2WordCount) / 400) * 100)}
          metrics={[
            { icon: 'clock-outline', label: 'Time left', value: formatTime(timeRemaining) },
            { icon: 'text-box-outline', label: 'Task 1', value: `${task1WordCount} words` },
            { icon: 'file-document-edit-outline', label: 'Task 2', value: `${task2WordCount} words` },
          ]}
        />
        <GlassCard style={styles.taskTabs}>
          <TouchableOpacity
            style={[styles.taskTab, currentTask === 1 && styles.taskTabActive]}
            onPress={() => setCurrentTask(1)}
          >
            <Text style={[styles.taskTabText, currentTask === 1 && styles.taskTabTextActive]}>
              Task 1 (150+ words)
            </Text>
            <View style={styles.wordCountBadge}>
              <Text style={[styles.wordCountText, { color: getWordCountColor(task1WordCount, 150) }]}>
                {task1WordCount}
              </Text>
            </View>
            {shouldSwitchToTask2 && (
              <MaterialCommunityIcons name="alert" size={16} color="#FF6F00" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.taskTab, currentTask === 2 && styles.taskTabActive]}
            onPress={() => setCurrentTask(2)}
          >
            <Text style={[styles.taskTabText, currentTask === 2 && styles.taskTabTextActive]}>
              Task 2 (250+ words)
            </Text>
            <View style={styles.wordCountBadge}>
              <Text style={[styles.wordCountText, { color: getWordCountColor(task2WordCount, 250) }]}>
                {task2WordCount}
              </Text>
            </View>
          </TouchableOpacity>
        </GlassCard>
      </View>

      {shouldSwitchToTask2 && currentTask === 1 && (
        <GlassCard style={styles.timeSuggestion}>
          <MaterialCommunityIcons name="information" size={20} color="#FF6F00" />
          <Text style={styles.timeSuggestionText}>
            20 minutes elapsed. Consider moving to Task 2 (worth twice as much)
          </Text>
        </GlassCard>
      )}

      {/* Task Content */}
      <ScrollView style={styles.content}>
        {currentTask === 1 && task1Question && (
          <GlassCard style={styles.taskContainer}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>Task 1</Text>
              <Text style={styles.taskInfo}>Minimum 150 words • Suggested 20 minutes</Text>
            </View>
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{task1Question.question_text}</Text>
              {task1Question.passage_text && (
                <View style={styles.visualData}>
                  <Text style={styles.visualDataLabel}>Visual Information:</Text>
                  <Text style={styles.visualDataText}>{task1Question.passage_text}</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.essayInput}
              placeholder="Write your response here..."
              placeholderTextColor={theme.colors.gray400}
              value={task1Text}
              onChangeText={setTask1Text}
              multiline
              textAlignVertical="top"
            />
          </GlassCard>
        )}

        {currentTask === 2 && task2Question && (
          <GlassCard style={styles.taskContainer}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>Task 2</Text>
              <Text style={styles.taskInfo}>Minimum 250 words • Suggested 40 minutes • Worth 2x Task 1</Text>
            </View>
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{task2Question.question_text}</Text>
            </View>
            <TextInput
              style={styles.essayInput}
              placeholder="Write your essay here..."
              placeholderTextColor={theme.colors.gray400}
              value={task2Text}
              onChangeText={setTask2Text}
              multiline
              textAlignVertical="top"
            />
          </GlassCard>
        )}
      </ScrollView>

      {/* Footer with word count and submit */}
      <GlassCard style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>Word Count:</Text>
          <Text style={[styles.footerValue, { color: getWordCountColor(currentTask === 1 ? task1WordCount : task2WordCount, currentTask === 1 ? 150 : 250) }]}>
            {currentTask === 1 ? task1WordCount : task2WordCount} / {currentTask === 1 ? '150+' : '250+'}
          </Text>
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Both Tasks</Text>
          <MaterialCommunityIcons name="check" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </GlassCard>

      {/* Submit Confirmation Modal */}
      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#7B1FA2" />
            <Text style={styles.modalTitle}>Submit Writing Exam?</Text>
            <View style={styles.modalStats}>
              <Text style={styles.modalText}>Task 1: {task1WordCount} words</Text>
              <Text style={styles.modalText}>Task 2: {task2WordCount} words</Text>
            </View>
            <Text style={styles.modalWarning}>
              Your essays will be evaluated by AI for Task Achievement, Coherence, Lexical Resource, and Grammar.
            </Text>
            <Text style={styles.modalText}>
              You cannot change your essays after submission.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={confirmSubmit}>
                <Text style={styles.modalButtonConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  chrome: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginLeft: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    fontWeight: '600',
    marginLeft: 4,
  },
  timerWarning: {
    color: '#D32F2F',
  },
  taskTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  taskTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: theme.spacing.xs,
  },
  taskTabActive: {
    borderBottomColor: '#7B1FA2',
  },
  taskTabText: {
    ...theme.typography.body,
    color: theme.colors.gray600,
  },
  taskTabTextActive: {
    color: '#7B1FA2',
    fontWeight: '600',
  },
  wordCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: theme.colors.gray100,
    borderRadius: 10,
  },
  wordCountText: {
    ...theme.typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  timeSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    gap: theme.spacing.xs,
  },
  timeSuggestionText: {
    ...theme.typography.caption,
    color: '#E65100',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  taskContainer: {
    padding: theme.spacing.lg,
  },
  taskHeader: {
    marginBottom: theme.spacing.md,
  },
  taskTitle: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
  },
  taskInfo: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  questionCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  questionText: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    lineHeight: 24,
  },
  visualData: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7B1FA2',
  },
  visualDataLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.xs,
    fontWeight: '600',
  },
  visualDataText: {
    ...theme.typography.body,
    color: theme.colors.gray800,
  },
  essayInput: {
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 12,
    padding: theme.spacing.lg,
    minHeight: 400,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  footerLabel: {
    ...theme.typography.body,
    color: theme.colors.gray600,
  },
  footerValue: {
    ...theme.typography.h3,
    fontSize: 18,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    backgroundColor: '#7B1FA2',
    gap: theme.spacing.sm,
  },
  submitButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modalStats: {
    width: '100%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
  },
  modalText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  modalWarning: {
    ...theme.typography.caption,
    color: '#7B1FA2',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: '100%',
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    ...theme.typography.button,
    color: theme.colors.gray700,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    backgroundColor: '#7B1FA2',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
});

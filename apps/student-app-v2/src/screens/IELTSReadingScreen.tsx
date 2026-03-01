// apps/student-app-v2/src/screens/IELTSReadingScreen.tsx

import React, { useEffect, useMemo, useState } from 'react';
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
  type DimensionValue,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '@eduvoice/mobile-ui';
import { ieltsApi } from '@eduvoice/mobile-shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { QuestionPalette } from '../components/exam/QuestionPalette';
import { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList & { IELTSReading: { examId: number } }, 'IELTSReading'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const IELTSReadingScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { examId } = route.params;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(60 * 60);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['ielts-exam', examId],
    queryFn: () => ieltsApi.getExam(examId),
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['ielts-questions', examId],
    queryFn: () => ieltsApi.getExamQuestions(examId),
  });

  const createAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.createAttempt({ exam: examId }),
    onSuccess: (data) => {
      setAttemptId(data.id);
      Alert.alert('Success', 'Reading exam started. Keep your pace steady and manage passage time carefully.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start exam');
      navigation.goBack();
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: number; answer: string }) =>
      ieltsApi.submitAnswer(attemptId!, {
        question_id: questionId,
        text_answer: answer,
      }),
  });

  const submitAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.submitAttempt(attemptId!),
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['ielts-attempts'] });
      Alert.alert('Submitted!', 'Your reading answers have been submitted.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('IELTSResults', { attemptId: attempt.id }),
        },
      ]);
    },
  });

  useEffect(() => {
    if (!attemptId && exam) {
      createAttemptMutation.mutate();
    }
  }, [attemptId, exam]);

  useEffect(() => {
    if (!attemptId) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowSubmitModal(true);
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

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNextQuestion = () => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);

    if (questions && attemptId) {
      for (const question of questions) {
        const answer = answers[question.id];
        if (answer) {
          await submitAnswerMutation.mutateAsync({
            questionId: question.id,
            answer,
          });
        }
      }

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

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No question available</Text>
      </View>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;
  const progressWidth = `${Math.max(0, Math.min(100, progress))}%` as DimensionValue;
  const passages = questions.reduce<string[]>((acc, question) => {
    if (question.passage_text && !acc.includes(question.passage_text)) {
      acc.push(question.passage_text);
    }
    return acc;
  }, []);
  const currentPassage = currentQuestion.passage_text || passages[0] || '';
  const answeredIndexes = questions.reduce<number[]>((acc, question, index) => {
    if (answers[question.id]) {
      acc.push(index);
    }
    return acc;
  }, []);
  const passageLabel = useMemo(() => {
    const foundIndex = passages.findIndex((passage) => passage === currentPassage);
    return foundIndex >= 0 ? `Passage ${foundIndex + 1}` : 'Reading passage';
  }, [currentPassage, passages]);

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow="IELTS Reading"
          title={exam.title}
          subtitle="Split-pane reading mode with quick navigation, answer tracking, and time control."
          accentColor="#2E7D32"
          progress={progress}
          metrics={[
            { icon: 'clock-outline', label: 'Time left', value: formatTime(timeRemaining) },
            { icon: 'file-document-outline', label: 'Passages', value: String(Math.max(passages.length, 1)) },
            { icon: 'check-circle-outline', label: 'Answered', value: `${answeredCount}/${questions.length}` },
          ]}
        />
        <QuestionPalette
          total={questions.length}
          currentIndex={currentQuestionIndex}
          answeredIndexes={answeredIndexes}
          accentColor="#2E7D32"
          onSelect={setCurrentQuestionIndex}
        />
      </View>

      <View style={styles.workspace}>
        <GlassCard style={styles.passageShell}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>{passageLabel}</Text>
              <Text style={styles.panelTitle}>Reading passage</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{answeredCount}/{questions.length}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <ScrollView style={styles.passageScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.passageText}>{currentPassage || 'No passage text available.'}</Text>
          </ScrollView>
        </GlassCard>

        <GlassCard style={styles.questionShell}>
          <ScrollView style={styles.questionScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1}</Text>
            <Text style={styles.questionType}>{currentQuestion.question_type_display}</Text>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

            {currentQuestion.question_type === 'multiple_choice' &&
            currentQuestion.options &&
            currentQuestion.options.length > 0 ? (
              <View style={styles.optionsContainer}>
                {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option, index) => (
                  <TouchableOpacity
                    key={`${currentQuestion.id}-${index}`}
                    style={[
                      styles.optionButton,
                      answers[currentQuestion.id] === option && styles.optionButtonSelected,
                    ]}
                    onPress={() => handleAnswerChange(currentQuestion.id, option)}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.optionMarker,
                        answers[currentQuestion.id] === option && styles.optionMarkerSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionMarkerText,
                          answers[currentQuestion.id] === option && styles.optionMarkerTextSelected,
                        ]}
                      >
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        answers[currentQuestion.id] === option && styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="Type your answer here..."
                placeholderTextColor={theme.colors.gray400}
                value={answers[currentQuestion.id] || ''}
                onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
                multiline
              />
            )}
          </ScrollView>
        </GlassCard>
      </View>

      <GlassCard style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={currentQuestionIndex === 0 ? theme.colors.gray400 : '#2E7D32'}
          />
          <Text
            style={[
              styles.navButtonText,
              currentQuestionIndex === 0 && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {currentQuestionIndex === questions.length - 1 ? (
          <TouchableOpacity style={styles.submitButton} onPress={() => setShowSubmitModal(true)}>
            <Text style={styles.submitButtonText}>Submit exam</Text>
            <MaterialCommunityIcons name="check" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleNextQuestion}>
            <Text style={styles.submitButtonText}>Next question</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        )}
      </GlassCard>

      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent}>
            <MaterialCommunityIcons name="book-open-page-variant" size={44} color="#2E7D32" />
            <Text style={styles.modalTitle}>Submit Reading Exam?</Text>
            <Text style={styles.modalText}>
              You answered {answeredCount} of {questions.length} questions.
            </Text>
            <Text style={styles.modalText}>
              After submission, answers are locked and sent for evaluation.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowSubmitModal(false)}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={confirmSubmit}>
                <Text style={styles.modalButtonConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
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
  chrome: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  passageShell: {
    flex: 1.05,
    padding: theme.spacing.lg,
    borderRadius: 28,
  },
  questionShell: {
    flex: 0.95,
    padding: theme.spacing.lg,
    borderRadius: 28,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  panelEyebrow: {
    ...theme.typography.caption,
    color: '#2E7D32',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  panelTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginTop: 2,
  },
  progressBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: '#E8F5E9',
  },
  progressBadgeText: {
    ...theme.typography.caption,
    color: '#2E7D32',
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.gray200,
    marginBottom: theme.spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2E7D32',
  },
  passageScroll: {
    flex: 1,
  },
  passageText: {
    ...theme.typography.body,
    color: theme.colors.gray800,
    lineHeight: 24,
    paddingBottom: theme.spacing.xl,
  },
  questionScroll: {
    flex: 1,
  },
  questionNumber: {
    ...theme.typography.h3,
    color: '#2E7D32',
    marginBottom: theme.spacing.xs,
  },
  questionType: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  questionText: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.gray300,
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  optionButtonSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  optionMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray100,
  },
  optionMarkerSelected: {
    backgroundColor: '#2E7D32',
  },
  optionMarkerText: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
    fontWeight: '700',
  },
  optionMarkerTextSelected: {
    color: theme.colors.white,
  },
  optionText: {
    ...theme.typography.body,
    color: theme.colors.gray800,
    flex: 1,
  },
  optionTextSelected: {
    color: '#14532D',
    fontWeight: '600',
  },
  textInput: {
    ...theme.typography.body,
    minHeight: 140,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: 'rgba(255,255,255,0.82)',
    padding: theme.spacing.md,
    color: theme.colors.gray900,
    textAlignVertical: 'top',
  },
  footer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2E7D32',
    minWidth: 140,
    gap: theme.spacing.xs,
  },
  navButtonDisabled: {
    borderColor: theme.colors.gray300,
  },
  navButtonText: {
    ...theme.typography.button,
    color: '#2E7D32',
  },
  navButtonTextDisabled: {
    color: theme.colors.gray400,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 18,
    backgroundColor: '#2E7D32',
    minWidth: 160,
    gap: theme.spacing.sm,
  },
  submitButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 30, 0.42)',
    padding: theme.spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    padding: theme.spacing.xl,
    borderRadius: 28,
    alignItems: 'center',
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  modalText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: 16,
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
    borderRadius: 16,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
});

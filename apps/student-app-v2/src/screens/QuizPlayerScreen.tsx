import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getErrorMessage, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { QuestionPalette } from '../components/exam/QuestionPalette';
import {
  completeRuntimeQuizAttempt,
  createRuntimeQuizAttempt,
  getRuntimeQuizDetail,
  getRuntimeQuizQuestions,
  type RuntimeQuizAttemptResult,
  submitRuntimeQuizAnswer,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type QuizPlayerRouteProp = RouteProp<AppStackParamList, 'QuizPlayer'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const QuizPlayerScreen = () => {
  const route = useRoute<QuizPlayerRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { quizId } = route.params;

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [completedAttempt, setCompletedAttempt] = useState<RuntimeQuizAttemptResult | null>(null);

  const quizQuery = useQuery({
    queryKey: ['runtime-quiz-detail', quizId],
    queryFn: () => getRuntimeQuizDetail(quizId),
  });

  const questionsQuery = useQuery({
    queryKey: ['runtime-quiz-questions', quizId],
    queryFn: () => getRuntimeQuizQuestions(quizId),
  });

  const startAttemptMutation = useMutation({
    mutationFn: () => createRuntimeQuizAttempt(quizId),
    onSuccess: (attempt) => {
      setAttemptId(attempt.id);
      setTimeRemaining((quizQuery.data?.timeLimitMinutes || 0) * 60);
    },
    onError: (error) => {
      Alert.alert('Quiz start failed', getErrorMessage(error), [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
    },
  });

  const completeAttemptMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId || !questionsQuery.data) {
        throw new Error('Quiz attempt is not ready.');
      }

      for (const question of questionsQuery.data) {
        const answerValue = answers[question.id];
        if (answerValue === undefined || answerValue === '') {
          continue;
        }

        await submitRuntimeQuizAnswer(attemptId, question, answerValue);
      }

      return completeRuntimeQuizAttempt(attemptId);
    },
    onSuccess: (attempt) => {
      setCompletedAttempt(attempt);
      queryClient.invalidateQueries({ queryKey: ['runtime-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    },
    onError: (error) => {
      Alert.alert('Submit failed', getErrorMessage(error));
    },
  });

  useEffect(() => {
    if (quizQuery.data && attemptId === null && !startAttemptMutation.isPending && !completedAttempt) {
      startAttemptMutation.mutate();
    }
  }, [attemptId, completedAttempt, quizQuery.data, startAttemptMutation]);

  useEffect(() => {
    if (!quizQuery.data?.timeLimitMinutes || completedAttempt) {
      return undefined;
    }

    if (attemptId && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((previous) => {
          if (previous <= 1) {
            clearInterval(timer);
            void completeAttemptMutation.mutateAsync();
            return 0;
          }
          return previous - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    return undefined;
  }, [attemptId, completeAttemptMutation, completedAttempt, quizQuery.data?.timeLimitMinutes, timeRemaining]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: number, value: string | number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleFinishQuiz = () => {
    const answeredCount = Object.keys(answers).length;
    const totalQuestions = questionsQuery.data?.length || 0;

    Alert.alert(
      'Submit Quiz?',
      `You answered ${answeredCount} of ${totalQuestions} questions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => completeAttemptMutation.mutate() },
      ]
    );
  };

  if (quizQuery.isLoading || questionsQuery.isLoading || startAttemptMutation.isPending) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Preparing quiz...</Text>
      </View>
    );
  }

  if (!quizQuery.data || !questionsQuery.data || questionsQuery.data.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Quiz unavailable</Text>
        <Text style={styles.stateText}>The quiz could not be loaded with questions.</Text>
      </View>
    );
  }

  if (completedAttempt) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <ExamHeroCard
          eyebrow="Quiz Results"
          title={`${completedAttempt.percentageScore.toFixed(0)}%`}
          subtitle={quizQuery.data.title}
          accentColor={completedAttempt.passed ? '#16a34a' : '#dc2626'}
          progress={completedAttempt.percentageScore}
          metrics={[
            { icon: 'check-circle-outline', label: 'Status', value: completedAttempt.passed ? 'Passed' : 'Needs Work' },
            { icon: 'star-outline', label: 'Points', value: `${completedAttempt.pointsEarned}/${completedAttempt.totalPoints}` },
            { icon: 'clock-outline', label: 'Time', value: formatTime(completedAttempt.timeTakenSeconds) },
          ]}
        />

        <GlassCard style={styles.resultCard}>
          <Text style={styles.resultTitle}>Performance Summary</Text>
          <Text style={styles.resultBody}>
            {completedAttempt.passed
              ? 'You cleared the passing threshold for this quiz.'
              : `Passing score: ${quizQuery.data.passingScore}%. Review the weak answers and try again.`}
          </Text>
        </GlassCard>

        <GlassCard style={styles.reviewCard}>
          <Text style={styles.resultTitle}>Answer Review</Text>
          {questionsQuery.data.map((question, index) => {
            const answer = completedAttempt.answers.find((item) => item.question === question.id);
            const selectedOptionText =
              question.options.find((option) => option.id === answer?.selectedOption)?.optionText || answer?.textAnswer || 'No answer';

            return (
              <View key={question.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewQuestion}>Q{index + 1}</Text>
                  <MaterialCommunityIcons
                    name={answer?.isCorrect ? 'check-circle' : 'close-circle'}
                    size={18}
                    color={answer?.isCorrect ? '#16a34a' : '#dc2626'}
                  />
                </View>
                <Text style={styles.reviewPrompt}>{question.questionText}</Text>
                <Text style={styles.reviewAnswer}>Your answer: {selectedOptionText}</Text>
                {answer?.correctAnswerText ? (
                  <Text style={styles.reviewCorrect}>Correct answer: {answer.correctAnswerText}</Text>
                ) : null}
                {question.explanation ? (
                  <Text style={styles.reviewExplanation}>{question.explanation}</Text>
                ) : null}
              </View>
            );
          })}
        </GlassCard>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.replace('QuizPlayer', { quizId })}>
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.white} />
            <Text style={styles.primaryActionText}>Retake Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryActionText}>Back to Quizzes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const currentQuestion = questionsQuery.data[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Question unavailable</Text>
        <Text style={styles.stateText}>The current quiz question could not be loaded.</Text>
      </View>
    );
  }

  const answeredIndexes = questionsQuery.data.reduce<number[]>((accumulator, question, index) => {
    if (answers[question.id] !== undefined && answers[question.id] !== '') {
      accumulator.push(index);
    }
    return accumulator;
  }, []);
  const answeredCount = answeredIndexes.length;
  const progress = (answeredCount / questionsQuery.data.length) * 100;
  const isObjective = currentQuestion.questionType === 'multiple_choice' || currentQuestion.questionType === 'true_false';

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow="LMS Quiz"
          title={quizQuery.data.title}
          subtitle={quizQuery.data.description || 'Answer carefully. Submit once you are ready.'}
          accentColor="#7c3aed"
          progress={progress}
          metrics={[
            { icon: 'help-circle-outline', label: 'Questions', value: `${currentQuestionIndex + 1}/${questionsQuery.data.length}` },
            { icon: 'check-circle-outline', label: 'Answered', value: `${answeredCount}/${questionsQuery.data.length}` },
            { icon: 'clock-outline', label: 'Timer', value: quizQuery.data.timeLimitMinutes ? formatTime(timeRemaining) : 'No limit' },
          ]}
        />
        <QuestionPalette
          total={questionsQuery.data.length}
          currentIndex={currentQuestionIndex}
          answeredIndexes={answeredIndexes}
          accentColor="#7c3aed"
          onSelect={setCurrentQuestionIndex}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <GlassCard style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionLabel}>Question {currentQuestionIndex + 1}</Text>
            <Text style={styles.questionPoints}>{currentQuestion.points} pts</Text>
          </View>
          <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

          {isObjective ? (
            <View style={styles.optionList}>
              {currentQuestion.options.map((option) => {
                const selected = answers[currentQuestion.id] === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.optionButton, selected && styles.optionButtonActive]}
                    onPress={() => handleAnswerChange(currentQuestion.id, option.id)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.optionMarker, selected && styles.optionMarkerActive]}>
                      <Text style={[styles.optionMarkerText, selected && styles.optionMarkerTextActive]}>
                        {String.fromCharCode(65 + Math.max(option.order - 1, 0))}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.optionText}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Type your answer here..."
              placeholderTextColor={theme.textSecondary}
              value={typeof answers[currentQuestion.id] === 'string' ? String(answers[currentQuestion.id]) : ''}
              onChangeText={(value) => handleAnswerChange(currentQuestion.id, value)}
              textAlignVertical="top"
            />
          )}
        </GlassCard>
      </ScrollView>

      <GlassCard style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
          disabled={currentQuestionIndex === 0}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={currentQuestionIndex === 0 ? theme.textMuted : '#7c3aed'} />
          <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.navButtonTextDisabled]}>Previous</Text>
        </TouchableOpacity>

        {currentQuestionIndex === questionsQuery.data.length - 1 ? (
          <TouchableOpacity
            style={[styles.submitButton, completeAttemptMutation.isPending && styles.buttonDisabled]}
            onPress={handleFinishQuiz}
            disabled={completeAttemptMutation.isPending}
          >
            <Text style={styles.submitButtonText}>{completeAttemptMutation.isPending ? 'Submitting...' : 'Finish Quiz'}</Text>
            <MaterialCommunityIcons name="check" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => setCurrentQuestionIndex((current) => Math.min(questionsQuery.data.length - 1, current + 1))}
          >
            <Text style={styles.submitButtonText}>Next</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        )}
      </GlassCard>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      gap: 14,
    },
    chrome: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 12,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: 24,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 12,
    },
    stateText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    questionCard: {
      padding: 20,
      borderRadius: 28,
      gap: 16,
    },
    questionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    questionLabel: {
      ...theme.typography.caption,
      color: '#7c3aed',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    questionPoints: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    questionText: {
      ...theme.typography.h3,
      color: theme.text,
      lineHeight: 28,
    },
    optionList: {
      gap: 12,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)',
    },
    optionButtonActive: {
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.12)',
    },
    optionMarker: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
    },
    optionMarkerActive: {
      backgroundColor: '#7c3aed',
    },
    optionMarkerText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
    },
    optionMarkerTextActive: {
      color: '#ffffff',
    },
    optionText: {
      ...theme.typography.body,
      color: theme.text,
      flex: 1,
    },
    optionTextActive: {
      color: '#5b21b6',
      fontWeight: '600',
    },
    textInput: {
      ...theme.typography.body,
      minHeight: 180,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      padding: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
      color: theme.text,
      textAlignVertical: 'top',
    },
    footer: {
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 14,
      borderRadius: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minWidth: 132,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#7c3aed',
    },
    navButtonDisabled: {
      borderColor: theme.border,
    },
    navButtonText: {
      ...theme.typography.button,
      color: '#7c3aed',
    },
    navButtonTextDisabled: {
      color: theme.textMuted,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minWidth: 148,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 18,
      backgroundColor: '#7c3aed',
    },
    submitButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    resultCard: {
      padding: 20,
      borderRadius: 28,
      gap: 10,
    },
    resultTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    resultBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    reviewCard: {
      padding: 20,
      borderRadius: 28,
      gap: 16,
    },
    reviewItem: {
      gap: 6,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewQuestion: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    reviewPrompt: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '600',
    },
    reviewAnswer: {
      ...theme.typography.body,
      color: theme.textSecondary,
    },
    reviewCorrect: {
      ...theme.typography.body,
      color: '#16a34a',
    },
    reviewExplanation: {
      ...theme.typography.body,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    actionsRow: {
      gap: 12,
      paddingBottom: 20,
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
    },
    secondaryActionText: {
      ...theme.typography.button,
      color: theme.text,
    },
  });

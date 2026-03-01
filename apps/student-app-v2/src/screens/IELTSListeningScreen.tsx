// apps/student-app-v2/src/screens/IELTSListeningScreen.tsx

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
import { Audio } from 'expo-av';
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

type RouteParams = RouteProp<AppStackParamList & { IELTSListening: { examId: number } }, 'IELTSListening'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const IELTSListeningScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { examId } = route.params;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(30 * 60); // 30 minutes
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioFinished, setAudioFinished] = useState(false);

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
      Alert.alert('Success', 'Exam started! The audio will play automatically. Listen carefully as it will play only once.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start exam');
      navigation.goBack();
    },
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: number; answer: string }) =>
      ieltsApi.submitAnswer(attemptId!, {
        question_id: questionId,
        text_answer: answer,
      }),
  });

  // Submit attempt mutation
  const submitAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.submitAttempt(attemptId!),
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['ielts-attempts'] });
      Alert.alert(
        'Submitted!',
        'Your answers have been submitted. You will receive your results soon.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('IELTSResults', { attemptId: attempt.id }),
          },
        ]
      );
    },
  });

  // Initialize exam and load audio
  useEffect(() => {
    if (!attemptId && exam) {
      createAttemptMutation.mutate();
    }
  }, [exam]);

  // Load audio when questions are available
  useEffect(() => {
    if (questions && questions.length > 0 && attemptId && !sound) {
      loadAudio();
    }

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [questions, attemptId]);

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

  const loadAudio = async () => {
    try {
      // Find the first question with audio
      const questionWithAudio = questions?.find(q => q.audio_file);
      if (!questionWithAudio?.audio_file) {
        Alert.alert('Error', 'No audio file found for this exam');
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: questionWithAudio.audio_file },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setAudioPosition(status.positionMillis);
      setAudioDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setAudioFinished(true);
        Alert.alert(
          'Audio Finished',
          'The listening has finished. Please complete your answers.'
        );
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAudioTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    return formatTime(totalSeconds);
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleQuestionSelect = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);

    // Submit all answers first
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

      // Then submit the attempt
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

  // Guard against undefined question
  if (!currentQuestion) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No question available</Text>
      </View>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;
  const audioProgress = audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0;
  const answeredIndexes = questions.reduce<number[]>((acc, question, index) => {
    if (answers[question.id]) {
      acc.push(index);
    }
    return acc;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow="IELTS Listening"
          title={exam.title}
          subtitle="One-pass listening flow with answer palette and timed completion."
          accentColor="#1976D2"
          progress={progress}
          metrics={[
            { icon: 'clock-outline', label: 'Time left', value: formatTime(timeRemaining) },
            { icon: 'headphones', label: 'Audio', value: audioFinished ? 'Finished' : isPlaying ? 'Playing' : 'Loading' },
            { icon: 'check-circle-outline', label: 'Answered', value: `${answeredCount}/${questions.length}` },
          ]}
        />
        <GlassCard style={styles.audioContainer}>
          <View style={styles.audioHeader}>
            <MaterialCommunityIcons
              name={isPlaying ? 'pause-circle' : audioFinished ? 'check-circle' : 'play-circle'}
              size={48}
              color={audioFinished ? '#2E7D32' : theme.colors.primary500}
            />
            <View style={styles.audioInfo}>
              <Text style={styles.audioTitle}>
                {audioFinished ? 'Audio Completed' : isPlaying ? 'Now Playing...' : 'Loading Audio...'}
              </Text>
              <Text style={styles.audioSubtitle}>
                Listen carefully - the recording plays once.
              </Text>
            </View>
          </View>
          <View style={styles.audioProgressContainer}>
            <View style={[styles.audioProgressBar, { width: `${audioProgress}%` }]} />
          </View>
          <Text style={styles.audioTime}>
            {formatAudioTime(audioPosition)} / {formatAudioTime(audioDuration)}
          </Text>
        </GlassCard>
        <QuestionPalette
          total={questions.length}
          currentIndex={currentQuestionIndex}
          answeredIndexes={answeredIndexes}
          accentColor="#1976D2"
          onSelect={handleQuestionSelect}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Current Question */}
        <GlassCard style={styles.questionCard}>
          <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1}</Text>
          <Text style={styles.questionType}>{currentQuestion.question_type_display}</Text>
          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

          {/* Answer Input */}
          {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && currentQuestion.options.length > 0 ? (
            <View style={styles.optionsContainer}>
              {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    answers[currentQuestion.id] === option && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleAnswerChange(currentQuestion.id, option)}
                >
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
            />
          )}
        </GlassCard>
      </ScrollView>

      {/* Submit Button */}
      <GlassCard style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Exam</Text>
          <MaterialCommunityIcons name="check" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </GlassCard>

      {/* Submit Confirmation Modal */}
      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FF6F00" />
            <Text style={styles.modalTitle}>Submit Exam?</Text>
            <Text style={styles.modalText}>
              You have answered {answeredCount} out of {questions.length} questions.
            </Text>
            {!audioFinished && (
              <Text style={[styles.modalText, { color: '#D32F2F' }]}>
                ⚠️ The audio is still playing or hasn't finished yet!
              </Text>
            )}
            <Text style={styles.modalText}>
              Are you sure you want to submit? You cannot change your answers after submission.
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
    flex: 1,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginLeft: theme.spacing.sm,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1976D2',
    borderRadius: 3,
  },
  progressText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
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
  audioContainer: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  audioInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  audioTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    fontSize: 16,
  },
  audioSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 2,
  },
  audioProgressContainer: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  audioProgressBar: {
    height: '100%',
    backgroundColor: '#1976D2',
    borderRadius: 4,
  },
  audioTime: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  questionNav: {
    maxHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm,
  },
  questionNavItem: {
    width: 40,
    height: 40,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNavItemActive: {
    backgroundColor: theme.colors.primary500,
  },
  questionNavItemAnswered: {
    backgroundColor: '#1976D2',
  },
  questionNavText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    fontWeight: '600',
  },
  questionNavTextActive: {
    color: theme.colors.white,
  },
  questionCard: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    ...theme.shadows.sm,
  },
  questionNumber: {
    ...theme.typography.h3,
    color: theme.colors.primary500,
    marginBottom: theme.spacing.xs,
  },
  questionType: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
  },
  questionText: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  optionButton: {
    padding: theme.spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary500,
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    ...theme.typography.body,
    color: theme.colors.gray800,
  },
  optionTextSelected: {
    color: theme.colors.primary500,
    fontWeight: '600',
  },
  textInput: {
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    backgroundColor: '#1976D2',
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
    marginBottom: theme.spacing.sm,
  },
  modalText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
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
    backgroundColor: '#1976D2',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
});

// apps/student-app-v2/src/screens/IELTSSpeakingScreen.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

type RouteParams = RouteProp<AppStackParamList & { IELTSSpeaking: { examId: number } }, 'IELTSSpeaking'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type SpeakingPart = 1 | 2 | 3;

export const IELTSSpeakingScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { examId } = route.params;

  const [currentPart, setCurrentPart] = useState<SpeakingPart>(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [preparationTime, setPreparationTime] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);

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
      Alert.alert(
        'Speaking Test Started',
        'The speaking simulation has three parts. Record each response clearly and move only when the response is saved.'
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start exam');
      navigation.goBack();
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, audioUri }: { questionId: number; audioUri: string }) => {
      const audioFile = await fetch(audioUri);
      const audioBlob = await audioFile.blob();

      return ieltsApi.submitAnswer(attemptId!, {
        question_id: questionId,
        audio_response: audioBlob as any,
      });
    },
  });

  const submitAttemptMutation = useMutation({
    mutationFn: () => ieltsApi.submitAttempt(attemptId!),
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['ielts-attempts'] });
      Alert.alert(
        'Submitted!',
        'Your speaking responses were sent for AI evaluation: fluency, vocabulary, grammar, and pronunciation.',
        [{ text: 'OK', onPress: () => navigation.navigate('IELTSResults', { attemptId: attempt.id }) }]
      );
    },
  });

  useEffect(() => {
    if (!attemptId && exam) {
      createAttemptMutation.mutate();
    }
  }, [attemptId, exam]);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is required for the speaking test.');
        navigation.goBack();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, [navigation]);

  useEffect(() => {
    if (isPreparing && preparationTime > 0) {
      const timer = setTimeout(() => setPreparationTime((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (isPreparing && preparationTime === 0) {
      setIsPreparing(false);
      Alert.alert('Preparation Complete', 'Preparation time is over. Start your recorded response now.');
    }

    return undefined;
  }, [isPreparing, preparationTime]);

  useEffect(() => {
    if (isRecording) {
      const timer = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    }

    return undefined;
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets['HIGH_QUALITY']
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Check microphone permissions and try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);

      if (uri && currentQuestion) {
        setRecordings((prev) => ({ ...prev, [currentQuestion.id]: uri }));
        Alert.alert('Saved', 'Your response was recorded.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to save recording.');
    }
  };

  const startPreparation = () => {
    setIsPreparing(true);
    setPreparationTime(60);
  };

  const getQuestionPart = (questionType: string): SpeakingPart => {
    if (questionType === 'introduction') {
      return 1;
    }
    if (questionType === 'long_turn') {
      return 2;
    }
    return 3;
  };

  const moveToNextPart = (nextPart: SpeakingPart) => {
    setCurrentPart(nextPart);
    setCurrentQuestionIndex(0);

    if (nextPart === 2) {
      Alert.alert(
        'Part 2: Cue Card',
        'You will have 1 minute to prepare. Then record a 1-2 minute response.'
      );
    } else if (nextPart === 3) {
      Alert.alert(
        'Part 3: Discussion',
        'Now continue with a deeper discussion related to the cue card topic.'
      );
    }
  };

  const handleNextQuestion = () => {
    if (!questions) {
      return;
    }

    const partQuestions = questions.filter((question) => getQuestionPart(question.question_type) === currentPart);
    if (currentQuestionIndex < partQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      return;
    }

    if (currentPart < 3) {
      moveToNextPart((currentPart + 1) as SpeakingPart);
    }
  };

  const handleSubmit = () => {
    const totalRecordings = Object.keys(recordings).length;
    const totalQuestions = questions?.length || 0;

    if (totalRecordings < totalQuestions) {
      Alert.alert(
        'Incomplete Responses',
        `You have recorded ${totalRecordings} out of ${totalQuestions} responses. Submit anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', onPress: () => setShowSubmitModal(true) },
        ]
      );
      return;
    }

    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);

    if (attemptId) {
      for (const [questionId, audioUri] of Object.entries(recordings)) {
        await submitAnswerMutation.mutateAsync({
          questionId: Number(questionId),
          audioUri,
        });
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

  const partQuestions = questions.filter((question) => getQuestionPart(question.question_type) === currentPart);
  const currentQuestion = partQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === partQuestions.length - 1 && currentPart === 3;
  const hasRecording = currentQuestion ? Boolean(recordings[currentQuestion.id]) : false;
  const answeredIndexes = partQuestions.reduce<number[]>((acc, question, index) => {
    if (recordings[question.id]) {
      acc.push(index);
    }
    return acc;
  }, []);

  const getPartInfo = (part: SpeakingPart) => {
    switch (part) {
      case 1:
        return {
          title: 'Part 1: Introduction & Interview',
          duration: '4-5 min',
          color: '#2E7D32',
          icon: 'account-voice',
        };
      case 2:
        return {
          title: 'Part 2: Long Turn / Cue Card',
          duration: '3-4 min',
          color: '#1976D2',
          icon: 'cards-outline',
        };
      default:
        return {
          title: 'Part 3: Two-way Discussion',
          duration: '4-5 min',
          color: '#7B1FA2',
          icon: 'forum-outline',
        };
    }
  };

  const partInfo = getPartInfo(currentPart);
  const totalRecorded = Object.keys(recordings).length;
  const statusText = useMemo(() => {
    if (isPreparing) {
      return `Prep ${formatTime(preparationTime)}`;
    }
    if (isRecording) {
      return `Recording ${formatTime(recordingDuration)}`;
    }
    return hasRecording ? 'Saved' : 'Ready';
  }, [hasRecording, isPreparing, isRecording, preparationTime, recordingDuration]);

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow="IELTS Speaking"
          title={partInfo.title}
          subtitle={exam.title}
          accentColor={partInfo.color}
          progress={(totalRecorded / Math.max(questions.length, 1)) * 100}
          metrics={[
            { icon: partInfo.icon as keyof typeof MaterialCommunityIcons.glyphMap, label: 'Duration', value: partInfo.duration },
            { icon: 'microphone-outline', label: 'Responses', value: `${totalRecorded}/${questions.length}` },
            { icon: 'robot-outline', label: 'Status', value: statusText },
          ]}
        />

        <GlassCard style={styles.partStrip}>
          {[1, 2, 3].map((part) => {
            const active = currentPart === part;
            const completed = currentPart > part;
            return (
              <TouchableOpacity
                key={part}
                style={[
                  styles.partChip,
                  active && [styles.partChipActive, { borderColor: partInfo.color, backgroundColor: `${partInfo.color}22` }],
                  completed && styles.partChipCompleted,
                ]}
                activeOpacity={0.9}
                disabled
              >
                <Text style={[styles.partChipLabel, active && { color: partInfo.color }, completed && styles.partChipLabelCompleted]}>
                  Part {part}
                </Text>
              </TouchableOpacity>
            );
          })}
        </GlassCard>

        <QuestionPalette
          total={partQuestions.length}
          currentIndex={currentQuestionIndex}
          answeredIndexes={answeredIndexes}
          accentColor={partInfo.color}
          onSelect={setCurrentQuestionIndex}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {currentPart === 2 && !isPreparing && !hasRecording && (
          <GlassCard style={styles.instructionCard}>
            <MaterialCommunityIcons name="information-outline" size={22} color="#1976D2" />
            <Text style={styles.instructionText}>
              Part 2 starts with one minute of preparation. Use that time to organize a clear structure before recording.
            </Text>
          </GlassCard>
        )}

        {currentQuestion && (
          <GlassCard style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <View>
                <Text style={styles.questionNumber}>
                  Question {currentQuestionIndex + 1} of {partQuestions.length}
                </Text>
                <Text style={styles.questionPartLabel}>{partInfo.duration}</Text>
              </View>
              {hasRecording && (
                <View style={styles.recordedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
                  <Text style={styles.recordedText}>Recorded</Text>
                </View>
              )}
            </View>

            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

            {currentPart === 2 &&
            currentQuestion.speaking_prompts &&
            currentQuestion.speaking_prompts.length > 0 && (
              <View style={styles.cueCard}>
                <Text style={styles.cueCardTitle}>You should talk about</Text>
                {(Array.isArray(currentQuestion.speaking_prompts) ? currentQuestion.speaking_prompts : []).map((prompt, index) => (
                  <Text key={`${currentQuestion.id}-${index}`} style={styles.cueCardPrompt}>
                    • {prompt}
                  </Text>
                ))}
              </View>
            )}
          </GlassCard>
        )}

        {currentPart === 2 && isPreparing && (
          <GlassCard style={styles.preparationCard}>
            <MaterialCommunityIcons name="timer-sand" size={46} color="#FF6F00" />
            <Text style={styles.preparationTitle}>Preparation Time</Text>
            <Text style={styles.preparationTimer}>{formatTime(preparationTime)}</Text>
            <Text style={styles.preparationText}>Make short notes and structure your answer.</Text>
          </GlassCard>
        )}

        {!isPreparing && (
          <GlassCard style={styles.recordingContainer}>
            <View style={styles.recordingHeader}>
              <Text style={styles.recordingTitle}>Response Capture</Text>
              <Text style={styles.recordingSubtitle}>
                Record once clearly. Re-record if you need a cleaner final submission.
              </Text>
            </View>

            {!isRecording && !hasRecording && currentPart === 2 && (
              <TouchableOpacity style={styles.prepareButton} onPress={startPreparation}>
                <MaterialCommunityIcons name="pencil" size={22} color={theme.colors.white} />
                <Text style={styles.prepareButtonText}>Start preparation</Text>
              </TouchableOpacity>
            )}

            {!isRecording && !hasRecording && (currentPart !== 2 || preparationTime === 0) && (
              <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                <MaterialCommunityIcons name="microphone" size={34} color={theme.colors.white} />
                <Text style={styles.recordButtonText}>Start recording</Text>
              </TouchableOpacity>
            )}

            {isRecording && (
              <View style={styles.recordingActive}>
                <View style={styles.recordingPulse}>
                  <MaterialCommunityIcons name="microphone" size={34} color="#D32F2F" />
                </View>
                <Text style={styles.recordingText}>Recording live</Text>
                <Text style={styles.recordingDuration}>{formatTime(recordingDuration)}</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                  <MaterialCommunityIcons name="stop" size={20} color={theme.colors.white} />
                  <Text style={styles.stopButtonText}>Stop recording</Text>
                </TouchableOpacity>
              </View>
            )}

            {hasRecording && !isRecording && (
              <View style={styles.recordedState}>
                <MaterialCommunityIcons name="check-circle" size={48} color="#2E7D32" />
                <Text style={styles.recordedStateText}>Response saved</Text>
                <TouchableOpacity
                  style={styles.reRecordButton}
                  onPress={() => {
                    setRecordings((prev) => {
                      const next = { ...prev };
                      if (currentQuestion) {
                        delete next[currentQuestion.id];
                      }
                      return next;
                    });
                  }}
                >
                  <MaterialCommunityIcons name="refresh" size={18} color="#1976D2" />
                  <Text style={styles.reRecordButtonText}>Re-record</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        )}
      </ScrollView>

      <GlassCard style={styles.footer}>
        {!isLastQuestion ? (
          <TouchableOpacity
            style={[styles.nextButton, !hasRecording && styles.nextButtonDisabled]}
            onPress={handleNextQuestion}
            disabled={!hasRecording}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestionIndex === partQuestions.length - 1 ? 'Next part' : 'Next question'}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={hasRecording ? theme.colors.white : theme.colors.gray400}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.nextButtonText}>Submit all responses</Text>
            <MaterialCommunityIcons name="check" size={22} color={theme.colors.white} />
          </TouchableOpacity>
        )}
      </GlassCard>

      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent}>
            <MaterialCommunityIcons name="robot-outline" size={46} color="#E65100" />
            <Text style={styles.modalTitle}>Submit Speaking Test?</Text>
            <Text style={styles.modalText}>
              Recorded responses: {Object.keys(recordings).length} / {questions.length}
            </Text>
            <View style={styles.modalEvaluationInfo}>
              <Text style={styles.modalEvaluationTitle}>AI rubric</Text>
              <Text style={styles.modalEvaluationItem}>Fluency and coherence</Text>
              <Text style={styles.modalEvaluationItem}>Lexical resource</Text>
              <Text style={styles.modalEvaluationItem}>Grammar range and accuracy</Text>
              <Text style={styles.modalEvaluationItem}>Pronunciation</Text>
            </View>
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
  partStrip: {
    padding: theme.spacing.sm,
    borderRadius: 24,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  partChip: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  partChipActive: {
    borderWidth: 1.5,
  },
  partChipCompleted: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  partChipLabel: {
    ...theme.typography.button,
    color: theme.colors.gray700,
  },
  partChipLabelCompleted: {
    color: '#2E7D32',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: 24,
  },
  instructionText: {
    ...theme.typography.body,
    color: theme.colors.gray800,
    flex: 1,
    lineHeight: 22,
  },
  questionCard: {
    padding: theme.spacing.xl,
    borderRadius: 28,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  questionNumber: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  questionPartLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  recordedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8F5E9',
    gap: 4,
  },
  recordedText: {
    ...theme.typography.caption,
    color: '#2E7D32',
    fontWeight: '700',
  },
  questionText: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    fontSize: 18,
    lineHeight: 27,
  },
  cueCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: 20,
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  cueCardTitle: {
    ...theme.typography.body,
    color: '#E65100',
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  cueCardPrompt: {
    ...theme.typography.body,
    color: theme.colors.gray800,
    lineHeight: 22,
    marginBottom: theme.spacing.xs,
  },
  preparationCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: 28,
  },
  preparationTitle: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
  },
  preparationTimer: {
    ...theme.typography.h1,
    color: '#FF6F00',
    fontSize: 48,
    fontWeight: '700',
    marginVertical: theme.spacing.md,
  },
  preparationText: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: 28,
    gap: theme.spacing.lg,
  },
  recordingHeader: {
    width: '100%',
    alignItems: 'center',
  },
  recordingTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
  },
  recordingSubtitle: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  prepareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 18,
    backgroundColor: '#1976D2',
    width: '100%',
  },
  prepareButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  recordButton: {
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: '#E65100',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...theme.shadows.lg,
  },
  recordButtonText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: '700',
  },
  recordingActive: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recordingPulse: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FFEBEE',
    borderWidth: 4,
    borderColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingText: {
    ...theme.typography.h3,
    color: '#D32F2F',
  },
  recordingDuration: {
    ...theme.typography.h2,
    color: theme.colors.gray900,
    fontSize: 34,
    fontWeight: '700',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 18,
    backgroundColor: '#D32F2F',
  },
  stopButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  recordedState: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recordedStateText: {
    ...theme.typography.h3,
    color: '#2E7D32',
  },
  reRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 16,
  },
  reRecordButtonText: {
    ...theme.typography.button,
    color: '#1976D2',
  },
  footer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: 18,
    backgroundColor: '#E65100',
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  nextButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: 18,
    backgroundColor: '#E65100',
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
  modalEvaluationInfo: {
    width: '100%',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: 18,
    backgroundColor: '#FFF3E0',
    gap: 4,
  },
  modalEvaluationTitle: {
    ...theme.typography.body,
    color: '#E65100',
    fontWeight: '700',
    marginBottom: 4,
  },
  modalEvaluationItem: {
    ...theme.typography.body,
    color: theme.colors.gray700,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing.md,
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
    backgroundColor: '#E65100',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
});

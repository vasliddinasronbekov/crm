import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
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
import { useTranslation } from 'react-i18next';

import { satApi, type SATAttempt, type SATQuestion, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { ExamHeroCard } from '../components/exam/ExamHeroCard';
import { QuestionPalette } from '../components/exam/QuestionPalette';
import type { AppStackParamList } from '../navigation/types';

type RouteParams = RouteProp<AppStackParamList, 'SATExam'>;
type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

type ModuleState = 'rw_module1' | 'rw_module2' | 'math_module1' | 'math_module2' | 'completed';
type ActiveModuleState = Exclude<ModuleState, 'completed'>;

type SavedAnswerMap = Record<number, { answer: string }>;

interface LocalSATRecoverySnapshot {
  examId: number;
  attemptId: number;
  currentModule: ModuleState;
  currentQuestionIndex: number;
  timeRemaining: number;
  answers: SavedAnswerMap;
  markedQuestionIds: number[];
  lastUpdatedAt: string;
}

const MODULE_ORDER: ActiveModuleState[] = ['rw_module1', 'rw_module2', 'math_module1', 'math_module2'];
const SAT_RECOVERY_PREFIX = 'sat-runtime';

const getDefaultModuleTime = (moduleName: ActiveModuleState) => (moduleName.startsWith('math') ? 35 * 60 : 32 * 60);

const isActiveModule = (value?: string): value is ActiveModuleState =>
  value === 'rw_module1' || value === 'rw_module2' || value === 'math_module1' || value === 'math_module2';

const satRecoveryKey = (attemptId: number) => `${SAT_RECOVERY_PREFIX}:${attemptId}`;

const readRecoverySnapshot = async (attemptId: number): Promise<LocalSATRecoverySnapshot | null> => {
  const raw = await AsyncStorage.getItem(satRecoveryKey(attemptId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LocalSATRecoverySnapshot;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeRecoverySnapshot = async (snapshot: LocalSATRecoverySnapshot) => {
  await AsyncStorage.setItem(satRecoveryKey(snapshot.attemptId), JSON.stringify(snapshot));
};

const clearRecoverySnapshot = async (attemptId?: number | null) => {
  if (!attemptId) {
    return;
  }
  await AsyncStorage.removeItem(satRecoveryKey(attemptId));
};

const moduleKeyFromSection = (section: 'reading_writing' | 'math', moduleNumber: number): ActiveModuleState | null => {
  if (section === 'reading_writing') {
    return moduleNumber === 1 ? 'rw_module1' : 'rw_module2';
  }
  if (section === 'math') {
    return moduleNumber === 1 ? 'math_module1' : 'math_module2';
  }
  return null;
};

const moduleOrderIndex = (moduleName: ModuleState) => {
  if (moduleName === 'completed') {
    return MODULE_ORDER.length;
  }
  return MODULE_ORDER.indexOf(moduleName);
};

const countAnsweredValues = (map: SavedAnswerMap) =>
  Object.values(map).filter((entry) => typeof entry.answer === 'string' && entry.answer.trim().length > 0).length;

export const SATExamScreen = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { examId } = route.params;

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<SATAttempt['status'] | null>(null);
  const [currentModule, setCurrentModule] = useState<ModuleState>('rw_module1');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(32 * 60);
  const [answers, setAnswers] = useState<SavedAnswerMap>({});
  const [markedQuestionIds, setMarkedQuestionIds] = useState<number[]>([]);
  const [moduleQuestions, setModuleQuestions] = useState<SATQuestion[]>([]);
  const [moduleQuestionCache, setModuleQuestionCache] = useState<Partial<Record<ActiveModuleState, SATQuestion[]>>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const hydratedAttemptRef = useRef<number | null>(null);
  const leaveConfirmedRef = useRef(false);
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const getModuleTitle = useCallback(
    (moduleName: ActiveModuleState) => {
      if (moduleName === 'rw_module1') return t('exams.satExam.module.rw1');
      if (moduleName === 'rw_module2') return t('exams.satExam.module.rw2');
      if (moduleName === 'math_module1') return t('exams.satExam.module.math1');
      return t('exams.satExam.module.math2');
    },
    [t]
  );

  const examQuery = useQuery({
    queryKey: ['sat-exam', examId],
    queryFn: () => satApi.getExam(examId),
  });

  const modulesQuery = useQuery({
    queryKey: ['sat-modules', examId],
    queryFn: () => satApi.getExamModules(examId),
    enabled: examQuery.isSuccess,
  });

  const attemptsQuery = useQuery({
    queryKey: ['sat-attempts'],
    queryFn: () => satApi.getMyAttempts(),
  });

  const activeAttempt = useMemo(
    () =>
      (attemptsQuery.data || []).find(
        (attempt) => attempt.exam === examId && (attempt.status === 'payment_pending' || attempt.status === 'in_progress')
      ) || null,
    [attemptsQuery.data, examId]
  );

  const attemptDetailQuery = useQuery({
    queryKey: ['sat-attempt-detail', attemptId],
    queryFn: () => satApi.getAttempt(attemptId!),
    enabled: Boolean(attemptId),
  });

  const createAttemptMutation = useMutation({
    mutationFn: () => satApi.createAttempt({ exam_id: examId }),
    onSuccess: (attempt) => {
      setAttemptId(attempt.id);
      setAttemptStatus(attempt.status);
    },
    onError: (error: any) => {
      Alert.alert(t('exams.satExam.alerts.examUnavailableTitle'), error?.response?.data?.detail || t('exams.satExam.alerts.examUnavailableBody'));
      navigation.goBack();
    },
  });

  const payAttemptMutation = useMutation({
    mutationFn: (id: number) => satApi.payExam(id),
    onSuccess: async () => {
      await attemptsQuery.refetch();
      if (attemptId) {
        await queryClient.invalidateQueries({ queryKey: ['sat-attempt-detail', attemptId] });
      }
    },
    onError: (error: any) => {
      Alert.alert(t('exams.satExam.alerts.paymentFailedTitle'), error?.response?.data?.detail || t('exams.satExam.alerts.paymentFailedBody'));
      navigation.goBack();
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: number; answer: string }) =>
      satApi.submitAnswer(attemptId!, {
        question_id: questionId,
        answer_given: { answer },
      }),
  });

  const syncStateMutation = useMutation({
    mutationFn: (payload: { current_module_key: string; current_question_index: number; module_time_remaining_seconds: number }) =>
      satApi.syncState(attemptId!, payload),
    onSuccess: (attempt) => {
      setAttemptStatus(attempt.status);
    },
  });

  const completeAttemptMutation = useMutation({
    mutationFn: () => satApi.completeAttempt(attemptId!),
    onSuccess: async (attempt) => {
      leaveConfirmedRef.current = true;
      setAttemptStatus(attempt.status);
      await clearRecoverySnapshot(attempt.id);
      await queryClient.invalidateQueries({ queryKey: ['sat-attempts'] });
      navigation.replace('SATResults', { attemptId: attempt.id });
    },
    onError: (error: any) => {
      Alert.alert(t('exams.satExam.alerts.submitFailedTitle'), error?.response?.data?.detail || t('exams.satExam.alerts.submitFailedBody'));
    },
  });

  const findModuleRecord = useCallback(
    (moduleName: ActiveModuleState) => {
      return (modulesQuery.data || []).find((item) => {
        const expectedKey = moduleKeyFromSection(item.section, item.module_number);
        return expectedKey === moduleName;
      });
    },
    [modulesQuery.data]
  );

  const fetchModuleQuestions = useCallback(
    async (moduleName: ActiveModuleState) => {
      const cached = moduleQuestionCache[moduleName];
      if (cached) {
        return cached;
      }

      const module = findModuleRecord(moduleName);
      if (!module) {
        return [];
      }

      const questions = await satApi.getModuleQuestions(module.id);
      setModuleQuestionCache((current) => ({
        ...current,
        [moduleName]: questions,
      }));
      return questions;
    },
    [findModuleRecord, moduleQuestionCache]
  );

  const loadModuleQuestions = useCallback(
    async (moduleName: ActiveModuleState, questionIndex = 0) => {
      const questions = await fetchModuleQuestions(moduleName);
      setModuleQuestions(questions);
      setCurrentQuestionIndex(Math.max(0, Math.min(questionIndex, Math.max(questions.length - 1, 0))));
      return questions;
    },
    [fetchModuleQuestions]
  );

  const persistRecoverySnapshot = useCallback(
    async (overrides: Partial<LocalSATRecoverySnapshot> = {}) => {
      if (!attemptId) {
        return;
      }

      const snapshot: LocalSATRecoverySnapshot = {
        examId,
        attemptId,
        currentModule,
        currentQuestionIndex,
        timeRemaining,
        answers,
        markedQuestionIds,
        lastUpdatedAt: new Date().toISOString(),
        ...overrides,
      };

      await writeRecoverySnapshot(snapshot);
      setLastSavedAt(snapshot.lastUpdatedAt);
    },
    [answers, attemptId, currentModule, currentQuestionIndex, examId, markedQuestionIds, timeRemaining]
  );

  const replayUnsyncedAnswers = useCallback(
    async (localAnswers: SavedAnswerMap, remoteAnswers: SavedAnswerMap) => {
      if (!attemptId) {
        return;
      }

      const pendingEntries = Object.entries(localAnswers).filter(([questionId, payload]) => {
        const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
        return answer.length > 0 && remoteAnswers[Number(questionId)]?.answer !== answer;
      });

      for (const [questionId, payload] of pendingEntries) {
        await submitAnswerMutation.mutateAsync({
          questionId: Number(questionId),
          answer: payload.answer,
        });
      }
    },
    [attemptId, submitAnswerMutation]
  );

  const hydrateAttempt = useCallback(
    async (attempt: SATAttempt) => {
      const backendAnswers = (attempt.answers || []).reduce<SavedAnswerMap>((accumulator, answer) => {
        const answerValue = answer.answer_given?.answer;
        if (typeof answerValue === 'string' && answerValue.trim().length > 0) {
          accumulator[answer.question] = { answer: answerValue };
        }
        return accumulator;
      }, {});

      const recoverySnapshot = await readRecoverySnapshot(attempt.id);
      const mergedAnswers = recoverySnapshot?.answers ? { ...backendAnswers, ...recoverySnapshot.answers } : backendAnswers;
      const serverTimestamp = Date.parse(
        attempt.last_state_synced_at || attempt.updated_at || attempt.started_at || attempt.created_at || ''
      );
      const localTimestamp = Date.parse(recoverySnapshot?.lastUpdatedAt || '');
      const shouldPreferLocal = Boolean(
        recoverySnapshot &&
          recoverySnapshot.examId === examId &&
          (
            Number.isFinite(localTimestamp) && Number.isFinite(serverTimestamp) && localTimestamp > serverTimestamp + 1500 ||
            countAnsweredValues(recoverySnapshot.answers) > countAnsweredValues(backendAnswers) ||
            moduleOrderIndex(recoverySnapshot.currentModule) > moduleOrderIndex((attempt.current_module_key as ModuleState) || 'rw_module1') ||
            (recoverySnapshot.currentModule === attempt.current_module_key &&
              recoverySnapshot.currentQuestionIndex > (attempt.current_question_index || 0))
          )
      );

      setAttemptId(attempt.id);
      setAttemptStatus(attempt.status);
      setAnswers(mergedAnswers);
      setMarkedQuestionIds(recoverySnapshot?.markedQuestionIds || []);
      setLastSavedAt(recoverySnapshot?.lastUpdatedAt || null);

      if (attempt.status === 'completed' || attempt.status === 'evaluated') {
        leaveConfirmedRef.current = true;
        await clearRecoverySnapshot(attempt.id);
        navigation.replace('SATResults', { attemptId: attempt.id });
        return;
      }

      const restoredModule = shouldPreferLocal
        ? recoverySnapshot?.currentModule || 'rw_module1'
        : (attempt.current_module_key as ModuleState) || 'rw_module1';
      const restoredIndex = shouldPreferLocal
        ? recoverySnapshot?.currentQuestionIndex || 0
        : attempt.current_question_index || 0;
      const restoredTime = shouldPreferLocal
        ? recoverySnapshot?.timeRemaining || 0
        : attempt.module_time_remaining_seconds || (isActiveModule(restoredModule) ? getDefaultModuleTime(restoredModule) : 0);

      setCurrentModule(restoredModule);
      setTimeRemaining(restoredTime);

      if (restoredModule === 'completed') {
        setModuleQuestions([]);
      } else {
        await loadModuleQuestions(restoredModule, restoredIndex);
      }

      if (shouldPreferLocal) {
        setRecoveryNote(t('exams.satExam.recovery.restored'));
      } else if (recoverySnapshot?.lastUpdatedAt) {
        setRecoveryNote(t('exams.satExam.recovery.ready'));
      } else {
        setRecoveryNote(null);
      }

      if (recoverySnapshot?.answers) {
        await replayUnsyncedAnswers(recoverySnapshot.answers, backendAnswers);
      }
    },
    [examId, loadModuleQuestions, navigation, replayUnsyncedAnswers]
  );

  useEffect(() => {
    if (!attemptId && activeAttempt) {
      setAttemptId(activeAttempt.id);
      setAttemptStatus(activeAttempt.status);
    }
  }, [activeAttempt, attemptId]);

  useEffect(() => {
    if (examQuery.isSuccess && modulesQuery.isSuccess && !attemptId && !activeAttempt && !createAttemptMutation.isPending) {
      createAttemptMutation.mutate();
    }
  }, [activeAttempt, attemptId, createAttemptMutation, examQuery.isSuccess, modulesQuery.isSuccess]);

  useEffect(() => {
    const attempt = attemptDetailQuery.data;
    if (!attempt || !modulesQuery.data || hydratedAttemptRef.current === attempt.id) {
      return;
    }

    hydratedAttemptRef.current = attempt.id;

    if (attempt.status === 'payment_pending') {
      setAttemptId(attempt.id);
      setAttemptStatus(attempt.status);
      payAttemptMutation.mutate(attempt.id);
      return;
    }

    void hydrateAttempt(attempt);
  }, [attemptDetailQuery.data, hydrateAttempt, modulesQuery.data, payAttemptMutation]);

  useEffect(() => {
    if (!attemptId || currentModule === 'completed' || attemptStatus !== 'in_progress') {
      return undefined;
    }

    const interval = setInterval(() => {
      setTimeRemaining((previous) => {
        if (previous <= 1) {
          clearInterval(interval);
          void handleModuleComplete({ fromTimer: true });
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attemptId, attemptStatus, currentModule]);

  useEffect(() => {
    if (!attemptId || attemptStatus !== 'in_progress') {
      return undefined;
    }

    const interval = setInterval(() => {
      if (!syncStateMutation.isPending) {
        syncStateMutation.mutate({
          current_module_key: currentModule,
          current_question_index: currentQuestionIndex,
          module_time_remaining_seconds: timeRemaining,
        });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [attemptId, attemptStatus, currentModule, currentQuestionIndex, timeRemaining, syncStateMutation]);

  useEffect(() => {
    if (!attemptId || attemptStatus !== 'in_progress') {
      return undefined;
    }

    const interval = setInterval(() => {
      void persistRecoverySnapshot();
    }, 5000);

    return () => clearInterval(interval);
  }, [attemptId, attemptStatus, persistRecoverySnapshot]);

  useEffect(() => {
    if (!attemptId || attemptStatus !== 'in_progress') {
      return;
    }

    void persistRecoverySnapshot();
  }, [attemptId, attemptStatus, currentModule, currentQuestionIndex, answers, markedQuestionIds, persistRecoverySnapshot]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' || !attemptId || attemptStatus !== 'in_progress') {
        return;
      }

      void persistRecoverySnapshot();
      if (!syncStateMutation.isPending) {
        syncStateMutation.mutate({
          current_module_key: currentModule,
          current_question_index: currentQuestionIndex,
          module_time_remaining_seconds: timeRemaining,
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [attemptId, attemptStatus, currentModule, currentQuestionIndex, persistRecoverySnapshot, syncStateMutation, timeRemaining]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (leaveConfirmedRef.current || !attemptId || attemptStatus !== 'in_progress') {
        return;
      }

      event.preventDefault();
      Alert.alert(
        t('exams.satExam.alerts.leaveTitle'),
        t('exams.satExam.alerts.leaveBody'),
        [
          { text: t('exams.satExam.alerts.stay'), style: 'cancel' },
          {
            text: t('exams.satExam.alerts.leave'),
            style: 'destructive',
            onPress: () => {
              leaveConfirmedRef.current = true;
              void persistRecoverySnapshot();
              navigation.dispatch(event.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [attemptId, attemptStatus, navigation, persistRecoverySnapshot]);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (currentModule !== 'completed') {
      return;
    }

    void Promise.all(MODULE_ORDER.map((moduleName) => fetchModuleQuestions(moduleName)));
  }, [currentModule, fetchModuleQuestions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSavedTime = (value?: string | null) => {
    if (!value) {
      return t('exams.satExam.savedNotYet');
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('exams.satExam.savedLocal') : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const syncCurrentState = (nextModule: ModuleState, nextQuestionIndex: number, nextTime: number) => {
    if (!attemptId || syncStateMutation.isPending) {
      return;
    }
    syncStateMutation.mutate({
      current_module_key: nextModule,
      current_question_index: nextQuestionIndex,
      module_time_remaining_seconds: nextTime,
    });
  };

  const persistAnswer = (questionId: number, answer: string) => {
    if (!attemptId || !answer) {
      return;
    }

    const existingTimer = saveTimersRef.current[questionId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    saveTimersRef.current[questionId] = setTimeout(() => {
      submitAnswerMutation.mutate({ questionId, answer });
    }, 350);
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((current) => ({ ...current, [questionId]: { answer } }));
    persistAnswer(questionId, answer);
  };

  const flushVisibleAnswers = async () => {
    if (!attemptId) {
      return;
    }

    for (const question of moduleQuestions) {
      const answer = answers[question.id]?.answer;
      if (answer) {
        await submitAnswerMutation.mutateAsync({ questionId: question.id, answer });
      }
    }
  };

  const handleQuestionSelect = (index: number) => {
    if (!isActiveModule(currentModule)) {
      return;
    }
    setCurrentQuestionIndex(index);
    syncCurrentState(currentModule, index, timeRemaining);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex === 0 || !isActiveModule(currentModule)) {
      return;
    }
    const nextIndex = currentQuestionIndex - 1;
    setCurrentQuestionIndex(nextIndex);
    syncCurrentState(currentModule, nextIndex, timeRemaining);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex >= moduleQuestions.length - 1 || !isActiveModule(currentModule)) {
      return;
    }
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    syncCurrentState(currentModule, nextIndex, timeRemaining);
  };

  const moveToModule = async (moduleName: ActiveModuleState, questionIndex = 0, overrideTime?: number) => {
    const nextTime = overrideTime ?? getDefaultModuleTime(moduleName);
    setCurrentModule(moduleName);
    setTimeRemaining(nextTime);
    await loadModuleQuestions(moduleName, questionIndex);
    syncCurrentState(moduleName, questionIndex, nextTime);
    await persistRecoverySnapshot({
      currentModule: moduleName,
      currentQuestionIndex: questionIndex,
      timeRemaining: nextTime,
    });
  };

  const toggleMarkedQuestion = (questionId: number) => {
    setMarkedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    );
  };

  const handleModuleComplete = async (options?: { fromTimer?: boolean }) => {
    if (!isActiveModule(currentModule)) {
      return;
    }

    await flushVisibleAnswers();

    const currentModuleIndex = MODULE_ORDER.indexOf(currentModule);
    const nextModule = MODULE_ORDER[currentModuleIndex + 1];

    if (!nextModule) {
      const reviewTime = options?.fromTimer ? 0 : timeRemaining;
      setCurrentModule('completed');
      setCurrentQuestionIndex(0);
      setTimeRemaining(reviewTime);
      setRecoveryNote(
        options?.fromTimer
          ? t('exams.satExam.completion.timeExpired')
          : t('exams.satExam.completion.finalReviewReady')
      );
      syncCurrentState('completed', 0, reviewTime);
      await persistRecoverySnapshot({
        currentModule: 'completed',
        currentQuestionIndex: 0,
        timeRemaining: reviewTime,
      });
      return;
    }

    const alertTitle = nextModule.startsWith('math') && currentModule.startsWith('rw')
      ? t('exams.satExam.completion.rwCompleteTitle')
      : t('exams.satExam.completion.moduleCompleteTitle');
    const alertText = nextModule.endsWith('2')
      ? t('exams.satExam.completion.adaptiveBody')
      : t('exams.satExam.completion.nextSectionBody');

    Alert.alert(alertTitle, alertText, [
      {
        text: t('exams.satExam.alerts.continue'),
        onPress: () => {
          void moveToModule(nextModule);
        },
      },
    ]);
  };

  const reopenFinalModule = async (questionIndex = 0) => {
    const finalModule: ActiveModuleState = MODULE_ORDER[MODULE_ORDER.length - 1] ?? 'math_module2';
    await moveToModule(finalModule, questionIndex, timeRemaining);
    setRecoveryNote(t('exams.satExam.recovery.returned'));
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
    Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
    await flushVisibleAnswers();
    completeAttemptMutation.mutate();
  };

  const isReviewMode = currentModule === 'completed' && attemptStatus === 'in_progress';
  const totalQuestionCount = (examQuery.data?.rw_total_questions || 0) + (examQuery.data?.math_total_questions || 0);
  const totalAnsweredCount = countAnsweredValues(answers);
  const finalModuleKey: ActiveModuleState = MODULE_ORDER[MODULE_ORDER.length - 1] ?? 'math_module2';
  const canReopenFinalModule = isReviewMode && timeRemaining > 0;
  const reviewCacheReady = MODULE_ORDER.every((moduleName) => Array.isArray(moduleQuestionCache[moduleName]));

  const reviewSummaries = useMemo(
    () =>
      MODULE_ORDER.map((moduleName) => {
        const questions = moduleQuestionCache[moduleName] || [];
        const descriptor = findModuleRecord(moduleName);
        const answeredQuestions = questions.filter((question) => {
          const value = answers[question.id]?.answer;
          return typeof value === 'string' && value.trim().length > 0;
        });
        const markedQuestions = questions.filter((question) => markedQuestionIds.includes(question.id));
        const unansweredQuestions = questions.filter((question) => {
          const value = answers[question.id]?.answer;
          return !(typeof value === 'string' && value.trim().length > 0);
        });

        return {
          key: moduleName,
          title: getModuleTitle(moduleName),
          total: questions.length || descriptor?.question_count || 0,
          answered: answeredQuestions.length,
          marked: markedQuestions.length,
          unansweredQuestions,
          locked: moduleName !== finalModuleKey,
        };
      }),
    [answers, finalModuleKey, findModuleRecord, getModuleTitle, markedQuestionIds, moduleQuestionCache]
  );

  const finalModuleSummary = reviewSummaries.find((item) => item.key === finalModuleKey);
  const finalModuleQuestions: SATQuestion[] = moduleQuestionCache[finalModuleKey] ?? [];
  const markedQuestionsInFinalModule = finalModuleQuestions.filter((question: SATQuestion) =>
    markedQuestionIds.includes(question.id)
  );

  if (examQuery.isLoading || modulesQuery.isLoading || attemptsQuery.isLoading || attemptDetailQuery.isLoading || payAttemptMutation.isPending) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('exams.satExam.loadingPreparing')}</Text>
      </View>
    );
  }

  if (!examQuery.data || !modulesQuery.data || (!isReviewMode && moduleQuestions.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error500} />
        <Text style={styles.loadingText}>{t('exams.satExam.loadingUnavailable')}</Text>
      </View>
    );
  }

  const moduleInfoMap: Record<ActiveModuleState, { title: string; color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
    rw_module1: { title: getModuleTitle('rw_module1'), color: '#1976D2', icon: 'book-open-variant' },
    rw_module2: { title: getModuleTitle('rw_module2'), color: '#1565C0', icon: 'brain' },
    math_module1: { title: getModuleTitle('math_module1'), color: '#7B1FA2', icon: 'calculator' },
    math_module2: { title: getModuleTitle('math_module2'), color: '#6A1B9A', icon: 'brain' },
  };

  if (isReviewMode) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content} contentContainerStyle={styles.reviewContentContainer}>
          <View style={styles.chrome}>
            <ExamHeroCard
              eyebrow={t('exams.satExam.finalReviewEyebrow')}
              title={examQuery.data.title}
              subtitle={t('exams.satExam.review.subtitle')}
              accentColor="#22c55e"
              progress={totalQuestionCount > 0 ? (totalAnsweredCount / totalQuestionCount) * 100 : 0}
              metrics={[
                { icon: 'check-circle-outline', label: t('exams.satExam.metricAnswered'), value: `${totalAnsweredCount}/${totalQuestionCount}` },
                { icon: 'bookmark-outline', label: t('exams.satExam.metricMarked'), value: `${markedQuestionIds.length}` },
                { icon: 'content-save-outline', label: t('exams.satExam.metricSaved'), value: formatSavedTime(lastSavedAt) },
              ]}
            />
          </View>

          {recoveryNote ? (
            <GlassCard style={styles.recoveryCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#22c55e" />
                <Text style={styles.cardTitle}>{t('exams.satExam.recovery.crashTitle')}</Text>
              </View>
              <Text style={styles.cardBody}>{recoveryNote}</Text>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.reviewSummaryCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={22} color="#22c55e" />
              <Text style={styles.cardTitle}>{t('exams.satExam.review.submissionReadiness')}</Text>
            </View>
            <View style={styles.reviewStatRow}>
              <View style={styles.reviewStatChip}>
                <Text style={styles.reviewStatValue}>{Math.max(0, totalQuestionCount - totalAnsweredCount)}</Text>
                <Text style={styles.reviewStatLabel}>{t('exams.satExam.review.unanswered')}</Text>
              </View>
              <View style={styles.reviewStatChip}>
                <Text style={styles.reviewStatValue}>{markedQuestionIds.length}</Text>
                <Text style={styles.reviewStatLabel}>{t('exams.satExam.review.marked')}</Text>
              </View>
              <View style={styles.reviewStatChip}>
                <Text style={styles.reviewStatValue}>{formatTime(timeRemaining)}</Text>
                <Text style={styles.reviewStatLabel}>{t('exams.satExam.review.timeLeft')}</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>
              {t('exams.satExam.review.lockedBody')}
            </Text>
          </GlassCard>

          {reviewCacheReady ? (
            <View style={styles.reviewGrid}>
              {reviewSummaries.map((summary) => (
                <GlassCard key={summary.key} style={styles.reviewModuleCard}>
                  <View style={styles.reviewModuleHeader}>
                    <Text style={styles.reviewModuleTitle}>{summary.title}</Text>
                    <View style={[styles.reviewBadge, summary.locked ? styles.reviewBadgeLocked : styles.reviewBadgeOpen]}>
                      <Text style={[styles.reviewBadgeText, summary.locked ? styles.reviewBadgeTextLocked : styles.reviewBadgeTextOpen]}>
                        {summary.locked ? t('exams.satExam.review.locked') : t('exams.satExam.review.editable')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reviewModuleMeta}>{t('exams.satExam.review.answeredProgress', { answered: summary.answered, total: summary.total })}</Text>
                  <Text style={styles.reviewModuleMeta}>{t('exams.satExam.review.markedProgress', { count: summary.marked })}</Text>
                  <Text style={styles.reviewModuleMeta}>{t('exams.satExam.review.unansweredProgress', { count: summary.total - summary.answered })}</Text>
                </GlassCard>
              ))}
            </View>
          ) : (
            <GlassCard style={styles.reviewSummaryCard}>
              <ActivityIndicator size="small" color="#22c55e" />
              <Text style={styles.cardBody}>{t('exams.satExam.review.building')}</Text>
            </GlassCard>
          )}

          {finalModuleSummary && finalModuleSummary.unansweredQuestions.length > 0 ? (
            <GlassCard style={styles.reviewSummaryCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#f97316" />
                <Text style={styles.cardTitle}>{t('exams.satExam.review.finalUnansweredTitle')}</Text>
              </View>
              <Text style={styles.cardBody}>
                {canReopenFinalModule
                  ? t('exams.satExam.review.finalUnansweredBodyOpen')
                  : t('exams.satExam.review.finalUnansweredBodyLocked')}
              </Text>
              <View style={styles.reviewLinkWrap}>
                {finalModuleSummary.unansweredQuestions.map((question) => (
                  <TouchableOpacity
                    key={question.id}
                    style={[styles.reviewLinkButton, !canReopenFinalModule && styles.reviewLinkButtonDisabled]}
                    onPress={() => {
                      if (canReopenFinalModule) {
                        void reopenFinalModule(Math.max(question.question_number - 1, 0));
                      }
                    }}
                    disabled={!canReopenFinalModule}
                  >
                    <Text style={[styles.reviewLinkText, !canReopenFinalModule && styles.reviewLinkTextDisabled]}>
                      {t('exams.satExam.questionLabel', { number: question.question_number })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          ) : null}

          {markedQuestionsInFinalModule.length > 0 ? (
            <GlassCard style={styles.reviewSummaryCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="bookmark-outline" size={22} color="#7c3aed" />
                <Text style={styles.cardTitle}>{t('exams.satExam.review.markedTitle')}</Text>
              </View>
              <Text style={styles.cardBody}>{t('exams.satExam.review.markedBody')}</Text>
              <View style={styles.reviewLinkWrap}>
                {markedQuestionsInFinalModule.map((question) => (
                  <TouchableOpacity
                    key={question.id}
                    style={[styles.reviewLinkButton, !canReopenFinalModule && styles.reviewLinkButtonDisabled]}
                    onPress={() => {
                      if (canReopenFinalModule) {
                        void reopenFinalModule(Math.max(question.question_number - 1, 0));
                      }
                    }}
                    disabled={!canReopenFinalModule}
                  >
                    <Text style={[styles.reviewLinkText, !canReopenFinalModule && styles.reviewLinkTextDisabled]}>
                      {t('exams.satExam.questionLabel', { number: question.question_number })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          ) : null}
        </ScrollView>

        <GlassCard style={styles.footer}>
          <TouchableOpacity
            style={[styles.navButton, !canReopenFinalModule && styles.navButtonDisabled]}
            onPress={() => {
              if (canReopenFinalModule) {
                void reopenFinalModule();
              }
            }}
            disabled={!canReopenFinalModule}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={20}
              color={!canReopenFinalModule ? theme.textMuted : '#22c55e'}
            />
            <Text style={[styles.navButtonText, !canReopenFinalModule && styles.navButtonTextDisabled]}>{t('exams.satExam.review.reviewFinalModule')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#22c55e' }]} onPress={() => setShowSubmitModal(true)}>
            <Text style={styles.primaryButtonText}>{t('exams.satExam.review.submitExam')}</Text>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </GlassCard>

        <Modal visible={showSubmitModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <MaterialCommunityIcons name="check-circle-outline" size={46} color="#22c55e" />
              <Text style={styles.modalTitle}>{t('exams.satExam.review.submitTitle')}</Text>
              <Text style={styles.modalText}>
                {t('exams.satExam.review.submitBody')}
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowSubmitModal(false)}>
                  <Text style={styles.modalSecondaryText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalPrimaryButton, styles.modalSubmitButton]} onPress={confirmSubmit}>
                  <Text style={styles.modalPrimaryText}>{t('exams.satExam.review.viewResults')}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>
      </View>
    );
  }

  const currentQuestion = moduleQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('exams.satExam.loadingNoQuestion')}</Text>
      </View>
    );
  }

  const answeredIndexes = moduleQuestions.reduce<number[]>((accumulator, question, index) => {
    const saved = answers[question.id]?.answer;
    if (typeof saved === 'string' && saved.length > 0) {
      accumulator.push(index);
    }
    return accumulator;
  }, []);
  const answeredCount = answeredIndexes.length;
  const progress = moduleQuestions.length > 0 ? (answeredCount / moduleQuestions.length) * 100 : 0;
  const moduleInfo = moduleInfoMap[currentModule as ActiveModuleState];
  const isMarked = markedQuestionIds.includes(currentQuestion.id);

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        <ExamHeroCard
          eyebrow={t('exams.satExam.title')}
          title={moduleInfo.title}
          subtitle={examQuery.data.title}
          accentColor={moduleInfo.color}
          progress={progress}
          metrics={[
            { icon: 'clock-outline', label: t('exams.satExam.metricTimeLeft'), value: formatTime(timeRemaining) },
            { icon: 'check-circle-outline', label: t('exams.satExam.metricAnswered'), value: `${answeredCount}/${moduleQuestions.length}` },
            { icon: 'content-save-outline', label: t('exams.satExam.metricSaved'), value: formatSavedTime(lastSavedAt) },
          ]}
        />
        <QuestionPalette
          total={moduleQuestions.length}
          currentIndex={currentQuestionIndex}
          answeredIndexes={answeredIndexes}
          accentColor={moduleInfo.color}
          onSelect={handleQuestionSelect}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {recoveryNote ? (
          <GlassCard style={styles.recoveryCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={20} color={moduleInfo.color} />
              <Text style={styles.cardTitle}>{t('exams.satExam.recovery.syncTitle')}</Text>
            </View>
            <Text style={styles.cardBody}>{recoveryNote}</Text>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionLabel}>{t('exams.satExam.questionLabel', { number: currentQuestionIndex + 1 })}</Text>
            {currentQuestion.rw_type_display ? <Text style={styles.questionType}>{currentQuestion.rw_type_display}</Text> : null}
            {currentQuestion.math_type_display ? <Text style={styles.questionType}>{currentQuestion.math_type_display}</Text> : null}
            <TouchableOpacity style={styles.markButton} onPress={() => toggleMarkedQuestion(currentQuestion.id)} activeOpacity={0.85}>
              <MaterialCommunityIcons
                name={isMarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isMarked ? '#7c3aed' : theme.textSecondary}
              />
              <Text style={[styles.markButtonText, isMarked && styles.markButtonTextActive]}>
                {isMarked ? t('exams.satExam.marked') : t('exams.satExam.mark')}
              </Text>
            </TouchableOpacity>
          </View>

          {currentQuestion.passage_text ? <Text style={styles.passageText}>{currentQuestion.passage_text}</Text> : null}
          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

          {currentQuestion.answer_type === 'mcq' ? (
            <View style={styles.optionList}>
              {(currentQuestion.options || []).map((option, index) => {
                const selected = answers[currentQuestion.id]?.answer === option;
                return (
                  <TouchableOpacity
                    key={`${currentQuestion.id}-${index}`}
                    style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    onPress={() => handleAnswerChange(currentQuestion.id, option)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.optionMarker, selected && styles.optionMarkerSelected]}>
                      <Text style={[styles.optionMarkerText, selected && styles.optionMarkerTextSelected]}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.gridCard}>
              <Text style={styles.gridTitle}>{t('exams.satExam.sprTitle')}</Text>
              <Text style={styles.gridSubtitle}>{t('exams.satExam.sprSubtitle')}</Text>
              <TextInput
                style={styles.gridInput}
                placeholder={t('exams.satExam.sprPlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={answers[currentQuestion.id]?.answer || ''}
                onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
              />
            </View>
          )}
        </GlassCard>
      </ScrollView>

      <GlassCard style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={currentQuestionIndex === 0 ? theme.textMuted : moduleInfo.color} />
          <Text style={[styles.navButtonText, currentQuestionIndex === 0 && styles.navButtonTextDisabled]}>{t('exams.satExam.previous')}</Text>
        </TouchableOpacity>

        {currentQuestionIndex === moduleQuestions.length - 1 ? (
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: moduleInfo.color }]} onPress={() => void handleModuleComplete()}>
            <Text style={styles.primaryButtonText}>{t('exams.satExam.completeModule')}</Text>
            <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: moduleInfo.color }]} onPress={handleNextQuestion}>
            <Text style={styles.primaryButtonText}>{t('exams.satExam.next')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </GlassCard>

      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <MaterialCommunityIcons name="check-circle-outline" size={46} color="#22c55e" />
            <Text style={styles.modalTitle}>{t('exams.satExam.review.submitTitle')}</Text>
            <Text style={styles.modalText}>{t('exams.satExam.review.submitActiveBody')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowSubmitModal(false)}>
                <Text style={styles.modalSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={confirmSubmit}>
                <Text style={styles.modalPrimaryText}>{t('exams.satExam.review.viewResults')}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: 24,
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    chrome: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 12,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      gap: 16,
    },
    reviewContentContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 16,
    },
    recoveryCard: {
      padding: 18,
      borderRadius: 24,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    cardBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    questionCard: {
      padding: 20,
      borderRadius: 28,
      gap: 16,
    },
    questionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    questionLabel: {
      ...theme.typography.caption,
      color: '#7c3aed',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    questionType: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    markButton: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    markButtonText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
    },
    markButtonTextActive: {
      color: '#7c3aed',
    },
    passageText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)',
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
      gap: 12,
      alignItems: 'center',
      padding: 14,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.68)',
    },
    optionButtonSelected: {
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
    optionMarkerSelected: {
      backgroundColor: '#7c3aed',
    },
    optionMarkerText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
    },
    optionMarkerTextSelected: {
      color: '#ffffff',
    },
    optionText: {
      ...theme.typography.body,
      color: theme.text,
      flex: 1,
    },
    optionTextSelected: {
      color: '#5b21b6',
      fontWeight: '600',
    },
    gridCard: {
      gap: 8,
      padding: 16,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
    },
    gridTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
    },
    gridSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    gridInput: {
      ...theme.typography.body,
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      paddingHorizontal: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.76)',
      color: theme.text,
    },
    reviewSummaryCard: {
      padding: 20,
      borderRadius: 28,
      gap: 14,
    },
    reviewStatRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    reviewStatChip: {
      flex: 1,
      minWidth: '30%',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.68)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
      gap: 4,
    },
    reviewStatValue: {
      ...theme.typography.h3,
      color: theme.text,
    },
    reviewStatLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reviewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    reviewModuleCard: {
      width: '48%',
      padding: 18,
      borderRadius: 24,
      gap: 8,
    },
    reviewModuleHeader: {
      gap: 8,
    },
    reviewModuleTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '700',
      lineHeight: 22,
    },
    reviewBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    reviewBadgeLocked: {
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.22)',
    },
    reviewBadgeOpen: {
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.22)',
    },
    reviewBadgeText: {
      ...theme.typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reviewBadgeTextLocked: {
      color: '#ef4444',
    },
    reviewBadgeTextOpen: {
      color: '#22c55e',
    },
    reviewModuleMeta: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    reviewLinkWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    reviewLinkButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124,58,237,0.08)',
    },
    reviewLinkButtonDisabled: {
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
    },
    reviewLinkText: {
      ...theme.typography.button,
      color: '#7c3aed',
    },
    reviewLinkTextDisabled: {
      color: theme.textMuted,
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
      minWidth: 132,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#7c3aed',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
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
    primaryButton: {
      minWidth: 158,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(2,6,23,0.52)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      padding: 22,
      borderRadius: 28,
      gap: 14,
      alignItems: 'center',
    },
    modalTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    modalText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
    },
    modalSecondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalSecondaryText: {
      ...theme.typography.button,
      color: theme.text,
    },
    modalPrimaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: '#7c3aed',
    },
    modalSubmitButton: {
      backgroundColor: '#22c55e',
    },
    modalPrimaryText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
  });

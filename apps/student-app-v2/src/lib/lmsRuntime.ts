import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient, getErrorMessage } from '@eduvoice/mobile-shared';

import { getLessonCompletion, getLessonModuleTitle, normalizeLessonType } from './lms';
import type { Lesson } from '../types';

const LESSON_RUNTIME_INDEX_KEY = 'lms-runtime:index';

type RawPaginated<T> = T[] | { results?: T[] | null };

const extractResults = <T>(payload: RawPaginated<T> | null | undefined): T[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
};

const lessonRuntimeKey = (lessonId: number) => `lesson-runtime:${lessonId}`;

const readLessonRuntimeIndex = async (): Promise<number[]> => {
  const raw = await AsyncStorage.getItem(LESSON_RUNTIME_INDEX_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : [];
  } catch {
    return [];
  }
};

const writeLessonRuntimeIndex = async (lessonIds: number[]) => {
  await AsyncStorage.setItem(LESSON_RUNTIME_INDEX_KEY, JSON.stringify([...new Set(lessonIds)]));
};

export interface LessonRuntimeState {
  lessonId: number;
  title?: string;
  moduleTitle?: string;
  lessonType?: string;
  completion?: number;
  bookmarked: boolean;
  notes: string;
  lastPositionSeconds: number;
  currentPage?: number;
  lastOpenedAt?: string;
}

export interface LessonRuntimeSummary {
  lessonId: number;
  title: string;
  moduleTitle: string;
  lessonType: string;
  completion: number;
  bookmarked: boolean;
  lastOpenedAt?: string;
  lastPositionSeconds: number;
}

export interface CourseRoadmapLesson extends Lesson {
  is_locked: boolean;
  unlock_reason?: string;
  lesson_type_display?: string;
}

export interface CourseRoadmapModule {
  id: number;
  course: number;
  course_name?: string;
  title: string;
  description?: string;
  order: number;
  is_published: boolean;
  is_free_preview: boolean;
  is_locked: boolean;
  unlock_reason?: string;
  lesson_count: number;
  completed_lessons: number;
  completion_percentage: number;
  next_lesson_id?: number | null;
  lessons: CourseRoadmapLesson[];
}

export interface CourseRoadmapResponse {
  course_id: number;
  course_name: string;
  continue_lesson_id?: number | null;
  continue_module_id?: number | null;
  modules: CourseRoadmapModule[];
}

export interface RuntimeQuizSummary {
  id: number;
  title: string;
  description?: string;
  instructions?: string;
  quizType: 'practice' | 'graded' | 'exam' | 'survey';
  subject: string;
  subjectDisplay: string;
  difficultyLevel: string;
  difficultyLevelDisplay: string;
  questionCount: number;
  totalPoints: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  userAttemptsCount: number;
  passingScore: number;
  bestAttempt?: {
    id: number;
    percentageScore: number;
    passed: boolean;
    submittedAt?: string;
  };
}

export interface RuntimeQuizOption {
  id: number;
  optionText: string;
  order: number;
}

export interface RuntimeQuizQuestion {
  id: number;
  questionText: string;
  questionType:
    | 'multiple_choice'
    | 'true_false'
    | 'short_answer'
    | 'essay'
    | 'fill_blank'
    | 'matching'
    | 'ordering';
  points: number;
  order: number;
  explanation?: string;
  options: RuntimeQuizOption[];
}

export interface RuntimeQuizAnswerResult {
  id: number;
  question: number;
  questionText: string;
  questionType: string;
  selectedOption?: number | null;
  textAnswer?: string;
  isCorrect?: boolean;
  pointsEarned?: number;
  feedback?: string;
  correctAnswerText?: string | null;
}

export interface RuntimeQuizAttemptResult {
  id: number;
  status: 'in_progress' | 'submitted' | 'graded';
  attemptNumber: number;
  startedAt?: string;
  totalPoints: number;
  pointsEarned: number;
  percentageScore: number;
  passed: boolean;
  submittedAt?: string;
  timeTakenSeconds: number;
  answers: RuntimeQuizAnswerResult[];
}

export interface RuntimeAssignmentSummary {
  id: number;
  title: string;
  description?: string;
  instructions?: string;
  moduleTitle?: string;
  assignmentType?: string;
  dueDate?: string;
  maxPoints: number;
  status: 'pending' | 'submitted' | 'graded';
  allowResubmission: boolean;
  attachment?: string | null;
  userSubmission?: {
    id: number;
    status: 'submitted' | 'graded';
    submittedAt?: string;
    pointsEarned?: number;
    isLate?: boolean;
  } | null;
}

export interface RuntimeAssignmentSubmission {
  id: number;
  textContent?: string;
  file?: string | null;
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  submittedAt?: string;
  pointsEarned?: number;
  feedback?: string;
  isLate: boolean;
}

export interface RuntimeQuizInsights {
  totalAttempts: number;
  quizzesAttempted: number;
  passedAttempts: number;
  passRate: number;
  averageScore: number;
  weakSubject?: {
    subject: string;
    attempts: number;
    averageScore: number;
    passRate: number;
  } | null;
  subjectBreakdown: Array<{
    subject: string;
    attempts: number;
    averageScore: number;
    passRate: number;
  }>;
  recentAttempts: Array<{
    attemptId: number;
    quizId: number;
    quizTitle: string;
    subject: string;
    difficultyLevel: string;
    score: number;
    passed: boolean;
    submittedAt?: string;
  }>;
}

export interface RuntimeQuizAttemptReviewQuestion {
  questionId: number;
  order: number;
  questionText: string;
  questionType: string;
  questionTypeDisplay: string;
  points: number;
  pointsEarned: number;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  feedback?: string;
  status: 'correct' | 'incorrect' | 'pending_manual' | 'unanswered';
  statusReason: string;
  needsFocus: boolean;
  explanation?: string | null;
}

export interface RuntimeQuizAttemptReview {
  attempt: {
    id: number;
    status: 'in_progress' | 'submitted' | 'graded';
    attemptNumber: number;
    startedAt?: string;
    submittedAt?: string;
    timeTakenSeconds: number;
    percentageScore: number;
    pointsEarned: number;
    totalPoints: number;
    passed: boolean;
  };
  quiz: {
    id: number;
    title: string;
    subject: string;
    subjectDisplay: string;
    difficultyLevel: string;
    difficultyLevelDisplay: string;
    passingScore: number;
    showCorrectAnswers: boolean;
  };
  metrics: {
    totalQuestions: number;
    answeredQuestions: number;
    correctQuestions: number;
    incorrectQuestions: number;
    pendingManualQuestions: number;
    unansweredQuestions: number;
    accuracyRate: number;
    completionRate: number;
    pointsEarned: number;
    pointsAvailable: number;
  };
  focusQuestions: Array<{
    questionId: number;
    order: number;
    status: 'correct' | 'incorrect' | 'pending_manual' | 'unanswered';
    reason: string;
  }>;
  tips: string[];
  questions: RuntimeQuizAttemptReviewQuestion[];
}

const normalizeReviewQuestionStatus = (
  status?: string
): RuntimeQuizAttemptReviewQuestion['status'] => {
  switch (status) {
    case 'correct':
      return 'correct';
    case 'incorrect':
      return 'incorrect';
    case 'pending_manual':
      return 'pending_manual';
    default:
      return 'unanswered';
  }
};

const normalizeQuizType = (quizType?: string): RuntimeQuizSummary['quizType'] => {
  switch (quizType) {
    case 'exam':
    case 'final_exam':
      return 'exam';
    case 'survey':
      return 'survey';
    case 'graded':
      return 'graded';
    default:
      return 'practice';
  }
};

const normalizeQuiz = (payload: any): RuntimeQuizSummary => ({
  id: Number(payload.id),
  title: payload.title || 'Quiz',
  description: payload.description,
  instructions: payload.instructions,
  quizType: normalizeQuizType(payload.quiz_type),
  subject: payload.subject || 'general',
  subjectDisplay: payload.subject_display || payload.subject || 'General',
  difficultyLevel: payload.difficulty_level || 'medium',
  difficultyLevelDisplay: payload.difficulty_level_display || payload.difficulty_level || 'Medium',
  questionCount: Number(payload.question_count ?? payload.questions_count ?? 0),
  totalPoints: Number(payload.total_points ?? 0),
  timeLimitMinutes: payload.time_limit_minutes ? Number(payload.time_limit_minutes) : undefined,
  maxAttempts: Number(payload.max_attempts ?? 0),
  userAttemptsCount: Number(payload.user_attempts_count ?? 0),
  passingScore: Number(payload.passing_score ?? 0),
  bestAttempt: payload.user_best_attempt
    ? {
        id: Number(payload.user_best_attempt.id),
        percentageScore: Number(payload.user_best_attempt.percentage_score ?? 0),
        passed: Boolean(payload.user_best_attempt.passed),
        submittedAt: payload.user_best_attempt.submitted_at,
      }
    : undefined,
});

const normalizeQuizQuestion = (payload: any): RuntimeQuizQuestion => ({
  id: Number(payload.id),
  questionText: payload.question_text || '',
  questionType: payload.question_type,
  points: Number(payload.points ?? 0),
  order: Number(payload.order ?? 0),
  explanation: payload.explanation,
  options: Array.isArray(payload.options)
    ? payload.options
        .map((option: any) => ({
          id: Number(option.id),
          optionText: option.option_text || '',
          order: Number(option.order ?? 0),
        }))
        .sort((left: RuntimeQuizOption, right: RuntimeQuizOption) => left.order - right.order)
    : [],
});

const normalizeQuizAttempt = (payload: any): RuntimeQuizAttemptResult => ({
  id: Number(payload.id),
  status: payload.status,
  attemptNumber: Number(payload.attempt_number ?? 1),
  startedAt: payload.started_at,
  totalPoints: Number(payload.total_points ?? 0),
  pointsEarned: Number(payload.points_earned ?? 0),
  percentageScore: Number(payload.percentage_score ?? payload.percentage ?? 0),
  passed: Boolean(payload.passed),
  submittedAt: payload.submitted_at,
  timeTakenSeconds: Number(payload.time_taken_seconds ?? payload.time_spent_seconds ?? 0),
  answers: Array.isArray(payload.answers)
    ? payload.answers.map((answer: any) => ({
        id: Number(answer.id),
        question: Number(answer.question),
        questionText: answer.question_text || '',
        questionType: answer.question_type || '',
        selectedOption: answer.selected_option ? Number(answer.selected_option) : null,
        textAnswer: answer.text_answer || '',
        isCorrect: answer.is_correct,
        pointsEarned: Number(answer.points_earned ?? 0),
        feedback: answer.feedback,
        correctAnswerText: answer.correct_answer_text,
      }))
    : [],
});

const deriveAssignmentStatus = (payload: any): RuntimeAssignmentSummary['status'] => {
  const rawStatus = payload.user_submission?.status;
  if (rawStatus === 'graded') {
    return 'graded';
  }
  if (rawStatus === 'submitted' || rawStatus === 'returned') {
    return 'submitted';
  }
  return 'pending';
};

const normalizeAssignment = (payload: any): RuntimeAssignmentSummary => ({
  id: Number(payload.id),
  title: payload.title || 'Assignment',
  description: payload.description,
  instructions: payload.instructions,
  moduleTitle: payload.module_title,
  assignmentType: payload.assignment_type_display || payload.assignment_type,
  dueDate: payload.due_date,
  maxPoints: Number(payload.max_points ?? 0),
  status: deriveAssignmentStatus(payload),
  allowResubmission: Boolean(payload.allow_resubmission),
  attachment: payload.attachment || null,
  userSubmission: payload.user_submission
    ? {
        id: Number(payload.user_submission.id),
        status: payload.user_submission.status,
        submittedAt: payload.user_submission.submitted_at,
        pointsEarned: payload.user_submission.points_earned,
        isLate: payload.user_submission.is_late,
      }
    : null,
});

const normalizeAssignmentSubmission = (payload: any): RuntimeAssignmentSubmission => ({
  id: Number(payload.id),
  textContent: payload.text_content || payload.submission_text,
  file: payload.file || null,
  status: payload.status,
  submittedAt: payload.submitted_at,
  pointsEarned: payload.points_earned ? Number(payload.points_earned) : undefined,
  feedback: payload.feedback,
  isLate: Boolean(payload.is_late),
});

const normalizeRoadmapLesson = (payload: any): CourseRoadmapLesson => ({
  ...payload,
  id: Number(payload.id),
  module: Number(payload.module),
  order: Number(payload.order ?? 0),
  is_locked: Boolean(payload.is_locked),
  unlock_reason: payload.unlock_reason || '',
});

const normalizeRoadmapModule = (payload: any): CourseRoadmapModule => ({
  id: Number(payload.id),
  course: Number(payload.course),
  course_name: payload.course_name,
  title: payload.title || 'Module',
  description: payload.description,
  order: Number(payload.order ?? 0),
  is_published: Boolean(payload.is_published),
  is_free_preview: Boolean(payload.is_free_preview),
  is_locked: Boolean(payload.is_locked),
  unlock_reason: payload.unlock_reason || '',
  lesson_count: Number(payload.lesson_count ?? 0),
  completed_lessons: Number(payload.completed_lessons ?? 0),
  completion_percentage: Number(payload.completion_percentage ?? 0),
  next_lesson_id: payload.next_lesson_id ? Number(payload.next_lesson_id) : null,
  lessons: Array.isArray(payload.lessons) ? payload.lessons.map(normalizeRoadmapLesson) : [],
});

export const loadLessonRuntimeState = async (lessonId: number): Promise<LessonRuntimeState> => {
  const raw = await AsyncStorage.getItem(lessonRuntimeKey(lessonId));
  if (!raw) {
    return {
      lessonId,
      bookmarked: false,
      notes: '',
      lastPositionSeconds: 0,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      lessonId,
      bookmarked: Boolean(parsed.bookmarked),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      lastPositionSeconds: Number(parsed.lastPositionSeconds ?? 0),
      currentPage: parsed.currentPage ? Number(parsed.currentPage) : undefined,
      lastOpenedAt: parsed.lastOpenedAt,
      title: parsed.title,
      moduleTitle: parsed.moduleTitle,
      lessonType: parsed.lessonType,
      completion: parsed.completion ? Number(parsed.completion) : 0,
    };
  } catch {
    return {
      lessonId,
      bookmarked: false,
      notes: '',
      lastPositionSeconds: 0,
    };
  }
};

export const saveLessonRuntimeState = async (
  lessonId: number,
  nextState: Partial<LessonRuntimeState>,
  lesson?: Lesson
) => {
  const current = await loadLessonRuntimeState(lessonId);
  const merged: LessonRuntimeState = {
    ...current,
    ...nextState,
    lessonId,
    title: lesson?.title || nextState.title || current.title,
    moduleTitle: lesson ? getLessonModuleTitle(lesson) : nextState.moduleTitle || current.moduleTitle,
    lessonType: lesson ? normalizeLessonType(lesson.lesson_type) : nextState.lessonType || current.lessonType,
    completion:
      lesson?.student_progress?.completion_percentage ??
      nextState.completion ??
      current.completion ??
      0,
    lastOpenedAt: nextState.lastOpenedAt || new Date().toISOString(),
  };

  await AsyncStorage.setItem(lessonRuntimeKey(lessonId), JSON.stringify(merged));
  const currentIndex = await readLessonRuntimeIndex();
  await writeLessonRuntimeIndex([lessonId, ...currentIndex.filter((value) => value !== lessonId)]);
  return merged;
};

export const listLessonRuntimeSummaries = async (): Promise<LessonRuntimeSummary[]> => {
  const index = await readLessonRuntimeIndex();
  if (index.length === 0) {
    return [];
  }

  const records = await AsyncStorage.multiGet(index.map((lessonId) => lessonRuntimeKey(lessonId)));
  return records
    .map(([, value]) => {
      if (!value) {
        return null;
      }

      try {
        const parsed = JSON.parse(value);
        return {
          lessonId: Number(parsed.lessonId),
          title: parsed.title || `Lesson ${parsed.lessonId}`,
          moduleTitle: parsed.moduleTitle || 'Module',
          lessonType: parsed.lessonType || 'article',
          completion: Number(parsed.completion ?? 0),
          bookmarked: Boolean(parsed.bookmarked),
          lastOpenedAt: parsed.lastOpenedAt,
          lastPositionSeconds: Number(parsed.lastPositionSeconds ?? 0),
        } as LessonRuntimeSummary;
      } catch {
        return null;
      }
    })
    .filter((item): item is LessonRuntimeSummary => Boolean(item))
    .sort((left, right) => {
      const leftTime = left.lastOpenedAt ? new Date(left.lastOpenedAt).getTime() : 0;
      const rightTime = right.lastOpenedAt ? new Date(right.lastOpenedAt).getTime() : 0;
      return rightTime - leftTime;
    });
};

export const getRecentLessonSummaries = async (limit = 5): Promise<LessonRuntimeSummary[]> => {
  const all = await listLessonRuntimeSummaries();
  return all.slice(0, limit);
};

export const getBookmarkedLessonSummaries = async (limit = 5): Promise<LessonRuntimeSummary[]> => {
  const all = await listLessonRuntimeSummaries();
  return all.filter((item) => item.bookmarked).slice(0, limit);
};

export const getContinueLearningLesson = async (): Promise<LessonRuntimeSummary | null> => {
  const all = await listLessonRuntimeSummaries();
  const candidate = all.find((item) => item.completion > 0 && item.completion < 100) || all[0];
  return candidate || null;
};

export const getCourseRoadmap = async (courseId: number): Promise<CourseRoadmapResponse> => {
  const payload = await apiClient.get<any>('/api/v1/lms/modules/roadmap/', {
    params: { course_id: courseId },
  });

  return {
    course_id: Number(payload.course_id),
    course_name: payload.course_name || 'Course',
    continue_lesson_id: payload.continue_lesson_id ? Number(payload.continue_lesson_id) : null,
    continue_module_id: payload.continue_module_id ? Number(payload.continue_module_id) : null,
    modules: Array.isArray(payload.modules) ? payload.modules.map(normalizeRoadmapModule) : [],
  };
};

export const getBackendContinueLearningLesson = async (courseId?: number) => {
  try {
    const payload = await apiClient.get<any>('/api/v1/lms/progress/continue_learning/', {
      params: courseId ? { course_id: courseId } : undefined,
    });
    return payload ? normalizeRoadmapLesson(payload) : null;
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase();
    if (message.includes('404') || message.includes('no lesson available')) {
      return null;
    }
    throw error;
  }
};

export const listRuntimeQuizzes = async (quizType?: RuntimeQuizSummary['quizType'] | 'all') => {
  const requestedQuizType = quizType && quizType !== 'all' ? quizType : undefined;

  const payload = await apiClient.get<any>('/api/v1/lms/quizzes/', {
    params: requestedQuizType ? { quiz_type: requestedQuizType } : undefined,
  });

  return extractResults(payload).map(normalizeQuiz);
};

export const getRuntimeQuizDetail = async (quizId: number) => {
  const payload = await apiClient.get<any>(`/api/v1/lms/quizzes/${quizId}/`);
  return normalizeQuiz(payload);
};

export const getRuntimeQuizQuestions = async (quizId: number) => {
  const payload = await apiClient.get<any[]>(`/api/v1/lms/quizzes/${quizId}/questions/`);
  return extractResults(payload).map(normalizeQuizQuestion);
};

export const createRuntimeQuizAttempt = async (quizId: number) => {
  const payload = await apiClient.post<any>('/api/v1/lms/quiz-attempts/', { quiz: quizId });
  return normalizeQuizAttempt(payload);
};

export const listRuntimeQuizAttempts = async (quizId: number, status?: 'in_progress' | 'submitted' | 'graded') => {
  const payload = await apiClient.get<any>('/api/v1/lms/quiz-attempts/', {
    params: {
      quiz_id: quizId,
      status,
      limit: 20,
    },
  });

  return extractResults(payload).map(normalizeQuizAttempt);
};

export const startOrResumeRuntimeQuizAttempt = async (quizId: number) => {
  const inProgressAttempts = await listRuntimeQuizAttempts(quizId, 'in_progress');
  if (inProgressAttempts.length > 0) {
    const latestAttempt = inProgressAttempts.sort((left, right) => {
      const leftTimestamp = left.startedAt ? new Date(left.startedAt).getTime() : 0;
      const rightTimestamp = right.startedAt ? new Date(right.startedAt).getTime() : 0;
      return rightTimestamp - leftTimestamp;
    })[0];
    if (latestAttempt) {
      return latestAttempt;
    }
  }

  return createRuntimeQuizAttempt(quizId);
};

export const submitRuntimeQuizAnswer = async (
  attemptId: number,
  question: RuntimeQuizQuestion,
  answerValue: string | number | null | undefined
) => {
  const payload: Record<string, unknown> = {
    attempt: attemptId,
    question: question.id,
  };

  if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
    payload['selected_option'] = Number(answerValue);
  } else {
    payload['text_answer'] = typeof answerValue === 'string' ? answerValue : '';
  }

  return apiClient.post<any>('/api/v1/lms/quiz-answers/', payload);
};

export const completeRuntimeQuizAttempt = async (attemptId: number) => {
  const payload = await apiClient.post<any>(`/api/v1/lms/quiz-attempts/${attemptId}/submit/`);
  return normalizeQuizAttempt(payload);
};

export const getRuntimeQuizAttempt = async (attemptId: number) => {
  const payload = await apiClient.get<any>(`/api/v1/lms/quiz-attempts/${attemptId}/`);
  return normalizeQuizAttempt(payload);
};

export const getRuntimeQuizAttemptReview = async (attemptId: number): Promise<RuntimeQuizAttemptReview> => {
  const payload = await apiClient.get<any>(`/api/v1/lms/quiz-attempts/${attemptId}/review/`);

  const questions: RuntimeQuizAttemptReviewQuestion[] = Array.isArray(payload.questions)
    ? payload.questions.map((question: any) => ({
        questionId: Number(question.question_id),
        order: Number(question.order ?? 0),
        questionText: question.question_text || 'Question',
        questionType: question.question_type || 'multiple_choice',
        questionTypeDisplay: question.question_type_display || question.question_type || 'Question',
        points: Number(question.points ?? 0),
        pointsEarned: Number(question.points_earned ?? 0),
        selectedAnswer: question.selected_answer ?? null,
        correctAnswer: question.correct_answer ?? null,
        feedback: question.feedback || '',
        status: normalizeReviewQuestionStatus(question.status),
        statusReason: question.status_reason || '',
        needsFocus: Boolean(question.needs_focus),
        explanation: question.explanation ?? null,
      }))
    : [];

  return {
    attempt: {
      id: Number(payload.attempt?.id),
      status: payload.attempt?.status || 'in_progress',
      attemptNumber: Number(payload.attempt?.attempt_number ?? 1),
      startedAt: payload.attempt?.started_at,
      submittedAt: payload.attempt?.submitted_at,
      timeTakenSeconds: Number(payload.attempt?.time_taken_seconds ?? 0),
      percentageScore: Number(payload.attempt?.percentage_score ?? 0),
      pointsEarned: Number(payload.attempt?.points_earned ?? 0),
      totalPoints: Number(payload.attempt?.total_points ?? 0),
      passed: Boolean(payload.attempt?.passed),
    },
    quiz: {
      id: Number(payload.quiz?.id),
      title: payload.quiz?.title || 'Quiz',
      subject: payload.quiz?.subject || 'general',
      subjectDisplay: payload.quiz?.subject_display || payload.quiz?.subject || 'General',
      difficultyLevel: payload.quiz?.difficulty_level || 'medium',
      difficultyLevelDisplay:
        payload.quiz?.difficulty_level_display || payload.quiz?.difficulty_level || 'Medium',
      passingScore: Number(payload.quiz?.passing_score ?? 0),
      showCorrectAnswers: Boolean(payload.quiz?.show_correct_answers),
    },
    metrics: {
      totalQuestions: Number(payload.metrics?.total_questions ?? 0),
      answeredQuestions: Number(payload.metrics?.answered_questions ?? 0),
      correctQuestions: Number(payload.metrics?.correct_questions ?? 0),
      incorrectQuestions: Number(payload.metrics?.incorrect_questions ?? 0),
      pendingManualQuestions: Number(payload.metrics?.pending_manual_questions ?? 0),
      unansweredQuestions: Number(payload.metrics?.unanswered_questions ?? 0),
      accuracyRate: Number(payload.metrics?.accuracy_rate ?? 0),
      completionRate: Number(payload.metrics?.completion_rate ?? 0),
      pointsEarned: Number(payload.metrics?.points_earned ?? 0),
      pointsAvailable: Number(payload.metrics?.points_available ?? 0),
    },
    focusQuestions: Array.isArray(payload.focus_questions)
      ? payload.focus_questions.map((question: any) => ({
          questionId: Number(question.question_id),
          order: Number(question.order ?? 0),
          status: normalizeReviewQuestionStatus(question.status),
          reason: question.reason || '',
        }))
      : [],
    tips: Array.isArray(payload.tips) ? payload.tips.filter((tip: any) => typeof tip === 'string') : [],
    questions,
  };
};

export const getRuntimeQuizInsights = async (): Promise<RuntimeQuizInsights> => {
  const payload = await apiClient.get<any>('/api/v1/lms/quizzes/my_insights/');

  const subjectBreakdown = Array.isArray(payload.subject_breakdown)
    ? payload.subject_breakdown.map((row: any) => ({
        subject: row.subject || 'general',
        attempts: Number(row.attempts ?? 0),
        averageScore: Number(row.average_score ?? 0),
        passRate: Number(row.pass_rate ?? 0),
      }))
    : [];

  return {
    totalAttempts: Number(payload.total_attempts ?? 0),
    quizzesAttempted: Number(payload.quizzes_attempted ?? 0),
    passedAttempts: Number(payload.passed_attempts ?? 0),
    passRate: Number(payload.pass_rate ?? 0),
    averageScore: Number(payload.average_score ?? 0),
    weakSubject: payload.weak_subject
      ? {
          subject: payload.weak_subject.subject || 'general',
          attempts: Number(payload.weak_subject.attempts ?? 0),
          averageScore: Number(payload.weak_subject.average_score ?? 0),
          passRate: Number(payload.weak_subject.pass_rate ?? 0),
        }
      : null,
    subjectBreakdown,
    recentAttempts: Array.isArray(payload.recent_attempts)
      ? payload.recent_attempts.map((attempt: any) => ({
          attemptId: Number(attempt.attempt_id),
          quizId: Number(attempt.quiz_id),
          quizTitle: attempt.quiz_title || 'Quiz',
          subject: attempt.subject || 'general',
          difficultyLevel: attempt.difficulty_level || 'medium',
          score: Number(attempt.score ?? 0),
          passed: Boolean(attempt.passed),
          submittedAt: attempt.submitted_at,
        }))
      : [],
  };
};

export const listRuntimeAssignments = async (
  status?: RuntimeAssignmentSummary['status'] | 'all'
) => {
  const payload = await apiClient.get<any>('/api/v1/lms/assignments/');
  const normalized = extractResults(payload).map(normalizeAssignment);

  if (!status || status === 'all') {
    return normalized;
  }

  return normalized.filter((assignment) => assignment.status === status);
};

export const getRuntimeAssignmentDetail = async (assignmentId: number) => {
  const payload = await apiClient.get<any>(`/api/v1/lms/assignments/${assignmentId}/`);
  return normalizeAssignment(payload);
};

export const getRuntimeAssignmentSubmission = async (assignmentId: number) => {
  const payload = await apiClient.get<any>('/api/v1/lms/assignment-submissions/', {
    params: { assignment_id: assignmentId },
  });
  const submissions = extractResults(payload).map(normalizeAssignmentSubmission);
  return submissions[0] || null;
};

export const submitRuntimeAssignment = async (assignmentId: number, textContent: string) => {
  if (!textContent.trim()) {
    throw new Error('Submission text is required.');
  }

  try {
    const payload = await apiClient.post<any>('/api/v1/lms/assignment-submissions/', {
      assignment: assignmentId,
      text_content: textContent.trim(),
    });
    return normalizeAssignmentSubmission(payload);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deriveLessonProgressLabel = (lesson: Lesson) => {
  const completion = getLessonCompletion(lesson);
  if (completion >= 100) {
    return 'Completed';
  }
  if (completion > 0) {
    return 'In Progress';
  }
  return 'Not Started';
};

import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Learn: undefined;
  Exams: undefined;
  AI: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Events: undefined;
  Coins: undefined;
  Payments: undefined;
  Library: undefined;
  Translator: undefined;
  Books: undefined;
  Courses: undefined;
  Videos: undefined;
  Articles: undefined;
  Quizzes: undefined;
  QuizPlayer: { quizId: number };
  QuizAttemptReview: { attemptId: number };
  Assignments: undefined;
  AssignmentReview: { submissionId: number };
  Messages: undefined;
  Groups: undefined;
  Ranking: undefined;
  AssignmentDetail: { assignmentId: number };
  CourseDetail: { courseId: number };
  LessonViewer: { lessonId: number; initialType?: 'article' | 'book' | 'video' };
  Chat: { conversationId: string };
  IELTSPrep: undefined;
  IELTSReading: { examId: number };
  IELTSListening: { examId: number };
  IELTSWriting: { examId: number };
  IELTSSpeaking: { examId: number };
  IELTSResults: { attemptId: number };
  SATPrep: undefined;
  SATExam: { examId: number };
  SATResults: { attemptId: number };
};

/**
 * Exam System Type Definitions (IELTS & SAT)
 */

// ============================================================================
// IELTS EXAM TYPES
// ============================================================================

export interface IELTSExam {
  id: number;
  title: string;
  description?: string;
  exam_type: 'academic' | 'general_training';
  difficulty: 'easy' | 'medium' | 'hard';
  duration_minutes: number;
  price?: number;
  is_free: boolean;
  is_published: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Section counts
  reading_questions_count: number;
  listening_questions_count: number;
  writing_tasks_count: number;
  speaking_tasks_count: number;
  total_questions: number;

  // Statistics
  attempts_count: number;
  average_score?: number;
}

export interface IELTSAttempt {
  id: number;
  student: number;
  student_name: string;
  exam: number;
  exam_title: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'graded';
  started_at: string;
  completed_at?: string;
  graded_at?: string;

  // Scores (band scores 0-9)
  reading_score?: number;
  listening_score?: number;
  writing_score?: number;
  speaking_score?: number;
  overall_score?: number;

  // Section statuses
  reading_completed: boolean;
  listening_completed: boolean;
  writing_completed: boolean;
  speaking_completed: boolean;

  // Time tracking
  reading_time_seconds?: number;
  listening_time_seconds?: number;
  writing_time_seconds?: number;
  speaking_time_seconds?: number;

  // Payment
  is_paid: boolean;
  paid_at?: string;
  payment_amount?: number;

  // Results
  certificate_url?: string;
  detailed_feedback?: string;
}

export interface IELTSQuestion {
  id: number;
  exam: number;
  section: 'reading' | 'listening' | 'writing' | 'speaking';
  question_type: IELTSQuestionType;
  order: number;

  // Question content
  question_text: string;
  instructions?: string;
  passage?: string; // For reading
  audio_url?: string; // For listening
  image_url?: string;
  word_limit?: number; // For writing
  time_limit_seconds?: number; // For speaking

  // Answer options (for MCQ, matching, etc.)
  options?: IELTSOption[];
  correct_answer?: string | string[];

  // Scoring
  points: number;
  band_level?: number; // Target band level
}

export type IELTSQuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'matching_headings'
  | 'matching_information'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flow_chart'
  | 'diagram_labeling'
  | 'short_answer'
  | 'essay' // Writing Task 2
  | 'letter' // Writing Task 1 (GT)
  | 'graph_description' // Writing Task 1 (Academic)
  | 'speaking_introduction'
  | 'speaking_long_turn'
  | 'speaking_discussion';

export interface IELTSOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  order: number;
}

export interface IELTSAnswer {
  id: number;
  attempt: number;
  question: number;
  answer_text?: string;
  selected_option?: number;
  audio_response_url?: string; // For speaking
  is_correct?: boolean;
  score?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: number;
}

export interface IELTSReadingPassage {
  id: number;
  exam: number;
  title: string;
  passage_text: string;
  order: number;
  word_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: IELTSQuestion[];
}

export interface IELTSListeningSection {
  id: number;
  exam: number;
  section_number: number; // 1-4
  title: string;
  audio_url: string;
  audio_duration_seconds: number;
  transcript?: string;
  context?: string; // e.g., "Conversation", "Monologue"
  questions: IELTSQuestion[];
}

export interface IELTSWritingTask {
  id: number;
  exam: number;
  task_number: 1 | 2;
  task_type: 'letter' | 'graph' | 'essay';
  prompt: string;
  image_url?: string; // For graphs/charts
  min_words: number;
  suggested_time_minutes: number;
  band_descriptors?: BandDescriptor[];
}

export interface IELTSSpeakingTask {
  id: number;
  exam: number;
  part_number: 1 | 2 | 3;
  title: string;
  instructions: string;
  questions: IELTSQuestion[];
  preparation_time_seconds?: number; // For Part 2
  speaking_time_seconds: number;
}

export interface BandDescriptor {
  band: number; // 0-9
  criteria: string; // e.g., "Task Achievement"
  description: string;
}

// ============================================================================
// SAT EXAM TYPES
// ============================================================================

export interface SATExam {
  id: number;
  title: string;
  description?: string;
  exam_date?: string;
  test_center?: string;
  duration_minutes: number;
  price?: number;
  is_free: boolean;
  is_published: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Module counts (SAT Digital has 2 modules per section)
  reading_writing_modules: number;
  math_modules: number;
  total_questions: number;

  // Statistics
  attempts_count: number;
  average_score?: number;
}

export interface SATAttempt {
  id: number;
  student: number;
  student_name: string;
  exam: number;
  exam_title: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'graded';
  started_at: string;
  completed_at?: string;
  graded_at?: string;

  // Scores (200-800 per section, 400-1600 total)
  reading_writing_score?: number; // 200-800
  math_score?: number; // 200-800
  total_score?: number; // 400-1600

  // Module completion
  current_module?: number;
  modules_completed: number;
  total_modules: number;

  // Time tracking
  time_spent_seconds: number;

  // Payment
  is_paid: boolean;
  paid_at?: string;
  payment_amount?: number;

  // Results
  percentile?: number;
  certificate_url?: string;
  detailed_report_url?: string;
}

export interface SATModule {
  id: number;
  exam: number;
  module_type: 'reading_writing' | 'math';
  module_number: number; // 1 or 2
  title: string;
  description?: string;
  duration_minutes: number;
  questions_count: number;
  difficulty: 'easier' | 'harder'; // Adaptive difficulty
  is_adaptive: boolean;
  order: number;
}

export interface SATQuestion {
  id: number;
  module: number;
  question_type: SATQuestionType;
  order: number;

  // Question content
  question_text: string;
  passage?: string; // For reading questions
  image_url?: string; // For graphs, diagrams

  // Answer options
  options?: SATOption[];
  correct_answer?: string | number;

  // Difficulty
  difficulty: 'easy' | 'medium' | 'hard';

  // Metadata
  topic?: string; // e.g., "Algebra", "Grammar"
  skill?: string; // e.g., "Linear Equations", "Standard English Conventions"

  // Scoring
  points: number;
}

export type SATQuestionType =
  // Reading & Writing
  | 'reading_comprehension'
  | 'vocabulary_context'
  | 'command_of_evidence'
  | 'standard_english_conventions'
  | 'expression_of_ideas'
  | 'rhetoric'
  // Math
  | 'multiple_choice_math'
  | 'student_produced_response' // Grid-in
  | 'algebra'
  | 'advanced_math'
  | 'problem_solving'
  | 'geometry_trigonometry';

export interface SATOption {
  id: number;
  option_text: string;
  option_label: string; // A, B, C, D
  is_correct: boolean;
  order: number;
}

export interface SATAnswer {
  id: number;
  attempt: number;
  question: number;
  answer_text?: string; // For student-produced response
  selected_option?: number;
  is_correct?: boolean;
  time_spent_seconds?: number;
  flagged: boolean; // Student can flag questions for review
  answered_at: string;
}

export interface SATScoreReport {
  attempt: number;
  total_score: number; // 400-1600
  reading_writing_score: number; // 200-800
  math_score: number; // 200-800
  percentile: number;

  // Subscores (1-15)
  reading_subscore?: number;
  writing_subscore?: number;
  math_subscore?: number;

  // Domain scores
  command_of_evidence?: number;
  words_in_context?: number;
  expression_of_ideas?: number;
  standard_english_conventions?: number;
  heart_of_algebra?: number;
  problem_solving_data_analysis?: number;
  passport_advanced_math?: number;

  // Question breakdown
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  omitted_answers: number;

  // Performance by section
  reading_writing_correct: number;
  reading_writing_total: number;
  math_correct: number;
  math_total: number;

  // Detailed feedback
  strengths?: string[];
  areas_for_improvement?: string[];
  recommendations?: string[];
}

// ============================================================================
// EXAM STATISTICS
// ============================================================================

export interface ExamStatistics {
  // IELTS
  ielts_attempts: number;
  ielts_average_score?: number;
  ielts_best_score?: number;
  ielts_completed: number;

  // SAT
  sat_attempts: number;
  sat_average_score?: number;
  sat_best_score?: number;
  sat_completed: number;

  // Recent attempts
  recent_ielts_attempts: IELTSAttempt[];
  recent_sat_attempts: SATAttempt[];

  // Progress over time
  score_trend?: ScoreTrend[];
}

export interface ScoreTrend {
  date: string;
  exam_type: 'ielts' | 'sat';
  score: number;
}

// ============================================================================
// EXAM PREPARATION
// ============================================================================

export interface StudyPlan {
  id: number;
  student: number;
  exam_type: 'ielts' | 'sat';
  target_score: number;
  target_date: string;
  current_level?: number;
  weekly_hours: number;
  study_days: number[];
  topics: StudyTopic[];
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface StudyTopic {
  id: number;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'in_progress' | 'completed';
  resources?: string[];
  practice_tests?: number[];
}

export interface PracticeSession {
  id: number;
  student: number;
  exam_type: 'ielts' | 'sat';
  section: string;
  duration_minutes: number;
  questions_attempted: number;
  questions_correct: number;
  score?: number;
  started_at: string;
  completed_at: string;
}

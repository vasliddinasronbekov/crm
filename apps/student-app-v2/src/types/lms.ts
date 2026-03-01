/**
 * LMS (Learning Management System) Type Definitions
 */

// ============================================================================
// COURSE TYPES
// ============================================================================

export interface Course {
  id: number;
  title: string;
  description?: string;
  code: string;
  category?: string;
  level?: CourseLevel;
  cefr_level?: CEFRLevel;
  thumbnail?: string;
  cover_image?: string;
  duration_weeks: number;
  total_hours: number;
  is_published: boolean;
  is_active: boolean;
  enrollment_limit?: number;
  current_enrollments: number;
  price?: number;
  currency?: string;
  prerequisites?: number[];
  tags?: string[];
  instructor?: number;
  instructor_name?: string;
  created_at: string;
  updated_at: string;
}

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface CEFRLevel {
  id: number;
  code: string; // A1, A2, B1, B2, C1, C2
  name: string;
  description?: string;
}

export interface CourseEnrollment {
  id: number;
  student: number;
  course: number;
  course_name: string;
  enrolled_at: string;
  completed_at?: string;
  progress_percentage: number;
  status: 'active' | 'completed' | 'dropped' | 'paused';
  grade?: number;
  certificate_issued: boolean;
}

// ============================================================================
// MODULE TYPES
// ============================================================================

export interface CourseModule {
  id: number;
  course: number;
  course_name?: string;
  title: string;
  description?: string;
  order: number;
  is_published: boolean;
  duration_hours: number;
  lessons_count: number;
  completed_lessons?: number;
  unlock_condition?: UnlockCondition;
  created_at: string;
  updated_at: string;
}

export interface UnlockCondition {
  type: 'sequential' | 'score' | 'date';
  value?: any;
}

// ============================================================================
// LESSON TYPES
// ============================================================================

export interface Lesson {
  id: number;
  module: number;
  module_name?: string;
  module_title?: string;
  title: string;
  description?: string;
  order: number;
  lesson_type: LessonType;
  content?: string; // HTML or Markdown
  video_url?: string;
  video_duration?: number; // in seconds
  video_duration_seconds?: number;
  audio_url?: string;
  attachments?: LessonAttachment[];
  resources?: LessonResource[];
  is_published: boolean;
  is_free_preview: boolean;
  duration_minutes: number;
  total_pages?: number;
  student_progress?: {
    completion_percentage?: number;
    last_watched_position_seconds?: number;
    current_page?: number;
  };
  points?: number;
  created_at: string;
  updated_at: string;
}

export type LessonType =
  | 'video'
  | 'audio'
  | 'text'
  | 'article'
  | 'book'
  | 'interactive'
  | 'quiz'
  | 'assignment';

export interface LessonAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface LessonResource {
  id: number;
  title: string;
  description?: string;
  resource_type: 'link' | 'document' | 'video' | 'external';
  url: string;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface LessonProgress {
  id: number;
  student: number;
  lesson: number;
  lesson_name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percentage: number;
  completion_percentage?: number;
  time_spent_seconds: number;
  last_position?: number; // For video/audio playback
  last_watched_position_seconds?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface ModuleProgress {
  id: number;
  student: number;
  module: number;
  module_name: string;
  lessons_completed: number;
  lessons_total: number;
  progress_percentage: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at?: string;
  completed_at?: string;
}

export interface CourseProgress {
  id: number;
  student: number;
  course: number;
  course_name: string;
  modules_completed: number;
  modules_total: number;
  lessons_completed: number;
  lessons_total: number;
  quizzes_completed: number;
  quizzes_total: number;
  assignments_completed: number;
  assignments_total: number;
  progress_percentage: number;
  average_score: number;
  time_spent_hours: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at?: string;
  completed_at?: string;
  last_accessed?: string;
}

// ============================================================================
// QUIZ TYPES
// ============================================================================

export interface Quiz {
  id: number;
  course?: number;
  module?: number;
  lesson?: number;
  title: string;
  description?: string;
  instructions?: string;
  quiz_type: 'practice' | 'graded' | 'final_exam';
  time_limit_minutes?: number;
  passing_score: number;
  max_attempts?: number;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  available_from?: string;
  available_until?: string;
  is_published: boolean;
  questions_count: number;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: number;
  quiz: number;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order: number;
  explanation?: string;
  image_url?: string;
  audio_url?: string;
  options?: QuizOption[];
  correct_answer?: string | string[]; // For non-multiple choice questions
  created_at: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'fill_blank'
  | 'matching'
  | 'ordering';

export interface QuizOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  order: number;
  explanation?: string;
}

export interface QuizAttempt {
  id: number;
  student: number;
  quiz: number;
  quiz_title: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted' | 'graded';
  started_at: string;
  submitted_at?: string;
  graded_at?: string;
  time_spent_seconds: number;
  score?: number;
  percentage?: number;
  passed?: boolean;
  answers: QuizAnswer[];
  feedback?: string;
}

export interface QuizAnswer {
  id: number;
  attempt: number;
  question: number;
  answer: string | string[];
  is_correct?: boolean;
  points_earned?: number;
  feedback?: string;
}

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

export interface Assignment {
  id: number;
  course?: number;
  module?: number;
  title: string;
  description: string;
  instructions?: string;
  assignment_type: 'homework' | 'project' | 'essay' | 'presentation' | 'lab';
  max_points: number;
  due_date: string;
  available_from?: string;
  allow_late_submission: boolean;
  late_penalty_percentage?: number;
  max_file_size_mb: number;
  allowed_file_types?: string[];
  submission_method: 'online' | 'file_upload' | 'text' | 'external_link';
  group_assignment: boolean;
  requires_plagiarism_check: boolean;
  rubric?: AssignmentRubric[];
  attachments?: LessonAttachment[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRubric {
  id: number;
  criterion: string;
  description?: string;
  max_points: number;
  levels?: RubricLevel[];
}

export interface RubricLevel {
  id: number;
  name: string;
  description: string;
  points: number;
}

export interface AssignmentSubmission {
  id: number;
  assignment: number;
  assignment_title: string;
  student: number;
  student_name: string;
  submission_text?: string;
  submission_url?: string;
  submitted_files?: SubmittedFile[];
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  submitted_at?: string;
  is_late: boolean;
  grade?: number;
  feedback?: string;
  graded_by?: number;
  graded_at?: string;
  rubric_scores?: RubricScore[];
  created_at: string;
  updated_at: string;
}

export interface SubmittedFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface RubricScore {
  criterion_id: number;
  criterion_name: string;
  level_id: number;
  level_name: string;
  points: number;
  feedback?: string;
}

// ============================================================================
// ANNOUNCEMENT TYPES
// ============================================================================

export interface CourseAnnouncement {
  id: number;
  course: number;
  course_name: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_pinned: boolean;
  published_at: string;
  author: number;
  author_name: string;
  attachments?: LessonAttachment[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CERTIFICATE TYPES
// ============================================================================

export interface CourseCertificate {
  id: number;
  student: number;
  student_name: string;
  course: number;
  course_name: string;
  certificate_number: string;
  issue_date: string;
  completion_date: string;
  grade?: number;
  certificate_url: string;
  verification_url: string;
  is_verified: boolean;
  metadata?: Record<string, any>;
}

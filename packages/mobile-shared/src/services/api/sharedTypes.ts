export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  offset?: number;
  limit?: number;
}

export interface SortParams {
  ordering?: string;
}

export interface FilterParams {
  status?: string;
  type?: string;
  category?: string;
}

export interface Course {
  id: number;
  title: string;
  description?: string;
  code: string;
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  thumbnail?: string;
  cover_image?: string;
  duration_weeks: number;
  total_hours: number;
  is_published: boolean;
  is_active: boolean;
  current_enrollments: number;
  price?: number;
  currency?: string;
  instructor?: number;
  instructor_name?: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

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

export interface LessonProgress {
  id: number;
  student: number;
  lesson: number;
  lesson_name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percentage: number;
  completion_percentage?: number;
  time_spent_seconds: number;
  last_position?: number;
  last_watched_position_seconds?: number;
  current_page?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface Lesson {
  id: number;
  module: number;
  module_name?: string;
  module_title?: string;
  title: string;
  description?: string;
  order: number;
  lesson_type:
    | 'video'
    | 'audio'
    | 'text'
    | 'article'
    | 'book'
    | 'interactive'
    | 'quiz'
    | 'assignment';
  content?: string;
  video_url?: string;
  video_duration?: number;
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

export interface QuizOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  order: number;
  explanation?: string;
}

export interface QuizQuestion {
  id: number;
  quiz: number;
  question_text: string;
  question_type:
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
  image_url?: string;
  audio_url?: string;
  options?: QuizOption[];
  correct_answer?: string | string[];
  created_at: string;
}

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

export interface QuizAnswer {
  id: number;
  attempt: number;
  question: number;
  answer: string | string[];
  is_correct?: boolean;
  points_earned?: number;
  feedback?: string;
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

export interface AssignmentRubric {
  id: number;
  criterion: string;
  description?: string;
  max_points: number;
}

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

export interface SubmittedFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
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
  created_at: string;
  updated_at: string;
}

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

export interface StudentProfile {
  id: number;
  user: number;
  user_email: string;
  user_full_name: string;
  student_id: string;
  phone?: string;
  avatar?: string;
  enrollment_date: string;
  is_active: boolean;
  branch?: number;
  branch_name?: string;
  level?: number;
  level_name?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentStatistics {
  student: StudentProfile;
  total_courses: number;
  completed_courses: number;
  active_courses: number;
  total_assignments: number;
  completed_assignments: number;
  pending_assignments: number;
  total_quizzes: number;
  average_quiz_score: number;
  total_attendance: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;
  overall_performance: number;
  current_streak: number;
  longest_streak: number;
  balance: number;
  total_paid: number;
  total_due: number;
  coins_balance: number;
  total_xp: number;
  current_level: number;
  badges_earned: number;
  achievements_unlocked: number;
  recent_activities: Array<Record<string, unknown>>;
  upcoming_events: Array<Record<string, unknown>>;
  pending_tasks: Array<Record<string, unknown>>;
}

export interface StudentBalance {
  student: number;
  balance: number;
  total_paid: number;
  total_due: number;
  currency: string;
  last_payment_date?: string;
  last_payment_amount?: number;
}

export interface Fine {
  id: number;
  student: number;
  amount: number;
  reason: string;
  fine_type: string;
  status: 'pending' | 'paid' | 'waived';
  issued_date: string;
  due_date: string;
  paid_date?: string;
  notes?: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  code: string;
  course?: number;
  course_name?: string;
  teacher?: number;
  teacher_name?: string;
  branch?: number;
  branch_name?: string;
  start_date: string;
  end_date?: string;
  max_students: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  user: number;
  title: string;
  message: string;
  notification_type: string;
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  assignment_reminders: boolean;
  exam_reminders: boolean;
  attendance_alerts: boolean;
  grade_notifications: boolean;
  announcement_notifications: boolean;
}

export const queryKeys = {
  auth: ['auth'] as const,
  profile: () => [...queryKeys.auth, 'profile'] as const,
  student: ['student'] as const,
  studentStats: () => [...queryKeys.student, 'statistics'] as const,
  studentBalance: () => [...queryKeys.student, 'balance'] as const,
  lms: ['lms'] as const,
  courses: (filters?: unknown) => [...queryKeys.lms, 'courses', filters] as const,
  course: (id: number) => [...queryKeys.lms, 'courses', id] as const,
  modules: (courseId?: number) => [...queryKeys.lms, 'modules', courseId] as const,
  lessons: (moduleId?: number) => [...queryKeys.lms, 'lessons', moduleId] as const,
  quizzes: (filters?: unknown) => [...queryKeys.lms, 'quizzes', filters] as const,
  quiz: (id: number) => [...queryKeys.lms, 'quizzes', id] as const,
  assignments: (filters?: unknown) => [...queryKeys.lms, 'assignments', filters] as const,
  assignment: (id: number) => [...queryKeys.lms, 'assignments', id] as const,
  progress: () => [...queryKeys.lms, 'progress'] as const,
};

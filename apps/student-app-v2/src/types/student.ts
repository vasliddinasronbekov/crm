/**
 * Student Profile Type Definitions
 */

// ============================================================================
// STUDENT PROFILE
// ============================================================================

export interface StudentProfile {
  id: number;
  user: number;
  user_email: string;
  user_full_name: string;
  student_id: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  avatar?: string;
  bio?: string;
  enrollment_date: string;
  is_active: boolean;
  branch?: number;
  branch_name?: string;
  level?: number;
  level_name?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// STUDENT STATISTICS
// ============================================================================

export interface StudentStatistics {
  student: StudentProfile;

  // Academic stats
  total_courses: number;
  completed_courses: number;
  active_courses: number;
  total_assignments: number;
  completed_assignments: number;
  pending_assignments: number;
  total_quizzes: number;
  average_quiz_score: number;

  // Attendance
  total_attendance: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;

  // Performance
  overall_performance: number;
  current_streak: number;
  longest_streak: number;

  // Financial
  balance: number;
  total_paid: number;
  total_due: number;
  coins_balance: number;

  // Gamification
  total_xp: number;
  current_level: number;
  badges_earned: number;
  achievements_unlocked: number;

  // Recent activity
  recent_activities: Activity[];
  upcoming_events: Event[];
  pending_tasks: Task[];
}

export interface Activity {
  id: number;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_all_day: boolean;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}

// ============================================================================
// STUDENT BALANCE & FINES
// ============================================================================

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

// ============================================================================
// GROUPS
// ============================================================================

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
  schedule?: Schedule[];
  max_students: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
}

export interface Schedule {
  day_of_week: number; // 0=Monday, 6=Sunday
  start_time: string; // HH:MM format
  end_time: string;
  room?: string;
}

// ============================================================================
// ATTENDANCE
// ============================================================================

export interface AttendanceRecord {
  id: number;
  student: number;
  student_name: string;
  group?: number;
  group_name?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  notes?: string;
  marked_by?: number;
  marked_by_name?: string;
  created_at: string;
}

export interface AttendanceStatistics {
  total_days: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percentage: number;
  current_streak: number;
  longest_streak: number;
  recent_records: AttendanceRecord[];
}

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_type: 'class' | 'exam' | 'assignment' | 'holiday' | 'meeting' | 'other';
  start_time: string;
  end_time: string;
  location?: string;
  is_all_day: boolean;
  recurrence?: RecurrenceRule;
  attendees?: number[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number;
  until?: string;
  by_day?: number[];
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

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
  metadata?: Record<string, any>;
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

/**
 * TypeScript type definitions for Parent Portal
 */

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone_number?: string;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  grade_level?: string;
  photo_url?: string;
  status: string;
}

export interface Progress {
  id: number;
  student: number;
  course: number;
  course_name: string;
  completion_percentage: number;
  current_module?: string;
  last_accessed: string;
  time_spent_hours: number;
}

export interface Attendance {
  id: number;
  student: number;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export interface Grade {
  id: number;
  student: number;
  course: string;
  exam_name: string;
  score: number;
  max_score: number;
  percentage: number;
  date: string;
  feedback?: string;
}

export interface Conversation {
  id: number;
  title?: string;
  conversation_type: 'direct' | 'group';
  participants: User[];
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation: number;
  sender: User;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface StudentStatistics {
  total_courses: number;
  completed_courses: number;
  in_progress_courses: number;
  average_grade: number;
  attendance_rate: number;
  total_study_hours: number;
  achievements_count: number;
}

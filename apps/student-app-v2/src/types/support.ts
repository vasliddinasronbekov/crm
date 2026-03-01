/**
 * Support & Help System Type Definitions
 */

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export interface SupportTicket {
  id: number;
  ticket_number: string;
  student: number;
  student_name: string;
  student_email: string;

  // Ticket details
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;

  // Assignment
  assigned_to?: number;
  assigned_to_name?: string;
  department?: string;

  // Attachments
  attachments?: TicketAttachment[];

  // Activity
  messages_count: number;
  last_message_at?: string;
  last_message_by?: number;

  // Resolution
  resolution?: string;
  resolved_at?: string;
  resolved_by?: number;
  resolution_time_hours?: number;

  // Satisfaction
  rating?: number; // 1-5
  feedback?: string;

  // Metadata
  tags?: string[];
  related_tickets?: number[];

  created_at: string;
  updated_at: string;
}

export type TicketCategory =
  | 'technical'
  | 'account'
  | 'billing'
  | 'course'
  | 'exam'
  | 'attendance'
  | 'grades'
  | 'feature_request'
  | 'bug_report'
  | 'other';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus =
  | 'open'
  | 'pending'
  | 'in_progress'
  | 'waiting_customer'
  | 'waiting_staff'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export interface TicketAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: string;
}

// ============================================================================
// TICKET MESSAGES
// ============================================================================

export interface TicketMessage {
  id: number;
  ticket: number;
  sender: number;
  sender_name: string;
  sender_avatar?: string;
  sender_role: 'student' | 'staff' | 'admin' | 'system';
  message: string;
  attachments?: TicketAttachment[];
  is_internal: boolean; // Internal note, not visible to student
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface TicketChat {
  ticket: SupportTicket;
  messages: TicketMessage[];
  typing_indicators?: TypingIndicator[];
}

export interface TypingIndicator {
  user_id: number;
  user_name: string;
  is_typing: boolean;
}

// ============================================================================
// TICKET STATISTICS
// ============================================================================

export interface TicketStatistics {
  student: number;

  // Counts
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;

  // By category
  tickets_by_category: CategoryCount[];

  // By status
  tickets_by_status: StatusCount[];

  // Response times
  average_first_response_hours: number;
  average_resolution_hours: number;

  // Satisfaction
  average_rating?: number;
  total_ratings: number;

  // Recent
  recent_tickets: SupportTicket[];
}

export interface CategoryCount {
  category: TicketCategory;
  count: number;
}

export interface StatusCount {
  status: TicketStatus;
  count: number;
}

// ============================================================================
// FAQ & KNOWLEDGE BASE
// ============================================================================

export interface FAQCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  articles_count: number;
}

export interface FAQArticle {
  id: number;
  category: number;
  category_name: string;
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  is_helpful_by_user?: boolean;
  is_featured: boolean;
  is_published: boolean;
  author: number;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface FAQSearch {
  query: string;
  results: FAQArticle[];
  total_results: number;
  search_time_ms: number;
}

// ============================================================================
// LIVE CHAT
// ============================================================================

export interface LiveChatSession {
  id: number;
  student: number;
  student_name: string;
  agent?: number;
  agent_name?: string;
  status: ChatStatus;
  started_at: string;
  ended_at?: string;
  messages: ChatMessage[];
  queue_position?: number;
  estimated_wait_minutes?: number;
}

export type ChatStatus = 'waiting' | 'active' | 'ended';

export interface ChatMessage {
  id: number;
  session: number;
  sender: number;
  sender_name: string;
  sender_type: 'student' | 'agent' | 'bot';
  message: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachments?: TicketAttachment[];
  is_read: boolean;
  timestamp: string;
}

export interface ChatAgent {
  id: number;
  name: string;
  avatar?: string;
  role: string;
  is_online: boolean;
  current_chats: number;
  max_chats: number;
  average_rating: number;
}

// ============================================================================
// FEEDBACK & SURVEYS
// ============================================================================

export interface Feedback {
  id: number;
  student: number;
  feedback_type: FeedbackType;
  category: string;
  rating?: number; // 1-5
  subject?: string;
  message: string;
  attachments?: TicketAttachment[];
  is_anonymous: boolean;
  status: 'submitted' | 'under_review' | 'resolved' | 'archived';
  response?: string;
  responded_at?: string;
  responded_by?: number;
  created_at: string;
}

export type FeedbackType = 'suggestion' | 'complaint' | 'praise' | 'bug_report' | 'feature_request';

export interface Survey {
  id: number;
  title: string;
  description?: string;
  survey_type: SurveyType;
  questions: SurveyQuestion[];
  is_active: boolean;
  is_required: boolean;
  start_date?: string;
  end_date?: string;
  responses_count: number;
  created_at: string;
}

export type SurveyType = 'satisfaction' | 'course_evaluation' | 'event_feedback' | 'general';

export interface SurveyQuestion {
  id: number;
  question_text: string;
  question_type: 'rating' | 'multiple_choice' | 'text' | 'yes_no' | 'scale';
  options?: string[];
  is_required: boolean;
  order: number;
}

export interface SurveyResponse {
  id: number;
  survey: number;
  student: number;
  answers: SurveyAnswer[];
  completed_at: string;
}

export interface SurveyAnswer {
  question_id: number;
  answer: string | number | string[];
}

// ============================================================================
// CONTACT & COMMUNICATION
// ============================================================================

export interface ContactInformation {
  support_email: string;
  support_phone: string;
  support_hours: string;
  emergency_contact?: string;
  address?: string;
  social_media?: SocialMediaLinks;
}

export interface SocialMediaLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
}

export interface SupportCategory {
  id: number;
  name: string;
  description: string;
  icon?: string;
  estimated_response_time?: string;
  contact_methods: ContactMethod[];
}

export interface ContactMethod {
  type: 'email' | 'phone' | 'chat' | 'ticket' | 'whatsapp';
  value: string;
  availability?: string;
  is_available_now?: boolean;
}

// ============================================================================
// NOTIFICATIONS & ALERTS
// ============================================================================

export interface SupportNotification {
  id: number;
  user: number;
  notification_type: SupportNotificationType;
  title: string;
  message: string;
  ticket_id?: number;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  created_at: string;
}

export type SupportNotificationType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_resolved'
  | 'message_received'
  | 'chat_started'
  | 'survey_available'
  | 'announcement';

export interface SystemAnnouncement {
  id: number;
  title: string;
  content: string;
  announcement_type: 'maintenance' | 'feature' | 'policy' | 'emergency' | 'general';
  severity: 'info' | 'warning' | 'critical';
  is_active: boolean;
  show_banner: boolean;
  start_date: string;
  end_date?: string;
  created_at: string;
}

/**
 * Social Learning Type Definitions
 */

// ============================================================================
// FORUMS
// ============================================================================

export interface Forum {
  id: number;
  name: string;
  description?: string;
  category: ForumCategory;
  icon?: string;
  cover_image?: string;
  is_public: boolean;
  is_moderated: boolean;
  topics_count: number;
  posts_count: number;
  last_activity?: string;
  moderators?: number[];
  created_at: string;
}

export type ForumCategory =
  | 'general'
  | 'course_specific'
  | 'study_help'
  | 'announcements'
  | 'feedback'
  | 'off_topic';

export interface ForumTopic {
  id: number;
  forum: number;
  forum_name: string;
  title: string;
  content: string;
  author: number;
  author_name: string;
  author_avatar?: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_announcement: boolean;
  views_count: number;
  replies_count: number;
  likes_count: number;
  tags?: string[];
  last_reply_at?: string;
  last_reply_by?: number;
  last_reply_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ForumPost {
  id: number;
  topic: number;
  author: number;
  author_name: string;
  author_avatar?: string;
  author_level?: number;
  content: string;
  attachments?: PostAttachment[];
  parent_post?: number; // For nested replies
  is_answer: boolean; // Marked as correct answer
  is_edited: boolean;
  edited_at?: string;
  likes_count: number;
  replies_count: number;
  is_liked_by_user?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface ForumStatistics {
  total_topics: number;
  total_posts: number;
  user_topics: number;
  user_posts: number;
  user_likes_received: number;
  user_best_answers: number;
  reputation_score: number;
}

// ============================================================================
// STUDY GROUPS
// ============================================================================

export interface StudyGroup {
  id: number;
  name: string;
  description?: string;
  group_type: StudyGroupType;
  course?: number;
  course_name?: string;
  topic?: string;
  cover_image?: string;
  is_public: boolean;
  is_active: boolean;

  // Membership
  creator: number;
  creator_name: string;
  members_count: number;
  max_members?: number;
  pending_requests?: number;

  // Activity
  posts_count: number;
  last_activity?: string;

  // Schedule
  meeting_schedule?: GroupMeeting[];
  next_meeting?: string;

  // Statistics
  study_hours_total: number;
  resources_shared: number;

  tags?: string[];
  created_at: string;
  updated_at: string;
}

export type StudyGroupType =
  | 'course_study'
  | 'exam_prep'
  | 'project'
  | 'language_exchange'
  | 'peer_tutoring'
  | 'general';

export interface GroupMembership {
  id: number;
  group: number;
  user: number;
  user_name: string;
  user_avatar?: string;
  role: GroupRole;
  status: 'active' | 'pending' | 'left' | 'removed';
  joined_at: string;
  contribution_score?: number;
}

export type GroupRole = 'creator' | 'admin' | 'moderator' | 'member';

export interface GroupMeeting {
  id: number;
  group: number;
  title: string;
  description?: string;
  meeting_type: 'online' | 'in_person' | 'hybrid';
  start_time: string;
  end_time: string;
  location?: string;
  meeting_url?: string;
  attendees_count: number;
  is_recurring: boolean;
  recurrence?: string;
  created_by: number;
  created_at: string;
}

export interface GroupPost {
  id: number;
  group: number;
  author: number;
  author_name: string;
  author_avatar?: string;
  post_type: 'text' | 'question' | 'resource' | 'announcement' | 'poll';
  content: string;
  attachments?: PostAttachment[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  is_liked_by_user?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupResource {
  id: number;
  group: number;
  shared_by: number;
  shared_by_name: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'video' | 'link' | 'image' | 'audio';
  file_url?: string;
  external_url?: string;
  downloads_count: number;
  likes_count: number;
  created_at: string;
}

// ============================================================================
// SOCIAL FEED
// ============================================================================

export interface FeedItem {
  id: number;
  activity_type: FeedActivityType;
  actor: number;
  actor_name: string;
  actor_avatar?: string;
  action: string; // Human-readable action
  target?: FeedTarget;
  content?: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked_by_user?: boolean;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
}

export type FeedActivityType =
  | 'course_completed'
  | 'badge_earned'
  | 'achievement_unlocked'
  | 'level_up'
  | 'quiz_passed'
  | 'assignment_submitted'
  | 'streak_milestone'
  | 'joined_group'
  | 'shared_resource'
  | 'posted_question'
  | 'helped_peer'
  | 'custom';

export interface FeedTarget {
  type: 'course' | 'badge' | 'achievement' | 'quiz' | 'assignment' | 'group' | 'forum';
  id: number;
  name: string;
  url?: string;
}

export interface FeedComment {
  id: number;
  feed_item: number;
  author: number;
  author_name: string;
  author_avatar?: string;
  content: string;
  likes_count: number;
  is_liked_by_user?: boolean;
  created_at: string;
}

// ============================================================================
// PEER MESSAGING
// ============================================================================

export interface Conversation {
  id: number;
  conversation_type: 'direct' | 'group';
  title?: string; // For group conversations
  participants: ConversationParticipant[];
  last_message?: Message;
  unread_count: number;
  is_muted: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  user: number;
  user_name: string;
  user_avatar?: string;
  role?: 'admin' | 'member';
  is_online: boolean;
  last_seen?: string;
  joined_at: string;
}

export interface Message {
  id: number;
  conversation: number;
  sender: number;
  sender_name: string;
  sender_avatar?: string;
  message_type: MessageType;
  content?: string;
  attachments?: MessageAttachment[];
  reply_to?: number; // Reference to another message
  is_read: boolean;
  read_at?: string;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  reactions?: MessageReaction[];
  created_at: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'system';

export interface MessageAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  thumbnail_url?: string;
  duration?: number; // For audio/video
}

export interface MessageReaction {
  emoji: string;
  users: number[];
  count: number;
}

export interface TypingIndicator {
  conversation_id: number;
  user_id: number;
  user_name: string;
  is_typing: boolean;
}

// ============================================================================
// PEER CONNECTIONS
// ============================================================================

export interface PeerConnection {
  id: number;
  user: number;
  friend: number;
  friend_name: string;
  friend_avatar?: string;
  friend_level?: number;
  status: ConnectionStatus;
  mutual_friends?: number;
  common_courses?: number[];
  created_at: string;
}

export type ConnectionStatus = 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';

export interface ConnectionRequest {
  id: number;
  from_user: number;
  from_user_name: string;
  from_user_avatar?: string;
  to_user: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// ============================================================================
// COLLABORATION
// ============================================================================

export interface CollaborativeSession {
  id: number;
  session_type: 'study' | 'project' | 'homework' | 'exam_prep';
  title: string;
  description?: string;
  host: number;
  host_name: string;
  participants: SessionParticipant[];
  max_participants?: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  start_time: string;
  end_time?: string;
  meeting_url?: string;
  shared_documents?: SharedDocument[];
  created_at: string;
}

export interface SessionParticipant {
  user: number;
  user_name: string;
  user_avatar?: string;
  role: 'host' | 'co-host' | 'participant';
  joined_at?: string;
  contribution_score?: number;
}

export interface SharedDocument {
  id: number;
  title: string;
  document_type: 'notes' | 'whiteboard' | 'code' | 'spreadsheet';
  url: string;
  shared_by: number;
  created_at: string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface SocialNotification {
  id: number;
  user: number;
  notification_type: SocialNotificationType;
  title: string;
  message: string;
  actor?: number;
  actor_name?: string;
  actor_avatar?: string;
  target_type?: string;
  target_id?: number;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export type SocialNotificationType =
  | 'message'
  | 'mention'
  | 'reply'
  | 'like'
  | 'follow'
  | 'friend_request'
  | 'group_invite'
  | 'group_join'
  | 'post_answer'
  | 'achievement_shared'
  | 'study_reminder';

// ============================================================================
// ACTIVITY & ENGAGEMENT
// ============================================================================

export interface UserActivity {
  user: number;
  activity_type: string;
  timestamp: string;
  duration_seconds?: number;
  metadata?: Record<string, any>;
}

export interface EngagementMetrics {
  user: number;
  posts_created: number;
  comments_made: number;
  likes_given: number;
  likes_received: number;
  resources_shared: number;
  groups_joined: number;
  peers_helped: number;
  reputation_score: number;
  engagement_level: 'low' | 'medium' | 'high' | 'very_high';
}

export interface MentorshipRelation {
  id: number;
  mentor: number;
  mentor_name: string;
  mentor_avatar?: string;
  mentee: number;
  mentee_name: string;
  mentee_avatar?: string;
  focus_area?: string;
  status: 'active' | 'completed' | 'paused';
  sessions_count: number;
  started_at: string;
}

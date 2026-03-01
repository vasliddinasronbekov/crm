/**
 * Gamification System Type Definitions
 */

// ============================================================================
// GAMIFICATION PROFILE
// ============================================================================

export interface GamificationProfile {
  id: number;
  user: number;
  username: string;
  full_name: string;
  avatar?: string;

  // XP and Level
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  level_progress_percentage: number;

  // Streaks
  current_streak: number;
  longest_streak: number;
  streak_freeze_available: number;

  // Badges and Achievements
  badges_earned: number;
  achievements_unlocked: number;
  total_badges: number;
  total_achievements: number;

  // Coins
  coins_balance: number;
  coins_earned_total: number;
  coins_spent_total: number;

  // Rankings
  global_rank?: number;
  branch_rank?: number;
  course_rank?: number;

  // Statistics
  courses_completed: number;
  quizzes_completed: number;
  assignments_submitted: number;
  study_hours_total: number;
  login_count: number;
  last_activity: string;

  // Preferences
  is_profile_public: boolean;
  show_on_leaderboard: boolean;
  notifications_enabled: boolean;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// XP (EXPERIENCE POINTS)
// ============================================================================

export interface XPTransaction {
  id: number;
  user: number;
  amount: number;
  reason: string;
  source: XPSource;
  metadata?: Record<string, any>;
  created_at: string;
}

export type XPSource =
  | 'lesson_completed'
  | 'quiz_passed'
  | 'assignment_submitted'
  | 'perfect_score'
  | 'daily_login'
  | 'streak_bonus'
  | 'challenge_completed'
  | 'achievement_unlocked'
  | 'badge_earned'
  | 'social_activity'
  | 'helping_peer'
  | 'bonus_reward';

export interface Level {
  level: number;
  name: string;
  xp_required: number;
  xp_range_start: number;
  xp_range_end: number;
  rewards?: LevelReward[];
  perks?: string[];
}

export interface LevelReward {
  type: 'coins' | 'badge' | 'avatar' | 'title' | 'feature';
  value: string | number;
  description: string;
}

// ============================================================================
// BADGES
// ============================================================================

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  badge_type: BadgeType;
  rarity: BadgeRarity;
  category: BadgeCategory;

  // Unlock criteria
  criteria: BadgeCriteria;

  // Rewards
  xp_reward: number;
  coins_reward: number;

  // Statistics
  earned_count: number;
  total_users: number;
  earned_percentage: number;

  is_secret: boolean;
  is_active: boolean;
  created_at: string;
}

export type BadgeType = 'achievement' | 'milestone' | 'streak' | 'competition' | 'special';
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'learning' | 'social' | 'attendance' | 'performance' | 'special';

export interface BadgeCriteria {
  type: 'count' | 'streak' | 'score' | 'time' | 'custom';
  target_value: number;
  metric: string; // e.g., "lessons_completed", "perfect_scores", "login_streak"
  additional_conditions?: Record<string, any>;
}

export interface UserBadge {
  id: number;
  user: number;
  badge: Badge;
  earned_at: string;
  progress?: number; // For multi-level badges
  is_equipped: boolean; // To display on profile
  showcase_order?: number;
}

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  achievement_type: AchievementType;
  category: string;

  // Unlock criteria
  criteria: AchievementCriteria;

  // Progression
  is_progressive: boolean; // Can be unlocked multiple times
  max_progress?: number;
  current_progress?: number;

  // Rewards
  xp_reward: number;
  coins_reward: number;
  badge_reward?: number;

  // Visibility
  is_secret: boolean;
  hint?: string; // For secret achievements

  // Statistics
  unlocked_count: number;
  unlocked_percentage: number;

  created_at: string;
}

export type AchievementType =
  | 'course_completion'
  | 'perfect_score'
  | 'speed_demon'
  | 'early_bird'
  | 'night_owl'
  | 'social_butterfly'
  | 'helping_hand'
  | 'collector'
  | 'milestone';

export interface AchievementCriteria {
  conditions: AchievementCondition[];
  logic: 'AND' | 'OR'; // How to combine conditions
}

export interface AchievementCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string;
}

export interface UserAchievement {
  id: number;
  user: number;
  achievement: Achievement;
  unlocked_at: string;
  progress: number;
  is_completed: boolean;
}

// ============================================================================
// CHALLENGES
// ============================================================================

export interface Challenge {
  id: number;
  title: string;
  description: string;
  challenge_type: ChallengeType;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';

  // Duration
  start_date: string;
  end_date: string;
  duration_days?: number;

  // Requirements
  requirements: ChallengeRequirement[];

  // Rewards
  xp_reward: number;
  coins_reward: number;
  badge_reward?: number;

  // Participation
  max_participants?: number;
  current_participants: number;
  is_team_challenge: boolean;

  // Status
  is_active: boolean;
  is_recurring: boolean;
  recurrence?: 'daily' | 'weekly' | 'monthly';

  created_at: string;
}

export type ChallengeType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'special_event'
  | 'course_specific'
  | 'community';

export interface ChallengeRequirement {
  task: string;
  target_value: number;
  current_value?: number;
  metric: string;
  description?: string;
}

export interface UserChallenge {
  id: number;
  user: number;
  challenge: Challenge;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'expired';
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  rewards_claimed: boolean;
  requirements_progress: ChallengeProgress[];
}

export interface ChallengeProgress {
  requirement_id: number;
  task: string;
  current_value: number;
  target_value: number;
  is_completed: boolean;
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  full_name: string;
  avatar?: string;
  score: number; // XP, points, or other metric
  level?: number;
  badge_count?: number;
  change?: number; // Rank change from previous period
  is_current_user?: boolean;
}

export interface Leaderboard {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  total_participants: number;
  current_user_rank?: number;
  current_user_score?: number;
  updated_at: string;
}

export type LeaderboardType = 'global' | 'branch' | 'course' | 'group' | 'friends';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';
export type LeaderboardMetric = 'xp' | 'level' | 'streak' | 'coins' | 'assignments' | 'quizzes';

export interface LeaderboardFilters {
  type?: LeaderboardType;
  period?: LeaderboardPeriod;
  metric?: LeaderboardMetric;
  branch_id?: number;
  course_id?: number;
  group_id?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// COINS & REWARDS
// ============================================================================

export interface CoinTransaction {
  id: number;
  user: number;
  amount: number;
  transaction_type: 'earn' | 'spend' | 'transfer' | 'refund';
  reason: string;
  source: CoinSource;
  balance_before: number;
  balance_after: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export type CoinSource =
  | 'daily_login'
  | 'lesson_completed'
  | 'quiz_passed'
  | 'assignment_submitted'
  | 'challenge_completed'
  | 'achievement_unlocked'
  | 'referral'
  | 'purchase'
  | 'shop_purchase'
  | 'bonus'
  | 'admin_grant';

export interface CoinBalance {
  user: number;
  balance: number;
  earned_total: number;
  spent_total: number;
  last_transaction?: string;
}

export interface EarnOpportunity {
  id: number;
  title: string;
  description: string;
  coins_amount: number;
  opportunity_type: 'task' | 'event' | 'promotion';
  requirements?: string[];
  available_until?: string;
  is_active: boolean;
}

// ============================================================================
// STREAKS
// ============================================================================

export interface Streak {
  user: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  streak_freeze_available: number;
  streak_freeze_used: number;
  milestone_reached?: number;
}

export interface StreakHistory {
  id: number;
  user: number;
  date: string;
  activity_type: string;
  streak_count: number;
  was_frozen: boolean;
}

// ============================================================================
// REWARDS
// ============================================================================

export interface Reward {
  id: number;
  name: string;
  description: string;
  reward_type: RewardType;
  icon_url?: string;
  value: string | number;
  cost_coins?: number;
  cost_xp?: number;
  required_level?: number;
  is_available: boolean;
  is_limited: boolean;
  quantity_available?: number;
  expires_at?: string;
}

export type RewardType =
  | 'avatar'
  | 'title'
  | 'theme'
  | 'badge'
  | 'feature_unlock'
  | 'discount'
  | 'physical_item'
  | 'certificate';

export interface UserReward {
  id: number;
  user: number;
  reward: Reward;
  claimed_at: string;
  is_active: boolean;
  expires_at?: string;
}

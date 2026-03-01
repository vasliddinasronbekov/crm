/**
 * Gamification API - XP, badges, leaderboard endpoints
 * Updated 2025-11-24: Using tested endpoints from API review
 * Tested with: student_akmal / test
 */

import { apiClient } from "./client";

export interface StudentProfile {
  id: string;
  user: string;
  xp_points: number;
  level: number;
  rank: number;
  total_students: number;
  badges_count: number;
  achievements_count: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "achievement" | "skill" | "milestone";
  rarity: "common" | "rare" | "epic" | "legendary";
  earned_at?: string;
  progress?: number;
  total_required?: number;
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  avatar?: string;
  xp_points: number;
  level: number;
  badges_count: number;
}

interface RawGamificationProfile {
  level_info?: {
    id?: number | string;
    username?: string;
    total_xp?: number;
    current_level?: number;
  };
  badges?: unknown[];
  achievements?: unknown[];
  leaderboard_rank?: number | null;
}

interface RawLeaderboardEntry {
  rank?: number;
  student_id?: number | string;
  student_name?: string;
  avatar?: string | null;
  photo?: string | null;
  xp_points?: number;
  level?: number;
  badges_count?: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: "physical" | "virtual" | "privilege";
  price_xp: number;
  stock: number;
  image?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  deadline?: string;
  progress: number;
  total_required: number;
  is_completed: boolean;
}

export const gamificationApi = {
  /**
   * Get student profile with XP and rank
   * TESTED ✅ - /api/gamification/profile/my_profile/
   */
  getProfile: async (): Promise<StudentProfile> => {
    const response = (await apiClient.get(
      "/api/gamification/profile/my_profile/",
    )) as RawGamificationProfile;

    return {
      id: String(response.level_info?.id ?? ""),
      user: response.level_info?.username ?? "",
      xp_points: response.level_info?.total_xp ?? 0,
      level: response.level_info?.current_level ?? 1,
      rank: response.leaderboard_rank ?? 0,
      total_students: 0,
      badges_count: Array.isArray(response.badges) ? response.badges.length : 0,
      achievements_count: Array.isArray(response.achievements)
        ? response.achievements.length
        : 0,
    };
  },

  /**
   * Get all badges (earned and available)
   * TESTED ✅ - /api/gamification/badges/
   */
  getBadges: async (): Promise<Badge[]> => {
    return await apiClient.get("/api/gamification/badges/");
  },

  /**
   * Get earned badges only
   */
  getEarnedBadges: async (): Promise<Badge[]> => {
    return await apiClient.get("/api/gamification/badges/my_badges/");
  },

  /**
   * Get leaderboard
   * TESTED ✅ - /api/v1/ranking/leaderboard/
   */
  getLeaderboard: async (courseId?: number): Promise<LeaderboardEntry[]> => {
    const searchParams = new URLSearchParams({ metric: "xp" });

    if (courseId) {
      searchParams.set("course", String(courseId));
    }

    const response = (await apiClient.get(
      `/api/v1/ranking/leaderboard/?${searchParams.toString()}`,
    )) as RawLeaderboardEntry[] | { results?: RawLeaderboardEntry[] };

    const results = Array.isArray(response)
      ? response
      : response?.results || [];

    return results.map((entry, index) => ({
      rank: entry.rank ?? index + 1,
      student_id: String(entry.student_id ?? ""),
      student_name: entry.student_name ?? "Student",
      avatar: entry.avatar || entry.photo || undefined,
      xp_points: entry.xp_points ?? 0,
      level: entry.level ?? 1,
      badges_count: entry.badges_count ?? 0,
    }));
  },

  /**
   * Get my rank on leaderboard
   */
  getMyRank: async (): Promise<any> => {
    return await apiClient.get("/api/gamification/leaderboard/my_rank/");
  },

  /**
   * Get shop products (coin-based)
   * TESTED ✅ - /api/v1/student-profile/product/
   */
  getShopItems: async (): Promise<ShopItem[]> => {
    return await apiClient.get("/api/v1/student-profile/product/");
  },

  /**
   * Get shop product detail
   * TESTED ✅ - /api/v1/student-profile/product/{id}/
   */
  getShopItem: async (productId: string): Promise<ShopItem> => {
    return await apiClient.get(`/api/v1/student-profile/product/${productId}/`);
  },

  /**
   * Get my orders
   * TESTED ✅ - /api/v1/student-profile/order/
   */
  getMyOrders: async (): Promise<any[]> => {
    return await apiClient.get("/api/v1/student-profile/order/");
  },

  /**
   * Place order (purchase shop item with coins)
   * TESTED ✅ - /api/v1/student-profile/order/
   */
  purchaseItem: async (
    productId: string,
    quantity: number = 1,
  ): Promise<void> => {
    return await apiClient.post("/api/v1/student-profile/order/", {
      product: productId,
      quantity,
    });
  },

  /**
   * Get coin balance
   * TESTED ✅ - /api/v1/student-bonus/
   */
  getCoinBalance: async (): Promise<{ total_coins: number }> => {
    return await apiClient.get("/api/v1/student-bonus/");
  },

  /**
   * Get coin transactions
   */
  getCoinTransactions: async (): Promise<any[]> => {
    return await apiClient.get("/api/v1/student-bonus/transactions/");
  },

  /**
   * Get active challenges
   */
  getChallenges: async (): Promise<Challenge[]> => {
    return await apiClient.get("/api/gamification/daily-challenges/");
  },
};

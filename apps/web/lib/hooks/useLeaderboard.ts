import { useQuery } from "@tanstack/react-query";
import apiService from "@/lib/api";

export type LeaderboardMetric =
  | "score"
  | "xp"
  | "coins"
  | "badges"
  | "completed_courses";
export type LeaderboardFilter = "all" | "top10" | "top50";

export interface LeaderboardEntry {
  id: number;
  student: number;
  student_id: number;
  username: string;
  student_name: string;
  rank: number;
  score: number;
  avg_score: number;
  coins: number;
  xp_points: number;
  level: number;
  badges_count: number;
  achievements: number;
  completed_courses: number;
  branch_name?: string | null;
  photo?: string | null;
  avatar?: string | null;
  is_current_user?: boolean;
}

export interface LeaderboardFilters {
  filter?: LeaderboardFilter;
  metric?: LeaderboardMetric;
  course?: number;
  branch?: number;
}

export const leaderboardKeys = {
  all: ["leaderboard"] as const,
  lists: () => [...leaderboardKeys.all, "list"] as const,
  list: (filters?: Record<string, any>) =>
    [...leaderboardKeys.lists(), filters] as const,
};

interface ScopeOptions {
  scopeKey?: string | number | null;
}

function resolveScopeKey(scopeKey?: string | number | null): string | number {
  return scopeKey ?? "all";
}

export function useGetLeaderboard(
  filters: LeaderboardFilters = {},
  { scopeKey = "default" }: ScopeOptions = {},
) {
  const resolvedScopeKey = resolveScopeKey(scopeKey);

  return useQuery({
    queryKey: [...leaderboardKeys.list(filters), resolvedScopeKey],
    queryFn: async () => {
      const params: Record<string, any> = {};

      if (filters.metric) {
        params.metric = filters.metric;
      }

      if (filters.filter === "top10") {
        params.limit = 10;
      } else if (filters.filter === "top50") {
        params.limit = 50;
      }

      if (filters.course) {
        params.course = filters.course;
      }

      if (filters.branch) {
        params.branch = filters.branch;
      }

      const data = await apiService.getLeaderboard(params);
      return (
        Array.isArray(data) ? data : data?.results || []
      ) as LeaderboardEntry[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

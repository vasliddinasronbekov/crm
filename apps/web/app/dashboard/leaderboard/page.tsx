"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchContext } from "@/contexts/BranchContext";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Star,
  TrendingUp,
  User,
  Coins,
  Target,
  GraduationCap,
} from "lucide-react";
import {
  useGetLeaderboard,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "@/lib/hooks/useLeaderboard";
import BranchScopeChip from '@/components/BranchScopeChip'
import LoadingScreen from '@/components/LoadingScreen'

const metricOptions: Array<{
  value: LeaderboardMetric;
  label: string;
  shortLabel: string;
}> = [
  { value: "score", label: "Exam Score", shortLabel: "Score" },
  { value: "xp", label: "XP Points", shortLabel: "XP" },
  { value: "coins", label: "Coins", shortLabel: "Coins" },
  { value: "badges", label: "Badges", shortLabel: "Badges" },
  {
    value: "completed_courses",
    label: "Completed Courses",
    shortLabel: "Courses",
  },
];

export default function LeaderboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { activeBranchId, branches } = useBranchContext();
  const router = useRouter();

  const [filter, setFilter] = useState<"all" | "top10" | "top50">("all");
  const [metric, setMetric] = useState<LeaderboardMetric>("score");
  const branchScopeKey = activeBranchId ?? "all";
  const activeBranchName = useMemo(
    () =>
      activeBranchId === null
        ? "All branches"
        : branches.find((branch) => branch.id === activeBranchId)?.name ||
          `Branch #${activeBranchId}`,
    [activeBranchId, branches],
  );

  const { data: leaderboard = [], isLoading: leaderboardLoading } =
    useGetLeaderboard({ filter, metric }, { scopeKey: branchScopeKey });

  const loading = authLoading || leaderboardLoading;

  const selectedMetric =
    metricOptions.find((option) => option.value === metric) || metricOptions[0];

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-warning" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-text-secondary" />;
    if (rank === 3) return <Award className="h-6 w-6 text-[#CD7F32]" />;
    return <span className="text-text-secondary font-bold">#{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return "bg-warning/20 border-warning/50";
    if (rank === 2) return "bg-text-secondary/20 border-text-secondary/50";
    if (rank === 3) return "bg-[#CD7F32]/20 border-[#CD7F32]/50";
    return "bg-surface border-border";
  };

  const getMetricValue = useCallback(
    (entry: LeaderboardEntry) => {
      switch (metric) {
        case "xp":
          return entry.xp_points || 0;
        case "coins":
          return entry.coins || 0;
        case "badges":
          return entry.badges_count || 0;
        case "completed_courses":
          return entry.completed_courses || 0;
        case "score":
        default:
          return entry.score || 0;
      }
    },
    [metric],
  );

  const formatMetricValue = useCallback(
    (entry: LeaderboardEntry) => {
      const value = getMetricValue(entry);
      return metric === "score" ? value.toFixed(1) : value.toLocaleString();
    },
    [getMetricValue, metric],
  );

  const stats = useMemo(() => {
    const metricTotal = leaderboard.reduce(
      (sum: number, entry: LeaderboardEntry) => sum + getMetricValue(entry),
      0,
    );

    return {
      totalStudents: leaderboard.length,
      averageMetric:
        leaderboard.length > 0 ? metricTotal / leaderboard.length : 0,
      topMetric: leaderboard.length > 0 ? getMetricValue(leaderboard[0]) : 0,
      totalCoins: leaderboard.reduce(
        (sum: number, entry: LeaderboardEntry) => sum + (entry.coins || 0),
        0,
      ),
    };
  }, [getMetricValue, leaderboard]);

  if (!authLoading && !user) {
    return null;
  }

  if (authLoading || loading) {
    return <LoadingScreen message="Loading leaderboard..." />
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-text-secondary">
            Top performing students and their rankings
          </p>
          <BranchScopeChip scopeName={activeBranchName} className="mt-3" />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Students</p>
              <User className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.totalStudents}</p>
            <p className="text-xs text-text-secondary mt-1">In rankings</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">
                Top {selectedMetric.shortLabel}
              </p>
              <Crown className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">
              {metric === "score"
                ? stats.topMetric.toFixed(1)
                : stats.topMetric.toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Current leading value
            </p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">
                Average {selectedMetric.shortLabel}
              </p>
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">
              {metric === "score"
                ? stats.averageMetric.toFixed(1)
                : Math.round(stats.averageMetric).toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Across current list
            </p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Coins</p>
              <Coins className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">{stats.totalCoins}</p>
            <p className="text-xs text-text-secondary mt-1">All students</p>
          </div>
        </div>

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="mb-8 flex items-end justify-center gap-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="bg-surface border-2 border-text-secondary/50 rounded-2xl p-6 w-48 text-center mb-4">
                <Medal className="h-12 w-12 text-text-secondary mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">
                  {leaderboard[1]?.student_name ||
                    `Student #${leaderboard[1]?.student}`}
                </h3>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-text-secondary">
                  {metric === "score" ? (
                    <Star className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                  {leaderboard[1] ? formatMetricValue(leaderboard[1]) : "0"}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {selectedMetric.shortLabel}
                </p>
              </div>
              <div className="w-48 h-32 bg-gradient-to-t from-text-secondary/30 to-text-secondary/10 rounded-t-2xl flex items-center justify-center">
                <span className="text-6xl font-bold text-text-secondary/50">
                  2
                </span>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              <Crown className="h-8 w-8 text-warning mb-2 animate-bounce" />
              <div className="bg-surface border-2 border-warning/50 rounded-2xl p-6 w-48 text-center mb-4 shadow-lg shadow-warning/20">
                <Crown className="h-16 w-16 text-warning mx-auto mb-3" />
                <h3 className="font-bold text-xl mb-1">
                  {leaderboard[0]?.student_name ||
                    `Student #${leaderboard[0]?.student}`}
                </h3>
                <div className="flex items-center justify-center gap-1 text-3xl font-bold text-warning">
                  {metric === "score" ? (
                    <Star className="h-6 w-6" />
                  ) : (
                    <TrendingUp className="h-6 w-6" />
                  )}
                  {leaderboard[0] ? formatMetricValue(leaderboard[0]) : "0"}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {selectedMetric.shortLabel}
                </p>
              </div>
              <div className="w-48 h-48 bg-gradient-to-t from-warning/30 to-warning/10 rounded-t-2xl flex items-center justify-center">
                <span className="text-7xl font-bold text-warning/50">1</span>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="bg-surface border-2 border-[#CD7F32]/50 rounded-2xl p-6 w-48 text-center mb-4">
                <Award className="h-12 w-12 text-[#CD7F32] mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">
                  {leaderboard[2]?.student_name ||
                    `Student #${leaderboard[2]?.student}`}
                </h3>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-[#CD7F32]">
                  {metric === "score" ? (
                    <Star className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                  {leaderboard[2] ? formatMetricValue(leaderboard[2]) : "0"}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {selectedMetric.shortLabel}
                </p>
              </div>
              <div className="w-48 h-24 bg-gradient-to-t from-[#CD7F32]/30 to-[#CD7F32]/10 rounded-t-2xl flex items-center justify-center">
                <span className="text-5xl font-bold text-[#CD7F32]/50">3</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-background"
                  : "hover:bg-background"
              }`}
            >
              All Students
            </button>
            <button
              onClick={() => setFilter("top10")}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filter === "top10"
                  ? "bg-primary text-background"
                  : "hover:bg-background"
              }`}
            >
              Top 10
            </button>
            <button
              onClick={() => setFilter("top50")}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filter === "top50"
                  ? "bg-primary text-background"
                  : "hover:bg-background"
              }`}
            >
              Top 50
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {metricOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setMetric(option.value)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  metric === option.value
                    ? "bg-primary text-background"
                    : "hover:bg-background"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="space-y-3">
          {leaderboard.map((entry: LeaderboardEntry) => (
            <div
              key={entry.id}
              className={`border-2 rounded-2xl p-4 hover:shadow-lg transition-all ${getRankBg(entry.rank)}`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="w-16 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>

                {/* Student Info */}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">
                    {entry.student_name || `Student #${entry.student}`}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Rank #{entry.rank}
                    {entry.branch_name ? ` • ${entry.branch_name}` : ""}
                    {entry.username ? ` • @${entry.username}` : ""}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap justify-end gap-6">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-2xl font-bold">
                      {metric === "score" && (
                        <Star className="h-5 w-5 text-warning" />
                      )}
                      {metric === "xp" && (
                        <TrendingUp className="h-5 w-5 text-success" />
                      )}
                      {metric === "coins" && (
                        <Coins className="h-5 w-5 text-warning" />
                      )}
                      {metric === "badges" && (
                        <Trophy className="h-5 w-5 text-info" />
                      )}
                      {metric === "completed_courses" && (
                        <GraduationCap className="h-5 w-5 text-success" />
                      )}
                      {formatMetricValue(entry)}
                    </div>
                    <p className="text-xs text-text-secondary">
                      {selectedMetric.shortLabel}
                    </p>
                  </div>

                  {metric !== "score" && (
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-xl font-bold">
                        <Target className="h-5 w-5 text-primary" />
                        {entry.score.toFixed(1)}
                      </div>
                      <p className="text-xs text-text-secondary">Avg Score</p>
                    </div>
                  )}

                  {metric !== "coins" && entry.coins !== undefined && (
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-xl font-bold">
                        <Coins className="h-5 w-5 text-warning" />
                        {entry.coins}
                      </div>
                      <p className="text-xs text-text-secondary">Coins</p>
                    </div>
                  )}

                  {metric !== "completed_courses" &&
                    entry.completed_courses !== undefined && (
                      <div className="text-center">
                        <div className="text-xl font-bold text-success">
                          {entry.completed_courses}
                        </div>
                        <p className="text-xs text-text-secondary">Courses</p>
                      </div>
                    )}

                  {metric !== "badges" && entry.badges_count !== undefined && (
                    <div className="text-center">
                      <div className="text-xl font-bold text-info">
                        {entry.badges_count}
                      </div>
                      <p className="text-xs text-text-secondary">Badges</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
            <p className="text-text-secondary">
              No ranking data available for this filter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

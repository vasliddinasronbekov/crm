// apps/student-app-v2/src/screens/RankingScreen.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@eduvoice/mobile-ui";
import { gamificationApi, useAuthStore } from "@eduvoice/mobile-shared";

export const RankingScreen = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const selectedFilter: "all" | number = "all";

  // Fetch leaderboard data
  const {
    data: leaderboard,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["leaderboard", selectedFilter],
    queryFn: () => {
      if (selectedFilter === "all") {
        return gamificationApi.getLeaderboard();
      }
      return gamificationApi.getLeaderboard(selectedFilter);
    },
    retry: 2,
  });

  // Fetch gamification profile
  const { data: profile } = useQuery({
    queryKey: ["gamificationProfile"],
    queryFn: gamificationApi.getProfile,
    retry: 2,
  });

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>
          {t("ranking.loadingLeaderboard")}
        </Text>
      </View>
    );
  }

  // Show error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={64}
          color={theme.colors.error500}
        />
        <Text style={styles.errorTitle}>
          {t("ranking.errorLoadingLeaderboard")}
        </Text>
        <Text style={styles.errorMessage}>
          {error instanceof Error ? error.message : t("ranking.errorMessage")}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.colors.primary500}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("ranking.leaderboard")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("ranking.competWithStudents")}
        </Text>
      </View>

      {/* My Rank Card */}
      {profile && (
        <View style={styles.myRankCard}>
          <View style={styles.myRankHeader}>
            <MaterialCommunityIcons
              name="account-star"
              size={32}
              color={theme.colors.primary500}
            />
            <View style={styles.myRankInfo}>
              <Text style={styles.myRankTitle}>{t("ranking.yourRank")}</Text>
              <Text style={styles.myRankValue}>#{profile.rank || "N/A"}</Text>
            </View>
          </View>
          <View style={styles.myRankStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("ranking.xpPoints")}</Text>
              <Text style={styles.statValue}>{profile.xp_points || 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("ranking.level")}</Text>
              <Text style={styles.statValue}>{profile.level || 1}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("ranking.badges")}</Text>
              <Text style={styles.statValue}>{profile.badges_count || 0}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Leaderboard Title */}
      <View style={styles.leaderboardHeader}>
        <Text style={styles.leaderboardTitle}>{t("ranking.topStudents")}</Text>
        <Text style={styles.leaderboardCount}>
          {leaderboard?.length || 0} {t("ranking.students")}
        </Text>
      </View>

      {/* Leaderboard List */}
      <View style={styles.leaderboardContainer}>
        {leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((entry: any, index: number) => (
            <LeaderboardEntry
              key={entry.student_id || index}
              entry={entry}
              rank={entry.rank || index + 1}
              isCurrentUser={String(entry.student_id) === String(user?.id)}
              youLabel={t("ranking.you")}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={64}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyText}>{t("ranking.noDataAvailable")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// Leaderboard Entry Component
interface LeaderboardEntryProps {
  entry: any;
  rank: number;
  isCurrentUser: boolean;
  youLabel: string;
}

const LeaderboardEntry: React.FC<LeaderboardEntryProps> = ({
  entry,
  rank,
  isCurrentUser,
  youLabel,
}) => {
  // Medal colors for top 3
  const getMedalColor = () => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#C0C0C0"; // Silver
    if (rank === 3) return "#CD7F32"; // Bronze
    return theme.colors.gray400;
  };

  const getMedalIcon = () => {
    if (rank <= 3) return "medal";
    return "numeric-" + rank + "-circle";
  };

  return (
    <View style={[styles.entryCard, isCurrentUser && styles.currentUserCard]}>
      {/* Rank */}
      <View style={styles.rankContainer}>
        {rank <= 3 ? (
          <MaterialCommunityIcons
            name={getMedalIcon() as any}
            size={32}
            color={getMedalColor()}
          />
        ) : (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {entry.avatar ? (
          <Image source={{ uri: entry.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <MaterialCommunityIcons
              name="account"
              size={28}
              color={theme.colors.gray500}
            />
          </View>
        )}
      </View>

      {/* Student Info */}
      <View style={styles.entryInfo}>
        <Text style={styles.entryName} numberOfLines={1}>
          {entry.student_name || "Student"}
          {isCurrentUser && (
            <Text style={styles.youBadge}> ({youLabel})</Text>
          )}
        </Text>
        <View style={styles.entryMeta}>
          <MaterialCommunityIcons
            name="star"
            size={14}
            color={theme.colors.warning500}
          />
          <Text style={styles.entryXP}>{entry.xp_points || 0} XP</Text>
          {entry.level && (
            <>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.entryLevel}>Lvl {entry.level}</Text>
            </>
          )}
        </View>
      </View>

      {/* Badges Count */}
      {entry.badges_count > 0 && (
        <View style={styles.badgesContainer}>
          <MaterialCommunityIcons
            name="trophy"
            size={16}
            color={theme.colors.warning500}
          />
          <Text style={styles.badgesText}>{entry.badges_count}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray50,
  },
  errorTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.error500,
    textAlign: "center",
  },
  errorMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: "center",
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary500,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    ...theme.typography.h1,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  myRankCard: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.primary500,
    borderRadius: 16,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  myRankHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  myRankInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  myRankTitle: {
    ...theme.typography.body,
    color: theme.colors.white,
    opacity: 0.9,
  },
  myRankValue: {
    ...theme.typography.h1,
    color: theme.colors.white,
    fontSize: 36,
    fontWeight: "700",
  },
  myRankStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: theme.spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.white,
    opacity: 0.8,
    fontSize: 11,
  },
  statValue: {
    ...theme.typography.h3,
    color: theme.colors.white,
    marginTop: 4,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: theme.spacing.sm,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  leaderboardTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
  },
  leaderboardCount: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  leaderboardContainer: {
    padding: theme.spacing.md,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: theme.colors.primary500,
    backgroundColor: theme.colors.primary50,
  },
  rankContainer: {
    width: 40,
    alignItems: "center",
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    ...theme.typography.body,
    fontWeight: "700",
    color: theme.colors.gray700,
  },
  avatarContainer: {
    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    ...theme.typography.h4,
    marginBottom: 4,
  },
  youBadge: {
    color: theme.colors.primary500,
    fontWeight: "700",
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  entryXP: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginLeft: 4,
    fontWeight: "600",
  },
  dotSeparator: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginHorizontal: theme.spacing.xs,
  },
  entryLevel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  badgesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warning50,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgesText: {
    ...theme.typography.caption,
    color: theme.colors.warning700,
    marginLeft: 4,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray500,
    marginTop: theme.spacing.md,
  },
});

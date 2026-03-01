import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';

interface LeaderboardEntry {
  id: number;
  rank: number;
  student: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
  points: number;
  total_coins_earned?: number;
  assignments_completed?: number;
  quizzes_completed?: number;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await apiService.getLeaderboard();
      const entries = data.results || data || [];
      setLeaderboard(entries);

      // Find current user's rank
      const userEntry = entries.find(
        (entry: LeaderboardEntry) => entry.student.id === user?.id
      );
      setMyRank(userEntry || null);
    } catch (error: any) {
      console.error('Failed to load leaderboard:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load leaderboard.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadLeaderboard();
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700'; // Gold
      case 2:
        return '#C0C0C0'; // Silver
      case 3:
        return '#CD7F32'; // Bronze
      default:
        return '#00d4ff';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getStudentName = (student: LeaderboardEntry['student']) => {
    if (student.first_name && student.last_name) {
      return `${student.first_name} ${student.last_name}`;
    }
    if (student.first_name) {
      return student.first_name;
    }
    return student.username;
  };

  const getInitials = (student: LeaderboardEntry['student']) => {
    if (student.first_name && student.last_name) {
      return `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
    }
    if (student.first_name) {
      return student.first_name.substring(0, 2).toUpperCase();
    }
    return student.username.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* My Rank Header */}
      {myRank && (
        <LinearGradient
          colors={['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.05)']}
          style={styles.myRankHeader}
        >
          <View style={styles.myRankContent}>
            <View style={styles.myRankLeft}>
              <LinearGradient
                colors={['#00d4ff', '#0099cc']}
                style={styles.myRankAvatar}
              >
                <Text style={styles.myRankAvatarText}>
                  {getInitials(myRank.student)}
                </Text>
              </LinearGradient>
              <View style={styles.myRankInfo}>
                <Text style={styles.myRankLabel}>Your Rank</Text>
                <Text style={styles.myRankValue}>
                  {getRankIcon(myRank.rank)}
                </Text>
              </View>
            </View>
            <View style={styles.myRankPoints}>
              <Text style={styles.myRankPointsLabel}>Points</Text>
              <Text style={styles.myRankPointsValue}>{myRank.points}</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
      >
        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <View style={styles.podiumContainer}>
            <Text style={styles.sectionTitle}>🏆 Top Performers</Text>
            <View style={styles.podium}>
              {/* Second Place */}
              <View style={styles.podiumItem}>
                <LinearGradient
                  colors={['rgba(192, 192, 192, 0.3)', 'rgba(192, 192, 192, 0.1)']}
                  style={[styles.podiumCard, styles.secondPlace]}
                >
                  <Text style={styles.podiumRank}>🥈</Text>
                  <LinearGradient
                    colors={['#C0C0C0', '#A8A8A8']}
                    style={styles.podiumAvatar}
                  >
                    <Text style={styles.podiumAvatarText}>
                      {getInitials(leaderboard[1].student)}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {getStudentName(leaderboard[1].student)}
                  </Text>
                  <Text style={styles.podiumPoints}>{leaderboard[1].points}</Text>
                </LinearGradient>
              </View>

              {/* First Place */}
              <View style={styles.podiumItem}>
                <LinearGradient
                  colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.1)']}
                  style={[styles.podiumCard, styles.firstPlace]}
                >
                  <Text style={styles.podiumRank}>🥇</Text>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    style={styles.podiumAvatar}
                  >
                    <Text style={styles.podiumAvatarText}>
                      {getInitials(leaderboard[0].student)}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {getStudentName(leaderboard[0].student)}
                  </Text>
                  <Text style={styles.podiumPoints}>{leaderboard[0].points}</Text>
                </LinearGradient>
              </View>

              {/* Third Place */}
              <View style={styles.podiumItem}>
                <LinearGradient
                  colors={['rgba(205, 127, 50, 0.3)', 'rgba(205, 127, 50, 0.1)']}
                  style={[styles.podiumCard, styles.thirdPlace]}
                >
                  <Text style={styles.podiumRank}>🥉</Text>
                  <LinearGradient
                    colors={['#CD7F32', '#B87333']}
                    style={styles.podiumAvatar}
                  >
                    <Text style={styles.podiumAvatarText}>
                      {getInitials(leaderboard[2].student)}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {getStudentName(leaderboard[2].student)}
                  </Text>
                  <Text style={styles.podiumPoints}>{leaderboard[2].points}</Text>
                </LinearGradient>
              </View>
            </View>
          </View>
        )}

        {/* Full Rankings */}
        <View style={styles.rankingsContainer}>
          <Text style={styles.sectionTitle}>All Rankings</Text>

          {leaderboard.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>No rankings available</Text>
            </View>
          ) : (
            leaderboard.map((entry, index) => {
              const isCurrentUser = entry.student.id === user?.id;
              return (
                <View key={entry.id} style={styles.rankCard}>
                  <LinearGradient
                    colors={
                      isCurrentUser
                        ? ['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.1)']
                        : ['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']
                    }
                    style={[
                      styles.rankGradient,
                      isCurrentUser && styles.currentUserCard,
                    ]}
                  >
                    <View style={styles.rankLeft}>
                      <View
                        style={[
                          styles.rankBadge,
                          { backgroundColor: getRankColor(entry.rank) },
                        ]}
                      >
                        <Text style={styles.rankNumber}>
                          {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                        </Text>
                      </View>
                      <LinearGradient
                        colors={
                          index < 3
                            ? [getRankColor(entry.rank), '#0099cc']
                            : ['#00d4ff', '#0099cc']
                        }
                        style={styles.rankAvatar}
                      >
                        <Text style={styles.rankAvatarText}>
                          {getInitials(entry.student)}
                        </Text>
                      </LinearGradient>
                      <View style={styles.rankInfo}>
                        <Text style={styles.rankName}>
                          {getStudentName(entry.student)}
                          {isCurrentUser && ' (You)'}
                        </Text>
                        {(entry.assignments_completed || entry.quizzes_completed) && (
                          <View style={styles.rankStats}>
                            {entry.assignments_completed !== undefined && (
                              <Text style={styles.rankStat}>
                                📝 {entry.assignments_completed}
                              </Text>
                            )}
                            {entry.quizzes_completed !== undefined && (
                              <Text style={styles.rankStat}>
                                ✏️ {entry.quizzes_completed}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.rankRight}>
                      <Text style={styles.rankPoints}>{entry.points}</Text>
                      <Text style={styles.rankPointsLabel}>points</Text>
                    </View>
                  </LinearGradient>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  myRankHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
  },
  myRankContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRankAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myRankAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  myRankInfo: {},
  myRankLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  myRankValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  myRankPoints: {
    alignItems: 'flex-end',
  },
  myRankPointsLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  myRankPointsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  podiumContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  podiumItem: {
    flex: 1,
    maxWidth: 110,
  },
  podiumCard: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  firstPlace: {
    borderColor: 'rgba(255, 215, 0, 0.5)',
    minHeight: 180,
  },
  secondPlace: {
    borderColor: 'rgba(192, 192, 192, 0.5)',
    minHeight: 160,
  },
  thirdPlace: {
    borderColor: 'rgba(205, 127, 50, 0.5)',
    minHeight: 140,
  },
  podiumRank: {
    fontSize: 32,
    marginBottom: 8,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  podiumAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  rankingsContainer: {
    flex: 1,
  },
  rankCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rankGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  currentUserCard: {
    borderColor: '#00d4ff',
    borderWidth: 2,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  rankAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  rankStats: {
    flexDirection: 'row',
    gap: 12,
  },
  rankStat: {
    fontSize: 11,
    color: '#94a3b8',
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 2,
  },
  rankPointsLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

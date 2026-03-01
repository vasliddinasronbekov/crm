import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

interface Statistics {
  total_courses: number;
  attendance_percentage: number;
  average_score: number;
  total_coins: number;
  upcoming_assignments: number;
  pending_quizzes: number;
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [stats, events] = await Promise.all([
        apiService.getStatistics(),
        apiService.getEvents(),
      ]);

      setStatistics(stats);
      setRecentEvents(events.results?.slice(0, 3) || []);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load dashboard data.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
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
      {/* Header with Gradient */}
      <LinearGradient
        colors={['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user?.first_name || user?.username}!
            </Text>
          </View>
          <View style={styles.coinsContainer}>
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.1)']}
              style={styles.coinsGradient}
            >
              <Text style={styles.coinsLabel}>Coins</Text>
              <Text style={styles.coinsValue}>{statistics?.total_coins || 0}</Text>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
            style={styles.statCardGradient}
          >
            <Text style={styles.statValue}>{statistics?.total_courses || 0}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </LinearGradient>
        </View>

        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
            style={styles.statCardGradient}
          >
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {statistics?.attendance_percentage?.toFixed(0) || 0}%
            </Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </LinearGradient>
        </View>

        <View style={styles.statCard}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.1)', 'rgba(139, 92, 246, 0.05)']}
            style={styles.statCardGradient}
          >
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>
              {statistics?.average_score?.toFixed(1) || 0}
            </Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Courses')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>📚</Text>
              <Text style={styles.actionLabel}>My Courses</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Assignments')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              {statistics?.upcoming_assignments > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {statistics.upcoming_assignments}
                  </Text>
                </View>
              )}
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={styles.actionLabel}>Assignments</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Quizzes')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              {statistics?.pending_quizzes > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{statistics.pending_quizzes}</Text>
                </View>
              )}
              <Text style={styles.actionIcon}>✏️</Text>
              <Text style={styles.actionLabel}>Quizzes</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>🏆</Text>
              <Text style={styles.actionLabel}>Leaderboard</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Shop')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>🛍️</Text>
              <Text style={styles.actionLabel}>Shop</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Support')}
          >
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionLabel}>Support</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Events</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Events')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentEvents.map((event) => (
            <TouchableOpacity key={event.id} style={styles.eventCard}>
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.eventGradient}
              >
                <View style={styles.eventDate}>
                  <LinearGradient
                    colors={['#00d4ff', '#0099cc']}
                    style={styles.eventDateGradient}
                  >
                    <Text style={styles.eventDay}>
                      {new Date(event.time).getDate()}
                    </Text>
                    <Text style={styles.eventMonth}>
                      {new Date(event.time).toLocaleDateString('en-US', {
                        month: 'short',
                      })}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>
                    {new Date(event.time).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
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
  header: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  coinsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  coinsGradient: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
  },
  coinsLabel: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  coinsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  section: {
    padding: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: '#00d4ff',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '31%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  eventCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  eventGradient: {
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  eventDate: {
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventDateGradient: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  eventDay: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventMonth: {
    fontSize: 11,
    color: '#fff',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  eventContent: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: '#94a3b8',
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { colors } from '../theme';

interface DashboardStats {
  my_groups: number;
  total_students: number;
  pending_tasks: number;
  completed_tasks: number;
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    my_groups: 0,
    total_students: 0,
    pending_tasks: 0,
    completed_tasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [groups, tasks] = await Promise.all([
        apiService.getMyGroups(),
        apiService.getTasks({ limit: 5 }),
      ]);

      // Calculate statistics
      const groupsArray = groups.results || groups;
      const tasksArray = tasks.results || tasks;

      const totalStudents = groupsArray.reduce(
        (sum: number, group: any) => sum + (group.students?.length || 0),
        0
      );

      const pendingTasks = tasksArray.filter((task: any) => !task.is_done).length;
      const completedTasks = tasksArray.filter((task: any) => task.is_done).length;

      setStats({
        my_groups: groupsArray.length,
        total_students: totalStudents,
        pending_tasks: pendingTasks,
        completed_tasks: completedTasks,
      });

      setRecentTasks(tasksArray.slice(0, 3));
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header - Matching Web App */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}, {user?.first_name || user?.username}! 👋
        </Text>
        <Text style={styles.subtitle}>Here's what's happening today</Text>
      </View>

      {/* Statistics Cards - Matching Web App */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total_students}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.my_groups}</Text>
          <Text style={styles.statLabel}>My Groups</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending_tasks}</Text>
          <Text style={styles.statLabel}>Pending Tasks</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.completed_tasks}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Quick Actions - Matching Web App */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Students')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>👨‍🎓</Text>
            </View>
            <Text style={styles.actionLabel}>Add Student</Text>
            <Text style={styles.actionDescription}>Register new student</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Groups')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>👥</Text>
            </View>
            <Text style={styles.actionLabel}>Create Group</Text>
            <Text style={styles.actionDescription}>Start a new class</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Attendance')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>✅</Text>
            </View>
            <Text style={styles.actionLabel}>Mark Attendance</Text>
            <Text style={styles.actionDescription}>Today's attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Grades')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📊</Text>
            </View>
            <Text style={styles.actionLabel}>Grade Assignment</Text>
            <Text style={styles.actionDescription}>Evaluate student work</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Tasks')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={styles.actionLabel}>My Tasks</Text>
            <Text style={styles.actionDescription}>
              {stats.pending_tasks} pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Schedule')}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📅</Text>
            </View>
            <Text style={styles.actionLabel}>Schedule</Text>
            <Text style={styles.actionDescription}>View timetable</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Tasks - Matching Web App */}
      {recentTasks.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Tasks</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
              <Text style={styles.seeAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          {recentTasks.map((task) => (
            <TouchableOpacity key={task.id} style={styles.taskCard}>
              <View style={styles.taskCheckbox}>
                {task.is_done ? (
                  <View style={styles.taskCheckIconDone}>
                    <Text style={styles.taskCheckIcon}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.taskCheckEmpty} />
                )}
              </View>
              <View style={styles.taskContent}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.is_done && styles.taskTitleDone,
                  ]}
                >
                  {task.title}
                </Text>
                {task.due_date && (
                  <Text style={styles.taskDueDate}>
                    Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                )}
              </View>
              {!task.is_done && (
                <View style={styles.taskPending}>
                  <Text style={styles.taskPendingText}>Pending</Text>
                </View>
              )}
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckIconDone: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckIcon: {
    fontSize: 14,
    color: colors.textOnPrimary,
    fontWeight: 'bold',
  },
  taskCheckEmpty: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  taskDueDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  taskPending: {
    backgroundColor: colors.badge.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskPendingText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
  },
});

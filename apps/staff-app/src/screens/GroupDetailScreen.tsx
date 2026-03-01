import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import apiService from '../services/api';
import { colors } from '../theme';

interface Student {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
}

interface Group {
  id: number;
  name: string;
  course: {
    id: number;
    name: string;
  };
  students: Student[];
  start_day: string;
  end_day: string;
  start_time: string;
  end_time: string;
  days: string;
  room?: {
    name: string;
  };
}

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'schedule' | 'info'>('students');

  useEffect(() => {
    loadGroupDetail();
  }, []);

  const loadGroupDetail = async () => {
    try {
      const data = await apiService.getGroupDetail(groupId);
      setGroup(data);
    } catch (error) {
      console.error('Failed to load group:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAttendance = () => {
    navigation.navigate('Attendance', { groupId });
  };

  const handleAddGrade = (studentId: number) => {
    navigation.navigate('Grades', { groupId, studentId });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <Text style={styles.headerSubtitle}>{group.course.name}</Text>
        </View>
        <View style={styles.studentsBadge}>
          <Text style={styles.studentsBadgeText}>
            {group.students?.length || 0} students
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleMarkAttendance}
        >
          <Text style={styles.actionIcon}>✅</Text>
          <Text style={styles.actionText}>Attendance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Grades')}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Grades</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {}}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>Tasks</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.tabActive]}
          onPress={() => setActiveTab('students')}
        >
          <Text
            style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}
          >
            Students
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text
            style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}
          >
            Schedule
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.tabActive]}
          onPress={() => setActiveTab('info')}
        >
          <Text
            style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}
          >
            Info
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'students' && (
          <View style={styles.studentsList}>
            {group.students?.map((student: Student, index: number) => (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentLeft}>
                  <View style={styles.studentNumber}>
                    <Text style={styles.studentNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.studentAvatarText}>
                      {(student.first_name?.[0] || student.username[0]).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.first_name && student.last_name
                        ? `${student.first_name} ${student.last_name}`
                        : student.username}
                    </Text>
                    {student.phone && (
                      <Text style={styles.studentContact}>{student.phone}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.gradeButton}
                  onPress={() => handleAddGrade(student.id)}
                >
                  <Text style={styles.gradeButtonText}>Grade</Text>
                </TouchableOpacity>
              </View>
            ))}

            {!group.students?.length && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No students</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'schedule' && (
          <View style={styles.scheduleContent}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📅</Text>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>Days</Text>
                  <Text style={styles.infoValue}>{group.days}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>⏰</Text>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>
                    {group.start_time.slice(0, 5)} - {group.end_time.slice(0, 5)}
                  </Text>
                </View>
              </View>
            </View>

            {group.room && (
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>🚪</Text>
                  <View style={styles.infoDetails}>
                    <Text style={styles.infoLabel}>Room</Text>
                    <Text style={styles.infoValue}>{group.room.name}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📆</Text>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>Start Date</Text>
                  <Text style={styles.infoValue}>
                    {new Date(group.start_day).toLocaleDateString('en-US')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🏁</Text>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>End Date</Text>
                  <Text style={styles.infoValue}>
                    {new Date(group.end_day).toLocaleDateString('en-US')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'info' && (
          <View style={styles.infoContent}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{group.students?.length || 0}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {Math.ceil(
                    (new Date(group.end_day).getTime() -
                      new Date(group.start_day).getTime()) /
                      (1000 * 60 * 60 * 24 * 7)
                  )}
                </Text>
                <Text style={styles.statLabel}>Weeks</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {group.days.split(',').length}
                </Text>
                <Text style={styles.statLabel}>Days/week</Text>
              </View>
            </View>

            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>About Course</Text>
              <Text style={styles.descriptionText}>
                {group.name} group for {group.course.name} course.
                Classes are held on {group.days} from {group.start_time.slice(0, 5)} to {group.end_time.slice(0, 5)}.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  studentsBadge: {
    backgroundColor: colors.primaryAlpha20,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  studentsBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  studentsList: {
    padding: 16,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  studentNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryAlpha20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  studentAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentContact: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gradeButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  infoDetails: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoContent: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

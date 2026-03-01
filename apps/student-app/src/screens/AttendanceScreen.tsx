import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

interface AttendanceRecord {
  id: number;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  course?: {
    id: number;
    title: string;
  };
  notes?: string;
}

interface AttendanceStats {
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  attendance_percentage: number;
}

export default function AttendanceScreen() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      const data = await apiService.getMyAttendance();
      const records = data.results || data || [];
      setAttendanceRecords(records);

      // Calculate stats
      const total = records.length;
      const present = records.filter((r: AttendanceRecord) => r.status === 'present').length;
      const absent = records.filter((r: AttendanceRecord) => r.status === 'absent').length;
      const late = records.filter((r: AttendanceRecord) => r.status === 'late').length;

      setStats({
        total_days: total,
        present_days: present,
        absent_days: absent,
        late_days: late,
        attendance_percentage: total > 0 ? (present / total) * 100 : 0,
      });
    } catch (error: any) {
      console.error('Failed to load attendance:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load attendance records.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadAttendance();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#10B981';
      case 'absent':
        return '#EF4444';
      case 'late':
        return '#F59E0B';
      case 'excused':
        return '#6366F1';
      default:
        return '#94a3b8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return '✓';
      case 'absent':
        return '✗';
      case 'late':
        return '⏰';
      case 'excused':
        return '📋';
      default:
        return '?';
    }
  };

  const filteredRecords = attendanceRecords.filter((record) => {
    if (filter === 'all') return true;
    return record.status === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading attendance...</Text>
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
      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.05)']}
          style={styles.statCard}
        >
          <Text style={styles.statValue}>
            {stats?.attendance_percentage?.toFixed(1) || 0}%
          </Text>
          <Text style={styles.statLabel}>Attendance Rate</Text>
        </LinearGradient>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
            style={styles.statItemGradient}
          >
            <Text style={[styles.statItemValue, { color: '#10B981' }]}>
              {stats?.present_days || 0}
            </Text>
            <Text style={styles.statItemLabel}>Present</Text>
          </LinearGradient>
        </View>

        <View style={styles.statItem}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.05)']}
            style={styles.statItemGradient}
          >
            <Text style={[styles.statItemValue, { color: '#EF4444' }]}>
              {stats?.absent_days || 0}
            </Text>
            <Text style={styles.statItemLabel}>Absent</Text>
          </LinearGradient>
        </View>

        <View style={styles.statItem}>
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']}
            style={styles.statItemGradient}
          >
            <Text style={[styles.statItemValue, { color: '#F59E0B' }]}>
              {stats?.late_days || 0}
            </Text>
            <Text style={styles.statItemLabel}>Late</Text>
          </LinearGradient>
        </View>

        <View style={styles.statItem}>
          <LinearGradient
            colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
            style={styles.statItemGradient}
          >
            <Text style={[styles.statItemValue, { color: '#00d4ff' }]}>
              {stats?.total_days || 0}
            </Text>
            <Text style={styles.statItemLabel}>Total</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => setFilter('all')}
          >
            <LinearGradient
              colors={
                filter === 'all'
                  ? ['#00d4ff', '#0099cc']
                  : ['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']
              }
              style={styles.filterGradient}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'all' && styles.filterTextActive,
                ]}
              >
                All ({attendanceRecords.length})
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => setFilter('present')}
          >
            <LinearGradient
              colors={
                filter === 'present'
                  ? ['#10B981', '#059669']
                  : ['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']
              }
              style={styles.filterGradient}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'present' && styles.filterTextActive,
                ]}
              >
                Present ({stats?.present_days || 0})
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => setFilter('absent')}
          >
            <LinearGradient
              colors={
                filter === 'absent'
                  ? ['#EF4444', '#DC2626']
                  : ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.05)']
              }
              style={styles.filterGradient}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'absent' && styles.filterTextActive,
                ]}
              >
                Absent ({stats?.absent_days || 0})
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => setFilter('late')}
          >
            <LinearGradient
              colors={
                filter === 'late'
                  ? ['#F59E0B', '#D97706']
                  : ['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']
              }
              style={styles.filterGradient}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'late' && styles.filterTextActive,
                ]}
              >
                Late ({stats?.late_days || 0})
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Attendance Records */}
      <View style={styles.recordsContainer}>
        <Text style={styles.sectionTitle}>Attendance History</Text>

        {filteredRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        ) : (
          filteredRecords.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.recordGradient}
              >
                <View style={styles.recordLeft}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(record.status) },
                    ]}
                  >
                    <Text style={styles.statusIcon}>
                      {getStatusIcon(record.status)}
                    </Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordDate}>
                      {formatDate(record.date)}
                    </Text>
                    <Text style={styles.recordDay}>
                      {getDayOfWeek(record.date)}
                    </Text>
                    {record.course && (
                      <Text style={styles.recordCourse}>
                        {record.course.title}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.recordRight}>
                  <View
                    style={[
                      styles.statusLabel,
                      { borderColor: getStatusColor(record.status) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(record.status) },
                      ]}
                    >
                      {record.status.charAt(0).toUpperCase() +
                        record.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
              {record.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText}>{record.notes}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  statsContainer: {
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  statValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statItem: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statItemGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  statItemValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statItemLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterTab: {
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  recordsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  recordCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recordGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 24,
    color: '#fff',
  },
  recordInfo: {
    flex: 1,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  recordDay: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  recordCourse: {
    fontSize: 12,
    color: '#00d4ff',
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    marginTop: -12,
    paddingTop: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  notesLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#cbd5e1',
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

/**
 * Student Details Screen
 *
 * Shows detailed information about a specific student including progress, attendance, and grades
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { studentAPI } from '../services/api';
import type { Student, Progress, Attendance, Grade, StudentStatistics } from '../types';

interface StudentDetailsScreenProps {
  route: {
    params: {
      studentId: number;
    };
  };
  navigation: any;
}

export default function StudentDetailsScreen({ route, navigation }: StudentDetailsScreenProps) {
  const { studentId } = route.params;
  const [student, setStudent] = useState<Student | null>(null);
  const [statistics, setStatistics] = useState<StudentStatistics | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const [studentData, statsData, progressData] = await Promise.all([
        studentAPI.getStudentDetails(studentId),
        studentAPI.getStudentStatistics(studentId),
        studentAPI.getStudentProgress(studentId),
      ]);

      setStudent(studentData);
      setStatistics(statsData);
      setProgress(progressData.results || progressData);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudentData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Student not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Student Info Card */}
        <View style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentInitial}>
              {student.first_name.charAt(0)}
              {student.last_name.charAt(0)}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>
              {student.first_name} {student.last_name}
            </Text>
            {student.grade_level && (
              <Text style={styles.studentGrade}>Grade {student.grade_level}</Text>
            )}
          </View>
        </View>

        {/* Statistics Cards */}
        {statistics && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.average_grade.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Average Grade</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.attendance_rate.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Attendance</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.completed_courses}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.total_study_hours}h</Text>
              <Text style={styles.statLabel}>Study Time</Text>
            </View>
          </View>
        )}

        {/* Course Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course Progress</Text>
          {progress.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No courses enrolled</Text>
            </View>
          ) : (
            progress.map((item) => (
              <View key={item.id} style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.courseName}>{item.course_name}</Text>
                  <Text style={styles.percentage}>{item.completion_percentage}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${item.completion_percentage}%` },
                    ]}
                  />
                </View>
                {item.current_module && (
                  <Text style={styles.currentModule}>Current: {item.current_module}</Text>
                )}
                <Text style={styles.studyTime}>
                  Study time: {item.time_spent_hours.toFixed(1)} hours
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Attendance', { studentId })}
          >
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionText}>View Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Grades', { studentId })}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>View Grades</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Messages')}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>Message Teachers</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  studentAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  studentInitial: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  studentGrade: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: '1%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  percentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  currentModule: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  studyTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
});

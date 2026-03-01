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
}

interface Group {
  id: number;
  name: string;
  students: Student[];
}

export default function AttendanceScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [attendance, setAttendance] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await apiService.getMyGroups();
      const groupsArray = data.results || data;
      setGroups(groupsArray);

      if (groupsArray.length > 0) {
        selectGroup(groupsArray[0]);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectGroup = (group: Group) => {
    setSelectedGroup(group);

    // Initialize attendance (all present by default)
    const initialAttendance: Record<number, boolean> = {};
    group.students?.forEach((student: Student) => {
      initialAttendance[student.id] = true;
    });
    setAttendance(initialAttendance);
  };

  const toggleAttendance = (studentId: number) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const saveAttendance = async () => {
    if (!selectedGroup) return;

    setIsSaving(true);
    try {
      const attendanceList = Object.entries(attendance).map(
        ([studentId, isPresent]) => ({
          student: parseInt(studentId),
          group: selectedGroup.id,
          date: selectedDate,
          is_present: isPresent,
        })
      );

      await apiService.bulkMarkAttendance(attendanceList);

      Alert.alert('Success', 'Attendance saved successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading attendance...</Text>
      </View>
    );
  }

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = Object.values(attendance).length - presentCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>
          {selectedGroup?.name || 'Select a group'}
        </Text>
      </View>

      {/* Group Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.groupSelector}
        contentContainerStyle={styles.groupSelectorContent}
      >
        {groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={[
              styles.groupTab,
              selectedGroup?.id === group.id && styles.groupTabActive,
            ]}
            onPress={() => selectGroup(group)}
          >
            <Text
              style={[
                styles.groupTabText,
                selectedGroup?.id === group.id && styles.groupTabTextActive,
              ]}
            >
              {group.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date & Stats */}
      <View style={styles.dateContainer}>
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>Date:</Text>
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{presentCount}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statValueAbsent]}>{absentCount}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>
      </View>

      {/* Student List */}
      <ScrollView style={styles.studentList}>
        {selectedGroup?.students?.map((student: Student) => (
          <TouchableOpacity
            key={student.id}
            style={styles.studentCard}
            onPress={() => toggleAttendance(student.id)}
          >
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {student.first_name && student.last_name
                  ? `${student.first_name} ${student.last_name}`
                  : student.username}
              </Text>
            </View>

            <View
              style={[
                styles.attendanceButton,
                attendance[student.id]
                  ? styles.attendanceButtonPresent
                  : styles.attendanceButtonAbsent,
              ]}
            >
              <Text
                style={[
                  styles.attendanceButtonText,
                  attendance[student.id]
                    ? styles.attendanceButtonTextPresent
                    : styles.attendanceButtonTextAbsent,
                ]}
              >
                {attendance[student.id] ? '✓ Present' : '✗ Absent'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveAttendance}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Attendance</Text>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  groupSelector: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupSelectorContent: {
    padding: 16,
    gap: 8,
  },
  groupTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  groupTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  groupTabTextActive: {
    color: colors.textOnPrimary,
  },
  dateContainer: {
    backgroundColor: colors.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSection: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  statValueAbsent: {
    color: colors.error,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  studentList: {
    flex: 1,
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
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  attendanceButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  attendanceButtonPresent: {
    backgroundColor: colors.badge.success,
  },
  attendanceButtonAbsent: {
    backgroundColor: colors.badge.error,
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attendanceButtonTextPresent: {
    color: colors.success,
  },
  attendanceButtonTextAbsent: {
    color: colors.error,
  },
  footer: {
    backgroundColor: colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
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

interface ExamScore {
  id?: number;
  student: number;
  exam_name: string;
  score: number;
  max_score: number;
  date: string;
}

export default function GradesScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form state
  const [examName, setExamName] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await apiService.getMyGroups();
      const groupsArray = data.results || data;
      setGroups(groupsArray);

      if (groupsArray.length > 0) {
        setSelectedGroup(groupsArray[0]);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openGradeModal = (student: Student) => {
    setSelectedStudent(student);
    setExamName('');
    setScore('');
    setMaxScore('100');
    setModalVisible(true);
  };

  const handleSubmitGrade = async () => {
    if (!selectedStudent || !examName || !score) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsSaving(true);
    try {
      await apiService.createExamScore({
        student: selectedStudent.id,
        exam_name: examName,
        score: parseFloat(score),
        max_score: parseFloat(maxScore),
        date: new Date().toISOString().split('T')[0],
      });

      Alert.alert('Success', 'Grade saved successfully');
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save grade');
    } finally {
      setIsSaving(false);
    }
  };

  const getGradeColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 85) return colors.success;
    if (percentage >= 70) return colors.warning;
    return colors.error;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading grades...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            onPress={() => setSelectedGroup(group)}
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

      {/* Students List */}
      <ScrollView style={styles.studentList}>
        {selectedGroup?.students?.map((student: Student) => (
          <View key={student.id} style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>
                  {(student.first_name?.[0] || student.username[0]).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentDetails}>
                <Text style={styles.studentName}>
                  {student.first_name && student.last_name
                    ? `${student.first_name} ${student.last_name}`
                    : student.username}
                </Text>
                <Text style={styles.studentUsername}>@{student.username}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.gradeButton}
              onPress={() => openGradeModal(student)}
            >
              <Text style={styles.gradeButtonText}>+ Grade</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!selectedGroup?.students?.length && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No students in this group</Text>
          </View>
        )}
      </ScrollView>

      {/* Grade Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Grade</Text>

            {selectedStudent && (
              <View style={styles.selectedStudentInfo}>
                <Text style={styles.selectedStudentName}>
                  {selectedStudent.first_name && selectedStudent.last_name
                    ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                    : selectedStudent.username}
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Exam Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Midterm Exam"
                value={examName}
                onChangeText={setExamName}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Score</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={score}
                  onChangeText={setScore}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Max Score</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  keyboardType="numeric"
                  value={maxScore}
                  onChangeText={setMaxScore}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSubmitGrade}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  groupSelector: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surfaceLight,
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentUsername: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  gradeButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedStudentInfo: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectedStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

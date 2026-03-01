import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import apiService from '../services/api';

interface Assignment {
  id: number;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  course: {
    id: number;
    name: string;
  };
  my_submission?: any;
}

export default function AssignmentsScreen({ navigation }: any) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const data = await apiService.getAssignments();
      setAssignments(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load assignments:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load assignments.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadAssignments();
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (result.type === 'success') {
        setSelectedFiles([...selectedFiles, result]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleSubmit = async () => {
    if (!submissionContent.trim() && selectedFiles.length === 0) {
      Alert.alert('Error', 'Please add content or attach files');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('assignment', selectedAssignment!.id.toString());
      formData.append('content', submissionContent);

      selectedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name,
        } as any);
      });

      await apiService.submitAssignment(selectedAssignment!.id, formData);

      Alert.alert('Success', 'Assignment submitted successfully!');
      setModalVisible(false);
      setSubmissionContent('');
      setSelectedFiles([]);
      loadAssignments();
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to submit assignment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (submissionId: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this submission?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAssignmentSubmission(submissionId);
              Alert.alert('Success', 'Submission deleted');
              loadAssignments();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete submission');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (assignment: Assignment) => {
    if (assignment.my_submission) return '#10B981';
    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    if (now > dueDate) return '#EF4444';
    return '#F59E0B';
  };

  const getStatusText = (assignment: Assignment) => {
    if (assignment.my_submission) return 'Submitted';
    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    if (now > dueDate) return 'Overdue';
    return 'Pending';
  };

  const getDaysRemaining = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return `${Math.abs(diff)} days late`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `${diff} days left`;
  };

  const filteredAssignments = assignments.filter((assignment) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !assignment.my_submission;
    if (filter === 'submitted') return assignment.my_submission;
    return true;
  });

  const renderAssignmentCard = ({ item }: { item: Assignment }) => {
    const statusColor = getStatusColor(item);
    const statusText = getStatusText(item);

    return (
      <TouchableOpacity
        style={styles.assignmentCard}
        onPress={() => {
          setSelectedAssignment(item);
          setModalVisible(true);
          if (item.my_submission) {
            setSubmissionContent(item.my_submission.content || '');
          }
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
          style={styles.assignmentGradient}
        >
          <View style={styles.assignmentHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <Text style={styles.pointsBadge}>{item.max_points} points</Text>
          </View>

          <Text style={styles.assignmentTitle}>{item.title}</Text>
          <Text style={styles.courseText}>{item.course.name}</Text>

          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.footer}>
            <View style={styles.dueDateContainer}>
              <Text style={styles.dueDateLabel}>Due:</Text>
              <Text style={[styles.dueDate, { color: statusColor }]}>
                {getDaysRemaining(item.due_date)}
              </Text>
            </View>

            {item.my_submission && (
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>Score:</Text>
                <Text style={styles.scoreValue}>
                  {item.my_submission.score || '-'}/{item.max_points}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading assignments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <LinearGradient
            colors={
              filter === 'all'
                ? ['#00d4ff', '#0099cc']
                : ['transparent', 'transparent']
            }
            style={styles.filterGradient}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.filterTextActive,
              ]}
            >
              All
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <LinearGradient
            colors={
              filter === 'pending'
                ? ['#00d4ff', '#0099cc']
                : ['transparent', 'transparent']
            }
            style={styles.filterGradient}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'pending' && styles.filterTextActive,
              ]}
            >
              Pending
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'submitted' && styles.filterTabActive]}
          onPress={() => setFilter('submitted')}
        >
          <LinearGradient
            colors={
              filter === 'submitted'
                ? ['#00d4ff', '#0099cc']
                : ['transparent', 'transparent']
            }
            style={styles.filterGradient}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'submitted' && styles.filterTextActive,
              ]}
            >
              Submitted
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAssignments}
        renderItem={renderAssignmentCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No assignments found</Text>
            <Text style={styles.emptySubtext}>Check back later for new assignments</Text>
          </View>
        }
      />

      {/* Submission Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assignment Details</Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setSubmissionContent('');
                setSelectedFiles([]);
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedAssignment && (
              <>
                <View style={styles.detailsCard}>
                  <Text style={styles.detailsTitle}>{selectedAssignment.title}</Text>
                  <Text style={styles.detailsCourse}>{selectedAssignment.course.name}</Text>

                  {selectedAssignment.description && (
                    <Text style={styles.detailsDescription}>
                      {selectedAssignment.description}
                    </Text>
                  )}

                  <View style={styles.detailsMetaGrid}>
                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Max Points</Text>
                      <Text style={styles.detailsMetaValue}>
                        {selectedAssignment.max_points}
                      </Text>
                    </View>

                    <View style={styles.detailsMetaItem}>
                      <Text style={styles.detailsMetaLabel}>Due Date</Text>
                      <Text style={styles.detailsMetaValue}>
                        {getDaysRemaining(selectedAssignment.due_date)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Submission Form */}
                {!selectedAssignment.my_submission ? (
                  <View style={styles.submissionSection}>
                    <Text style={styles.sectionTitle}>Submit Assignment</Text>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Content</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={submissionContent}
                        onChangeText={setSubmissionContent}
                        placeholder="Enter your submission content..."
                        placeholderTextColor="#64748b"
                        multiline
                        numberOfLines={6}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Attachments</Text>
                      <TouchableOpacity
                        style={styles.filePickerButton}
                        onPress={handlePickDocument}
                      >
                        <Text style={styles.filePickerText}>📎 Attach File</Text>
                      </TouchableOpacity>

                      {selectedFiles.length > 0 && (
                        <View style={styles.filesContainer}>
                          {selectedFiles.map((file, index) => (
                            <View key={index} style={styles.fileItem}>
                              <Text style={styles.fileName}>{file.name}</Text>
                              <TouchableOpacity
                                onPress={() =>
                                  setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
                                }
                              >
                                <Text style={styles.fileRemove}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                    >
                      <LinearGradient
                        colors={['#00d4ff', '#0099cc']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.submitButtonText}>Submit Assignment</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.submissionSection}>
                    <Text style={styles.sectionTitle}>Your Submission</Text>

                    <View style={styles.submittedCard}>
                      <View style={styles.submittedHeader}>
                        <Text style={styles.submittedLabel}>Submitted</Text>
                        {selectedAssignment.my_submission.score !== null && (
                          <View style={styles.scoreChip}>
                            <Text style={styles.scoreChipText}>
                              {selectedAssignment.my_submission.score}/{selectedAssignment.max_points}
                            </Text>
                          </View>
                        )}
                      </View>

                      {selectedAssignment.my_submission.content && (
                        <Text style={styles.submittedContent}>
                          {selectedAssignment.my_submission.content}
                        </Text>
                      )}

                      {selectedAssignment.my_submission.submitted_at && (
                        <Text style={styles.submittedDate}>
                          Submitted: {new Date(selectedAssignment.my_submission.submitted_at).toLocaleDateString()}
                        </Text>
                      )}

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(selectedAssignment.my_submission.id)}
                      >
                        <Text style={styles.deleteButtonText}>Delete Submission</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  filterTab: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterTabActive: {},
  filterGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  assignmentCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  assignmentGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  pointsBadge: {
    fontSize: 12,
    color: '#00d4ff',
    fontWeight: '600',
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  courseText: {
    fontSize: 14,
    color: '#00d4ff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.1)',
  },
  dueDateContainer: {},
  dueDateLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  dueDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  detailsCourse: {
    fontSize: 14,
    color: '#00d4ff',
    marginBottom: 12,
  },
  detailsDescription: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 16,
  },
  detailsMetaGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  detailsMetaItem: {},
  detailsMetaLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  detailsMetaValue: {
    fontSize: 16,
    color: '#00d4ff',
    fontWeight: '600',
  },
  submissionSection: {
    marginBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  filePickerButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  filePickerText: {
    color: '#00d4ff',
    fontSize: 15,
    fontWeight: '600',
  },
  filesContainer: {
    marginTop: 12,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  fileRemove: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submittedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  submittedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  submittedLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  scoreChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  scoreChipText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  submittedContent: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 12,
  },
  submittedDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});

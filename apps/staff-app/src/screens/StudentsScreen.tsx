import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../services/api';
import FloatingActionButton from '../components/FloatingActionButton';
import { colors } from '../theme';

interface Student {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar?: string;
  group?: {
    id: number;
    name: string;
  };
}

export default function StudentsScreen({ navigation }: any) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/students/');
      setStudents(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const handleCreate = () => {
    setFormData({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
    });
    setIsCreateModalVisible(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      username: student.username,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      password: '',
    });
    setIsEditModalVisible(true);
  };

  const handleDelete = (student: Student) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${student.first_name} ${student.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteStudent(student.id);
              setStudents(students.filter(s => s.id !== student.id));
              Alert.alert('Success', 'Student deleted successfully');
            } catch (error) {
              console.error('Delete student error:', error);
              Alert.alert('Error', 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  const handleSaveCreate = async () => {
    if (!formData.username || !formData.password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }

    try {
      const newStudent = await api.createStudent(formData);
      setStudents([newStudent, ...students]);
      setIsCreateModalVisible(false);
      Alert.alert('Success', 'Student created successfully');
    } catch (error: any) {
      console.error('Create student error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create student');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;

    try {
      const updatedData = { ...formData };
      if (!updatedData.password) {
        delete updatedData.password; // Don't send empty password
      }

      const updated = await api.updateStudent(editingStudent.id, updatedData);
      setStudents(students.map(s => s.id === editingStudent.id ? updated : s));
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Student updated successfully');
    } catch (error: any) {
      console.error('Update student error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update student');
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStudentCard = ({ item }: { item: Student }) => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          {/* Avatar */}
          <View style={styles.avatar}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Student Info */}
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{fullName}</Text>
            {item.email && (
              <View style={styles.infoRow}>
                <Icon name="mail-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.infoText}>{item.email}</Text>
              </View>
            )}
            {item.phone && (
              <View style={styles.infoRow}>
                <Icon name="call-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.infoText}>{item.phone}</Text>
              </View>
            )}
            {item.group && (
              <View style={styles.groupBadge}>
                <Icon name="people-outline" size={12} color={colors.primary} />
                <Text style={styles.groupText}>{item.group.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEdit(item)}
          >
            <Icon name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Icon name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading students...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <Text style={styles.subtitle}>{filteredStudents.length} students total</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Students List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="people-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>No students found</Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearButtonText}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleCreate} />

      {/* Create Student Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>New Student</Text>

              <TextInput
                style={styles.input}
                placeholder="Username *"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Password *"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={formData.first_name}
                onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={formData.last_name}
                onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsCreateModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveCreate}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Student</Text>

              <TextInput
                style={styles.input}
                placeholder="Username"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="New password (leave empty to keep current)"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={formData.first_name}
                onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={formData.last_name}
                onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textOnPrimary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.badge.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  groupText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  clearButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clearButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
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

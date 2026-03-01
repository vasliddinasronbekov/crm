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
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import apiService from '../services/api';
import FloatingActionButton from '../components/FloatingActionButton';
import { colors } from '../theme';

interface Task {
  id: number;
  title: string;
  description: string;
  is_done: boolean;
  due_date: string;
  created_at: string;
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await apiService.getTasks();
      setTasks(data.results || data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadTasks();
  };

  const toggleTask = async (task: Task) => {
    try {
      await apiService.updateTask(task.id, { is_done: !task.is_done });

      // Update local state
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === task.id ? { ...t, is_done: !t.is_done } : t
        )
      );
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      Alert.alert('Error', 'Please enter task title');
      return;
    }

    try {
      const createdTask = await apiService.createTask(newTask);
      setTasks((prevTasks) => [createdTask, ...prevTasks]);
      setIsCreateModalVisible(false);
      setNewTask({ title: '', description: '', due_date: '' });
      Alert.alert('Success', 'Task created successfully');
    } catch (error) {
      console.error('Failed to create task:', error);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const deleteTask = async (task: Task) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this task?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await apiService.deleteTask(task.id);
              setTasks((prevTasks) => prevTasks.filter((t) => t.id !== task.id));
              Alert.alert('Success', 'Task deleted successfully');
            } catch (error) {
              console.error('Failed to delete task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'pending') return !task.is_done;
    if (filter === 'done') return task.is_done;
    return true;
  });

  const renderTaskCard = ({ item }: { item: Task }) => (
    <View style={styles.taskCard}>
      <TouchableOpacity
        style={styles.taskCardContent}
        onPress={() => toggleTask(item)}
      >
        <View style={styles.taskCheckbox}>
          {item.is_done ? (
            <View style={styles.taskCheckboxChecked}>
              <Text style={styles.taskCheckIcon}>✓</Text>
            </View>
          ) : (
            <View style={styles.taskCheckboxUnchecked} />
          )}
        </View>

        <View style={styles.taskContent}>
          <Text
            style={[styles.taskTitle, item.is_done && styles.taskTitleDone]}
          >
            {item.title}
          </Text>

          {item.description && (
            <Text
              style={[
                styles.taskDescription,
                item.is_done && styles.taskDescriptionDone,
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}

          {item.due_date && (
            <View style={styles.dueDateContainer}>
              <Text style={styles.dueDateLabel}>Due:</Text>
              <Text
                style={[
                  styles.taskDueDate,
                  new Date(item.due_date) < new Date() && !item.is_done && styles.taskOverdue,
                ]}
              >
                {new Date(item.due_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTask(item)}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  const pendingCount = tasks.filter(t => !t.is_done).length;
  const doneCount = tasks.filter(t => t.is_done).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>
          {filteredTasks.length} {filter === 'all' ? 'total' : filter} tasks
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'all' && styles.filterTextActive,
            ]}
          >
            All ({tasks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'pending' && styles.filterTabActive,
          ]}
          onPress={() => setFilter('pending')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'pending' && styles.filterTextActive,
            ]}
          >
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'done' && styles.filterTabActive]}
          onPress={() => setFilter('done')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'done' && styles.filterTextActive,
            ]}
          >
            Done ({doneCount})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTaskCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'Create your first task to get started'
                : `No ${filter} tasks`
              }
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <FloatingActionButton onPress={() => setIsCreateModalVisible(true)} />

      {/* Create Task Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>New Task</Text>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter task title"
                value={newTask.title}
                onChangeText={(text) => setNewTask({ ...newTask, title: text })}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter task description"
                value={newTask.description}
                onChangeText={(text) => setNewTask({ ...newTask, description: text })}
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>Due Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={newTask.due_date}
                onChangeText={(text) => setNewTask({ ...newTask, due_date: text })}
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setIsCreateModalVisible(false);
                    setNewTask({ title: '', description: '', due_date: '' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateTask}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: colors.background,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textOnPrimary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  taskCardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.badge.error,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  taskCheckbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  taskCheckboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  taskCheckIcon: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  taskDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  taskDescriptionDone: {
    color: colors.textMuted,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueDateLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  taskDueDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  taskOverdue: {
    color: colors.error,
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
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

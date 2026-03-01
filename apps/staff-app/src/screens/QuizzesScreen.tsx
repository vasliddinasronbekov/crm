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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

interface Quiz {
  id: number;
  title: string;
  description: string;
  quiz_type: string;
  quiz_type_display: string;
  time_limit_minutes: number;
  passing_score: number;
  is_published: boolean;
  question_count: number;
  total_points: number;
  created_at: string;
}

export default function QuizzesScreen({ navigation }: any) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'practice' | 'graded' | 'exam'>('all');

  useEffect(() => {
    fetchQuizzes();
  }, [filter]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter !== 'all') {
        params.quiz_type = filter;
      }

      const response = await api.get('/api/v1/lms/quizzes/', { params });
      setQuizzes(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuizzes();
  };

  const togglePublished = async (quiz: Quiz) => {
    try {
      await api.patch(`/api/v1/lms/quizzes/${quiz.id}/`, {
        is_published: !quiz.is_published,
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Error updating quiz:', error);
      Alert.alert('Error', 'Failed to update quiz status');
    }
  };

  const handleDelete = (quiz: Quiz) => {
    Alert.alert(
      'Delete Quiz',
      `Are you sure you want to delete "${quiz.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/v1/lms/quizzes/${quiz.id}/`);
              fetchQuizzes();
              Alert.alert('Success', 'Quiz deleted successfully');
            } catch (error) {
              console.error('Error deleting quiz:', error);
              Alert.alert('Error', 'Failed to delete quiz');
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async (quiz: Quiz) => {
    try {
      await api.post(`/api/v1/lms/quizzes/${quiz.id}/duplicate/`);
      Alert.alert('Success', 'Quiz duplicated successfully');
      fetchQuizzes();
    } catch (error) {
      console.error('Error duplicating quiz:', error);
      Alert.alert('Error', 'Failed to duplicate quiz');
    }
  };

  const filteredQuizzes = quizzes.filter(
    (quiz) =>
      quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderQuizCard = ({ item }: { item: Quiz }) => {
    const typeColor =
      item.quiz_type === 'practice'
        ? colors.success
        : item.quiz_type === 'graded'
        ? colors.primary
        : colors.warning;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('QuizDetail', { quizId: item.id })}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.badgeText, { color: typeColor }]}>
              {item.quiz_type_display}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => togglePublished(item)}
            style={[
              styles.publishButton,
              { backgroundColor: item.is_published ? colors.success : colors.textMuted },
            ]}
          >
            <Icon
              name={item.is_published ? 'eye' : 'eye-off'}
              size={16}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Questions</Text>
            <Text style={styles.statValue}>{item.question_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>{item.total_points}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{item.time_limit_minutes}m</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pass</Text>
            <Text style={styles.statValue}>{item.passing_score}%</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate('EditQuiz', { quizId: item.id })}
          >
            <Icon name="pencil" size={16} color={colors.textOnPrimary} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.statsButton]}
            onPress={() =>
              navigation.navigate('QuizStats', { quizId: item.id })
            }
          >
            <Icon name="stats-chart" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.duplicateButton]}
            onPress={() => handleDuplicate(item)}
          >
            <Icon name="copy" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Icon name="trash" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading quizzes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quiz Management</Text>
        <Text style={styles.subtitle}>Create and manage quizzes</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search quizzes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'practice', 'graded', 'exam'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              filter === type && styles.filterTabActive,
            ]}
            onPress={() => setFilter(type)}
          >
            <Text
              style={[
                styles.filterText,
                filter === type && styles.filterTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quiz List */}
      <FlatList
        data={filteredQuizzes}
        renderItem={renderQuizCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No quizzes found</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateQuiz')}
            >
              <Text style={styles.createButtonText}>Create Your First Quiz</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Action Button */}
      {filteredQuizzes.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateQuiz')}
        >
          <Icon name="add" size={28} color={colors.textOnPrimary} />
        </TouchableOpacity>
      )}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textOnPrimary,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  publishButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  statsButton: {
    backgroundColor: colors.surfaceLight,
  },
  duplicateButton: {
    backgroundColor: colors.surfaceLight,
  },
  deleteButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textOnPrimary,
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
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
});

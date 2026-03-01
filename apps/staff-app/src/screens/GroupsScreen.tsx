import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import apiService from '../services/api';
import { colors } from '../theme';

interface Group {
  id: number;
  name: string;
  course: {
    id: number;
    name: string;
  };
  students: any[];
  start_day: string;
  end_day: string;
  start_time: string;
  end_time: string;
  days: string;
  room?: {
    name: string;
  };
}

export default function GroupsScreen({ navigation }: any) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await apiService.getMyGroups();
      setGroups(data.results || data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadGroups();
  };

  const renderGroupCard = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleContainer}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.courseName}>{item.course.name}</Text>
        </View>
        <View style={styles.studentsBadge}>
          <Text style={styles.studentsBadgeText}>
            {item.students?.length || 0} students
          </Text>
        </View>
      </View>

      <View style={styles.groupInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoLabel}>Days:</Text>
          <Text style={styles.infoText}>{item.days}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>⏰</Text>
          <Text style={styles.infoLabel}>Time:</Text>
          <Text style={styles.infoText}>
            {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
          </Text>
        </View>

        {item.room && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🚪</Text>
            <Text style={styles.infoLabel}>Room:</Text>
            <Text style={styles.infoText}>{item.room.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.viewButton}>
        <Text style={styles.viewButtonText}>View Details →</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <Text style={styles.subtitle}>{groups.length} groups total</Text>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroupCard}
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
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No groups found</Text>
            <Text style={styles.emptySubtext}>
              Your assigned groups will appear here
            </Text>
          </View>
        }
      />
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
  listContent: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  groupTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  courseName: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  studentsBadge: {
    backgroundColor: colors.badge.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  studentsBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  groupInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginRight: 6,
  },
  infoText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  viewButton: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  viewButtonText: {
    color: colors.primary,
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
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

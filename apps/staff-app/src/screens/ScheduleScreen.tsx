import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
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
  start_time: string;
  end_time: string;
  days: string;
  room?: {
    name: string;
  };
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_UZBEK = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

export default function ScheduleScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

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
    }
  };

  const parseGroupDays = (daysString: string): number[] => {
    // Support both Uzbek and English day names
    const dayMap: { [key: string]: number } = {
      'Dushanba': 1, 'Monday': 1,
      'Seshanba': 2, 'Tuesday': 2,
      'Chorshanba': 3, 'Wednesday': 3,
      'Payshanba': 4, 'Thursday': 4,
      'Juma': 5, 'Friday': 5,
      'Shanba': 6, 'Saturday': 6,
      'Yakshanba': 0, 'Sunday': 0,
    };

    const days: number[] = [];
    Object.entries(dayMap).forEach(([name, index]) => {
      if (daysString.includes(name)) {
        days.push(index);
      }
    });
    return days;
  };

  const getGroupsForDay = (dayIndex: number) => {
    return groups
      .filter((group) => parseGroupDays(group.days).includes(dayIndex))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const todayGroups = getGroupsForDay(selectedDay);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <Text style={styles.headerSubtitle}>
          {groups.length} groups total
        </Text>
      </View>

      {/* Day Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {DAYS_OF_WEEK.map((day, index) => {
          const dayIndex = index === 6 ? 0 : index + 1;
          const isSelected = selectedDay === dayIndex;
          const groupCount = getGroupsForDay(dayIndex).length;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayTab, isSelected && styles.dayTabActive]}
              onPress={() => setSelectedDay(dayIndex)}
            >
              <Text style={[styles.dayTabText, isSelected && styles.dayTabTextActive]}>
                {DAYS_SHORT[index]}
              </Text>
              {groupCount > 0 && (
                <View style={[styles.dayBadge, isSelected && styles.dayBadgeActive]}>
                  <Text style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextActive]}>
                    {groupCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Schedule List */}
      <ScrollView style={styles.scheduleList}>
        <Text style={styles.dateText}>
          {DAYS_OF_WEEK[selectedDay === 0 ? 6 : selectedDay - 1]}
        </Text>

        {todayGroups.length > 0 ? (
          todayGroups.map((group) => (
            <View key={group.id} style={styles.scheduleCard}>
              <View style={styles.timeSection}>
                <Text style={styles.timeText}>{group.start_time.slice(0, 5)}</Text>
                <View style={styles.timeLine} />
                <Text style={styles.timeText}>{group.end_time.slice(0, 5)}</Text>
              </View>

              <View style={styles.scheduleContent}>
                <View style={styles.scheduleHeader}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {group.room && (
                    <View style={styles.roomBadge}>
                      <Text style={styles.roomBadgeText}>🚪 {group.room.name}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.courseName}>{group.course.name}</Text>

                <View style={styles.scheduleFooter}>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {calculateDuration(group.start_time, group.end_time)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No classes scheduled</Text>
            <Text style={styles.emptySubtext}>for this day</Text>
          </View>
        )}
      </ScrollView>

      {/* Weekly Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{groups.length}</Text>
          <Text style={styles.summaryLabel}>Groups</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {calculateWeeklyHours()}
          </Text>
          <Text style={styles.summaryLabel}>Weekly Hours</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{todayGroups.length}</Text>
          <Text style={styles.summaryLabel}>Today's Classes</Text>
        </View>
      </View>
    </View>
  );

  function calculateDuration(start: string, end: string): string {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const duration = endMinutes - startMinutes;

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  function calculateWeeklyHours(): string {
    let totalMinutes = 0;

    groups.forEach((group) => {
      const [startHour, startMin] = group.start_time.split(':').map(Number);
      const [endHour, endMin] = group.end_time.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const duration = endMinutes - startMinutes;

      const daysCount = parseGroupDays(group.days).length;
      totalMinutes += duration * daysCount;
    });

    const hours = Math.floor(totalMinutes / 60);
    return `${hours}h`;
  }
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
    backgroundColor: colors.surface,
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  daySelector: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  daySelectorContent: {
    padding: 16,
    gap: 8,
  },
  dayTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayTabTextActive: {
    color: colors.textOnPrimary,
  },
  dayBadge: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  dayBadgeActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  dayBadgeTextActive: {
    color: colors.textOnPrimary,
  },
  scheduleList: {
    flex: 1,
    padding: 16,
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSection: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.primaryAlpha20,
    marginVertical: 4,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  roomBadge: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roomBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  courseName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  scheduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationBadge: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
});

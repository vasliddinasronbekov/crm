// apps/student-app-v2/src/screens/EventsScreen.tsx

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@eduvoice/mobile-ui';
import { eventsApi, Event } from '@eduvoice/mobile-shared';

type EventType = 'all' | 'exam' | 'holiday' | 'meeting' | 'class';

export const EventsScreen = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState<EventType>('all');

  // Get current month date range
  const dateRange = useMemo(() => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return {
      start: startOfMonth.toISOString().split('T')[0],
      end: endOfMonth.toISOString().split('T')[0],
    };
  }, [selectedDate]);

  // Fetch events
  const {
    data: events,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['events', dateRange, filter],
    queryFn: () =>
      eventsApi.getEvents({
        date_from: dateRange.start,
        date_to: dateRange.end,
        event_type: filter === 'all' ? undefined : filter,
      }),
    retry: 2,
  });

  // Filter tabs
  const filters: { key: EventType; label: string; icon: string; color: string }[] = [
    { key: 'all', label: t('events.all'), icon: 'calendar', color: theme.colors.primary500 },
    { key: 'exam', label: t('events.exams'), icon: 'clipboard-text', color: theme.colors.error500 },
    { key: 'holiday', label: t('events.holidays'), icon: 'beach', color: theme.colors.success500 },
    { key: 'meeting', label: t('events.meetings'), icon: 'account-group', color: theme.colors.warning500 },
    { key: 'class', label: t('events.classes'), icon: 'school', color: theme.colors.info500 },
  ];

  // Month navigation
  const previousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const currentMonth = selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  // Group events by date
  const eventsByDate = useMemo(() => {
    if (!events) return {};
    const grouped: Record<string, Event[]> = {};
    events.forEach((event) => {
      const date = event.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [events]);

  const sortedDates = useMemo(() => {
    return Object.keys(eventsByDate).sort();
  }, [eventsByDate]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('events.loadingEvents')}</Text>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.colors.error500} />
        <Text style={styles.errorTitle}>{t('common.error')}</Text>
        <Text style={styles.errorMessage}>
          {error instanceof Error ? error.message : t('events.errorLoadingEvents')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthHeader}>
        <TouchableOpacity style={styles.monthButton} onPress={previousMonth}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.primary500} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{currentMonth}</Text>
        <TouchableOpacity style={styles.monthButton} onPress={nextMonth}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.primary500} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && { backgroundColor: f.color },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <MaterialCommunityIcons
              name={f.icon as any}
              size={20}
              color={filter === f.key ? theme.colors.white : f.color}
            />
            <Text
              style={[
                styles.filterTabText,
                filter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Events List */}
      {sortedDates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="calendar-blank" size={80} color={theme.colors.gray400} />
          <Text style={styles.emptyTitle}>{t('events.noEvents')}</Text>
          <Text style={styles.emptyMessage}>{t('events.noEventsMessage')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary500}
            />
          }
        >
          <View style={styles.eventsContainer}>
            {sortedDates.map((date) => (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateLabelContainer}>
                  <Text style={styles.dateLabel}>
                    {new Date(date).toLocaleDateString('default', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <View style={styles.dateLine} />
                </View>
                {(eventsByDate[date] || []).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Event Card Component
interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const { t } = useTranslation();

  const eventTypeConfig = {
    exam: {
      color: theme.colors.error500,
      icon: 'clipboard-text',
      label: t('events.exam'),
      bgColor: '#FEE2E2',
    },
    holiday: {
      color: theme.colors.success500,
      icon: 'beach',
      label: t('events.holiday'),
      bgColor: '#D1FAE5',
    },
    meeting: {
      color: theme.colors.warning500,
      icon: 'account-group',
      label: t('events.meeting'),
      bgColor: '#FEF3C7',
    },
    class: {
      color: theme.colors.info500,
      icon: 'school',
      label: t('events.class'),
      bgColor: '#DBEAFE',
    },
    other: {
      color: theme.colors.gray600,
      icon: 'calendar',
      label: t('events.other'),
      bgColor: theme.colors.gray100,
    },
  };

  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;

  const startTime = new Date(event.start_time).toLocaleTimeString('default', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTime = new Date(event.end_time).toLocaleTimeString('default', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.eventCard, { backgroundColor: config.bgColor }]}>
      <View style={[styles.eventColorBar, { backgroundColor: config.color }]} />

      <View style={styles.eventContent}>
        {/* Header */}
        <View style={styles.eventHeader}>
          <View style={styles.eventTitleContainer}>
            <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
            <Text style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </Text>
          </View>
          <View style={[styles.eventTypeBadge, { backgroundColor: config.color }]}>
            <Text style={styles.eventTypeText}>{config.label}</Text>
          </View>
        </View>

        {/* Description */}
        {event.description && (
          <Text style={styles.eventDescription} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        {/* Details */}
        <View style={styles.eventDetails}>
          {/* Time */}
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.detailText}>
              {startTime} - {endTime}
            </Text>
          </View>

          {/* Location */}
          {event.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.gray600} />
              <Text style={styles.detailText}>{event.location}</Text>
            </View>
          )}

          {/* Course */}
          {event.course_name && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="book-open" size={16} color={theme.colors.gray600} />
              <Text style={styles.detailText}>{event.course_name}</Text>
            </View>
          )}

          {/* Group */}
          {event.group_name && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account-group" size={16} color={theme.colors.gray600} />
              <Text style={styles.detailText}>{event.group_name}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray50,
  },
  errorTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.error500,
  },
  errorMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary500,
    borderRadius: 8,
  },
  retryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.gray700,
  },
  emptyMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  monthButton: {
    padding: theme.spacing.sm,
  },
  monthText: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
  },
  filterTabs: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    gap: theme.spacing.xs,
  },
  filterTabText: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    fontSize: 14,
  },
  filterTabTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  eventsContainer: {
    padding: theme.spacing.md,
  },
  dateGroup: {
    marginBottom: theme.spacing.lg,
  },
  dateLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dateLabel: {
    ...theme.typography.h4,
    color: theme.colors.primary500,
    marginRight: theme.spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  eventTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  eventTitle: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    flex: 1,
  },
  eventTypeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventTypeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  eventDescription: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  eventDetails: {
    gap: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
});

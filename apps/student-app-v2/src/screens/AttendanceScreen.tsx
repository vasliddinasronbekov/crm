// apps/student-app-v2/src/screens/AttendanceScreen.tsx

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
import { attendanceApi, AttendanceRecord, AttendanceStats } from '@eduvoice/mobile-shared';

export const AttendanceScreen = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get current month date range
  const dateRange = useMemo(() => {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return {
      start: startOfMonth.toISOString().split('T')[0],
      end: endOfMonth.toISOString().split('T')[0],
    };
  }, [selectedDate]);

  // Fetch attendance records
  const {
    data: records,
    isLoading: recordsLoading,
    isError: recordsError,
    error: recordsErrorObj,
    refetch: refetchRecords,
    isRefetching: recordsRefetching,
  } = useQuery({
    queryKey: ['attendance-records', dateRange],
    queryFn: () => attendanceApi.getAttendanceRecords(dateRange.start, dateRange.end),
    retry: 2,
  });

  // Fetch attendance statistics
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['attendance-stats'],
    queryFn: attendanceApi.getAttendanceStats,
    retry: 2,
  });

  // Month navigation
  const previousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const currentMonth = selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  // Refresh all data
  const handleRefresh = () => {
    refetchRecords();
    refetchStats();
  };

  // Group records by date
  const recordsByDate = useMemo(() => {
    if (!records) return {};
    const grouped: Record<string, AttendanceRecord[]> = {};
    records.forEach((record) => {
      const date = record.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(record);
    });
    return grouped;
  }, [records]);

  const sortedDates = useMemo(() => {
    return Object.keys(recordsByDate).sort().reverse();
  }, [recordsByDate]);

  // Loading state
  if (recordsLoading || statsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('attendance.loadingAttendance')}</Text>
      </View>
    );
  }

  // Error state
  if (recordsError || statsError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={64}
          color={theme.colors.error500}
        />
        <Text style={styles.errorTitle}>{t('common.error')}</Text>
        <Text style={styles.errorMessage}>
          {recordsErrorObj instanceof Error
            ? recordsErrorObj.message
            : t('attendance.errorLoadingAttendance')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={recordsRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary500}
          />
        }
      >
        {/* Statistics Card */}
        {stats && <StatisticsCard stats={stats} />}

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

        {/* Attendance Records */}
        {sortedDates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={80}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyTitle}>{t('attendance.noRecords')}</Text>
            <Text style={styles.emptyMessage}>{t('attendance.noRecordsMessage')}</Text>
          </View>
        ) : (
          <View style={styles.recordsContainer}>
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
                {(recordsByDate[date] || []).map((record) => (
                  <AttendanceCard key={record.id} record={record} />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Statistics Card Component
interface StatisticsCardProps {
  stats: AttendanceStats;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ stats }) => {
  const { t } = useTranslation();

  const statusItems = [
    {
      key: 'present',
      label: t('attendance.present'),
      value: stats.present,
      color: theme.colors.success500,
      icon: 'check-circle',
      bgColor: '#D1FAE5',
    },
    {
      key: 'late',
      label: t('attendance.late'),
      value: stats.late,
      color: theme.colors.warning500,
      icon: 'clock-alert',
      bgColor: '#FEF3C7',
    },
    {
      key: 'absent',
      label: t('attendance.absent'),
      value: stats.absent,
      color: theme.colors.error500,
      icon: 'close-circle',
      bgColor: '#FEE2E2',
    },
    {
      key: 'excused',
      label: t('attendance.excused'),
      value: stats.excused,
      color: theme.colors.info500,
      icon: 'information-outline',
      bgColor: '#DBEAFE',
    },
  ];

  return (
    <View style={styles.statsCard}>
      {/* Header with attendance rate */}
      <View style={styles.statsHeader}>
        <View style={styles.statsHeaderLeft}>
          <MaterialCommunityIcons
            name="chart-donut"
            size={32}
            color={theme.colors.primary500}
          />
          <View style={styles.statsHeaderText}>
            <Text style={styles.statsTitle}>{t('attendance.attendanceRate')}</Text>
            <Text style={styles.statsSubtitle}>
              {stats.total_classes} {t('attendance.totalClasses')}
            </Text>
          </View>
        </View>
        <View style={styles.attendanceRateContainer}>
          <Text style={styles.attendanceRateText}>{stats.attendance_rate.toFixed(1)}%</Text>
        </View>
      </View>

      {/* Status breakdown */}
      <View style={styles.statusBreakdown}>
        {statusItems.map((item) => (
          <View key={item.key} style={[styles.statusItem, { backgroundColor: item.bgColor }]}>
            <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
            <Text style={[styles.statusValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.statusLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          {stats.present > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  backgroundColor: theme.colors.success500,
                  width: `${(stats.present / stats.total_classes) * 100}%`,
                },
              ]}
            />
          )}
          {stats.late > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  backgroundColor: theme.colors.warning500,
                  width: `${(stats.late / stats.total_classes) * 100}%`,
                },
              ]}
            />
          )}
          {stats.excused > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  backgroundColor: theme.colors.info500,
                  width: `${(stats.excused / stats.total_classes) * 100}%`,
                },
              ]}
            />
          )}
          {stats.absent > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  backgroundColor: theme.colors.error500,
                  width: `${(stats.absent / stats.total_classes) * 100}%`,
                },
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
};

// Attendance Card Component
interface AttendanceCardProps {
  record: AttendanceRecord;
}

const AttendanceCard: React.FC<AttendanceCardProps> = ({ record }) => {
  const { t } = useTranslation();

  const statusConfig = {
    present: {
      color: theme.colors.success500,
      icon: 'check-circle',
      label: t('attendance.present'),
      bgColor: '#D1FAE5',
    },
    late: {
      color: theme.colors.warning500,
      icon: 'clock-alert',
      label: t('attendance.late'),
      bgColor: '#FEF3C7',
    },
    absent: {
      color: theme.colors.error500,
      icon: 'close-circle',
      label: t('attendance.absent'),
      bgColor: '#FEE2E2',
    },
    excused: {
      color: theme.colors.info500,
      icon: 'information-outline',
      label: t('attendance.excused'),
      bgColor: '#DBEAFE',
    },
  };

  const config = statusConfig[record.status];

  return (
    <View style={[styles.attendanceCard, { backgroundColor: config.bgColor }]}>
      <View style={[styles.attendanceColorBar, { backgroundColor: config.color }]} />

      <View style={styles.attendanceContent}>
        {/* Header */}
        <View style={styles.attendanceHeader}>
          <View style={styles.attendanceTitleContainer}>
            <MaterialCommunityIcons name="account-group" size={20} color={theme.colors.gray700} />
            <Text style={styles.groupName} numberOfLines={1}>
              {record.group_name}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
            <MaterialCommunityIcons name={config.icon as any} size={16} color={theme.colors.white} />
            <Text style={styles.statusText}>{config.label}</Text>
          </View>
        </View>

        {/* Check-in time */}
        {record.check_in_time && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.detailText}>
              {t('attendance.checkInTime')}: {new Date(record.check_in_time).toLocaleTimeString('default', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* Notes */}
        {record.notes && (
          <View style={styles.notesContainer}>
            <MaterialCommunityIcons name="note-text" size={16} color={theme.colors.gray600} />
            <Text style={styles.notesText} numberOfLines={2}>
              {record.notes}
            </Text>
          </View>
        )}
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
    marginTop: theme.spacing.xxl,
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
  scrollView: {
    flex: 1,
  },

  // Statistics Card
  statsCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: 16,
    ...theme.shadows.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  statsHeaderText: {
    flex: 1,
  },
  statsTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
    marginBottom: 2,
  },
  statsSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  attendanceRateContainer: {
    backgroundColor: theme.colors.primary50,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 12,
  },
  attendanceRateText: {
    ...theme.typography.h2,
    color: theme.colors.primary500,
    fontWeight: '700',
  },
  statusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: 12,
  },
  statusValue: {
    ...theme.typography.h3,
    fontWeight: '700',
    marginTop: 4,
  },
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontSize: 11,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },

  // Month Header
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    marginTop: theme.spacing.sm,
  },
  monthButton: {
    padding: theme.spacing.sm,
  },
  monthText: {
    ...theme.typography.h3,
    color: theme.colors.gray900,
  },

  // Records
  recordsContainer: {
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

  // Attendance Card
  attendanceCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  attendanceColorBar: {
    width: 4,
  },
  attendanceContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  attendanceTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  groupName: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  notesText: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
    flex: 1,
    lineHeight: 18,
  },
});

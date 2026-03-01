// apps/student-app-v2/src/screens/GroupsScreen.tsx

import React from 'react';
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
import { groupsApi, Group } from '@eduvoice/mobile-shared';

export const GroupsScreen = () => {
  const { t } = useTranslation();

  // Fetch groups
  const {
    data: groups,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.getMyGroups,
    retry: 2,
  });

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('groups.loadingGroups')}</Text>
      </View>
    );
  }

  // Error state
  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={64}
          color={theme.colors.error500}
        />
        <Text style={styles.errorTitle}>{t('common.error')}</Text>
        <Text style={styles.errorMessage}>
          {error instanceof Error ? error.message : t('groups.errorLoadingGroups')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (!groups || groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="account-group-outline"
          size={80}
          color={theme.colors.gray400}
        />
        <Text style={styles.emptyTitle}>{t('groups.noGroups')}</Text>
        <Text style={styles.emptyMessage}>{t('groups.noGroupsMessage')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        <View style={styles.groupsContainer}>
          {(Array.isArray(groups) ? groups : []).map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// Group Card Component
interface GroupCardProps {
  group: Group;
}

const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.groupCard}>
      {/* Header with gradient */}
      <View style={styles.cardHeader}>
        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="account-group"
              size={32}
              color={theme.colors.white}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.courseName} numberOfLines={1}>
              {group.course_name}
            </Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {/* Teacher */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-tie"
            size={20}
            color={theme.colors.primary500}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{t('groups.teacher')}</Text>
            <Text style={styles.infoValue}>{group.teacher_name}</Text>
          </View>
        </View>

        {/* Students Count */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-multiple"
            size={20}
            color={theme.colors.info500}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{t('groups.students')}</Text>
            <Text style={styles.infoValue}>
              {group.students_count} {t('groups.studentsCount')}
            </Text>
          </View>
        </View>

        {/* Level */}
        {group.level && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="signal"
              size={20}
              color={theme.colors.warning500}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('groups.level')}</Text>
              <Text style={styles.infoValue}>{group.level}</Text>
            </View>
          </View>
        )}

        {/* Room */}
        {group.room && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="door"
              size={20}
              color={theme.colors.success500}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('groups.room')}</Text>
              <Text style={styles.infoValue}>{group.room}</Text>
            </View>
          </View>
        )}

        {/* Schedule */}
        {group.schedule && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="calendar-clock"
              size={20}
              color={theme.colors.error500}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('groups.schedule')}</Text>
              <Text style={styles.infoValue}>{group.schedule}</Text>
            </View>
          </View>
        )}

        {/* Dates */}
        {group.start_date && group.end_date && (
          <View style={styles.dateContainer}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('groups.startDate')}</Text>
              <Text style={styles.dateValue}>
                {new Date(group.start_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{t('groups.endDate')}</Text>
              <Text style={styles.dateValue}>
                {new Date(group.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {group.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description} numberOfLines={3}>
              {group.description}
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
  groupsContainer: {
    padding: theme.spacing.md,
  },
  groupCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  cardHeader: {
    backgroundColor: theme.colors.primary500,
    padding: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  groupName: {
    ...theme.typography.h3,
    color: theme.colors.white,
    marginBottom: 4,
  },
  courseName: {
    ...theme.typography.body,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  cardBody: {
    padding: theme.spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  infoContent: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontSize: 12,
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  dateItem: {
    flex: 1,
  },
  dateDivider: {
    width: 1,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: theme.spacing.md,
  },
  dateLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontSize: 12,
    marginBottom: 4,
  },
  dateValue: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    lineHeight: 20,
  },
});

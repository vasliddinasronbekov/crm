/**
 * Student Profile API Service
 * Handles all student profile-related API calls
 */

import { apiClient } from './client';
import type {
  StudentStatistics,
  StudentProfile,
  StudentBalance,
  Fine,
  Group,
  Notification,
  NotificationPreferences,
  PaginatedResponse,
  PaginationParams,
} from './sharedTypes';

// ============================================================================
// API ENDPOINTS
// ============================================================================

const ENDPOINTS = {
  STATISTICS: '/api/v1/student-profile/student/statistics/',
  PROFILE: '/api/v1/student-profile/student/me/',
  UPDATE: '/api/v1/student-profile/student/update/',
  BALANCE: '/api/v1/student-bonus/',
  FINES: '/api/v1/student-profile/fines/',
  GROUPS: '/api/v1/student-profile/groups/',
  NOTIFICATIONS: '/api/v1/student-profile/notifications/',
  NOTIFICATION_DETAIL: (id: number) => `/api/v1/student-profile/notifications/${id}/`,
  NOTIFICATION_PREFERENCES: '/api/v1/student-profile/notification-preferences/',
};

// ============================================================================
// STUDENT PROFILE SERVICE
// ============================================================================

export const profileService = {
  /**
   * Get student statistics including courses, attendance, performance, etc.
   * @tested ✅ Working
   */
  getStudentStatistics: async (): Promise<StudentStatistics> => {
    return apiClient.get(ENDPOINTS.STATISTICS);
  },

  /**
   * Get student profile details
   */
  getStudentProfile: async (): Promise<StudentProfile> => {
    return apiClient.get(ENDPOINTS.PROFILE);
  },

  /**
   * Update student profile
   */
  updateStudentProfile: async (data: Partial<StudentProfile>): Promise<StudentProfile> => {
    return apiClient.put(ENDPOINTS.UPDATE, data);
  },

  /**
   * Get student coin balance
   * @tested ✅ Working
   */
  getStudentBalance: async (): Promise<StudentBalance> => {
    return apiClient.get(ENDPOINTS.BALANCE);
  },

  /**
   * Get student fines
   */
  getFines: async (params?: PaginationParams): Promise<PaginatedResponse<Fine>> => {
    return apiClient.get(ENDPOINTS.FINES, { params });
  },

  /**
   * Get student's enrolled groups
   */
  getGroups: async (params?: PaginationParams): Promise<PaginatedResponse<Group>> => {
    return apiClient.get(ENDPOINTS.GROUPS, { params });
  },

  /**
   * Get notifications for the student
   */
  getNotifications: async (
    params?: PaginationParams & { is_read?: boolean }
  ): Promise<PaginatedResponse<Notification>> => {
    return apiClient.get(ENDPOINTS.NOTIFICATIONS, { params });
  },

  /**
   * Mark notification as read
   */
  markNotificationAsRead: async (id: number): Promise<Notification> => {
    return apiClient.patch(ENDPOINTS.NOTIFICATION_DETAIL(id), { is_read: true });
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead: async (): Promise<{ success: boolean }> => {
    return apiClient.post(`${ENDPOINTS.NOTIFICATIONS}mark_all_read/`);
  },

  /**
   * Delete notification
   */
  deleteNotification: async (id: number): Promise<void> => {
    return apiClient.delete(ENDPOINTS.NOTIFICATION_DETAIL(id));
  },

  /**
   * Get notification preferences
   */
  getNotificationPreferences: async (): Promise<NotificationPreferences> => {
    return apiClient.get(ENDPOINTS.NOTIFICATION_PREFERENCES);
  },

  /**
   * Update notification preferences
   */
  updateNotificationPreferences: async (
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> => {
    return apiClient.put(ENDPOINTS.NOTIFICATION_PREFERENCES, preferences);
  },
};

// ============================================================================
// REACT QUERY HOOKS (Optional - can be in separate hooks file)
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './sharedTypes';

/**
 * Hook to get student statistics
 */
export const useStudentStatistics = () => {
  return useQuery({
    queryKey: queryKeys.studentStats(),
    queryFn: profileService.getStudentStatistics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get student profile
 */
export const useStudentProfile = () => {
  return useQuery({
    queryKey: queryKeys.profile(),
    queryFn: profileService.getStudentProfile,
  });
};

/**
 * Hook to update student profile
 */
export const useUpdateStudentProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileService.updateStudentProfile,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.studentStats() });
    },
  });
};

/**
 * Hook to get student balance
 */
export const useStudentBalance = () => {
  return useQuery({
    queryKey: queryKeys.studentBalance(),
    queryFn: profileService.getStudentBalance,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to get student groups
 */
export const useStudentGroups = (params?: PaginationParams) => {
  return useQuery({
    queryKey: [...queryKeys.student, 'groups', params],
    queryFn: () => profileService.getGroups(params),
  });
};

/**
 * Hook to get notifications
 */
export const useNotifications = (params?: PaginationParams & { is_read?: boolean }) => {
  return useQuery({
    queryKey: [...queryKeys.student, 'notifications', params],
    queryFn: () => profileService.getNotifications(params),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

/**
 * Hook to mark notification as read
 */
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileService.markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.student, 'notifications'] });
    },
  });
};

/**
 * Hook to get notification preferences
 */
export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: [...queryKeys.student, 'notification-preferences'],
    queryFn: profileService.getNotificationPreferences,
  });
};

/**
 * Hook to update notification preferences
 */
export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileService.updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.student, 'notification-preferences'],
      });
    },
  });
};

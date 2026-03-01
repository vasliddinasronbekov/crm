/**
 * Permission System for Role-Based Access Control
 *
 * This module defines permissions for different user roles and provides
 * utility functions to check permissions throughout the application.
 */

export type UserRole = 'superuser' | 'staff' | 'teacher' | 'student';

export type Permission =
  // User Management
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'teachers.view'
  | 'teachers.create'
  | 'teachers.edit'
  | 'teachers.delete'
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  // CRM
  | 'crm.view'
  | 'crm.create'
  | 'crm.edit'
  | 'crm.delete'
  | 'leads.view'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.delete'
  | 'deals.view'
  | 'deals.create'
  | 'deals.edit'
  | 'deals.delete'
  // LMS
  | 'lms.view'
  | 'lms.create'
  | 'lms.edit'
  | 'lms.delete'
  | 'courses.view'
  | 'courses.create'
  | 'courses.edit'
  | 'courses.delete'
  | 'groups.view'
  | 'groups.create'
  | 'groups.edit'
  | 'groups.delete'
  | 'modules.view'
  | 'modules.create'
  | 'modules.edit'
  | 'modules.delete'
  | 'lessons.view'
  | 'lessons.create'
  | 'lessons.edit'
  | 'lessons.delete'
  | 'assignments.view'
  | 'assignments.create'
  | 'assignments.edit'
  | 'assignments.delete'
  | 'quizzes.view'
  | 'quizzes.create'
  | 'quizzes.edit'
  | 'quizzes.delete'
  // Attendance & Grading
  | 'attendance.view'
  | 'attendance.create'
  | 'attendance.edit'
  | 'grades.view'
  | 'grades.create'
  | 'grades.edit'
  // Analytics & Reports
  | 'analytics.view'
  | 'reports.view'
  | 'reports.create'
  | 'reports.export'
  // Financial
  | 'payments.view'
  | 'payments.create'
  | 'payments.edit'
  | 'payments.delete'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'expenses.delete'
  // HR
  | 'hr.view'
  | 'hr.create'
  | 'hr.edit'
  | 'hr.delete'
  | 'salaries.view'
  | 'salaries.create'
  | 'salaries.edit'
  // Tasks
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.delete'
  // Messaging
  | 'messaging.view'
  | 'messaging.send'
  | 'messaging.delete'
  // Shop
  | 'shop.view'
  | 'shop.create'
  | 'shop.edit'
  | 'shop.delete'
  | 'orders.view'
  | 'orders.process'
  // Events
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  // Support
  | 'support.view'
  | 'support.respond'
  | 'support.close'
  // Announcements
  | 'announcements.view'
  | 'announcements.create'
  | 'announcements.edit'
  | 'announcements.delete'
  // Certificates
  | 'certificates.view'
  | 'certificates.create'
  | 'certificates.issue'
  // Email
  | 'email.view'
  | 'email.send'
  | 'email.campaigns'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  | 'settings.system';

/**
 * Permission mappings for each role
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superuser: [
    // Full access to everything
    'users.view', 'users.create', 'users.edit', 'users.delete',
    'teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete',
    'students.view', 'students.create', 'students.edit', 'students.delete',
    'crm.view', 'crm.create', 'crm.edit', 'crm.delete',
    'leads.view', 'leads.create', 'leads.edit', 'leads.delete',
    'deals.view', 'deals.create', 'deals.edit', 'deals.delete',
    'lms.view', 'lms.create', 'lms.edit', 'lms.delete',
    'courses.view', 'courses.create', 'courses.edit', 'courses.delete',
    'groups.view', 'groups.create', 'groups.edit', 'groups.delete',
    'modules.view', 'modules.create', 'modules.edit', 'modules.delete',
    'lessons.view', 'lessons.create', 'lessons.edit', 'lessons.delete',
    'assignments.view', 'assignments.create', 'assignments.edit', 'assignments.delete',
    'quizzes.view', 'quizzes.create', 'quizzes.edit', 'quizzes.delete',
    'attendance.view', 'attendance.create', 'attendance.edit',
    'grades.view', 'grades.create', 'grades.edit',
    'analytics.view', 'reports.view', 'reports.create', 'reports.export',
    'payments.view', 'payments.create', 'payments.edit', 'payments.delete',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    'hr.view', 'hr.create', 'hr.edit', 'hr.delete',
    'salaries.view', 'salaries.create', 'salaries.edit',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
    'messaging.view', 'messaging.send', 'messaging.delete',
    'shop.view', 'shop.create', 'shop.edit', 'shop.delete',
    'orders.view', 'orders.process',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'support.view', 'support.respond', 'support.close',
    'announcements.view', 'announcements.create', 'announcements.edit', 'announcements.delete',
    'certificates.view', 'certificates.create', 'certificates.issue',
    'email.view', 'email.send', 'email.campaigns',
    'settings.view', 'settings.edit', 'settings.system',
  ],
  staff: [
    // Administrative access (most features except system settings)
    'users.view', 'users.create', 'users.edit',
    'teachers.view', 'teachers.create', 'teachers.edit',
    'students.view', 'students.create', 'students.edit', 'students.delete',
    'crm.view', 'crm.create', 'crm.edit', 'crm.delete',
    'leads.view', 'leads.create', 'leads.edit', 'leads.delete',
    'deals.view', 'deals.create', 'deals.edit', 'deals.delete',
    'lms.view', 'lms.create', 'lms.edit',
    'courses.view', 'courses.create', 'courses.edit',
    'groups.view', 'groups.create', 'groups.edit',
    'modules.view', 'modules.create', 'modules.edit',
    'lessons.view', 'lessons.create', 'lessons.edit',
    'assignments.view', 'assignments.create', 'assignments.edit',
    'quizzes.view', 'quizzes.create', 'quizzes.edit',
    'attendance.view', 'attendance.create', 'attendance.edit',
    'grades.view', 'grades.create', 'grades.edit',
    'analytics.view', 'reports.view', 'reports.create', 'reports.export',
    'payments.view', 'payments.create', 'payments.edit',
    'expenses.view', 'expenses.create', 'expenses.edit',
    'hr.view', 'hr.create', 'hr.edit',
    'salaries.view', 'salaries.create', 'salaries.edit',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
    'messaging.view', 'messaging.send',
    'shop.view', 'shop.create', 'shop.edit',
    'orders.view', 'orders.process',
    'events.view', 'events.create', 'events.edit',
    'support.view', 'support.respond', 'support.close',
    'announcements.view', 'announcements.create', 'announcements.edit',
    'certificates.view', 'certificates.create', 'certificates.issue',
    'email.view', 'email.send', 'email.campaigns',
    'settings.view', 'settings.edit',
  ],
  teacher: [
    // Course and student management focused
    'students.view',
    'lms.view', 'lms.create', 'lms.edit',
    'courses.view', 'courses.create', 'courses.edit',
    'groups.view',
    'modules.view', 'modules.create', 'modules.edit',
    'lessons.view', 'lessons.create', 'lessons.edit',
    'assignments.view', 'assignments.create', 'assignments.edit',
    'quizzes.view', 'quizzes.create', 'quizzes.edit',
    'attendance.view', 'attendance.create', 'attendance.edit',
    'grades.view', 'grades.create', 'grades.edit',
    'analytics.view', 'reports.view',
    'tasks.view', 'tasks.create', 'tasks.edit',
    'messaging.view', 'messaging.send',
    'announcements.view', 'announcements.create',
    'certificates.view', 'certificates.issue',
    'settings.view', 'settings.edit',
  ],
  student: [
    // Limited view-only access
    'lms.view',
    'courses.view',
    'groups.view',
    'modules.view',
    'lessons.view',
    'assignments.view',
    'quizzes.view',
    'attendance.view',
    'grades.view',
    'shop.view',
    'orders.view',
    'events.view',
    'announcements.view',
    'certificates.view',
    'messaging.view',
    'settings.view',
  ],
};

/**
 * Page access permissions - defines which roles can access which pages
 */
export const PAGE_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard': ['lms.view'],
  '/dashboard/students': ['students.view'],
  '/dashboard/teachers': ['teachers.view'],
  '/dashboard/crm': ['crm.view'],
  '/dashboard/lms': ['lms.view'],
  '/dashboard/lms/modules': ['modules.view'],
  '/dashboard/lms/lessons': ['lessons.view'],
  '/dashboard/lms/assignments': ['assignments.view'],
  '/dashboard/groups': ['groups.view'],
  '/dashboard/analytics': ['analytics.view'],
  '/dashboard/reports': ['reports.view'],
  '/dashboard/payments': ['payments.view'],
  '/dashboard/expenses': ['expenses.view'],
  '/dashboard/hr': ['hr.view'],
  '/dashboard/tasks': ['tasks.view'],
  '/dashboard/messaging': ['messaging.view'],
  '/dashboard/shop': ['shop.view'],
  '/dashboard/events': ['events.view'],
  '/dashboard/support': ['support.view'],
  '/dashboard/announcements': ['announcements.view'],
  '/dashboard/leaderboard': ['analytics.view'],
  '/dashboard/certificates': ['certificates.view'],
  '/dashboard/email': ['email.view'],
  '/dashboard/quizzes': ['quizzes.view'],
  '/dashboard/quizzes/create': ['quizzes.create'],
  '/dashboard/settings': ['settings.view'],
};

/**
 * Get user role from user object
 */
export function getUserRole(user: {
  is_superuser: boolean;
  is_staff: boolean;
  is_teacher: boolean;
}): UserRole {
  if (user.is_superuser) return 'superuser';
  if (user.is_staff) return 'staff';
  if (user.is_teacher) return 'teacher';
  return 'student';
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if a user can access a specific page
 */
export function canAccessPage(role: UserRole, path: string): boolean {
  const requiredPermissions = PAGE_PERMISSIONS[path];

  // If no permissions defined for the page, allow access (public page)
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // User needs at least one of the required permissions
  return hasAnyPermission(role, requiredPermissions);
}

/**
 * Get user-friendly permission denied message
 */
export function getPermissionDeniedMessage(permission: Permission): string {
  const messages: Partial<Record<Permission, string>> = {
    'users.create': 'You do not have permission to create users',
    'users.edit': 'You do not have permission to edit users',
    'users.delete': 'You do not have permission to delete users',
    'teachers.create': 'You do not have permission to create teachers',
    'teachers.edit': 'You do not have permission to edit teachers',
    'teachers.delete': 'You do not have permission to delete teachers',
    'students.create': 'You do not have permission to create students',
    'students.edit': 'You do not have permission to edit students',
    'students.delete': 'You do not have permission to delete students',
  };

  return messages[permission] || `You do not have permission to perform this action`;
}

/**
 * Permission hook for React components
 */
export function usePermissions(user: {
  is_superuser: boolean;
  is_staff: boolean;
  is_teacher: boolean;
} | null) {
  if (!user) {
    return {
      role: 'student' as UserRole,
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      canAccessPage: () => false,
    };
  }

  const role = getUserRole(user);

  return {
    role,
    hasPermission: (permission: Permission) => hasPermission(role, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    canAccessPage: (path: string) => canAccessPage(role, path),
  };
}

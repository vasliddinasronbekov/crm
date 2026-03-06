/**
 * Permission System for Role-Based Access Control
 *
 * This module defines permissions for different user roles and provides
 * utility functions to check permissions throughout the application.
 */

export type BackendRole =
  | 'student'
  | 'parent'
  | 'teacher'
  | 'staff'
  | 'crm_manager'
  | 'lms_manager'
  | 'manager'
  | 'director'
  | 'admin'
  | 'superadmin';

// Keep "superuser" for backward compatibility with older UI helpers.
export type UserRole = BackendRole | 'superuser' | 'guest';

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
const LEGACY_ROLE_PERMISSIONS: Record<'superuser' | 'staff' | 'teacher' | 'student', Permission[]> = {
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

export const STAFF_SIDE_ROLES: UserRole[] = [
  'superuser',
  'superadmin',
  'admin',
  'director',
  'manager',
  'crm_manager',
  'lms_manager',
  'staff',
  'teacher',
];

const ROLE_PERMISSION_SOURCE: Record<UserRole, 'superuser' | 'staff' | 'teacher' | 'student'> = {
  superuser: 'superuser',
  superadmin: 'superuser',
  admin: 'staff',
  director: 'staff',
  manager: 'staff',
  crm_manager: 'staff',
  lms_manager: 'staff',
  staff: 'staff',
  teacher: 'teacher',
  student: 'student',
  parent: 'student',
  guest: 'student',
};

interface PagePermissionRule {
  pattern: string;
  requiredPermissions: Permission[];
}

/**
 * Page access permissions with wildcard support.
 * `*` means prefix match.
 */
export const PAGE_PERMISSION_RULES: PagePermissionRule[] = [
  { pattern: '/dashboard/students*', requiredPermissions: ['students.view'] },
  { pattern: '/dashboard/teachers*', requiredPermissions: ['teachers.view'] },
  { pattern: '/dashboard/attendance*', requiredPermissions: ['attendance.view'] },
  { pattern: '/dashboard/branches*', requiredPermissions: ['settings.view'] },
  { pattern: '/dashboard/courses*', requiredPermissions: ['courses.view'] },
  { pattern: '/dashboard/crm*', requiredPermissions: ['crm.view'] },
  { pattern: '/dashboard/data-view*', requiredPermissions: ['reports.view'] },
  { pattern: '/dashboard/exam-scores*', requiredPermissions: ['grades.view'] },
  { pattern: '/dashboard/exams*', requiredPermissions: ['quizzes.view'] },
  { pattern: '/dashboard/inbox*', requiredPermissions: ['messaging.view'] },
  { pattern: '/dashboard/lms/modules*', requiredPermissions: ['modules.view'] },
  { pattern: '/dashboard/lms/lessons*', requiredPermissions: ['lessons.view'] },
  { pattern: '/dashboard/lms/assignments*', requiredPermissions: ['assignments.view'] },
  { pattern: '/dashboard/lms*', requiredPermissions: ['lms.view'] },
  { pattern: '/dashboard/groups*', requiredPermissions: ['groups.view'] },
  { pattern: '/dashboard/rooms*', requiredPermissions: ['groups.view'] },
  { pattern: '/dashboard/sat*', requiredPermissions: ['quizzes.view'] },
  { pattern: '/dashboard/schedule*', requiredPermissions: ['groups.view'] },
  { pattern: '/dashboard/analytics*', requiredPermissions: ['analytics.view'] },
  { pattern: '/dashboard/reports*', requiredPermissions: ['reports.view'] },
  { pattern: '/dashboard/payments*', requiredPermissions: ['payments.view'] },
  { pattern: '/dashboard/finance*', requiredPermissions: ['payments.view'] },
  { pattern: '/dashboard/accounting*', requiredPermissions: ['payments.view'] },
  { pattern: '/dashboard/expenses*', requiredPermissions: ['expenses.view'] },
  { pattern: '/dashboard/hr*', requiredPermissions: ['hr.view'] },
  { pattern: '/dashboard/subscriptions*', requiredPermissions: ['payments.view'] },
  { pattern: '/dashboard/tasks*', requiredPermissions: ['tasks.view'] },
  { pattern: '/dashboard/messaging*', requiredPermissions: ['messaging.view'] },
  { pattern: '/dashboard/shop*', requiredPermissions: ['shop.view'] },
  { pattern: '/dashboard/events*', requiredPermissions: ['events.view'] },
  { pattern: '/dashboard/support*', requiredPermissions: ['support.view'] },
  { pattern: '/dashboard/announcements*', requiredPermissions: ['announcements.view'] },
  { pattern: '/dashboard/leaderboard*', requiredPermissions: ['analytics.view'] },
  { pattern: '/dashboard/certificates*', requiredPermissions: ['certificates.view'] },
  { pattern: '/dashboard/email*', requiredPermissions: ['email.view'] },
  { pattern: '/dashboard/quizzes*', requiredPermissions: ['quizzes.view'] },
  { pattern: '/dashboard/settings*', requiredPermissions: ['settings.view'] },
  { pattern: '/dashboard', requiredPermissions: ['lms.view'] },
];

// Backward-compatible export for existing imports.
export const PAGE_PERMISSIONS: Record<string, Permission[]> = PAGE_PERMISSION_RULES.reduce(
  (acc, rule) => {
    acc[rule.pattern] = rule.requiredPermissions;
    return acc;
  },
  {} as Record<string, Permission[]>,
);

function isKnownRole(role: string): role is UserRole {
  return (
    role === 'superuser' ||
    role === 'superadmin' ||
    role === 'admin' ||
    role === 'director' ||
    role === 'manager' ||
    role === 'crm_manager' ||
    role === 'lms_manager' ||
    role === 'staff' ||
    role === 'teacher' ||
    role === 'student' ||
    role === 'parent' ||
    role === 'guest'
  );
}

export function getUserRole(user: {
  role?: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  is_teacher: boolean;
}): UserRole {
  const explicitRole = (user.role || '').toLowerCase();
  if (isKnownRole(explicitRole)) {
    return explicitRole;
  }
  if (user.is_superuser) return 'superadmin';
  if (user.is_teacher) return 'teacher';
  if (user.is_staff) return 'staff';
  return 'student';
}

export function getRolePermissions(role: UserRole): Permission[] {
  if (role === 'guest') return [];
  const source = ROLE_PERMISSION_SOURCE[role] || 'student';
  return LEGACY_ROLE_PERMISSIONS[source] || [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function matchPattern(pathname: string, pattern: string): boolean {
  const normalizedPath = normalizePath(pathname);
  const normalizedPattern = normalizePath(pattern);
  if (normalizedPattern.endsWith('*')) {
    const prefix = normalizedPattern.slice(0, -1);
    return normalizedPath.startsWith(prefix);
  }
  return normalizedPath === normalizedPattern;
}

export function canAccessPage(role: UserRole, path: string): boolean {
  const pathname = normalizePath(path);
  const matchedRule = PAGE_PERMISSION_RULES.find((rule) => matchPattern(pathname, rule.pattern));
  if (matchedRule) {
    return hasAnyPermission(role, matchedRule.requiredPermissions);
  }

  // Unknown dashboard pages default to staff-side only.
  if (pathname.startsWith('/dashboard')) {
    return STAFF_SIDE_ROLES.includes(role);
  }
  return true;
}

export function getRequiredPermissionsForPath(path: string): Permission[] {
  const pathname = normalizePath(path);
  const matchedRule = PAGE_PERMISSION_RULES.find((rule) => matchPattern(pathname, rule.pattern));
  return matchedRule?.requiredPermissions || [];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    superuser: 'Superuser',
    superadmin: 'Super Admin',
    admin: 'Admin',
    director: 'Director',
    manager: 'Manager',
    crm_manager: 'CRM Manager',
    lms_manager: 'LMS Manager',
    staff: 'Staff',
    teacher: 'Teacher',
    student: 'Student',
    parent: 'Parent',
    guest: 'Guest',
  };
  return labels[role] || 'User';
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
  role?: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  is_teacher: boolean;
} | null) {
  if (!user) {
    return {
      role: 'guest' as UserRole,
      roleLabel: getRoleLabel('guest'),
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      canAccessPage: () => false,
      isStaffSideRole: false,
    };
  }

  const role = getUserRole(user);
  const roleLabel = getRoleLabel(role);
  const isStaffSideRole = STAFF_SIDE_ROLES.includes(role);

  return {
    role,
    roleLabel,
    hasPermission: (permission: Permission) => hasPermission(role, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    canAccessPage: (path: string) => canAccessPage(role, path),
    isStaffSideRole,
  };
}

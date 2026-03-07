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

export type StaffSideRole = (typeof STAFF_SIDE_ROLES)[number];

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

export interface PagePermissionRule {
  pattern: string;
  requiredPermissions: Permission[];
}

export type StaffAccessIntent = 'staff_and_teacher' | 'staff_ops_only';

export interface StaffRouteFamilyPolicy {
  family: string;
  patterns: string[];
  requiredPermission: Permission;
  intendedAccess: StaffAccessIntent;
  backendParityNote: string;
}

/**
 * Canonical staff-side route-family map for the web dashboard.
 *
 * Notes:
 * - This map is web-app focused and assumes dashboard access is already behind
 *   web auth entry routing.
 * - Runtime page checks are derived from this map to reduce drift.
 * - Student/parent access intent is intentionally out of scope here.
 */
export const STAFF_ROUTE_FAMILY_POLICIES: StaffRouteFamilyPolicy[] = [
  {
    family: 'students',
    patterns: ['/dashboard/students*'],
    requiredPermission: 'students.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Keep read access aligned with student listing/detail endpoints.',
  },
  {
    family: 'teachers',
    patterns: ['/dashboard/teachers*'],
    requiredPermission: 'teachers.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Guard teacher directory endpoints for non-ops roles.',
  },
  {
    family: 'attendance',
    patterns: ['/dashboard/attendance*'],
    requiredPermission: 'attendance.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Attendance list/write endpoints must stay teacher-capable.',
  },
  {
    family: 'branches',
    patterns: ['/dashboard/branches*'],
    requiredPermission: 'settings.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Branch and org settings endpoints should remain ops-scoped.',
  },
  {
    family: 'courses',
    patterns: ['/dashboard/courses*'],
    requiredPermission: 'courses.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Course listing/detail endpoints should follow course visibility policy.',
  },
  {
    family: 'crm',
    patterns: ['/dashboard/crm*'],
    requiredPermission: 'crm.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'CRM endpoints should enforce explicit CRM role/permission checks.',
  },
  {
    family: 'reports',
    patterns: ['/dashboard/data-view*', '/dashboard/reports*'],
    requiredPermission: 'reports.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Export/report endpoints should keep parity with report permissions.',
  },
  {
    family: 'exam_scores',
    patterns: ['/dashboard/exam-scores*'],
    requiredPermission: 'grades.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Score endpoints must remain aligned with grading permissions.',
  },
  {
    family: 'exams_quizzes',
    patterns: ['/dashboard/exams*', '/dashboard/sat*', '/dashboard/quizzes*'],
    requiredPermission: 'quizzes.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Exam and quiz endpoints should keep teacher-capable read/write parity.',
  },
  {
    family: 'messaging',
    patterns: ['/dashboard/inbox*', '/dashboard/messaging*'],
    requiredPermission: 'messaging.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Conversation/message reads should follow messaging visibility policy.',
  },
  {
    family: 'lms_modules',
    patterns: ['/dashboard/lms/modules*'],
    requiredPermission: 'modules.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Module endpoints should stay aligned with module-level permissions.',
  },
  {
    family: 'lms_lessons',
    patterns: ['/dashboard/lms/lessons*'],
    requiredPermission: 'lessons.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Lesson endpoints should map to lesson permissions.',
  },
  {
    family: 'lms_assignments',
    patterns: ['/dashboard/lms/assignments*'],
    requiredPermission: 'assignments.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Assignment endpoints should enforce assignment-level guards.',
  },
  {
    family: 'lms_core',
    patterns: ['/dashboard/lms*'],
    requiredPermission: 'lms.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'LMS root and nested data must keep teacher-safe read boundaries.',
  },
  {
    family: 'groups',
    patterns: ['/dashboard/groups*', '/dashboard/rooms*'],
    requiredPermission: 'groups.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Match group and room read endpoints with group visibility scope.',
  },
  {
    family: 'schedule',
    patterns: ['/dashboard/schedule*'],
    requiredPermission: 'groups.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Schedule feeds should mirror group visibility constraints.',
  },
  {
    family: 'analytics',
    patterns: ['/dashboard/analytics*', '/dashboard/leaderboard*'],
    requiredPermission: 'analytics.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Align analytics endpoints with role-scoped dataset exposure.',
  },
  {
    family: 'payments_finance',
    patterns: ['/dashboard/payments*', '/dashboard/finance*', '/dashboard/accounting*', '/dashboard/subscriptions*'],
    requiredPermission: 'payments.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Financial endpoints should reject non-ops roles consistently.',
  },
  {
    family: 'expenses',
    patterns: ['/dashboard/expenses*'],
    requiredPermission: 'expenses.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Expense read/write guards should map to expense capabilities.',
  },
  {
    family: 'hr',
    patterns: ['/dashboard/hr*'],
    requiredPermission: 'hr.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'HR records must remain restricted to ops roles.',
  },
  {
    family: 'tasks',
    patterns: ['/dashboard/tasks*'],
    requiredPermission: 'tasks.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Task visibility and assignment actions need consistent guard checks.',
  },
  {
    family: 'shop',
    patterns: ['/dashboard/shop*'],
    requiredPermission: 'shop.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Shop/product/order endpoints should preserve ops-only capability.',
  },
  {
    family: 'events',
    patterns: ['/dashboard/events*'],
    requiredPermission: 'events.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Event management endpoints should reject unauthorized role writes.',
  },
  {
    family: 'support',
    patterns: ['/dashboard/support*'],
    requiredPermission: 'support.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Support ticket reads/respond actions need strict role guards.',
  },
  {
    family: 'announcements',
    patterns: ['/dashboard/announcements*'],
    requiredPermission: 'announcements.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Announcement CRUD should remain consistent across staff and teacher roles.',
  },
  {
    family: 'certificates',
    patterns: ['/dashboard/certificates*'],
    requiredPermission: 'certificates.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Certificate read/issue endpoints should map to certificate permissions.',
  },
  {
    family: 'email',
    patterns: ['/dashboard/email*'],
    requiredPermission: 'email.view',
    intendedAccess: 'staff_ops_only',
    backendParityNote: 'Campaign/send endpoints should remain non-teacher unless explicitly enabled.',
  },
  {
    family: 'settings',
    patterns: ['/dashboard/settings*'],
    requiredPermission: 'settings.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Settings writes require action-level checks beyond view access.',
  },
  {
    family: 'dashboard_home',
    patterns: ['/dashboard'],
    requiredPermission: 'lms.view',
    intendedAccess: 'staff_and_teacher',
    backendParityNote: 'Home widgets should not leak data from restricted modules.',
  },
];

/**
 * Page access permissions with wildcard support.
 * `*` means prefix match.
 */
export const PAGE_PERMISSION_RULES: PagePermissionRule[] = STAFF_ROUTE_FAMILY_POLICIES.flatMap((family) =>
  family.patterns.map((pattern) => ({
    pattern,
    requiredPermissions: [family.requiredPermission],
  })),
);

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

function getEffectiveStaffRolesForPermission(permission: Permission): StaffSideRole[] {
  return STAFF_SIDE_ROLES.filter((role) => hasPermission(role, permission)) as StaffSideRole[];
}

export interface StaffRoutePermissionAuditEntry {
  family: string;
  pattern: string;
  requiredPermission: Permission;
  intendedAccess: StaffAccessIntent;
  effectiveStaffRoles: StaffSideRole[];
  backendParityNote: string;
}

export const STAFF_ROUTE_PERMISSION_AUDIT: StaffRoutePermissionAuditEntry[] = STAFF_ROUTE_FAMILY_POLICIES.flatMap(
  (family) =>
    family.patterns.map((pattern) => ({
      family: family.family,
      pattern,
      requiredPermission: family.requiredPermission,
      intendedAccess: family.intendedAccess,
      effectiveStaffRoles: getEffectiveStaffRolesForPermission(family.requiredPermission),
      backendParityNote: family.backendParityNote,
    })),
);

export function getStaffRoutePermissionAudit(): StaffRoutePermissionAuditEntry[] {
  return STAFF_ROUTE_PERMISSION_AUDIT;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

function normalizePath(path: string): string {
  if (!path) return '/';
  let normalized = path.trim();

  // Accept absolute URLs by extracting only pathname.
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)) {
    try {
      normalized = new URL(normalized).pathname || '/';
    } catch {
      // Keep best-effort normalization below.
    }
  }

  // Ignore query/hash for permission matching.
  normalized = normalized.split('#', 1)[0].split('?', 1)[0];
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
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

function patternToRoute(pattern: string): string {
  const normalizedPattern = normalizePath(pattern);
  if (normalizedPattern.endsWith('*')) {
    return normalizedPattern.slice(0, -1);
  }
  return normalizedPattern;
}

export function isDashboardRoute(path: string): boolean {
  return normalizePath(path).startsWith('/dashboard');
}

export function getFirstAccessibleDashboardPath(role: UserRole): string | null {
  const candidates = Array.from(
    new Set(['/dashboard', ...PAGE_PERMISSION_RULES.map((rule) => patternToRoute(rule.pattern))]),
  ).filter((candidate) => isDashboardRoute(candidate));

  for (const candidate of candidates) {
    if (canAccessPage(role, candidate)) {
      return candidate;
    }
  }

  return null;
}

export interface DashboardRouteAccess {
  allowed: boolean;
  fallbackPath: string | null;
}

export function getDashboardRouteAccess(role: UserRole, path: string): DashboardRouteAccess {
  if (!isDashboardRoute(path)) {
    return { allowed: true, fallbackPath: null };
  }

  const allowed = canAccessPage(role, path);
  if (allowed) {
    return { allowed: true, fallbackPath: null };
  }

  return {
    allowed: false,
    fallbackPath: getFirstAccessibleDashboardPath(role),
  };
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
      canAccessDashboardRoute: () => ({ allowed: false, fallbackPath: null }),
      getFirstAccessibleDashboardPath: () => null,
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
    canAccessDashboardRoute: (path: string) => getDashboardRouteAccess(role, path),
    getFirstAccessibleDashboardPath: () => getFirstAccessibleDashboardPath(role),
    isStaffSideRole,
  };
}

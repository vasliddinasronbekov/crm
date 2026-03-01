import { User, UserRole, PermissionKey } from '@/packages/types/user';

const allPermissions = Object.keys({
  VIEW_USERS: null,
  CREATE_USERS: null,
  EDIT_USERS: null,
  DELETE_USERS: null,
  VIEW_STUDENTS: null,
  CREATE_STUDENTS: null,
  EDIT_STUDENTS: null,
  DELETE_STUDENTS: null,
  VIEW_TEACHERS: null,
  CREATE_TEACHERS: null,
  EDIT_TEACHERS: null,
  DELETE_TEACHERS: null,
  VIEW_GROUPS: null,
  CREATE_GROUPS: null,
  EDIT_GROUPS: null,
  DELETE_GROUPS: null,
  VIEW_COURSES: null,
  CREATE_COURSES: null,
  EDIT_COURSES: null,
  DELETE_COURSES: null,
  VIEW_ATTENDANCE: null,
  MARK_ATTENDANCE: null,
  EDIT_ATTENDANCE: null,
  VIEW_EXAM_SCORES: null,
  CREATE_EXAM_SCORES: null,
  EDIT_EXAM_SCORES: null,
  DELETE_EXAM_SCORES: null,
  VIEW_PAYMENTS: null,
  CREATE_PAYMENTS: null,
  EDIT_PAYMENTS: null,
  DELETE_PAYMENTS: null,
  VIEW_ACCOUNTING: null,
  MANAGE_ACCOUNTING: null,
  VIEW_ANALYTICS: null,
  VIEW_REPORTS: null,
  GENERATE_REPORTS: null,
  VIEW_CRM: null,
  MANAGE_LEADS: null,
  MANAGE_DEALS: null,
  VIEW_TASKS: null,
  CREATE_TASKS: null,
  EDIT_TASKS: null,
  DELETE_TASKS: null,
  VIEW_LMS: null,
  MANAGE_LMS_CONTENT: null,
  GRADE_ASSIGNMENTS: null,
  VIEW_EMAIL_CAMPAIGNS: null,
  MANAGE_EMAIL_CAMPAIGNS: null,
  VIEW_CERTIFICATES: null,
  GENERATE_CERTIFICATES: null,
  VIEW_SALARIES: null,
  MANAGE_SALARIES: null,
  VIEW_EXPENSES: null,
  MANAGE_EXPENSES: null,
  VIEW_SUPPORT: null,
  MANAGE_SUPPORT: null,
  VIEW_SHOP: null,
  MANAGE_SHOP: null,
  AWARD_COINS: null,
  VIEW_SETTINGS: null,
  MANAGE_SETTINGS: null,
}) as PermissionKey[];


const ROLES_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
    superuser: allPermissions,
    staff: [
        'VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'DELETE_USERS',
        'VIEW_STUDENTS', 'CREATE_STUDENTS', 'EDIT_STUDENTS', 'DELETE_STUDENTS',
        'VIEW_TEACHERS', 'CREATE_TEACHERS', 'EDIT_TEACHERS', 'DELETE_TEACHERS',
        'VIEW_GROUPS', 'CREATE_GROUPS', 'EDIT_GROUPS', 'DELETE_GROUPS',
        'VIEW_COURSES', 'CREATE_COURSES', 'EDIT_COURSES', 'DELETE_COURSES',
        'VIEW_ATTENDANCE', 'MARK_ATTENDANCE', 'EDIT_ATTENDANCE',
        'VIEW_EXAM_SCORES', 'CREATE_EXAM_SCORES', 'EDIT_EXAM_SCORES', 'DELETE_EXAM_SCORES',
        'VIEW_PAYMENTS', 'CREATE_PAYMENTS', 'EDIT_PAYMENTS', 'DELETE_PAYMENTS',
        'VIEW_ACCOUNTING', 'MANAGE_ACCOUNTING',
        'VIEW_ANALYTICS', 'VIEW_REPORTS', 'GENERATE_REPORTS',
        'VIEW_CRM', 'MANAGE_LEADS', 'MANAGE_DEALS',
        'VIEW_TASKS', 'CREATE_TASKS', 'EDIT_TASKS', 'DELETE_TASKS',
        'VIEW_LMS', 'MANAGE_LMS_CONTENT', 'GRADE_ASSIGNMENTS',
        'VIEW_EMAIL_CAMPAIGNS', 'MANAGE_EMAIL_CAMPAIGNS',
        'VIEW_CERTIFICATES', 'GENERATE_CERTIFICATES',
        'VIEW_SALARIES', 'MANAGE_SALARIES',
        'VIEW_EXPENSES', 'MANAGE_EXPENSES',
        'VIEW_SUPPORT', 'MANAGE_SUPPORT',
        'VIEW_SHOP', 'MANAGE_SHOP', 'AWARD_COINS',
        'VIEW_SETTINGS', 'MANAGE_SETTINGS'
    ],
    teacher: [
        'VIEW_STUDENTS', 'VIEW_GROUPS', 'VIEW_COURSES', 'VIEW_ATTENDANCE',
        'MARK_ATTENDANCE', 'EDIT_ATTENDANCE', 'VIEW_EXAM_SCORES', 'CREATE_EXAM_SCORES',
        'EDIT_EXAM_SCORES', 'VIEW_TASKS', 'CREATE_TASKS', 'EDIT_TASKS',
        'DELETE_TASKS', 'VIEW_LMS', 'MANAGE_LMS_CONTENT', 'GRADE_ASSIGNMENTS'
    ],
    student: [
        'VIEW_COURSES', 'VIEW_ATTENDANCE', 'VIEW_EXAM_SCORES', 'VIEW_PAYMENTS', 'VIEW_TASKS',
        'VIEW_LMS', 'VIEW_SUPPORT'
    ],
    guest: [],
};

export const RBAC = {
    isSuperuser: (user: User | null): boolean => !!user && user.is_superuser,
    isStaff: (user: User | null): boolean => !!user && user.is_staff,
    isTeacher: (user: User | null): boolean => !!user && user.is_teacher,
    isStudent: (user: User | null): boolean => !!user && !user.is_staff && !user.is_teacher,
    isAdmin: (user: User | null): boolean => !!user && (user.is_superuser || user.is_staff),
    getRole: (user: User | null): UserRole => {
        if (!user) return 'guest';
        if (user.is_superuser) return 'superuser';
        if (user.is_staff) return 'staff';
        if (user.is_teacher) return 'teacher';
        return 'student';
    },
    getRoleLabel: (user: User | null): string => {
        const role = RBAC.getRole(user);
        return role.charAt(0).toUpperCase() + role.slice(1);
    },
    getDisplayName: (user: User | null): string => {
        if (!user) return 'Guest';
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        return user.username;
    },
};

export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  const userRole = RBAC.getRole(user);
  return roles.includes(userRole);
}

export function hasPermission(user: User | null, permission: PermissionKey): boolean {
    if (!user) return false;
    const userRole = RBAC.getRole(user);
    const userPermissions = ROLES_PERMISSIONS[userRole] || [];
    return userPermissions.includes(permission);
}

export function hasAnyPermission(user: User | null, permissions: PermissionKey[]): boolean {
    if (!user) return false;
    const userRole = RBAC.getRole(user);
    const userPermissions = ROLES_PERMISSIONS[userRole] || [];
    return permissions.some(p => userPermissions.includes(p));
}

export type { UserRole, PermissionKey };

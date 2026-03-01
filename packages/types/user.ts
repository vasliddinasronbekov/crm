export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  photo?: string;
  is_teacher: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  branch?: { id: number; name: string } | number | null;
}

export type UserRole = 'superuser' | 'staff' | 'teacher' | 'student' | 'guest';

export type PermissionKey = 
  | 'VIEW_USERS'
  | 'CREATE_USERS'
  | 'EDIT_USERS'
  | 'DELETE_USERS'
  | 'VIEW_STUDENTS'
  | 'CREATE_STUDENTS'
  | 'EDIT_STUDENTS'
  | 'DELETE_STUDENTS'
  | 'VIEW_TEACHERS'
  | 'CREATE_TEACHERS'
  | 'EDIT_TEACHERS'
  | 'DELETE_TEACHERS'
  | 'VIEW_GROUPS'
  | 'CREATE_GROUPS'
  | 'EDIT_GROUPS'
  | 'DELETE_GROUPS'
  | 'VIEW_COURSES'
  | 'CREATE_COURSES'
  | 'EDIT_COURSES'
  | 'DELETE_COURSES'
  | 'VIEW_ATTENDANCE'
  | 'MARK_ATTENDANCE'
  | 'EDIT_ATTENDANCE'
  | 'VIEW_EXAM_SCORES'
  | 'CREATE_EXAM_SCORES'
  | 'EDIT_EXAM_SCORES'
  | 'DELETE_EXAM_SCORES'
  | 'VIEW_PAYMENTS'
  | 'CREATE_PAYMENTS'
  | 'EDIT_PAYMENTS'
  | 'DELETE_PAYMENTS'
  | 'VIEW_ACCOUNTING'
  | 'MANAGE_ACCOUNTING'
  | 'VIEW_ANALYTICS'
  | 'VIEW_REPORTS'
  | 'GENERATE_REPORTS'
  | 'VIEW_CRM'
  | 'MANAGE_LEADS'
  | 'MANAGE_DEALS'
  | 'VIEW_TASKS'
  | 'CREATE_TASKS'
  | 'EDIT_TASKS'
  | 'DELETE_TASKS'
  | 'VIEW_LMS'
  | 'MANAGE_LMS_CONTENT'
  | 'GRADE_ASSIGNMENTS'
  | 'VIEW_EMAIL_CAMPAIGNS'
  | 'MANAGE_EMAIL_CAMPAIGNS'
  | 'VIEW_CERTIFICATES'
  | 'GENERATE_CERTIFICATES'
  | 'VIEW_SALARIES'
  | 'MANAGE_SALARIES'
  | 'VIEW_EXPENSES'
  | 'MANAGE_EXPENSES'
  | 'VIEW_SUPPORT'
  | 'MANAGE_SUPPORT'
  | 'VIEW_SHOP'
  | 'MANAGE_SHOP'
  | 'AWARD_COINS'
  | 'VIEW_SETTINGS'
  | 'MANAGE_SETTINGS';
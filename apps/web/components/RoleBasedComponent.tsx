/**
 * Role-Based Component
 * Conditionally renders children based on user permissions
 */

'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole, PermissionKey, hasAnyRole, hasPermission, hasAnyPermission } from '@/packages/utils/roleHelpers'

interface RoleBasedProps {
  children: ReactNode
  roles?: UserRole[]
  permissions?: PermissionKey[]
  requireAll?: boolean
  fallback?: ReactNode
}

export function RoleBased({
  children,
  roles,
  permissions,
  requireAll = false,
  fallback = null,
}: RoleBasedProps) {
  const { user } = useAuth()

  // Check roles
  if (roles && roles.length > 0) {
    const hasRole = hasAnyRole(user, roles)
    if (!hasRole) return <>{fallback}</>
  }

  // Check permissions
  if (permissions && permissions.length > 0) {
    const hasPerms = requireAll
      ? permissions.every(p => hasPermission(user, p))
      : hasAnyPermission(user, permissions)

    if (!hasPerms) return <>{fallback}</>
  }

  return <>{children}</>
}

// Convenience components for common roles
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBased roles={['superuser', 'staff']} fallback={fallback}>
      {children}
    </RoleBased>
  )
}

export function SuperuserOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBased roles={['superuser']} fallback={fallback}>
      {children}
    </RoleBased>
  )
}

export function TeacherOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBased roles={['teacher']} fallback={fallback}>
      {children}
    </RoleBased>
  )
}

export function StaffAndTeacher({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleBased roles={['superuser', 'staff', 'teacher']} fallback={fallback}>
      {children}
    </RoleBased>
  )
}

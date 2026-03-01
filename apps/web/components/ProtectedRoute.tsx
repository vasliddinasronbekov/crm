'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PAGE_PERMISSIONS } from '@/lib/permissions';
import { AlertCircle, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  showError?: boolean;
}

/**
 * ProtectedRoute Component
 *
 * Wraps pages/components to enforce role-based access control.
 * Automatically redirects unauthorized users or shows error message.
 *
 * @example
 * <ProtectedRoute>
 *   <TeachersPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  fallback,
  redirectTo = '/dashboard',
  showError = true,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const permissions = usePermissions(user);

  useEffect(() => {
    if (!isLoading && user) {
      const canAccess = permissions.canAccessPage(pathname);

      if (!canAccess) {
        // User doesn't have permission to access this page
        if (redirectTo && redirectTo !== pathname) {
          router.push(redirectTo);
        }
      }
    }
  }, [isLoading, user, pathname, permissions, router, redirectTo]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <AlertCircle className="h-16 w-16 text-warning mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to access current page
  const canAccess = permissions.canAccessPage(pathname);

  if (!canAccess) {
    if (!showError) {
      return fallback || null;
    }

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
        <div className="text-center space-y-6 max-w-md p-8">
          {/* Lock Icon with Gradient */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-50"></div>
            <div className="relative bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full p-6 border border-red-500/30 inline-block">
              <Lock className="h-16 w-16 text-red-500" />
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              Access Denied
            </h2>
            <p className="text-muted-foreground text-lg">
              You don&apos;t have permission to access this page.
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4">
              <p className="text-sm text-red-400">
                <strong>Your Role:</strong>{' '}
                {user.is_superuser
                  ? 'Administrator'
                  : user.is_staff
                  ? 'Staff'
                  : user.is_teacher
                  ? 'Teacher'
                  : 'Student'}
              </p>
              <p className="text-sm text-red-400 mt-2">
                Please contact your administrator if you believe you should have access to this page.
              </p>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 hover:from-cyan-500 hover:to-primary text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // User has permission, render children
  return <>{children}</>;
}

/**
 * Permission-based conditional rendering component
 *
 * @example
 * <RequirePermission permission="users.create">
 *   <button>Create User</button>
 * </RequirePermission>
 */
interface RequirePermissionProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
}

export function RequirePermission({
  permission,
  children,
  fallback = null,
  requireAll = false,
}: RequirePermissionProps) {
  const { user } = useAuth();
  const permissions = usePermissions(user);

  const permissionsArray = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? permissions.hasAllPermissions(permissionsArray as any)
    : permissions.hasAnyPermission(permissionsArray as any);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Role-based conditional rendering component
 *
 * @example
 * <RequireRole role={['superuser', 'staff']}>
 *   <AdminPanel />
 * </RequireRole>
 */
interface RequireRoleProps {
  role: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { user } = useAuth();
  const permissions = usePermissions(user);

  const rolesArray = Array.isArray(role) ? role : [role];

  const hasRole = rolesArray.includes(permissions.role);

  return hasRole ? <>{children}</> : <>{fallback}</>;
}

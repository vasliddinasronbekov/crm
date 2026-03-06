'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';
import {
  type Permission,
  type UserRole,
  usePermissions,
  getRequiredPermissionsForPath,
} from '@/lib/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  showError?: boolean;
}

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

  const canAccess = permissions.canAccessPage(pathname);
  const requiredPermissions = getRequiredPermissionsForPath(pathname);

  useEffect(() => {
    if (!isLoading && user && !canAccess && redirectTo && redirectTo !== pathname) {
      router.push(redirectTo);
    }
  }, [canAccess, isLoading, pathname, redirectTo, router, user]);

  if (isLoading) {
    return <LoadingScreen message="Checking access..." />;
  }

  if (!user) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4 max-w-md p-8">
            <AlertCircle className="h-16 w-16 text-warning mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access this page.</p>
          </div>
        </div>
      )
    );
  }

  if (!canAccess) {
    if (!showError) {
      return fallback || null;
    }

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
        <div className="text-center space-y-5 max-w-lg p-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-red-500/10 border border-red-500/30">
            <Lock className="h-10 w-10 text-red-500" />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">
              Your current role cannot open this route.
            </p>
          </div>

          <div className="text-left bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
            <div className="text-sm">
              <span className="text-red-400 font-semibold">Role:</span>{' '}
              <span className="text-red-300">{permissions.roleLabel}</span>
            </div>
            {requiredPermissions.length > 0 && (
              <div className="text-sm">
                <span className="text-red-400 font-semibold">Required permissions:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {requiredPermissions.map((permission) => (
                    <span
                      key={permission}
                      className="text-xs px-2 py-1 rounded-md bg-red-500/20 text-red-300 border border-red-500/30"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 hover:from-cyan-500 hover:to-primary text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  permission: Permission | Permission[];
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
  const permissionList = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? permissions.hasAllPermissions(permissionList)
    : permissions.hasAnyPermission(permissionList);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

interface RequireRoleProps {
  role: UserRole | UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { user } = useAuth();
  const permissions = usePermissions(user);
  const roles = Array.isArray(role) ? role : [role];

  return roles.includes(permissions.role) ? <>{children}</> : <>{fallback}</>;
}

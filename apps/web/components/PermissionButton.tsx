'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, Permission } from '@/lib/permissions';
import { Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  permission: Permission | Permission[];
  requireAll?: boolean;
  showDisabled?: boolean;
  disabledTooltip?: string;
  children: ReactNode;
}

/**
 * PermissionButton Component
 *
 * A button that automatically disables/hides based on user permissions.
 * Shows a lock icon and tooltip when user lacks permission.
 *
 * @example
 * <PermissionButton
 *   permission="users.create"
 *   onClick={handleCreate}
 *   className="btn-primary"
 * >
 *   Create User
 * </PermissionButton>
 */
export function PermissionButton({
  permission,
  requireAll = false,
  showDisabled = true,
  disabledTooltip,
  children,
  onClick,
  className = '',
  ...props
}: PermissionButtonProps) {
  const { user } = useAuth();
  const permissions = usePermissions(user);

  const permissionsArray = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? permissions.hasAllPermissions(permissionsArray)
    : permissions.hasAnyPermission(permissionsArray);

  // If no access and showDisabled is false, don't render
  if (!hasAccess && !showDisabled) {
    return null;
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasAccess) {
      e.preventDefault();
      const message =
        disabledTooltip ||
        `You don't have permission to perform this action. Required: ${permissionsArray.join(', ')}`;
      toast.error(message, {
        icon: '🔒',
        duration: 3000,
      });
      return;
    }

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={!hasAccess || props.disabled}
      className={`
        relative inline-flex items-center justify-center gap-2 transition-all duration-300
        ${!hasAccess ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        ${className}
      `}
      title={!hasAccess ? disabledTooltip || 'Permission required' : props.title}
    >
      {!hasAccess && <Lock className="h-4 w-4" />}
      {children}
    </button>
  );
}

/**
 * ActionButton Component
 *
 * Pre-styled button with permission checking for common actions.
 */
interface ActionButtonProps extends PermissionButtonProps {
  variant?: 'create' | 'edit' | 'delete' | 'view' | 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ActionButtonProps) {
  const variantClasses = {
    create: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg hover:shadow-green-500/50',
    edit: 'bg-gradient-to-r from-primary to-cyan-500 hover:from-cyan-500 hover:to-primary text-white shadow-lg hover:shadow-primary/50',
    delete: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-orange-500 hover:to-red-500 text-white shadow-lg hover:shadow-red-500/50',
    view: 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white shadow-lg hover:shadow-gray-500/50',
    primary: 'bg-gradient-to-r from-primary to-cyan-500 hover:from-cyan-500 hover:to-primary text-white shadow-lg hover:shadow-primary/50',
    secondary: 'bg-surface border border-border hover:bg-background text-foreground shadow hover:shadow-lg',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg hover:shadow-red-500/50',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-7 py-3.5 text-lg rounded-2xl',
  };

  return (
    <PermissionButton
      {...props}
      className={`
        font-medium transition-all duration-300
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    />
  );
}

/**
 * CRUDButtons Component
 *
 * A set of pre-configured buttons for common CRUD operations.
 */
interface CRUDButtonsProps {
  entityName: string; // e.g., "users", "teachers", "students"
  onView?: () => void;
  onCreate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showView?: boolean;
  showCreate?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  className?: string;
}

export function CRUDButtons({
  entityName,
  onView,
  onCreate,
  onEdit,
  onDelete,
  showView = true,
  showCreate = true,
  showEdit = true,
  showDelete = true,
  className = '',
}: CRUDButtonsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showView && onView && (
        <ActionButton
          permission={`${entityName}.view` as Permission}
          variant="view"
          size="sm"
          onClick={onView}
          showDisabled={false}
        >
          View
        </ActionButton>
      )}

      {showCreate && onCreate && (
        <ActionButton
          permission={`${entityName}.create` as Permission}
          variant="create"
          size="sm"
          onClick={onCreate}
          showDisabled={false}
        >
          Create
        </ActionButton>
      )}

      {showEdit && onEdit && (
        <ActionButton
          permission={`${entityName}.edit` as Permission}
          variant="edit"
          size="sm"
          onClick={onEdit}
          showDisabled={false}
        >
          Edit
        </ActionButton>
      )}

      {showDelete && onDelete && (
        <ActionButton
          permission={`${entityName}.delete` as Permission}
          variant="delete"
          size="sm"
          onClick={onDelete}
          showDisabled={false}
        >
          Delete
        </ActionButton>
      )}
    </div>
  );
}

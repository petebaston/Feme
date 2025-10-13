import { useMemo } from 'react';
import { hasPermission, hasAnyPermission, hasAllPermissions, getCurrentUser, type Permission } from '@/lib/permissions';

export function usePermissions() {
  const user = useMemo(() => getCurrentUser(), []);

  const can = (permission: Permission): boolean => {
    return hasPermission(user?.role, permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    return hasAnyPermission(user?.role, permissions);
  };

  const canAll = (permissions: Permission[]): boolean => {
    return hasAllPermissions(user?.role, permissions);
  };

  return {
    user,
    can,
    canAny,
    canAll,
  };
}

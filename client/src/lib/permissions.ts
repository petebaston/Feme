// Permission types
export type Permission = 
  | 'view_orders'
  | 'create_orders'
  | 'view_quotes'
  | 'create_quotes'
  | 'manage_quotes'
  | 'view_invoices'
  | 'view_company'
  | 'manage_company'
  | 'manage_users'
  | 'manage_addresses'
  | 'view_shopping_lists'
  | 'manage_shopping_lists'
  | 'switch_companies';

// Role permission mappings
export const rolePermissions: Record<string, Permission[]> = {
  admin: [
    'view_orders',
    'create_orders',
    'view_quotes',
    'create_quotes',
    'manage_quotes',
    'view_invoices',
    'view_company',
    'manage_company',
    'manage_users',
    'manage_addresses',
    'view_shopping_lists',
    'manage_shopping_lists',
    'switch_companies',
  ],
  buyer: [
    'view_orders',
    'create_orders',
    'view_quotes',
    'create_quotes',
    'view_invoices',
    'view_company',
    'view_shopping_lists',
    'manage_shopping_lists',
  ],
  user: [
    'view_orders',
    'view_quotes',
    'view_invoices',
    'view_company',
    'view_shopping_lists',
  ],
};

// Check if a user has a specific permission
export function hasPermission(userRole: string | null, permission: Permission): boolean {
  if (!userRole) return false;
  const permissions = rolePermissions[userRole] || [];
  return permissions.includes(permission);
}

// Check if user has any of the specified permissions
export function hasAnyPermission(userRole: string | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

// Check if user has all of the specified permissions
export function hasAllPermissions(userRole: string | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// Get current user from localStorage
export function getCurrentUser() {
  try {
    const user = localStorage.getItem('b2b_user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

// Check permission for current user
export function canCurrentUser(permission: Permission): boolean {
  const user = getCurrentUser();
  return hasPermission(user?.role, permission);
}

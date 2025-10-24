import type { AuthRequest } from './auth';

export interface FilterOptions {
  companyId?: string;
  userId?: string;
  role?: string;
}

/**
 * Filter data array by company
 * Admins see all data, regular users only see their company's data
 */
export function filterByCompany<T extends { companyId?: string | number }>(
  data: T[],
  userCompanyId?: string | number,
  userRole?: string
): T[] {
  // Admins and superadmins see all data
  if (userRole === 'admin' || userRole === 'superadmin') {
    return data;
  }

  // Regular users only see their company's data
  if (!userCompanyId) {
    return [];
  }

  // Convert to string for comparison (handles both string and number IDs)
  const userCompanyStr = String(userCompanyId);
  
  return data.filter(item => {
    if (!item.companyId) return false;
    return String(item.companyId) === userCompanyStr;
  });
}

/**
 * Verify single resource ownership
 * Returns true if user can access the resource
 */
export function verifyResourceOwnership<T extends { companyId?: string | number; customerId?: string | number }>(
  resource: T | null,
  userCompanyId?: string | number,
  userRole?: string
): boolean {
  // Admins can access anything
  if (userRole === 'admin' || userRole === 'superadmin') {
    return true;
  }

  // Resource must exist
  if (!resource) {
    return false;
  }

  // Must have company or customer association
  if (!userCompanyId) {
    return false;
  }

  // Check both companyId and customerId fields (invoices use customerId)
  const resourceId = (resource as any).companyId || (resource as any).customerId;
  if (!resourceId) {
    return false;
  }

  // IDs must match (convert both to string for comparison)
  return String(resourceId) === String(userCompanyId);
}

/**
 * Extract filter options from authenticated request
 */
export function getFilterOptions(req: AuthRequest): FilterOptions {
  return {
    companyId: req.user?.companyId,
    userId: req.user?.userId,
    role: req.user?.role,
  };
}

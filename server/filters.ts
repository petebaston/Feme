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
export function filterByCompany<T extends { companyId?: string }>(
  data: T[],
  userCompanyId?: string,
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

  return data.filter(item => item.companyId === userCompanyId);
}

/**
 * Verify single resource ownership
 * Returns true if user can access the resource
 */
export function verifyResourceOwnership<T extends { companyId?: string; customerId?: string }>(
  resource: T | null,
  userCompanyId?: string,
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

  // IDs must match
  return resourceId === userCompanyId;
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

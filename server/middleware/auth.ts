import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Permission types matching frontend
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
const rolePermissions: Record<string, Permission[]> = {
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

// Check if a role has a specific permission
function hasPermission(userRole: string | null, permission: Permission): boolean {
  if (!userRole) return false;
  const permissions = rolePermissions[userRole] || [];
  return permissions.includes(permission);
}

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Authentication middleware - verifies token and attaches user to request
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header only (no query parameter fallback for security)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // In production, validate JWT token. For demo, extract user ID from token
    const userId = token.replace('demo_token_', '');
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
}

// Authorization middleware factory - checks if user has required permission
export function authorize(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = req.user.role;
    const hasRequiredPermission = permissions.some(permission => 
      hasPermission(userRole, permission)
    );

    if (!hasRequiredPermission) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permissions,
        userRole,
      });
    }

    next();
  };
}

// Optional authentication - doesn't fail if no token, but attaches user if valid
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.query.token as string;

    if (token) {
      const userId = token.replace('demo_token_', '');
      const user = await storage.getUser(userId);
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    console.error("Optional auth error:", error);
  }
  next();
}

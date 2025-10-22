import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  companyId?: string;
  role?: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// Generate access token
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Generate refresh token
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

// Verify access token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

// Check if user has required role
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role || '')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Session tracking for timeout
const userSessions = new Map<string, { lastActivity: number; token: string }>();

export function trackSession(userId: string, token: string) {
  userSessions.set(userId, { lastActivity: Date.now(), token });
}

export function updateSessionActivity(userId: string) {
  const session = userSessions.get(userId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

export function clearSession(userId: string) {
  userSessions.delete(userId);
}

export function checkSessionTimeout(userId: string): boolean {
  const session = userSessions.get(userId);
  if (!session) {
    // Session doesn't exist - create it instead of failing
    // This happens after server restart or initial request
    return false;
  }

  const timeout = parseInt(process.env.SESSION_TIMEOUT || '3600000'); // 1 hour default
  return Date.now() - session.lastActivity > timeout;
}

// Session timeout middleware
export function sessionTimeout(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user) {
    if (checkSessionTimeout(req.user.userId)) {
      clearSession(req.user.userId);
      return res.status(401).json({ message: 'Session expired due to inactivity' });
    }
    // Update or create session activity
    const session = userSessions.get(req.user.userId);
    if (session) {
      session.lastActivity = Date.now();
    } else {
      // Create new session if it doesn't exist (e.g., after server restart)
      userSessions.set(req.user.userId, { lastActivity: Date.now(), token: '' });
    }
  }
  next();
}

// Company-based authorization middleware
export function requireCompanyAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admins and superadmins can access all companies
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }

  // Regular users must have a companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'No company association found' });
  }

  next();
}

// Verify resource belongs to user's company
export function verifyCompanyOwnership(resourceCompanyId?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admins can access all resources
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      return next();
    }

    // Verify company match
    if (resourceCompanyId && resourceCompanyId !== req.user.companyId) {
      return res.status(403).json({ message: 'Access denied to this resource' });
    }

    next();
  };
}

import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Best Practice: Custom error classes for different error types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code || 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', code?: string) {
    super(message, 401, code || 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', code?: string) {
    super(message, 403, code || 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Best Practice: Async error wrapper to avoid try-catch in every route
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Best Practice: Global error handling middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`Operational Error: ${err.message}`, {
      statusCode: err.statusCode,
      code: err.code,
      path: req.path,
    });
  } else {
    logger.error(`Unexpected Error: ${err.message}`, {
      stack: err.stack,
      path: req.path,
    });
  }

  // Send error response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Best Practice: 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
};

// Best Practice: Process-level error handlers
export const setupProcessErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', { reason });
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });
};

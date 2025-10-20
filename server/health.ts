import type { Request, Response } from 'express';
import { db } from '../db';

// Best Practice: Health check endpoints (Item 107)

export async function healthCheck(req: Request, res: Response) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
}

export async function readinessCheck(req: Request, res: Response) {
  try {
    // Best Practice: Check database connection
    await db.execute('SELECT 1');

    // Best Practice: Check required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      return res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          environment: 'missing variables',
          missingEnvVars,
        },
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        environment: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export async function livenessCheck(req: Request, res: Response) {
  // Best Practice: Simple check that server is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: process.memoryUsage(),
  });
}

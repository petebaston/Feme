import winston from 'winston';

// Best Practice: Structured logging with proper levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Best Practice: Different log levels for different environments
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Best Practice: Custom format for better readability
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Best Practice: Multiple transports for different environments
const transports = [
  // Console output for development
  new winston.transports.Console(),
  // File output for production errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // All logs
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Best Practice: Create singleton logger instance
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Best Practice: HTTP request logging middleware
export const httpLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

// Best Practice: Export convenience methods
export default logger;

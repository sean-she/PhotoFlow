/**
 * Performance timing utilities
 * 
 * Provides utilities for measuring and logging performance metrics
 * including operation timing, request/response logging, and performance tracking.
 */

import type { Logger } from "pino";

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private logger: Logger;
  private operation: string;
  private context?: Record<string, unknown>;

  constructor(
    logger: Logger,
    operation: string,
    context?: Record<string, unknown>
  ) {
    this.logger = logger;
    this.operation = operation;
    this.context = context;
    this.startTime = performance.now();
  }

  /**
   * End the timer and log the duration
   * 
   * @param additionalContext - Additional context to include in the log
   * @returns Duration in milliseconds
   */
  end(additionalContext?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;
    const logContext = {
      ...this.context,
      ...additionalContext,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      operation: this.operation,
    };

    // Safe logging - catch any errors from logger (e.g., worker thread issues)
    try {
      // Log based on duration (warn if slow)
      if (duration > 1000) {
        this.logger.warn(logContext, `Slow operation: ${this.operation}`);
      } else if (duration > 500) {
        this.logger.info(logContext, `Operation completed: ${this.operation}`);
      } else {
        this.logger.debug(logContext, `Operation completed: ${this.operation}`);
      }
    } catch (error) {
      // Fallback to console if logger fails (e.g., worker thread issues)
      const level = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
      console[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](
        `[${level.toUpperCase()}] ${this.operation} (${Math.round(duration)}ms)`,
        logContext
      );
    }

    return duration;
  }

  /**
   * Get the current elapsed time without ending the timer
   * 
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Time an operation and log the result
 * 
 * @param logger - Logger instance
 * @param operation - Operation name/description
 * @param fn - Function to execute and time
 * @param context - Additional context for logging
 * @returns Result of the function execution
 */
export async function timeOperation<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const timer = new PerformanceTimer(logger, operation, context);
  try {
    const result = await fn();
    timer.end({ success: true });
    return result;
  } catch (error) {
    timer.end({ success: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Time a synchronous operation and log the result
 * 
 * @param logger - Logger instance
 * @param operation - Operation name/description
 * @param fn - Function to execute and time
 * @param context - Additional context for logging
 * @returns Result of the function execution
 */
export function timeOperationSync<T>(
  logger: Logger,
  operation: string,
  fn: () => T,
  context?: Record<string, unknown>
): T {
  const timer = new PerformanceTimer(logger, operation, context);
  try {
    const result = fn();
    timer.end({ success: true });
    return result;
  } catch (error) {
    timer.end({ success: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Request/response logging helper
 * 
 * Logs HTTP request and response with timing information
 * 
 * @param logger - Logger instance
 * @param req - Request object (Express or similar)
 * @param res - Response object (Express or similar)
 * @param startTime - Request start time (from performance.now())
 */
export function logRequestResponse(
  logger: Logger,
  req: {
    method?: string;
    url?: string;
    path?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
  },
  res: {
    statusCode?: number;
    headers?: Record<string, unknown>;
  },
  startTime: number
): void {
  const duration = Math.round((performance.now() - startTime) * 100) / 100;
  const method = req.method || "UNKNOWN";
  const path = req.path || req.url || "UNKNOWN";
  const statusCode = res.statusCode || 0;

  const logData: Record<string, unknown> = {
    method,
    path,
    statusCode,
    duration,
    query: req.query,
  };

  // Only log body in development if it's an object
  if (process.env.NODE_ENV === "development" && req.body && typeof req.body === "object" && req.body !== null) {
    logData.body = req.body;
  }

  // Log level based on status code
  if (statusCode >= 500) {
    logger.error(logData, `${method} ${path} - ${statusCode}`);
  } else if (statusCode >= 400) {
    logger.warn(logData, `${method} ${path} - ${statusCode}`);
  } else {
    logger.info(logData, `${method} ${path} - ${statusCode}`);
  }
}

/**
 * Create a performance timer
 * 
 * @param logger - Logger instance
 * @param operation - Operation name/description
 * @param context - Additional context
 * @returns Performance timer instance
 */
export function createTimer(
  logger: Logger,
  operation: string,
  context?: Record<string, unknown>
): PerformanceTimer {
  return new PerformanceTimer(logger, operation, context);
}


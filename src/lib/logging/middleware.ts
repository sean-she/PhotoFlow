/**
 * Express and Next.js middleware for logging
 * 
 * Provides middleware for request/response logging and error logging
 * integration with Express.js and Next.js API routes.
 */

import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import { getLogger } from "./logger";
import { createRequestLogger, extractRequestContext } from "./context";
import { logRequestResponse, createTimer } from "./performance";
import { logError } from "./error-integration";

/**
 * Express middleware for request/response logging
 * 
 * Logs incoming requests and responses with timing information.
 * Creates a request-scoped logger and attaches it to the request object.
 * 
 * @param logger - Optional logger instance (uses default if not provided)
 * @returns Express middleware function
 */
export function requestLoggingMiddleware(logger?: Logger) {
  const baseLogger = logger || getLogger();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Create request-scoped logger
    const requestLogger = createRequestLogger(baseLogger, req as unknown as Parameters<typeof createRequestLogger>[1]);
    
    // Attach logger to request for use in route handlers
    (req as Request & { logger: Logger }).logger = requestLogger;

    // Record start time
    const startTime = performance.now();

    // Log request
    const method = req.method;
    const path = req.path || req.url;
    requestLogger.info(
      {
        method,
        path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      `Incoming request: ${method} ${path}`
    );

    // Log response when finished
    res.on("finish", () => {
      logRequestResponse(requestLogger, req, res, startTime);
    });

    next();
  };
}

/**
 * Express error logging middleware
 * 
 * Should be used after all routes and before error handling middleware.
 * Logs errors that occur during request processing.
 * 
 * @param logger - Optional logger instance (uses default if not provided)
 * @returns Express error middleware function
 */
export function errorLoggingMiddleware(logger?: Logger) {
  const baseLogger = logger || getLogger();

  return (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Get request logger if available, otherwise use base logger
    const requestLogger =
      (req as Request & { logger?: Logger }).logger ||
      createRequestLogger(baseLogger, req as unknown as Parameters<typeof createRequestLogger>[1]);

    // Log the error with request context
    logError(requestLogger, error, {
      method: req.method,
      path: req.path || req.url,
      query: req.query,
    });

    // Continue to next error handler
    next(error);
  };
}

/**
 * Next.js API route logging wrapper
 * 
 * Wraps a Next.js API route handler with logging functionality.
 * 
 * @param handler - Next.js API route handler
 * @param logger - Optional logger instance
 * @returns Wrapped handler with logging
 */
export function withLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  logger?: Logger
): T {
  const baseLogger = logger || getLogger();

  return (async (...args: Parameters<T>) => {
    const req = args[0] as { url?: string; method?: string; headers?: Record<string, unknown> };
    const res = args[1] as { statusCode?: number };

    // Create request logger
    const requestLogger = createRequestLogger(baseLogger, req as unknown as Parameters<typeof createRequestLogger>[1]);
    const timer = createTimer(requestLogger, `API ${req.method || "UNKNOWN"} ${req.url || "UNKNOWN"}`);

    try {
      // Log request
      requestLogger.info(
        {
          method: req.method,
          url: req.url,
        },
        `API request: ${req.method} ${req.url}`
      );

      // Execute handler
      const result = await handler(...args);

      // Log response
      timer.end({ statusCode: res.statusCode || 200 });
      return result;
    } catch (error) {
      // Log error
      timer.end({ success: false });
      logError(requestLogger, error);
      throw error;
    }
  }) as T;
}

/**
 * Async route handler wrapper with error logging
 * 
 * Wraps an async Express route handler to automatically catch and log errors.
 * 
 * @param handler - Async route handler function
 * @param logger - Optional logger instance
 * @returns Wrapped handler with error logging
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  logger?: Logger
) {
  const baseLogger = logger || getLogger();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestLogger =
      (req as Request & { logger?: Logger }).logger ||
      createRequestLogger(baseLogger, req as unknown as Parameters<typeof createRequestLogger>[1]);

    try {
      await handler(req, res, next);
    } catch (error) {
      logError(requestLogger, error, {
        method: req.method,
        path: req.path || req.url,
      });
      next(error);
    }
  };
}


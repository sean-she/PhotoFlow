/**
 * Context-aware logging with request IDs
 * 
 * Provides utilities for managing request-scoped logging context
 * and generating unique request IDs for traceability.
 */

import type { Logger } from "pino";
import { randomBytes } from "node:crypto";

/**
 * Request context stored in AsyncLocalStorage
 * Allows request-scoped data to be accessed throughout the request lifecycle
 */
export interface RequestContext {
  /**
   * Unique request ID for traceability
   */
  requestId: string;

  /**
   * User ID (if authenticated)
   */
  userId?: string;

  /**
   * IP address of the client
   */
  ip?: string;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Additional custom context
   */
  [key: string]: unknown;
}

/**
 * Generate a unique request ID
 * 
 * @param prefix - Optional prefix for the request ID
 * @returns Unique request ID string
 */
export function generateRequestId(prefix = "req"): string {
  const randomPart = randomBytes(8).toString("hex");
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${randomPart}`;
}

/**
 * Create a child logger with request context
 * 
 * All logs from the child logger will include the context fields
 * 
 * @param logger - Parent logger instance
 * @param context - Request context to include in logs
 * @returns Child logger with context bound
 */
export function createContextLogger(
  logger: Logger,
  context: RequestContext
): Logger {
  return logger.child(context);
}

/**
 * Add context to an existing logger
 * 
 * Creates a child logger with additional context fields
 * 
 * @param logger - Parent logger instance
 * @param additionalContext - Additional context fields to add
 * @returns Child logger with merged context
 */
export function addContext(
  logger: Logger,
  additionalContext: Record<string, unknown>
): Logger {
  return logger.child(additionalContext);
}

/**
 * Extract request context from Express request object
 * 
 * @param req - Express request object (or similar)
 * @returns Request context object
 */
export function extractRequestContext(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
  [key: string]: unknown;
}): RequestContext {
  const context: RequestContext = {
    requestId: generateRequestId(),
  };

  // Extract IP address
  if (req.ip) {
    context.ip = req.ip;
  } else if (req.headers?.["x-forwarded-for"]) {
    const forwardedFor = req.headers["x-forwarded-for"];
    context.ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  } else if (req.headers?.["x-real-ip"]) {
    const realIp = req.headers["x-real-ip"];
    context.ip = Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Extract user agent
  if (req.headers?.["user-agent"]) {
    const userAgent = req.headers["user-agent"];
    context.userAgent = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  }

  // Extract user ID if available
  if (req.user && typeof req.user === "object" && "id" in req.user) {
    context.userId = String(req.user.id);
  }

  return context;
}

/**
 * Create a request-scoped logger from context
 * 
 * @param logger - Base logger instance
 * @param req - Express request object (or similar)
 * @returns Child logger with request context
 */
export function createRequestLogger(
  logger: Logger,
  req: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    user?: { id?: string };
    [key: string]: unknown;
  }
): Logger {
  const context = extractRequestContext(req);
  return createContextLogger(logger, context);
}


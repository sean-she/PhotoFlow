/**
 * Context-aware logging with request IDs
 * 
 * Provides utilities for managing request-scoped logging context
 * and generating unique request IDs for traceability.
 * 
 * Supports both Express request objects and Next.js NextRequest objects.
 */

import type { Logger } from "pino";
import type { NextRequest } from "next/server";

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
 * Generate random bytes using Web Crypto API (Edge Runtime compatible)
 * 
 * @param length - Number of bytes to generate
 * @returns Uint8Array of random bytes
 */
async function generateRandomBytes(length: number): Promise<Uint8Array> {
  // Use Web Crypto API which works in both Node.js and Edge Runtime
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }
  
  // Fallback for environments without Web Crypto API
  // This should not happen in modern runtimes
  throw new Error("Web Crypto API not available");
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(array: Uint8Array): string {
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a unique request ID
 * 
 * Uses Web Crypto API for Edge Runtime compatibility.
 * 
 * @param prefix - Optional prefix for the request ID
 * @returns Unique request ID string
 */
export function generateRequestId(prefix = "req"): string {
  // Use synchronous approach for Edge Runtime compatibility
  // Generate random bytes synchronously using crypto.getRandomValues
  const randomArray = new Uint8Array(8);
  
  // Web Crypto API is available in both Node.js and Edge Runtime
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomArray);
  } else {
    // Fallback: use Math.random (less secure but works everywhere)
    for (let i = 0; i < randomArray.length; i++) {
      randomArray[i] = Math.floor(Math.random() * 256);
    }
  }
  
  const randomPart = uint8ArrayToHex(randomArray);
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

/**
 * Extract request context from Next.js NextRequest object
 * 
 * Optimized for Next.js App Router route handlers.
 * 
 * @param request - Next.js NextRequest object
 * @returns Request context object
 * 
 * @example
 * ```typescript
 * import { extractNextRequestContext } from "@/lib/logging";
 * import type { NextRequest } from "next/server";
 * 
 * export async function GET(request: NextRequest) {
 *   const context = extractNextRequestContext(request);
 *   // Use context for logging
 * }
 * ```
 */
export function extractNextRequestContext(request: NextRequest): RequestContext {
  const context: RequestContext = {
    requestId: generateRequestId(),
  };

  // Extract IP address from NextRequest
  // NextRequest doesn't have ip property directly, extract from headers
  const ip = 
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  
  if (ip) {
    context.ip = ip;
  }

  // Extract user agent
  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    context.userAgent = userAgent;
  }

  // Extract user ID from cookies or headers if available
  // This assumes you store user ID in a cookie named 'userId' or similar
  const userId = request.cookies.get("userId")?.value ||
    request.headers.get("x-user-id") ||
    undefined;
  
  if (userId) {
    context.userId = userId;
  }

  return context;
}

/**
 * Create a request-scoped logger from Next.js NextRequest
 * 
 * Optimized for Next.js App Router route handlers.
 * 
 * @param logger - Base logger instance
 * @param request - Next.js NextRequest object
 * @returns Child logger with request context
 * 
 * @example
 * ```typescript
 * import { createRequestLoggerFromNextRequest } from "@/lib/logging";
 * import { getLogger } from "@/lib/logging";
 * import type { NextRequest } from "next/server";
 * 
 * export async function GET(request: NextRequest) {
 *   const logger = createRequestLoggerFromNextRequest(getLogger(), request);
 *   logger.info("Processing request");
 * }
 * ```
 */
export function createRequestLoggerFromNextRequest(
  logger: Logger,
  request: NextRequest
): Logger {
  const context = extractNextRequestContext(request);
  return createContextLogger(logger, context);
}


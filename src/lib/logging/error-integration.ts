/**
 * Error logging integration with error handling framework
 * 
 * Provides utilities for logging errors using the BaseError framework
 * with proper formatting and context preservation.
 */

import type { Logger } from "pino";
import { BaseError } from "../errors/base";
import { serializeErrorForLogging, shouldLogError } from "../errors/utils";

/**
 * Log an error with proper formatting
 * 
 * Automatically determines log level based on error type and severity.
 * Uses the error handling framework's serialization utilities.
 * 
 * @param logger - Logger instance
 * @param error - Error to log (BaseError or any error)
 * @param context - Additional context to include in the log
 */
export function logError(
  logger: Logger,
  error: unknown,
  context?: Record<string, unknown>
): void {
  // Check if error should be logged
  if (!shouldLogError(error)) {
    // Still log at debug level for operational errors
    const serialized = serializeErrorForLogging(error);
    logger.debug(
      {
        ...serialized,
        ...context,
      },
      `Operational error: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  // Serialize error for logging
  const serialized = serializeErrorForLogging(error);

  // Determine log level based on error
  const isBaseError = error instanceof BaseError;
  const statusCode = isBaseError ? error.statusCode : 500;

  // Log at appropriate level
  if (statusCode >= 500) {
    logger.error(
      {
        ...serialized,
        ...context,
      },
      `Server error: ${error instanceof Error ? error.message : String(error)}`
    );
  } else if (statusCode >= 400) {
    logger.warn(
      {
        ...serialized,
        ...context,
      },
      `Client error: ${error instanceof Error ? error.message : String(error)}`
    );
  } else {
    logger.info(
      {
        ...serialized,
        ...context,
      },
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Log an error at a specific level
 * 
 * @param logger - Logger instance
 * @param level - Log level (error, warn, info, debug)
 * @param error - Error to log
 * @param context - Additional context
 */
export function logErrorAtLevel(
  logger: Logger,
  level: "error" | "warn" | "info" | "debug",
  error: unknown,
  context?: Record<string, unknown>
): void {
  const serialized = serializeErrorForLogging(error);
  const message = error instanceof Error ? error.message : String(error);

  logger[level](
    {
      ...serialized,
      ...context,
    },
    message
  );
}

/**
 * Log error with request context
 * 
 * Combines error logging with request context for better traceability
 * 
 * @param logger - Logger instance (should be request-scoped)
 * @param error - Error to log
 * @param additionalContext - Additional context beyond request context
 */
export function logErrorWithContext(
  logger: Logger,
  error: unknown,
  additionalContext?: Record<string, unknown>
): void {
  logError(logger, error, additionalContext);
}

/**
 * Create an error logger helper
 * 
 * Returns a function that logs errors with consistent formatting
 * 
 * @param logger - Logger instance
 * @param defaultContext - Default context to include in all error logs
 * @returns Error logging function
 */
export function createErrorLogger(
  logger: Logger,
  defaultContext?: Record<string, unknown>
) {
  return (error: unknown, context?: Record<string, unknown>) => {
    logError(logger, error, { ...defaultContext, ...context });
  };
}


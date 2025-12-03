/**
 * Error handling utilities
 * 
 * Helper functions for error serialization, HTTP status code mapping,
 * and client-safe error message generation
 */

import { BaseError, HttpStatusCode } from "./base";
import { ValidationError } from "./validation";

/**
 * Check if an error is an instance of BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Convert any error to a BaseError
 * 
 * If the error is already a BaseError, returns it as-is.
 * Otherwise, wraps it in a BaseError with appropriate status code.
 */
export function toBaseError(error: unknown): BaseError {
  if (isBaseError(error)) {
    return error;
  }

  // Handle known error types
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.name === "ZodError") {
      // This should be handled by validation utilities, but just in case
      return new BaseError(
        "Validation failed",
        HttpStatusCode.UNPROCESSABLE_ENTITY,
        true,
        { originalError: error.message }
      );
    }

    // For other Error instances, wrap them
    return new BaseError(
      error.message || "An unexpected error occurred",
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      false, // Not operational - these are unexpected
      { originalError: error.name }
    );
  }

  // For unknown error types, create a generic error
  return new BaseError(
    "An unexpected error occurred",
    HttpStatusCode.INTERNAL_SERVER_ERROR,
    false,
    { originalError: String(error) }
  );
}

/**
 * Get HTTP status code from an error
 * 
 * Returns the status code from BaseError, or defaults to 500
 */
export function getErrorStatusCode(error: unknown): number {
  if (isBaseError(error)) {
    return error.statusCode;
  }

  // Handle common error patterns
  if (error instanceof Error) {
    if (error.name === "ZodError") {
      return HttpStatusCode.UNPROCESSABLE_ENTITY;
    }
  }

  return HttpStatusCode.INTERNAL_SERVER_ERROR;
}

/**
 * Serialize error for logging
 * 
 * Includes full details including stack trace
 */
export function serializeErrorForLogging(error: unknown): {
  name: string;
  message: string;
  statusCode: number;
  timestamp: string;
  context?: Record<string, unknown>;
  stack?: string;
} {
  const baseError = toBaseError(error);
  return baseError.toJSON(true, true);
}

/**
 * Serialize error for client response
 * 
 * Strips sensitive information based on environment
 */
export function serializeErrorForClient(
  error: unknown,
  includeDetails = false
): {
  name: string;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  context?: Record<string, unknown>;
} {
  const baseError = toBaseError(error);
  return baseError.toClientJSON(includeDetails);
}

/**
 * Check if error should be logged
 * 
 * Operational errors (expected errors) may not need logging,
 * while non-operational errors (unexpected) should always be logged
 */
export function shouldLogError(error: unknown): boolean {
  if (isBaseError(error)) {
    // Log non-operational errors (unexpected errors)
    // Operational errors (expected errors like validation) may be logged at a lower level
    return !error.isOperational;
  }

  // Unknown errors should always be logged
  return true;
}

/**
 * Get error message for client
 * 
 * Returns a safe message that can be shown to users
 */
export function getClientErrorMessage(error: unknown, includeDetails = false): string {
  if (isBaseError(error)) {
    return error.getClientMessage(includeDetails);
  }

  if (error instanceof Error) {
    // For non-BaseError instances, return generic message
    return "An unexpected error occurred";
  }

  return "An unexpected error occurred";
}


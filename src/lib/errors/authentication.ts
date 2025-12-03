/**
 * Authentication error classes
 * 
 * Errors related to authentication and authorization
 */

import { BaseError, HttpStatusCode } from "./base";

/**
 * Error thrown when authentication fails
 * 
 * Use this when:
 * - User provides invalid credentials
 * - Token is missing or invalid
 * - Session has expired
 */
export class AuthenticationError extends BaseError {
  constructor(
    message = "Authentication failed",
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.UNAUTHORIZED, true, context);
    this.name = "AuthenticationError";
  }
}

/**
 * Error thrown when user lacks permission to perform an action
 * 
 * Use this when:
 * - User is authenticated but not authorized
 * - User tries to access resource they don't own
 * - Insufficient permissions for the requested operation
 */
export class AuthorizationError extends BaseError {
  constructor(
    message = "You do not have permission to perform this action",
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.FORBIDDEN, true, context);
    this.name = "AuthorizationError";
  }
}

/**
 * Error thrown when a token is invalid or expired
 */
export class TokenError extends BaseError {
  constructor(
    message = "Invalid or expired token",
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.UNAUTHORIZED, true, context);
    this.name = "TokenError";
  }
}


/**
 * Error handling module exports
 * 
 * This module provides a comprehensive error handling framework with:
 * - Custom error classes (BaseError, ValidationError, etc.)
 * - Error utilities (serialization, status code mapping)
 * - Express/Next.js middleware for error handling
 */

// Base error class
export { BaseError, HttpStatusCode } from "./base";
export type { HttpStatusCode as HttpStatusCodeType } from "./base";

// Validation error
export { ValidationError } from "./validation";

// Authentication errors
export {
  AuthenticationError,
  AuthorizationError,
  TokenError,
} from "./authentication";

// Not found error
export { NotFoundError } from "./not-found";

// Conflict error
export { ConflictError } from "./conflict";

// Error utilities
export {
  isBaseError,
  isValidationError,
  toBaseError,
  getErrorStatusCode,
  serializeErrorForLogging,
  serializeErrorForClient,
  shouldLogError,
  getClientErrorMessage,
} from "./utils";

// Middleware
export {
  errorHandler,
  asyncHandler,
  handleApiError,
  withErrorHandling,
  handleRouteError,
  withRouteErrorHandling,
  type RouteContext,
} from "./middleware";


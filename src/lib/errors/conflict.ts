/**
 * Conflict error class
 * 
 * Error thrown when a request conflicts with the current state
 */

import { BaseError, HttpStatusCode } from "./base";

/**
 * Error thrown when a request conflicts with the current state
 * 
 * Use this when:
 * - Duplicate resource creation (e.g., email already exists)
 * - Resource is in a state that prevents the operation
 * - Concurrent modification conflicts
 */
export class ConflictError extends BaseError {
  constructor(
    message = "The request conflicts with the current state",
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.CONFLICT, true, context);
    this.name = "ConflictError";
  }
}


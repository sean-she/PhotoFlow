/**
 * Not found error class
 * 
 * Error thrown when a requested resource is not found
 */

import { BaseError, HttpStatusCode } from "./base";

/**
 * Error thrown when a requested resource cannot be found
 * 
 * Use this when:
 * - User requests a resource that doesn't exist
 * - ID doesn't match any record
 * - Route doesn't exist
 */
export class NotFoundError extends BaseError {
  constructor(
    resource: string,
    identifier?: string | number,
    context?: Record<string, unknown>
  ) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(message, HttpStatusCode.NOT_FOUND, true, {
      resource,
      identifier,
      ...context,
    });
    this.name = "NotFoundError";
  }
}


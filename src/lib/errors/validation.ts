/**
 * Validation error class
 * 
 * Extends BaseError for validation-specific errors with field-level error details
 */

import { BaseError, HttpStatusCode } from "./base";

/**
 * Validation error with field-level error messages
 * 
 * This error is thrown when input validation fails and provides
 * structured error information for each field that failed validation.
 */
export class ValidationError extends BaseError {
  /**
   * Field-specific error messages
   * Key is the field path (e.g., "email" or "user.profile.name")
   * Value is an array of error messages for that field
   */
  public readonly errors: Record<string, string[]>;

  constructor(
    errors: Record<string, string[]>,
    message = "Validation failed",
    context?: Record<string, unknown>
  ) {
    super(message, HttpStatusCode.UNPROCESSABLE_ENTITY, true, context);
    this.errors = errors;
    this.name = "ValidationError";
  }

  /**
   * Get first error message for a field
   */
  getFieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }

  /**
   * Check if a field has errors
   */
  hasFieldError(field: string): boolean {
    return field in this.errors && this.errors[field].length > 0;
  }

  /**
   * Get all error messages as a flat array
   */
  getAllErrors(): string[] {
    return Object.values(this.errors).flat();
  }

  /**
   * Override toJSON to include field errors
   */
  override toJSON(includeStack = false, includeContext = true): {
    name: string;
    message: string;
    statusCode: number;
    timestamp: string;
    errors: Record<string, string[]>;
    context?: Record<string, unknown>;
    stack?: string;
  } {
    const json = super.toJSON(includeStack, includeContext) as {
      name: string;
      message: string;
      statusCode: number;
      timestamp: string;
      errors: Record<string, string[]>;
      context?: Record<string, unknown>;
      stack?: string;
    };
    json.errors = this.errors;
    return json;
  }

  /**
   * Override toClientJSON to include field errors
   */
  override toClientJSON(includeDetails = false): {
    name: string;
    message: string;
    statusCode: number;
    errors: Record<string, string[]>;
    context?: Record<string, unknown>;
  } {
    const json = super.toClientJSON(includeDetails) as {
      name: string;
      message: string;
      statusCode: number;
      errors: Record<string, string[]>;
      context?: Record<string, unknown>;
    };
    json.errors = this.errors;
    return json;
  }
}


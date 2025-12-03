/**
 * Base error class for the application
 * 
 * Provides a foundation for all custom errors with consistent properties
 * and serialization capabilities.
 */

/**
 * HTTP status codes for common error scenarios
 */
export enum HttpStatusCode {
  // 4xx Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Base error class that all custom errors should extend
 * 
 * Provides:
 * - Consistent error structure
 * - HTTP status code mapping
 * - Error serialization
 * - Client-safe error messages
 * - Stack trace handling
 */
export abstract class BaseError extends Error {
  /**
   * HTTP status code for this error
   */
  public readonly statusCode: HttpStatusCode;

  /**
   * Whether this error is safe to expose to clients
   */
  public readonly isOperational: boolean;

  /**
   * Additional context/metadata for the error
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a client-safe error message
   * Strips sensitive information in production
   */
  getClientMessage(includeDetails = false): string {
    if (!this.isOperational) {
      return "An unexpected error occurred";
    }

    if (includeDetails && this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      return contextStr ? `${this.message} (${contextStr})` : this.message;
    }

    return this.message;
  }

  /**
   * Serialize error to a plain object
   * 
   * @param includeStack - Whether to include stack trace (default: false for production)
   * @param includeContext - Whether to include context (default: true)
   */
  toJSON(includeStack = false, includeContext = true): {
    name: string;
    message: string;
    statusCode: number;
    timestamp: string;
    context?: Record<string, unknown>;
    stack?: string;
  } {
    const json: {
      name: string;
      message: string;
      statusCode: number;
      timestamp: string;
      context?: Record<string, unknown>;
      stack?: string;
    } = {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
    };

    if (includeContext && this.context) {
      json.context = this.context;
    }

    if (includeStack && this.stack) {
      json.stack = this.stack;
    }

    return json;
  }

  /**
   * Serialize error for client response
   * Strips sensitive information based on environment
   */
  toClientJSON(includeDetails = false): {
    name: string;
    message: string;
    statusCode: number;
    context?: Record<string, unknown>;
  } {
    const json: {
      name: string;
      message: string;
      statusCode: number;
      context?: Record<string, unknown>;
    } = {
      name: this.name,
      message: this.getClientMessage(includeDetails),
      statusCode: this.statusCode,
    };

    if (includeDetails && this.context) {
      json.context = this.context;
    }

    return json;
  }
}


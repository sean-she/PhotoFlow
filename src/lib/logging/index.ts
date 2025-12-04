/**
 * Structured logging module with Pino v8
 * 
 * Provides comprehensive logging utilities including:
 * - Core logger setup with Pino v8
 * - Context-aware logging with request IDs
 * - Transport configuration (console, file, external)
 * - Performance timing utilities
 * - Error logging integration
 * - Express/Next.js middleware
 * 
 * @example
 * ```typescript
 * import { getLogger, createRequestLogger } from "@/lib/logging";
 * 
 * const logger = getLogger();
 * logger.info({ userId: "123" }, "User logged in");
 * 
 * // With request context
 * const requestLogger = createRequestLogger(logger, req);
 * requestLogger.info("Processing request");
 * ```
 */

// Core logger
export {
  createLogger,
  getLogger,
  resetLogger,
  setLogger,
  LogLevel,
  type LoggerConfig,
} from "./logger";

// Context-aware logging
export {
  createContextLogger,
  createRequestLogger,
  createRequestLoggerFromNextRequest,
  addContext,
  generateRequestId,
  extractRequestContext,
  extractNextRequestContext,
  type RequestContext,
} from "./context";

// Transport configuration
export {
  createLoggerWithTransports,
  createFileLogger,
  type TransportConfig,
  type FileTransportConfig,
  type ConsoleTransportConfig,
} from "./transports";

// Performance utilities
export {
  PerformanceTimer,
  timeOperation,
  timeOperationSync,
  logRequestResponse,
  createTimer,
} from "./performance";

// Error integration
export {
  logError,
  logErrorAtLevel,
  logErrorWithContext,
  createErrorLogger,
} from "./error-integration";

// Middleware
export {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  withLogging,
  asyncHandler,
  withRouteLogging,
  type RouteContext,
} from "./middleware";

// Re-export Pino types for convenience
export type { Logger } from "pino";


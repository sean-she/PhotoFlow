/**
 * Core logger setup with Pino v8
 * 
 * Provides a configured Pino logger instance with environment-based
 * configuration and consistent log format across the application.
 */

import pino from "pino";
import type { Logger } from "pino";

/**
 * Log levels supported by the application
 */
export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   * @default "info" in production, "debug" in development
   */
  level?: LogLevel | string;

  /**
   * Application name
   * @default "photoflow"
   */
  name?: string;

  /**
   * Environment (development, production, test)
   * @default process.env.NODE_ENV || "development"
   */
  env?: string;

  /**
   * Enable pretty printing (only in development)
   * @default true in development, false in production
   */
  pretty?: boolean;

  /**
   * Additional base fields to include in all logs
   */
  base?: Record<string, unknown>;
}

/**
 * Get the default log level based on environment
 */
function getDefaultLogLevel(env?: string): string {
  const nodeEnv = env || process.env.NODE_ENV || "development";
  
  if (nodeEnv === "production") {
    return LogLevel.INFO;
  }
  
  if (nodeEnv === "test") {
    return LogLevel.WARN;
  }
  
  return LogLevel.DEBUG;
}

/**
 * Create a Pino logger instance with configuration
 * 
 * @param config - Logger configuration options
 * @returns Configured Pino logger instance
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const env = config.env || process.env.NODE_ENV || "development";
  const level = config.level || getDefaultLogLevel(env);
  const name = config.name || "photoflow";
  const isDevelopment = env === "development";
  const isProduction = env === "production";

  // Base logger options
  const loggerOptions: pino.LoggerOptions = {
    name,
    level,
    base: {
      env,
      ...config.base,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    // In production, use JSON format
    // In development, pretty printing is handled by transport
    ...(isProduction && {
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
    }),
  };

  // Check if we're in Edge Runtime
  const isEdgeRuntime = 
    typeof (globalThis as any).EdgeRuntime !== "undefined" ||
    (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge");

  // In Edge Runtime, use simple logger without transports
  if (isEdgeRuntime) {
    // Edge Runtime doesn't support pino.transport
    // Use basic logger with pretty printing disabled (handled by formatters)
    return pino({
      ...loggerOptions,
      // In Edge Runtime, we can't use pino-pretty transport
      // So we use JSON format which works everywhere
      formatters: {
        ...loggerOptions.formatters,
      },
    });
  }

  // In development, use simple logger without transport to avoid worker thread issues
  // pino-pretty uses worker threads which don't work well in Next.js dev mode
  if (isDevelopment && (config.pretty !== false)) {
    // Use basic logger with JSON output in development
    // Next.js will handle pretty printing if needed
    // This avoids worker thread issues with pino-pretty transport
    return pino({
      ...loggerOptions,
      // Use simple JSON output that works reliably
      formatters: {
        ...loggerOptions.formatters,
      },
    });
  }

  // Production logger (JSON format)
  return pino(loggerOptions);
}

/**
 * Default logger instance
 * Created once and reused throughout the application
 */
let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance
 * 
 * @param config - Optional configuration (only used on first call)
 * @returns Default logger instance
 */
export function getLogger(config?: LoggerConfig): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger(config);
  }
  return defaultLogger;
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetLogger(): void {
  defaultLogger = null;
}

/**
 * Set the default logger instance
 * 
 * @param logger - Logger instance to use as default
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}


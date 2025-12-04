/**
 * Log transport configuration
 * 
 * Provides configuration for different log transports:
 * - Console (pretty printing in dev, JSON in prod)
 * - File (with rotation)
 * - External services (optional)
 */

import type { Logger } from "pino";
import pino from "pino";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

/**
 * File transport configuration
 */
export interface FileTransportConfig {
  /**
   * Directory where log files will be stored
   * @default "./logs"
   */
  directory?: string;

  /**
   * Log file name pattern
   * @default "app-%DATE%.log"
   */
  filename?: string;

  /**
   * Maximum file size before rotation (in bytes)
   * @default 10MB
   */
  maxSize?: string;

  /**
   * Maximum number of files to keep
   * @default 10
   */
  maxFiles?: number;

  /**
   * Log level for file transport
   * @default "info"
   */
  level?: string;
}

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig {
  /**
   * Enable pretty printing
   * @default true in development
   */
  pretty?: boolean;

  /**
   * Log level for console transport
   * @default "debug" in development, "info" in production
   */
  level?: string;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /**
   * Enable console transport
   * @default true
   */
  console?: boolean | ConsoleTransportConfig;

  /**
   * Enable file transport
   * @default false
   */
  file?: boolean | FileTransportConfig;

  /**
   * Environment
   * @default process.env.NODE_ENV || "development"
   */
  env?: string;
}

/**
 * Create file transport configuration
 */
function createFileTransport(config: FileTransportConfig): pino.TransportTargetOptions {
  const directory = config.directory || "./logs";
  const filename = config.filename || "app-%DATE%.log";
  const maxSize = config.maxSize || "10M";
  const maxFiles = config.maxFiles || 10;
  const level = config.level || "info";

  // Ensure log directory exists
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const filePath = join(directory, filename);

  return {
    target: "pino-roll",
    options: {
      file: filePath,
      frequency: "daily",
      size: maxSize,
      limit: maxFiles,
    },
    level,
  };
}

/**
 * Create console transport configuration
 */
function createConsoleTransport(
  config: ConsoleTransportConfig,
  env?: string
): pino.TransportTargetOptions {
  const isDevelopment = (env || process.env.NODE_ENV) === "development";
  const pretty = config.pretty !== undefined ? config.pretty : isDevelopment;
  const level = config.level || (isDevelopment ? "debug" : "info");

  if (pretty) {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
      },
      level,
    };
  }

  // JSON console output
  return {
    target: "pino/file",
    options: {
      destination: 1, // stdout
    },
    level,
  };
}

/**
 * Create a logger with multiple transports
 * 
 * @param config - Transport configuration
 * @returns Configured Pino logger instance
 */
export function createLoggerWithTransports(config: TransportConfig = {}): Logger {
  const env = config.env || process.env.NODE_ENV || "development";
  const transports: pino.TransportTargetOptions[] = [];

  // Console transport
  if (config.console !== false) {
    const consoleConfig = typeof config.console === "object" ? config.console : {};
    transports.push(createConsoleTransport(consoleConfig, env));
  }

  // File transport
  if (config.file) {
    const fileConfig = typeof config.file === "object" ? config.file : {};
    transports.push(createFileTransport(fileConfig));
  }

  // If no transports, use default console
  if (transports.length === 0) {
    transports.push(createConsoleTransport({}, env));
  }

  // Create logger with transports
  return pino(
    {
      name: "photoflow",
      level: "trace", // Set to trace to allow transports to filter
      base: {
        env,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport({
      targets: transports,
    })
  );
}

/**
 * Create a file-only logger (useful for background jobs)
 * 
 * @param config - File transport configuration
 * @returns Logger instance writing only to file
 */
export function createFileLogger(config: FileTransportConfig = {}): Logger {
  const transport = createFileTransport(config);
  
  return pino(
    {
      name: "photoflow",
      level: config.level || "info",
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport({
      targets: [transport],
    })
  );
}


#!/usr/bin/env tsx
/**
 * Test script for logging utilities
 * 
 * Tests Pino-based logging system including logger setup, context management,
 * performance timing, error integration, and middleware functionality.
 * 
 * Usage:
 *   tsx scripts/test-logging.ts
 * 
 * Tests all logging features including log levels, context propagation,
 * performance timing, error logging, and transport configuration.
 */

import {
  createLogger,
  getLogger,
  resetLogger,
  setLogger,
  LogLevel,
  createContextLogger,
  createRequestLogger,
  generateRequestId,
  extractRequestContext,
  addContext,
  timeOperation,
  timeOperationSync,
  createTimer,
  logError,
  logErrorAtLevel,
  createErrorLogger,
  PerformanceTimer,
  type Logger,
} from "../src/lib/logging";
import { BaseError, HttpStatusCode } from "../src/lib/errors/base";
import { ValidationError } from "../src/lib/errors/validation";

/**
 * Test class for BaseError (since BaseError is abstract)
 */
class TestBaseError extends BaseError {
  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, isOperational, context);
  }
}

/**
 * Test 1: Basic logger creation and configuration
 */
function test1BasicLoggerCreation(): boolean {
  console.log("\n📋 Test 1: Basic Logger Creation");
  console.log("─".repeat(50));

  try {
    // Reset logger to ensure clean state
    resetLogger();

    // Create logger with default config
    const logger1 = createLogger();
    if (!logger1) {
      console.error("❌ Failed to create logger");
      return false;
    }

    // Create logger with custom config
    const logger2 = createLogger({
      level: LogLevel.DEBUG,
      name: "test-logger",
      env: "test",
    });
    if (!logger2) {
      console.error("❌ Failed to create logger with custom config");
      return false;
    }

    // Test getLogger (should create default)
    const defaultLogger = getLogger();
    if (!defaultLogger) {
      console.error("❌ Failed to get default logger");
      return false;
    }

    // Test setLogger
    const customLogger = createLogger({ name: "custom" });
    setLogger(customLogger);
    const retrievedLogger = getLogger();
    if (retrievedLogger !== customLogger) {
      console.error("❌ setLogger/getLogger mismatch");
      return false;
    }

    console.log("✅ Basic logger creation works correctly");
    return true;
  } catch (error) {
    console.error("❌ Basic logger creation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: Log levels and output
 */
function test2LogLevels(): boolean {
  console.log("\n📋 Test 2: Log Levels");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Test all log levels (should not throw)
    logger.trace("Trace message");
    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");
    logger.fatal("Fatal message");

    // Test with context
    logger.info({ userId: "123", action: "login" }, "User logged in");

    console.log("✅ Log levels work correctly");
    return true;
  } catch (error) {
    console.error("❌ Log levels test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 3: Request ID generation
 */
function test3RequestIdGeneration(): boolean {
  console.log("\n📋 Test 3: Request ID Generation");
  console.log("─".repeat(50));

  try {
    // Generate multiple request IDs
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    const id3 = generateRequestId("custom");

    // Check format
    if (!id1.startsWith("req-")) {
      console.error(`❌ Request ID format incorrect: ${id1}`);
      return false;
    }

    if (!id3.startsWith("custom-")) {
      console.error(`❌ Custom prefix not applied: ${id3}`);
      return false;
    }

    // Check uniqueness
    if (id1 === id2) {
      console.error("❌ Request IDs should be unique");
      return false;
    }

    console.log(`✅ Request ID generation works (sample: ${id1.substring(0, 20)}...)`);
    return true;
  } catch (error) {
    console.error("❌ Request ID generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: Context-aware logging
 */
function test4ContextAwareLogging(): boolean {
  console.log("\n📋 Test 4: Context-Aware Logging");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const baseLogger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Create context logger
    const contextLogger = createContextLogger(baseLogger, {
      requestId: "test-req-123",
      userId: "user-456",
    });

    // Create child logger with additional context
    const childLogger = addContext(contextLogger, { operation: "test" });

    // Test that context is preserved (logs should include context)
    contextLogger.info("Message with context");
    childLogger.info("Message with extended context");

    console.log("✅ Context-aware logging works correctly");
    return true;
  } catch (error) {
    console.error("❌ Context-aware logging failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: Request context extraction
 */
function test5RequestContextExtraction(): boolean {
  console.log("\n📋 Test 5: Request Context Extraction");
  console.log("─".repeat(50));

  try {
    // Mock request object
    const mockReq = {
      ip: "192.168.1.1",
      headers: {
        "user-agent": "test-agent",
        "x-forwarded-for": "10.0.0.1",
      },
      user: {
        id: "user-123",
      },
    };

    const context = extractRequestContext(mockReq);

    if (!context.requestId) {
      console.error("❌ Request ID not generated");
      return false;
    }

    if (context.ip !== "192.168.1.1") {
      console.error(`❌ IP not extracted correctly: ${context.ip}`);
      return false;
    }

    if (context.userAgent !== "test-agent") {
      console.error(`❌ User agent not extracted correctly: ${context.userAgent}`);
      return false;
    }

    if (context.userId !== "user-123") {
      console.error(`❌ User ID not extracted correctly: ${context.userId}`);
      return false;
    }

    // Test with forwarded IP
    const mockReq2 = {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    };
    const context2 = extractRequestContext(mockReq2);
    if (context2.ip !== "10.0.0.1") {
      console.error(`❌ Forwarded IP not extracted: ${context2.ip}`);
      return false;
    }

    console.log("✅ Request context extraction works correctly");
    return true;
  } catch (error) {
    console.error("❌ Request context extraction failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: Performance timing - async operations
 */
async function test6PerformanceTimingAsync(): Promise<boolean> {
  console.log("\n📋 Test 6: Performance Timing (Async)");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Test async operation timing
    const result = await timeOperation(
      logger,
      "testOperation",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true };
      },
      { testId: "123" }
    );

    if (!result.success) {
      console.error("❌ Operation result incorrect");
      return false;
    }

    // Test error handling
    let errorCaught = false;
    try {
      await timeOperation(
        logger,
        "failingOperation",
        async () => {
          throw new Error("Test error");
        }
      );
    } catch (error) {
      errorCaught = true;
    }

    if (!errorCaught) {
      console.error("❌ Error not propagated");
      return false;
    }

    console.log("✅ Performance timing (async) works correctly");
    return true;
  } catch (error) {
    console.error("❌ Performance timing (async) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 7: Performance timing - sync operations
 */
function test7PerformanceTimingSync(): boolean {
  console.log("\n📋 Test 7: Performance Timing (Sync)");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Test sync operation timing
    const result = timeOperationSync(
      logger,
      "testSyncOperation",
      () => {
        return { value: 42 };
      },
      { testId: "456" }
    );

    if (result.value !== 42) {
      console.error("❌ Operation result incorrect");
      return false;
    }

    // Test error handling
    let errorCaught = false;
    try {
      timeOperationSync(
        logger,
        "failingSyncOperation",
        () => {
          throw new Error("Test error");
        }
      );
    } catch (error) {
      errorCaught = true;
    }

    if (!errorCaught) {
      console.error("❌ Error not propagated");
      return false;
    }

    console.log("✅ Performance timing (sync) works correctly");
    return true;
  } catch (error) {
    console.error("❌ Performance timing (sync) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 8: Performance timer class
 */
function test8PerformanceTimerClass(): boolean {
  console.log("\n📋 Test 8: Performance Timer Class");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Create timer
    const timer = createTimer(logger, "testTimer", { testId: "789" });

    // Check elapsed time
    const elapsed1 = timer.elapsed();
    if (elapsed1 < 0) {
      console.error("❌ Elapsed time should be non-negative");
      return false;
    }

    // Wait a bit
    const start = Date.now();
    while (Date.now() - start < 5) {
      // Busy wait
    }

    const elapsed2 = timer.elapsed();
    if (elapsed2 <= elapsed1) {
      console.error("❌ Elapsed time should increase");
      return false;
    }

    // End timer
    const duration = timer.end({ success: true });
    if (duration < 0) {
      console.error("❌ Duration should be non-negative");
      return false;
    }

    console.log("✅ Performance timer class works correctly");
    return true;
  } catch (error) {
    console.error("❌ Performance timer class failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 9: Error logging - BaseError
 */
function test9ErrorLoggingBaseError(): boolean {
  console.log("\n📋 Test 9: Error Logging (BaseError)");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Test with BaseError (using TestBaseError since BaseError is abstract)
    const baseError = new TestBaseError(
      "Test error",
      HttpStatusCode.BAD_REQUEST,
      true,
      { field: "test" }
    );

    // Should not throw
    logError(logger, baseError, { operation: "test" });

    // Test with ValidationError
    const validationError = new ValidationError({
      email: ["Invalid email format"],
    }, "Validation failed");
    logError(logger, validationError);

    console.log("✅ Error logging (BaseError) works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error logging (BaseError) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 10: Error logging - standard Error
 */
function test10ErrorLoggingStandardError(): boolean {
  console.log("\n📋 Test 10: Error Logging (Standard Error)");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Test with standard Error
    const standardError = new Error("Standard error message");
    logError(logger, standardError, { operation: "test" });

    // Test with string
    logError(logger, "String error", { operation: "test" });

    // Test with unknown type
    logError(logger, { custom: "error" }, { operation: "test" });

    console.log("✅ Error logging (standard Error) works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error logging (standard Error) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 11: Error logging at specific level
 */
function test11ErrorLoggingAtLevel(): boolean {
  console.log("\n📋 Test 11: Error Logging at Specific Level");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    const error = new Error("Test error");

    // Test all levels
    logErrorAtLevel(logger, "error", error);
    logErrorAtLevel(logger, "warn", error);
    logErrorAtLevel(logger, "info", error);
    logErrorAtLevel(logger, "debug", error);

    console.log("✅ Error logging at specific level works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error logging at specific level failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 12: Error logger helper
 */
function test12ErrorLoggerHelper(): boolean {
  console.log("\n📋 Test 12: Error Logger Helper");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const logger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Create error logger with default context
    const errorLogger = createErrorLogger(logger, { module: "test" });

    // Use error logger
    const error = new Error("Test error");
    errorLogger(error, { operation: "test" });

    console.log("✅ Error logger helper works correctly");
    return true;
  } catch (error) {
    console.error("❌ Error logger helper failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 13: Request logger creation
 */
function test13RequestLoggerCreation(): boolean {
  console.log("\n📋 Test 13: Request Logger Creation");
  console.log("─".repeat(50));

  try {
    resetLogger();
    const baseLogger = createLogger({ level: LogLevel.DEBUG, env: "test" });

    // Mock request
    const mockReq = {
      ip: "192.168.1.1",
      headers: {
        "user-agent": "test-agent",
      },
      user: {
        id: "user-123",
      },
    };

    // Create request logger
    const requestLogger = createRequestLogger(baseLogger, mockReq);

    // Test logging with request context
    requestLogger.info("Request processed");

    console.log("✅ Request logger creation works correctly");
    return true;
  } catch (error) {
    console.error("❌ Request logger creation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 14: Environment-based configuration
 */
function test14EnvironmentConfiguration(): boolean {
  console.log("\n📋 Test 14: Environment-Based Configuration");
  console.log("─".repeat(50));

  try {
    // Test development config
    const devLogger = createLogger({ env: "development" });
    if (!devLogger) {
      console.error("❌ Failed to create dev logger");
      return false;
    }

    // Test production config
    const prodLogger = createLogger({ env: "production" });
    if (!prodLogger) {
      console.error("❌ Failed to create prod logger");
      return false;
    }

    // Test test config
    const testLogger = createLogger({ env: "test" });
    if (!testLogger) {
      console.error("❌ Failed to create test logger");
      return false;
    }

    console.log("✅ Environment-based configuration works correctly");
    return true;
  } catch (error) {
    console.error("❌ Environment-based configuration failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 15: Logger reset functionality
 */
function test15LoggerReset(): boolean {
  console.log("\n📋 Test 15: Logger Reset Functionality");
  console.log("─".repeat(50));

  try {
    // Get initial logger
    const logger1 = getLogger();

    // Reset
    resetLogger();

    // Get new logger
    const logger2 = getLogger();

    // They should be different instances
    if (logger1 === logger2) {
      console.error("❌ Logger reset did not create new instance");
      return false;
    }

    // Set custom logger
    const customLogger = createLogger({ name: "custom" });
    setLogger(customLogger);

    // Get logger should return custom
    const retrieved = getLogger();
    if (retrieved !== customLogger) {
      console.error("❌ setLogger did not work correctly");
      return false;
    }

    console.log("✅ Logger reset functionality works correctly");
    return true;
  } catch (error) {
    console.error("❌ Logger reset functionality failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Logging Module Test Suite");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({ name: "Test 1: Basic Logger Creation", passed: test1BasicLoggerCreation() });
  results.push({ name: "Test 2: Log Levels", passed: test2LogLevels() });
  results.push({ name: "Test 3: Request ID Generation", passed: test3RequestIdGeneration() });
  results.push({ name: "Test 4: Context-Aware Logging", passed: test4ContextAwareLogging() });
  results.push({ name: "Test 5: Request Context Extraction", passed: test5RequestContextExtraction() });
  results.push({ name: "Test 6: Performance Timing (Async)", passed: await test6PerformanceTimingAsync() });
  results.push({ name: "Test 7: Performance Timing (Sync)", passed: test7PerformanceTimingSync() });
  results.push({ name: "Test 8: Performance Timer Class", passed: test8PerformanceTimerClass() });
  results.push({ name: "Test 9: Error Logging (BaseError)", passed: test9ErrorLoggingBaseError() });
  results.push({ name: "Test 10: Error Logging (Standard Error)", passed: test10ErrorLoggingStandardError() });
  results.push({ name: "Test 11: Error Logging at Specific Level", passed: test11ErrorLoggingAtLevel() });
  results.push({ name: "Test 12: Error Logger Helper", passed: test12ErrorLoggerHelper() });
  results.push({ name: "Test 13: Request Logger Creation", passed: test13RequestLoggerCreation() });
  results.push({ name: "Test 14: Environment-Based Configuration", passed: test14EnvironmentConfiguration() });
  results.push({ name: "Test 15: Logger Reset Functionality", passed: test15LoggerReset() });

  // Cleanup
  console.log("\n🧹 Cleanup");
  console.log("─".repeat(50));
  resetLogger();
  console.log("✅ Cleanup completed");

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
  });

  console.log("\n" + "─".repeat(50));
  console.log(`Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Please review the errors above.");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});


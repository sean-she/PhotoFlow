# Logging Module

Comprehensive structured logging system using Pino v8 with context-aware logging, performance tracking, and error integration.

## Features

- **Structured Logging**: JSON-formatted logs in production, pretty-printed in development
- **Context-Aware**: Request ID tracking and context propagation
- **Multiple Transports**: Console, file (with rotation), and external services
- **Performance Tracking**: Built-in timing utilities for operations
- **Error Integration**: Seamless integration with the error handling framework
- **Express/Next.js Middleware**: Ready-to-use middleware for request/response logging

## Quick Start

### Basic Usage

```typescript
import { getLogger } from "@/lib/logging";

const logger = getLogger();
logger.info("Application started");
logger.info({ userId: "123" }, "User logged in");
logger.error({ error: err }, "Operation failed");
```

### Request-Scoped Logging

```typescript
import { createRequestLogger } from "@/lib/logging";
import { getLogger } from "@/lib/logging";

const logger = getLogger();

// In Express middleware
app.use((req, res, next) => {
  const requestLogger = createRequestLogger(logger, req);
  req.logger = requestLogger; // Attach to request
  next();
});

// In route handler
app.get("/api/users", (req, res) => {
  const logger = req.logger; // Request-scoped logger with request ID
  logger.info("Fetching users");
});
```

### Performance Timing

```typescript
import { timeOperation, createTimer } from "@/lib/logging";
import { getLogger } from "@/lib/logging";

const logger = getLogger();

// Time an async operation
const result = await timeOperation(
  logger,
  "fetchUsers",
  async () => {
    return await db.users.findMany();
  },
  { userId: "123" }
);

// Manual timing
const timer = createTimer(logger, "processImage", { imageId: "456" });
// ... do work ...
timer.end({ success: true });
```

### Error Logging

```typescript
import { logError } from "@/lib/logging";
import { getLogger } from "@/lib/logging";
import { ValidationError } from "@/lib/errors";

const logger = getLogger();

try {
  // ... operation ...
} catch (error) {
  logError(logger, error, { operation: "createUser" });
  throw error;
}
```

### Express Middleware

```typescript
import {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
} from "@/lib/logging";

// Request/response logging
app.use(requestLoggingMiddleware());

// Error logging (use after routes, before error handler)
app.use(errorLoggingMiddleware());
```

### File Logging with Rotation

```typescript
import { createLoggerWithTransports } from "@/lib/logging";

const logger = createLoggerWithTransports({
  console: true, // Console output
  file: {
    directory: "./logs",
    filename: "app-%DATE%.log",
    maxSize: "10M",
    maxFiles: 10,
    level: "info",
  },
});
```

## Configuration

### Environment Variables

- `NODE_ENV`: Environment (development, production, test)
  - Development: Pretty console output, debug level
  - Production: JSON console output, info level
  - Test: Warn level

### Log Levels

- `trace`: Very detailed debugging
- `debug`: Debugging information
- `info`: General information (default in production)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal errors

## API Reference

### Core Logger

- `getLogger(config?)`: Get or create default logger
- `createLogger(config)`: Create a new logger instance
- `resetLogger()`: Reset default logger (useful for testing)

### Context Management

- `createRequestLogger(logger, req)`: Create request-scoped logger
- `createContextLogger(logger, context)`: Create child logger with context
- `generateRequestId(prefix?)`: Generate unique request ID
- `extractRequestContext(req)`: Extract context from request object

### Performance

- `timeOperation(logger, operation, fn, context?)`: Time async operation
- `timeOperationSync(logger, operation, fn, context?)`: Time sync operation
- `createTimer(logger, operation, context?)`: Create performance timer
- `logRequestResponse(logger, req, res, startTime)`: Log HTTP request/response

### Error Integration

- `logError(logger, error, context?)`: Log error with proper formatting
- `logErrorAtLevel(logger, level, error, context?)`: Log error at specific level
- `createErrorLogger(logger, defaultContext?)`: Create error logger helper

### Middleware

- `requestLoggingMiddleware(logger?)`: Express request logging middleware
- `errorLoggingMiddleware(logger?)`: Express error logging middleware
- `withLogging(handler, logger?)`: Next.js API route wrapper
- `asyncHandler(handler, logger?)`: Async Express handler wrapper

## Integration with Error Handling

The logging module integrates seamlessly with the error handling framework:

- Automatically uses `serializeErrorForLogging()` for error formatting
- Respects `shouldLogError()` to determine if errors should be logged
- Logs operational errors at debug level, non-operational at error level
- Includes full error context and stack traces in development

## Best Practices

1. **Use request-scoped loggers** in route handlers for traceability
2. **Include relevant context** in log messages (userId, operation, etc.)
3. **Use appropriate log levels** (info for normal operations, error for failures)
4. **Time expensive operations** using performance utilities
5. **Log errors with context** using `logError()` for proper formatting
6. **Use file transport in production** for log persistence and rotation

## Examples

See the test script (`scripts/test-logging.ts`) for comprehensive examples of all features.


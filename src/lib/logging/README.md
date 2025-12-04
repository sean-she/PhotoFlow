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

## Next.js App Router (Recommended)

### Route Handler Logging

Use `withRouteLogging` to automatically log requests and responses:

```typescript
// app/api/users/route.ts
import { withRouteLogging } from "@/lib/logging";
import type { NextRequest, NextResponse } from "next/server";

export const GET = withRouteLogging(
  async (request: NextRequest): Promise<NextResponse> => {
    const users = await getUsers();
    return NextResponse.json(users);
  }
);
```

### Combining Logging and Error Handling

Combine `withRouteLogging` and `withRouteErrorHandling`:

```typescript
// app/api/users/route.ts
import { withRouteLogging } from "@/lib/logging";
import { withRouteErrorHandling } from "@/lib/errors";
import type { NextRequest, NextResponse } from "next/server";

const handler = async (request: NextRequest): Promise<NextResponse> => {
  const users = await getUsers();
  return NextResponse.json(users);
};

export const GET = withRouteErrorHandling(withRouteLogging(handler));
```

### NextRequest Context Extraction

Extract context from NextRequest objects:

```typescript
import { extractNextRequestContext, createRequestLoggerFromNextRequest } from "@/lib/logging";
import { getLogger } from "@/lib/logging";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const context = extractNextRequestContext(request);
  const logger = createRequestLoggerFromNextRequest(getLogger(), request);
  
  logger.info({ userId: context.userId }, "Processing request");
  // ...
}
```

### Next.js Middleware

Use logging in Next.js middleware (`src/middleware.ts`):

```typescript
import { getLogger, createRequestLoggerFromNextRequest } from "@/lib/logging";
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const logger = createRequestLoggerFromNextRequest(getLogger(), request);
  logger.info({ pathname: new URL(request.url).pathname }, "Middleware processing");
  
  // Your middleware logic
  return NextResponse.next();
}
```

## Express Middleware (Legacy)

> **Note**: These utilities are for Express.js compatibility only. For Next.js App Router, use the App Router utilities above.

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

- `createRequestLogger(logger, req)`: Create request-scoped logger (generic request)
- `createRequestLoggerFromNextRequest(logger, request)`: Create request-scoped logger from NextRequest
- `createContextLogger(logger, context)`: Create child logger with context
- `generateRequestId(prefix?)`: Generate unique request ID
- `extractRequestContext(req)`: Extract context from generic request object
- `extractNextRequestContext(request)`: Extract context from NextRequest (optimized)

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

- `requestLoggingMiddleware(logger?)`: Express request logging middleware (legacy)
- `errorLoggingMiddleware(logger?)`: Express error logging middleware (legacy)
- `withLogging(handler, logger?)`: Next.js Pages Router API route wrapper (legacy)
- `asyncHandler(handler, logger?)`: Async Express handler wrapper (legacy)
- `withRouteLogging(handler, logger?)`: Next.js App Router route handler wrapper (recommended)

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


# Error Handling Framework

A comprehensive error handling framework for the PhotoFlow application, providing standardized error classes, utilities, and middleware for Next.js API routes.

## Features

- **Custom Error Classes**: Hierarchy of error classes extending `BaseError`
- **HTTP Status Code Mapping**: Automatic status code assignment
- **Error Serialization**: JSON serialization for logging and client responses
- **Client-Safe Messages**: Automatic sanitization of sensitive information
- **Next.js Middleware**: Ready-to-use error handling for Next.js API routes
- **Type Safety**: Full TypeScript support with type inference

## Error Classes

### BaseError

The base class for all custom errors. Provides:
- HTTP status code mapping
- Error serialization (`toJSON()`, `toClientJSON()`)
- Client-safe message generation
- Context/metadata support
- Timestamp tracking

```typescript
import { BaseError, HttpStatusCode } from "@/lib/errors";

class CustomError extends BaseError {
  constructor(message: string) {
    super(message, HttpStatusCode.BAD_REQUEST, true, { field: "value" });
  }
}
```

### ValidationError

Error for input validation failures with field-level error messages.

```typescript
import { ValidationError } from "@/lib/errors";

const error = new ValidationError({
  email: ["Email is required", "Email must be valid"],
  password: ["Password must be at least 8 characters"],
});

// Access field errors
error.getFieldError("email"); // "Email is required"
error.hasFieldError("password"); // true
error.getAllErrors(); // ["Email is required", "Email must be valid", ...]
```

### AuthenticationError

Error for authentication failures (401).

```typescript
import { AuthenticationError } from "@/lib/errors";

throw new AuthenticationError("Invalid credentials");
```

### AuthorizationError

Error for authorization failures (403).

```typescript
import { AuthorizationError } from "@/lib/errors";

throw new AuthorizationError("You do not have permission");
```

### TokenError

Error for invalid or expired tokens (401).

```typescript
import { TokenError } from "@/lib/errors";

throw new TokenError("Token expired");
```

### NotFoundError

Error for missing resources (404).

```typescript
import { NotFoundError } from "@/lib/errors";

throw new NotFoundError("User", "123");
// Message: "User with identifier '123' not found"
```

### ConflictError

Error for resource conflicts (409).

```typescript
import { ConflictError } from "@/lib/errors";

throw new ConflictError("Email already exists");
```

## Error Utilities

### Type Checking

```typescript
import { isBaseError, isValidationError } from "@/lib/errors";

if (isBaseError(error)) {
  // error is BaseError
  console.log(error.statusCode);
}

if (isValidationError(error)) {
  // error is ValidationError
  console.log(error.errors);
}
```

### Error Conversion

```typescript
import { toBaseError } from "@/lib/errors";

// Converts any error to BaseError
const baseError = toBaseError(unknownError);
```

### Status Code Extraction

```typescript
import { getErrorStatusCode } from "@/lib/errors";

const statusCode = getErrorStatusCode(error); // 400, 404, 500, etc.
```

### Error Serialization

```typescript
import {
  serializeErrorForLogging,
  serializeErrorForClient,
} from "@/lib/errors";

// For logging (includes stack trace)
const logData = serializeErrorForLogging(error);

// For client responses (sanitized)
const clientData = serializeErrorForClient(error, includeDetails);
```

### Client-Safe Messages

```typescript
import { getClientErrorMessage } from "@/lib/errors";

const message = getClientErrorMessage(error, includeDetails);
// Returns sanitized message for non-operational errors
```

### Logging Decision

```typescript
import { shouldLogError } from "@/lib/errors";

if (shouldLogError(error)) {
  // Log non-operational errors (unexpected)
  logger.error(error);
}
```



## Next.js API Routes

### Error Handler

Use in Next.js API routes:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiError } from "@/lib/errors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Your API logic
  } catch (error) {
    handleApiError(error, req, res);
  }
}
```

### Error Handler Wrapper

Wrap your handler function:

```typescript
import { withErrorHandling } from "@/lib/errors";
import type { NextApiRequest, NextApiResponse } from "next";

export default withErrorHandling(
  async (req: NextApiRequest, res: NextApiResponse) => {
    // Your API logic - errors are automatically handled
    const data = await fetchData();
    res.json(data);
  }
);
```

## Integration with Validation

The error handling framework integrates seamlessly with the validation module:

```typescript
import { validate, ValidationError } from "@/lib/validation";
import { isValidationError } from "@/lib/errors";

try {
  const data = validate(schema, input);
} catch (error) {
  if (isValidationError(error)) {
    // Handle validation errors
    console.log(error.errors);
  }
}
```

## Environment Configuration

Error handling behavior changes based on environment:

- **Development**: Includes stack traces and full error details
- **Production**: Strips sensitive information, generic messages for non-operational errors

Set `NODE_ENV` to control behavior:
- `development` - Full error details
- `production` - Sanitized errors

## HTTP Status Codes

The framework includes an `HttpStatusCode` enum with common status codes:

```typescript
import { HttpStatusCode } from "@/lib/errors";

HttpStatusCode.BAD_REQUEST; // 400
HttpStatusCode.UNAUTHORIZED; // 401
HttpStatusCode.FORBIDDEN; // 403
HttpStatusCode.NOT_FOUND; // 404
HttpStatusCode.CONFLICT; // 409
HttpStatusCode.UNPROCESSABLE_ENTITY; // 422
HttpStatusCode.INTERNAL_SERVER_ERROR; // 500
```

## Best Practices

1. **Use appropriate error types** - Choose the right error class for each scenario
2. **Include context** - Add relevant context to errors for better debugging
3. **Handle errors at boundaries** - Catch and convert errors at API boundaries
4. **Log non-operational errors** - Use `shouldLogError()` to decide what to log
5. **Sanitize for clients** - Always use `serializeErrorForClient()` for responses
6. **Extend BaseError** - Create custom errors by extending `BaseError`

## Testing

Run the error handling tests:

```bash
npm run test:errors
```

Tests cover:
- All error classes
- Error utilities
- Serialization
- Middleware functionality
- Error inheritance and polymorphism


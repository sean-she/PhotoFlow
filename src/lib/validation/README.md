# Validation Module

TypeScript-first validation utilities using Zod v3 for type-safe schema validation across the application.

## Overview

This module provides:
- **Validation schemas** for all major data types (users, albums, photos, clients)
- **Helper functions** for custom error messages and validation pipelines
- **Type-safe validation** with automatic TypeScript type inference
- **Error formatting** utilities for consistent error handling

## Installation

Zod is already installed as a dependency. Import validation utilities from:

```typescript
import { validate, validateBody, validateQuery } from "@/lib/validation";
import { createAlbumSchema, loginUserSchema } from "@/lib/validation";
```

## Usage Examples

### Basic Validation

```typescript
import { validate, loginUserSchema } from "@/lib/validation";

// Validate user login input
try {
  const loginData = validate(loginUserSchema, {
    email: "user@example.com",
    password: "securePassword123",
  });
  // loginData is typed as { email: string; password: string }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.errors); // { email: ["..."], password: ["..."] }
  }
}
```

### Safe Validation (No Exceptions)

```typescript
import { safeValidate, createAlbumSchema } from "@/lib/validation";

const result = safeValidate(createAlbumSchema, {
  title: "My Album",
  description: "A great album",
});

if (result.success) {
  // result.data is typed and validated
  console.log(result.data.title);
} else {
  // result.error contains ValidationError
  console.error(result.error.errors);
}
```

### Request Validation (Express/Next.js)

```typescript
import { validateBody, validateQuery, validateParams } from "@/lib/validation";
import { createAlbumSchema, albumIdSchema, albumQuerySchema } from "@/lib/validation";

// Validate request body
app.post("/api/albums", (req, res) => {
  try {
    const data = validateBody(createAlbumSchema, req.body);
    // Use validated data...
  } catch (error) {
    // Handle validation error
  }
});

// Validate query parameters
app.get("/api/albums", (req, res) => {
  try {
    const query = validateQuery(albumQuerySchema, req.query);
    // Use validated query...
  } catch (error) {
    // Handle validation error
  }
});

// Validate route parameters
app.get("/api/albums/:id", (req, res) => {
  try {
    const { id } = validateParams(albumIdSchema, req.params);
    // Use validated id...
  } catch (error) {
    // Handle validation error
  }
});
```

### Custom Error Messages

```typescript
import { withCustomMessages, registerUserSchema } from "@/lib/validation";

const customSchema = withCustomMessages(registerUserSchema, {
  email: "Please provide a valid email address",
  password: "Password must be at least 8 characters with uppercase, lowercase, and number",
});
```

### Validation Pipeline

```typescript
import { createValidationPipeline } from "@/lib/validation";
import { z } from "zod";

const baseSchema = z.object({ name: z.string() });
const transformSchema = z.object({ name: z.string().toUpperCase() });

const pipeline = createValidationPipeline(baseSchema, transformSchema);
```

## Available Schemas

### User Schemas
- `registerUserSchema` - User registration
- `loginUserSchema` - User login
- `updateUserProfileSchema` - Profile updates
- `changePasswordSchema` - Password changes
- `passwordSchema` - Password validation rules

### Album Schemas
- `createAlbumSchema` - Album creation
- `updateAlbumSchema` - Album updates
- `albumIdSchema` - Album ID parameter
- `albumQuerySchema` - Album query/filtering
- `albumStatusSchema` - Album status enum

### Photo Schemas
- `createPhotoSchema` - Photo creation
- `updatePhotoSchema` - Photo updates
- `photoUploadMetadataSchema` - Upload metadata
- `exifMetadataSchema` - EXIF data
- `photoIdSchema` - Photo ID parameter
- `photoQuerySchema` - Photo query/filtering
- `imageMimeTypeSchema` - Valid image MIME types

### Client Schemas
- `createAlbumClientSchema` - Client invitation
- `updateAlbumClientSchema` - Client updates
- `createPhotoSelectionSchema` - Photo selection
- `batchPhotoSelectionSchema` - Batch selections
- `accessTokenSchema` - Access token validation
- `accessTokenParamSchema` - Access token parameter

### Common Schemas
- `cuidSchema` - CUID validation
- `emailSchema` - Email validation
- `paginationSchema` - Pagination parameters
- `dateRangeSchema` - Date range filtering
- `sortOrderSchema` - Sort order enum

## Utility Functions

### `validate(schema, data)`
Parse and validate data, throwing `ValidationError` on failure.

### `safeValidate(schema, data)`
Parse and validate data, returning a result object instead of throwing.

### `validateBody(schema, body)`
Validate request body (alias for `validate` with clearer intent).

### `validateQuery(schema, query)`
Validate query parameters.

### `validateParams(schema, params)`
Validate route parameters.

### `formatZodError(error)`
Format Zod errors into a structured object.

### `withCustomMessages(schema, messages)`
Create a schema with custom error messages.

### `createValidationPipeline(...schemas)`
Create a validation pipeline that applies multiple schemas in sequence.

## Error Handling

All validation functions throw `ValidationError` which extends `Error` and includes:

- `errors: Record<string, string[]>` - Field-specific error messages
- `getFieldError(field: string)` - Get first error for a field
- `hasFieldError(field: string)` - Check if field has errors
- `getAllErrors()` - Get all errors as a flat array

Example:

```typescript
import { ValidationError } from "@/lib/validation";

try {
  validate(createAlbumSchema, invalidData);
} catch (error) {
  if (error instanceof ValidationError) {
    // Access structured errors
    console.error(error.errors); // { title: ["Title is required"] }
    console.error(error.getFieldError("title")); // "Title is required"
    console.error(error.getAllErrors()); // ["Title is required"]
  }
}
```

## Type Safety

All schemas automatically infer TypeScript types:

```typescript
import type { CreateAlbumInput, LoginUserInput } from "@/lib/validation";

function createAlbum(data: CreateAlbumInput) {
  // data is fully typed based on createAlbumSchema
}
```

## Best Practices

1. **Always validate user input** - Never trust client-side validation alone
2. **Use type inference** - Import types from validation module for consistency
3. **Handle errors gracefully** - Use `safeValidate` when you want to handle errors without try/catch
4. **Customize error messages** - Use `withCustomMessages` for user-friendly errors
5. **Validate at boundaries** - Validate at API endpoints, not in business logic

## Integration with Express/Next.js

For Express middleware integration, see the error handling module (Task 3.2) which will provide middleware for automatic validation and error formatting.


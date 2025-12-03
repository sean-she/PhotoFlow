/**
 * Validation utility functions
 * 
 * Helper functions for custom error messages, validation pipelines, and error formatting
 */

import { z } from "zod";
import type { ZodError, ZodSchema } from "zod";
import { ValidationError } from "../errors/validation";

// Re-export ValidationError for convenience
export { ValidationError };

/**
 * Format Zod errors into a structured format
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Parse and validate data with custom error handling
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export function validate<T extends ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = formatZodError(error);
      throw new ValidationError(formatted, "Validation failed");
    }
    throw error;
  }
}

/**
 * Safe parse that returns a result object instead of throwing
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result object with success flag and data/error
 */
export function safeValidate<T extends ZodSchema>(
  schema: T,
  data: unknown
): {
  success: true;
  data: z.infer<T>;
} | {
  success: false;
  error: ValidationError;
} {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const formatted = formatZodError(result.error);
      return {
        success: false,
        error: new ValidationError(formatted, "Validation failed"),
      };
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Create a validation pipeline that applies multiple transformations
 * 
 * @param schemas - Array of schemas to apply in sequence
 * @returns Combined schema
 */
export function createValidationPipeline<T extends ZodSchema[]>(
  ...schemas: T
): z.ZodTypeAny {
  if (schemas.length === 0) {
    throw new Error("At least one schema is required");
  }

  return schemas.reduce((acc, schema) => {
    return acc.pipe(schema);
  });
}

/**
 * Extract and validate query parameters
 * 
 * @param schema - Schema for query parameters
 * @param query - Query object (e.g., from URLSearchParams or request.query)
 * @returns Validated query parameters
 */
export function validateQuery<T extends ZodSchema>(
  schema: T,
  query: Record<string, unknown>
): z.infer<T> {
  return validate(schema, query);
}

/**
 * Extract and validate request body
 * 
 * @param schema - Schema for request body
 * @param body - Request body
 * @returns Validated body
 */
export function validateBody<T extends ZodSchema>(
  schema: T,
  body: unknown
): z.infer<T> {
  return validate(schema, body);
}

/**
 * Extract and validate route parameters
 * 
 * @param schema - Schema for route parameters
 * @param params - Route parameters
 * @returns Validated parameters
 */
export function validateParams<T extends ZodSchema>(
  schema: T,
  params: Record<string, unknown>
): z.infer<T> {
  return validate(schema, params);
}

/**
 * Create a schema with custom error messages
 * 
 * @param schema - Base schema
 * @param messages - Custom error messages
 * @returns Schema with custom messages
 */
export function withCustomMessages<T extends ZodSchema>(
  schema: T,
  messages: Record<string, string>
): T {
  return schema.superRefine((data, ctx) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        const customMessage = messages[path] || messages[issue.code] || issue.message;
        ctx.addIssue({
          ...issue,
          message: customMessage,
        });
      }
    }
  }) as T;
}


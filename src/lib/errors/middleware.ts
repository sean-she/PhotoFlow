/**
 * Error handling middleware for Express and Next.js
 * 
 * Provides middleware to catch and format errors uniformly
 */

import type { Request, Response, NextFunction } from "express";
import { BaseError } from "./base";
import {
  serializeErrorForClient,
  serializeErrorForLogging,
  shouldLogError,
  toBaseError,
} from "./utils";

/**
 * Environment configuration
 */
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Express error handling middleware
 * 
 * Catches all errors and formats them appropriately based on environment.
 * Should be added as the last middleware in your Express app.
 * 
 * @example
 * ```typescript
 * import express from "express";
 * import { errorHandler } from "@/lib/errors";
 * 
 * const app = express();
 * // ... your routes ...
 * app.use(errorHandler);
 * ```
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Convert to BaseError if needed
  const baseError = toBaseError(error);

  // Log error if needed
  if (shouldLogError(baseError) || isDevelopment) {
    const errorLog = serializeErrorForLogging(baseError);
    console.error("Error occurred:", {
      ...errorLog,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
  }

  // Determine if we should include details
  const includeDetails = isDevelopment && !isProduction;

  // Serialize error for client
  const clientError = serializeErrorForClient(baseError, includeDetails);

  // Send response
  res.status(baseError.statusCode).json(clientError);
}

/**
 * Async error wrapper for Express route handlers
 * 
 * Wraps async route handlers to automatically catch and forward errors
 * to the error handling middleware.
 * 
 * @example
 * ```typescript
 * import { asyncHandler } from "@/lib/errors";
 * 
 * router.get("/users", asyncHandler(async (req, res) => {
 *   const users = await getUsers();
 *   res.json(users);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Next.js API route error handler
 * 
 * Use this in Next.js API routes to handle errors consistently.
 * 
 * @example
 * ```typescript
 * import type { NextApiRequest, NextApiResponse } from "next";
 * import { handleApiError } from "@/lib/errors";
 * 
 * export default async function handler(
 *   req: NextApiRequest,
 *   res: NextApiResponse
 * ) {
 *   try {
 *     // Your API logic
 *   } catch (error) {
 *     handleApiError(error, req, res);
 *   }
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  req: { method?: string; url?: string },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
  }
): void {
  // Convert to BaseError if needed
  const baseError = toBaseError(error);

  // Log error if needed
  if (shouldLogError(baseError) || isDevelopment) {
    const errorLog = serializeErrorForLogging(baseError);
    console.error("API Error occurred:", {
      ...errorLog,
      method: req.method,
      url: req.url,
    });
  }

  // Determine if we should include details
  const includeDetails = isDevelopment && !isProduction;

  // Serialize error for client
  const clientError = serializeErrorForClient(baseError, includeDetails);

  // Send response
  res.status(baseError.statusCode).json(clientError);
}

/**
 * Create a Next.js API route wrapper that handles errors automatically
 * 
 * @example
 * ```typescript
 * import { withErrorHandling } from "@/lib/errors";
 * import type { NextApiRequest, NextApiResponse } from "next";
 * 
 * export default withErrorHandling(
 *   async (req: NextApiRequest, res: NextApiResponse) => {
 *     // Your API logic - errors are automatically handled
 *     const data = await fetchData();
 *     res.json(data);
 *   }
 * );
 * ```
 */
export function withErrorHandling(
  handler: (
    req: { method?: string; url?: string },
    res: {
      status: (code: number) => { json: (data: unknown) => void };
    }
  ) => Promise<unknown>
) {
  return async (
    req: { method?: string; url?: string },
    res: {
      status: (code: number) => { json: (data: unknown) => void };
    }
  ): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      handleApiError(error, req, res);
    }
  };
}


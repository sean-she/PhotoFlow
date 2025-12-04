/**
 * Error handling middleware for Express and Next.js
 * 
 * Provides middleware to catch and format errors uniformly.
 * Supports both Express.js and Next.js App Router route handlers.
 */

import type { Request, Response, NextFunction } from "express";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
 * @deprecated For Express.js compatibility only. For Next.js App Router,
 * use `handleRouteError` or `withRouteErrorHandling` instead.
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
 * @deprecated For Express.js compatibility only. For Next.js App Router,
 * use `withRouteErrorHandling` instead.
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
 * Next.js Pages Router API route error handler
 * 
 * @deprecated For Next.js Pages Router compatibility only. For App Router,
 * use `handleRouteError` or `withRouteErrorHandling` instead.
 * 
 * Use this in Next.js Pages Router API routes to handle errors consistently.
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
 * Create a Next.js Pages Router API route wrapper that handles errors automatically
 * 
 * @deprecated For Next.js Pages Router compatibility only. For App Router,
 * use `withRouteErrorHandling` instead.
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

/**
 * Route context for Next.js App Router route handlers
 */
export interface RouteContext {
  params?: Record<string, string | string[]>;
  [key: string]: unknown;
}

/**
 * Handle errors in Next.js App Router route handlers
 * 
 * Converts any error to a properly formatted NextResponse with appropriate
 * status code and error message.
 * 
 * @param error - The error to handle
 * @param request - Next.js NextRequest object
 * @returns NextResponse with error details
 * 
 * @example
 * ```typescript
 * import { handleRouteError } from "@/lib/errors";
 * import type { NextRequest } from "next/server";
 * 
 * export async function GET(request: NextRequest) {
 *   try {
 *     // Your route logic
 *   } catch (error) {
 *     return handleRouteError(error, request);
 *   }
 * }
 * ```
 */
export function handleRouteError(
  error: unknown,
  request: NextRequest
): NextResponse {
  // Convert to BaseError if needed
  const baseError = toBaseError(error);

  // Log error if needed
  if (shouldLogError(baseError) || isDevelopment) {
    const errorLog = serializeErrorForLogging(baseError);
    console.error("Route Error occurred:", {
      ...errorLog,
      method: request.method,
      url: request.url,
      pathname: new URL(request.url).pathname,
    });
  }

  // Determine if we should include details
  const includeDetails = isDevelopment && !isProduction;

  // Serialize error for client
  const clientError = serializeErrorForClient(baseError, includeDetails);

  // Return NextResponse with error
  return NextResponse.json(clientError, {
    status: baseError.statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create a Next.js App Router route handler wrapper that handles errors automatically
 * 
 * Wraps a route handler function to automatically catch and format errors.
 * Use this to ensure all errors are properly handled and returned as NextResponse.
 * 
 * @param handler - Route handler function that returns NextResponse
 * @returns Wrapped handler with automatic error handling
 * 
 * @example
 * ```typescript
 * import { withRouteErrorHandling } from "@/lib/errors";
 * import type { NextRequest, NextResponse } from "next/server";
 * 
 * export const GET = withRouteErrorHandling(
 *   async (request: NextRequest): Promise<NextResponse> => {
 *     // Your route logic - errors are automatically handled
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   }
 * );
 * ```
 * 
 * @example With route context (dynamic routes)
 * ```typescript
 * import { withRouteErrorHandling, type RouteContext } from "@/lib/errors";
 * import type { NextRequest, NextResponse } from "next/server";
 * 
 * export const GET = withRouteErrorHandling(
 *   async (
 *     request: NextRequest,
 *     context: RouteContext
 *   ): Promise<NextResponse> => {
 *     const { id } = context.params as { id: string };
 *     const data = await fetchDataById(id);
 *     return NextResponse.json(data);
 *   }
 * );
 * ```
 */
export function withRouteErrorHandling(
  handler: (
    request: NextRequest,
    context?: RouteContext
  ) => Promise<NextResponse>
): (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse> {
  return async (
    request: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleRouteError(error, request);
    }
  };
}


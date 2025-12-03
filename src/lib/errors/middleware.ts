/**
 * Error handling middleware for Next.js
 * 
 * Provides middleware to catch and format errors uniformly for Next.js API routes
 */

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


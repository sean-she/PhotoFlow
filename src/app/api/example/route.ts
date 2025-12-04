/**
 * Example Next.js App Router Route Handler
 * 
 * This file demonstrates how to use the error handling and logging utilities
 * with Next.js App Router route handlers.
 * 
 * This is a reference implementation - you can delete this file once you
 * understand the patterns.
 */

import { withRouteLogging } from "@/lib/logging";
import { withRouteErrorHandling } from "@/lib/errors";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Example GET handler with logging and error handling
 * 
 * This demonstrates the recommended pattern: combine logging and error handling
 * wrappers for automatic request/response logging and error formatting.
 */
const getHandler = async (request: NextRequest): Promise<NextResponse> => {
  // Your business logic here
  // Errors are automatically caught and formatted by withRouteErrorHandling
  // Requests/responses are automatically logged by withRouteLogging
  
  const data = {
    message: "Hello from Next.js App Router!",
    timestamp: new Date().toISOString(),
    method: request.method,
    pathname: new URL(request.url).pathname,
  };

  return NextResponse.json(data, { status: 200 });
};

// Export with both logging and error handling
export const GET = withRouteErrorHandling(withRouteLogging(getHandler));

/**
 * Example POST handler with manual error handling
 * 
 * This shows how to handle errors manually if you need more control.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();

    // Your business logic
    const result = {
      received: body,
      processed: true,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Manual error handling - you can customize the response
    // For automatic handling, use withRouteErrorHandling instead
    const { handleRouteError } = await import("@/lib/errors");
    return handleRouteError(error, request);
  }
}


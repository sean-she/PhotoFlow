/**
 * Example Dynamic Route Handler
 * 
 * Demonstrates how to use route handlers with dynamic segments
 * and access route parameters from the context.
 */

import { withRouteLogging, type RouteContext } from "@/lib/logging";
import { withRouteErrorHandling } from "@/lib/errors";
import type { NextRequest, NextResponse } from "next/server";

const getHandler = async (
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> => {
  // Access route parameters from context
  const { id } = context.params as { id: string };

  // Your business logic
  const data = {
    id,
    message: `Resource with ID: ${id}`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data, { status: 200 });
};

// Export with both logging and error handling
export const GET = withRouteErrorHandling(withRouteLogging(getHandler));


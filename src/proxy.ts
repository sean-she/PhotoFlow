/**
 * Next.js 16+ Proxy
 * 
 * Global proxy that runs before requests are processed.
 * Handles authentication, logging, CORS, and other cross-cutting concerns.
 * 
 * Uses Node.js runtime for full session validation with database checks.
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * @see https://www.better-auth.com/docs/integrations/next#nextjs-16-proxy
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLogger, createRequestLoggerFromNextRequest, extractNextRequestContext } from "@/lib/logging";

/**
 * Proxy configuration
 * 
 * Must be exported directly (not re-exported) for Next.js to parse it at compile time.
 */
export const config = {
  // Specify the routes the proxy applies to
  matcher: ["/dashboard"], // Specify the routes the middleware applies to
};

/**
 * Main proxy function
 * 
 * This runs on every matched request before it reaches route handlers.
 * 
 * THIS IS NOT SECURE!
 * This is the recommended approach to optimistically redirect users.
 * We recommend handling auth checks in each page/route.
 * 
 * @param request - The incoming NextRequest
 * @returns NextResponse for redirects or to continue processing
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Extract request context to get request ID
  const requestContext = extractNextRequestContext(request);
  const requestId = requestContext.requestId;
  
  // Create request-scoped logger
  const logger = createRequestLoggerFromNextRequest(getLogger(), request);
  
  const url = new URL(request.url);
  const startTime = performance.now();

  // Log incoming request
  logger.info(
    {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
          request.headers.get("x-real-ip") || 
          "unknown",
      userAgent: request.headers.get("user-agent"),
    },
    `Proxy: ${request.method} ${url.pathname}`
  );

  // Full session validation with database check
  const session = await auth.api.getSession({
    headers: await headers()
  });

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  if (!session) {
    logger.warn({ pathname: url.pathname }, "Unauthenticated request to protected route");
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Continue processing - let the request proceed to route handlers
  const response = NextResponse.next();

  // Add custom headers if needed
  response.headers.set("X-Request-ID", requestId);

  // Log response timing
  const duration = Math.round((performance.now() - startTime) * 100) / 100;
  logger.debug({ duration, pathname: url.pathname }, "Proxy completed");

  return response;
}


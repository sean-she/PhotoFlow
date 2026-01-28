/**
 * Next.js Middleware
 * 
 * Global middleware that runs before requests are processed.
 * Handles authentication, logging, CORS, and other cross-cutting concerns.
 * 
 * This middleware runs on the Edge Runtime for optimal performance.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { getLogger, createRequestLoggerFromNextRequest, extractNextRequestContext } from "@/lib/logging";

/**
 * Middleware configuration
 * 
 * Must be exported directly (not re-exported) for Next.js to parse it at compile time.
 */
export const config = {
  // Paths that should be excluded from middleware processing
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

/**
 * Main middleware function
 * 
 * This runs on every request before it reaches route handlers.
 * 
 * @param request - The incoming NextRequest
 * @returns NextResponse or void (to continue processing)
 */
export function middleware(request: NextRequest): NextResponse | void {
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
    `Middleware: ${request.method} ${url.pathname}`
  );

  // CORS headers (if needed for API routes)
  // Uncomment and configure if you need CORS
  /*
  if (url.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return response;
  }
  */

  // Authentication checks (example - implement based on your auth strategy)
  // Uncomment and implement when authentication is ready
  /*
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (url.pathname.startsWith("/api/protected") && !token) {
    logger.warn({ pathname: url.pathname }, "Unauthenticated request to protected route");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  */

  // Rate limiting (example - implement based on your needs)
  // Consider using a library like @upstash/ratelimit for production
  /*
  const rateLimitKey = request.ip || "unknown";
  // Check rate limit
  if (isRateLimited(rateLimitKey)) {
    logger.warn({ ip: rateLimitKey, pathname: url.pathname }, "Rate limit exceeded");
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }
  */

  // Continue processing - let the request proceed to route handlers
  const response = NextResponse.next();

  // Add custom headers if needed
  response.headers.set("X-Request-ID", requestId);

  // Log response timing (after response is sent)
  // Note: We can't easily hook into response finish in middleware,
  // so this is logged immediately. For detailed response logging,
  // use withRouteLogging in route handlers.
  const duration = Math.round((performance.now() - startTime) * 100) / 100;
  logger.debug({ duration, pathname: url.pathname }, "Middleware completed");

  return response;
}


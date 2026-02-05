/**
 * Route Protection Utilities
 * 
 * Provides authentication and authorization helpers for:
 * - Next.js route handlers (API routes)
 * - Server Actions
 * - Server Components
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/errors/authentication";
import { validateApiToken } from "./api-token";
import type { Photographer, User } from "@/generated/prisma/client";

/**
 * Get the current session from better-auth
 * Returns null if no session exists (does not throw)
 * 
 * @param request - Next.js request object
 * @returns Session with user data, or null if not authenticated
 */
export async function getSession(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ 
      headers: request.headers 
    });
    return session;
  } catch (error) {
    return null;
  }
}

/**
 * Require authentication for route handlers
 * Throws AuthenticationError if not authenticated
 * 
 * @param request - Next.js request object
 * @returns User object from session
 * @throws AuthenticationError if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const session = await auth.api.getSession({ 
    headers: request.headers 
  });
  
  if (!session) {
    throw new AuthenticationError("Authentication required");
  }
  
  return session.user;
}

/**
 * Require photographer role for Server Actions and route handlers
 * Validates session and links User to Photographer record
 * 
 * @param request - Next.js request object
 * @returns Object with user and photographer data
 * @throws AuthenticationError if not authenticated
 * @throws NotFoundError if photographer profile not found
 */
export async function requirePhotographer(request: NextRequest) {
  const session = await auth.api.getSession({ 
    headers: request.headers 
  });
  
  if (!session) {
    throw new AuthenticationError("Authentication required");
  }
  
  // Get the Photographer record linked to the User
  const photographer = await prisma.photographer.findUnique({
    where: { userId: session.user.id },
  });
  
  if (!photographer) {
    throw new AuthenticationError(
      "Photographer profile not found. Please complete your profile setup."
    );
  }
  
  return { 
    user: session.user, 
    photographer 
  };
}

/**
 * Get photographer for Server Actions (alternative to requirePhotographer)
 * Returns null if photographer profile doesn't exist
 * 
 * @param request - Next.js request object
 * @returns Object with user and photographer data, or null if not found
 */
export async function getPhotographer(request: NextRequest) {
  const session = await auth.api.getSession({ 
    headers: request.headers 
  });
  
  if (!session) {
    return null;
  }
  
  const photographer = await prisma.photographer.findUnique({
    where: { userId: session.user.id },
  });
  
  if (!photographer) {
    return null;
  }
  
  return { 
    user: session.user, 
    photographer 
  };
}

/**
 * Require API token authentication for Lightroom plugin
 * Validates Bearer token from Authorization header
 * 
 * @param request - Next.js request object
 * @returns Object with user and photographer data
 * @throws AuthenticationError if token is missing or invalid
 */
export async function requireApiToken(
  request: NextRequest
): Promise<{ user: User; photographer: Photographer }> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("API token required. Use 'Authorization: Bearer <token>' header");
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  const validation = await validateApiToken(token);
  
  if (!validation) {
    throw new AuthenticationError("Invalid or expired API token");
  }
  
  return validation;
}

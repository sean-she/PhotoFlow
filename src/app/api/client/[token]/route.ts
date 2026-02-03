/**
 * Client Access Route Handler
 * 
 * Provides client access to albums via secure token authentication.
 * Clients access their album gallery using a unique token in the URL.
 * 
 * Route: GET /api/client/[token]
 */

import { validateClientToken } from "@/lib/auth/client-token";
import { withRouteErrorHandling } from "@/lib/errors";
import { withRouteLogging, type RouteContext } from "@/lib/logging";
import { NotFoundError } from "@/lib/errors/not-found";
import { AuthenticationError } from "@/lib/errors/authentication";
import prisma from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET handler for client album access
 * 
 * Validates the client token and returns album data with photos.
 * 
 * @param request - Next.js request object
 * @param context - Route context containing params (Next.js 16 uses async params)
 * @returns Album data with photos and client information
 */
const getHandler = async (
  request: NextRequest,
  context?: RouteContext | { params?: Promise<{ token: string }> | { token: string } }
): Promise<NextResponse> => {
  // Extract token from params (Next.js 16 uses Promise-based params)
  let token: string;
  
  if (!context?.params) {
    throw new AuthenticationError("Token parameter is required");
  }
  
  // Handle Next.js 16 async params (Promise) or RouteContext fallback (Record)
  const params = context.params;
  if (params instanceof Promise) {
    // Next.js 16: params is a Promise
    const resolved = await params;
    token = resolved.token;
  } else if (typeof params === 'object' && 'token' in params) {
    // Direct object format
    token = params.token as string;
  } else {
    // RouteContext format: Record<string, string | string[]>
    const tokenValue = (params as Record<string, string | string[]>).token;
    token = Array.isArray(tokenValue) ? tokenValue[0] : (tokenValue || "");
  }
  
  if (!token) {
    throw new AuthenticationError("Token parameter is required");
  }
  
  // Validate the client token
  const validation = await validateClientToken(token);
  
  if (!validation) {
    throw new AuthenticationError("Invalid or expired client access token");
  }
  
  const { client, album } = validation;
  
  // Check if album is accessible (not in DRAFT status for clients)
  if (album.status === "DRAFT") {
    throw new NotFoundError("Album is not yet available");
  }
  
  // Fetch photos for the album
  const photos = await prisma.photo.findMany({
    where: { albumId: album.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      filename: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      width: true,
      height: true,
      storageKey: true,
      thumbnailStorageKey: true,
      createdAt: true,
      exifCameraMake: true,
      exifCameraModel: true,
      exifDateTimeOriginal: true,
      exifIso: true,
      exifFocalLength: true,
      exifAperture: true,
      exifShutterSpeed: true,
    },
  });
  
  // Fetch client's photo selections
  const selections = await prisma.photoSelection.findMany({
    where: { clientId: client.id },
    select: {
      photoId: true,
      selectionDate: true,
      notes: true,
    },
  });
  
  // Create a map of photo selections for easy lookup
  const selectionMap = new Map(
    selections.map((sel) => [sel.photoId, sel])
  );
  
  // Combine photos with selection status
  const photosWithSelections = photos.map((photo) => ({
    ...photo,
    isSelected: selectionMap.has(photo.id),
    selection: selectionMap.get(photo.id) || null,
  }));
  
  // Return album data
  return NextResponse.json({
    album: {
      id: album.id,
      title: album.title,
      description: album.description,
      status: album.status,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    },
    client: {
      id: client.id,
      name: client.clientName,
      email: client.clientEmail,
    },
    photos: photosWithSelections,
    totalPhotos: photos.length,
    selectedCount: selections.length,
  });
};

// Export with both logging and error handling
export const GET = withRouteErrorHandling(withRouteLogging(getHandler));

/**
 * Presigned URL Generation API
 * 
 * Generates presigned R2 PUT URLs for direct photo uploads from Lightroom plugin.
 * This bypasses Vercel serverless timeout limits by allowing direct client-to-storage uploads.
 * 
 * Route: POST /api/photos/presigned-url
 */

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireApiToken } from "@/lib/auth/guards";
import { withRouteErrorHandling } from "@/lib/errors";
import { withRouteLogging, type RouteContext } from "@/lib/logging";
import { validateBody } from "@/lib/validation";
import { presignedUrlRequestSchema } from "@/lib/validation/schemas/photo";
import { generatePhotoPath, FileType } from "@/lib/storage/paths";
import { getR2Client, getR2Config } from "@/lib/storage/r2-config";
import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors/not-found";
import { AuthorizationError } from "@/lib/errors/authentication";
import { randomBytes } from "node:crypto";

/**
 * Generate a CUID-like ID for photos
 * Uses timestamp + random bytes to ensure uniqueness
 * Format: c + timestamp (base36) + random (hex)
 */
function generatePhotoId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `c${timestamp}${random}`;
}

/**
 * POST handler for presigned URL generation
 * 
 * @param request - Next.js request object
 * @returns Presigned URL and photo metadata
 */
const postHandler = async (
  request: NextRequest,
  context?: RouteContext
): Promise<NextResponse> => {
  // Authenticate using API token
  const { photographer } = await requireApiToken(request);

  // Validate request body
  const body = await request.json();
  const validated = validateBody(presignedUrlRequestSchema, body);

  const { albumId, filename, contentType, fileSize } = validated;

  // Validate album exists and belongs to photographer
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { photographer: true },
  });

  if (!album) {
    throw new NotFoundError(`Album with ID ${albumId} not found`);
  }

  if (album.photographerId !== photographer.id) {
    throw new AuthorizationError("Album does not belong to this photographer");
  }

  // Generate unique photo ID (CUID-like format)
  const photoId = generatePhotoId();

  // Generate storage key using path utilities
  const storageKey = generatePhotoPath({
    albumId,
    photoId,
    fileType: FileType.ORIGINAL,
    filename,
  });

  // Get R2 client and config
  const r2Client = getR2Client();
  const r2Config = getR2Config();

  // Create PutObjectCommand for presigned URL
  const command = new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: storageKey,
    ContentType: contentType,
    // Metadata for tracking
    Metadata: {
      photographerId: photographer.id,
      albumId,
      photoId,
      originalFilename: filename,
    },
  });

  // Generate presigned URL (1 hour expiration)
  const expiresIn = 3600; // 1 hour in seconds
  const presignedUrl = await getSignedUrl(r2Client, command, {
    expiresIn,
  });

  // Calculate expiration timestamp
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Create Photo record with status='uploading' (we'll add status field in subtask 5)
  // For now, create the record without status
  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      filename: filename,
      originalFilename: filename,
      mimeType: contentType,
      size: fileSize,
      storageKey,
      albumId,
    },
  });

  // Return presigned URL and metadata
  return NextResponse.json({
    presignedUrl,
    photoId: photo.id,
    storageKey: photo.storageKey,
    expiresAt: expiresAt.toISOString(),
  });
};

// Export with both logging and error handling
export const POST = withRouteErrorHandling(withRouteLogging(postHandler));

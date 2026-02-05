/**
 * Upload Confirmation API
 * 
 * Confirms successful direct upload to R2 and finalizes the database record.
 * Called by Lightroom plugin after successful direct-to-storage upload.
 * 
 * Route: POST /api/photos/confirm-upload
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiToken } from "@/lib/auth/guards";
import { withRouteErrorHandling } from "@/lib/errors";
import { withRouteLogging, type RouteContext } from "@/lib/logging";
import { validateBody } from "@/lib/validation";
import { uploadConfirmationRequestSchema } from "@/lib/validation/schemas/photo";
import { fileExists } from "@/lib/storage/organization";
import { generateCdnUrl } from "@/lib/storage/cdn";
import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors/not-found";
import { AuthorizationError } from "@/lib/errors/authentication";
import { ValidationError } from "@/lib/errors/validation";

/**
 * POST handler for upload confirmation
 * 
 * @param request - Next.js request object
 * @returns Confirmation with storage key and CDN URL
 */
const postHandler = async (
  request: NextRequest,
  context?: RouteContext
): Promise<NextResponse> => {
  // Authenticate using API token
  const { photographer } = await requireApiToken(request);

  // Validate request body
  const body = await request.json();
  const validated = validateBody(uploadConfirmationRequestSchema, body);

  const { photoId, albumId, metadata, exif } = validated;

  // Verify photo exists and belongs to the photographer's album
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: {
      album: {
        include: {
          photographer: true,
        },
      },
    },
  });

  if (!photo) {
    throw new NotFoundError(`Photo with ID ${photoId} not found`);
  }

  // Verify album belongs to photographer
  if (photo.album.photographerId !== photographer.id) {
    throw new AuthorizationError("Photo does not belong to this photographer");
  }

  // Verify album ID matches
  if (photo.albumId !== albumId) {
    throw new ValidationError({
      albumId: ["Album ID does not match photo's album"],
    });
  }

  // Verify file exists in R2 at expected storageKey
  const fileExistsInR2 = await fileExists(photo.storageKey);

  if (!fileExistsInR2) {
    // File doesn't exist - return error but keep status as 'uploading' for retry
    // Note: Status field doesn't exist in schema yet, so we'll just return an error
    throw new NotFoundError(
      `File not found in storage at key: ${photo.storageKey}. Upload may not have completed. Please retry.`
    );
  }

  // Prepare update data
  const updateData: {
    width?: number;
    height?: number;
    size?: number;
    exifCameraMake?: string | null;
    exifCameraModel?: string | null;
    exifDateTimeOriginal?: Date | null;
    exifIso?: number | null;
    exifFocalLength?: number | null;
    exifAperture?: number | null;
    exifShutterSpeed?: string | null;
  } = {};

  // Update metadata if provided
  if (metadata) {
    if (metadata.width !== undefined) {
      updateData.width = metadata.width;
    }
    if (metadata.height !== undefined) {
      updateData.height = metadata.height;
    }
    if (metadata.size !== undefined) {
      updateData.size = metadata.size;
    }
  }

  // Extract and store EXIF metadata if provided
  if (exif) {
    if (exif.cameraMake !== undefined) {
      updateData.exifCameraMake = exif.cameraMake;
    }
    if (exif.cameraModel !== undefined) {
      updateData.exifCameraModel = exif.cameraModel;
    }
    if (exif.dateTimeOriginal !== undefined) {
      updateData.exifDateTimeOriginal = exif.dateTimeOriginal;
    }
    if (exif.iso !== undefined) {
      updateData.exifIso = exif.iso;
    }
    if (exif.focalLength !== undefined) {
      updateData.exifFocalLength = exif.focalLength;
    }
    if (exif.aperture !== undefined) {
      updateData.exifAperture = exif.aperture;
    }
    if (exif.shutterSpeed !== undefined) {
      updateData.exifShutterSpeed = exif.shutterSpeed;
    }
  }

  // Use Prisma transaction to ensure atomicity
  const updatedPhoto = await prisma.$transaction(async (tx) => {
    // Update photo record with metadata
    // Note: Status field doesn't exist in schema yet, so we're not setting it
    // When status field is added, we would set status='completed' here
    const photo = await tx.photo.update({
      where: { id: photoId },
      data: updateData,
      include: {
        album: true,
      },
    });

    return photo;
  });

  // Generate CDN URL for the photo
  const cdnUrl = await generateCdnUrl({
    key: updatedPhoto.storageKey,
    signed: false, // Public URL for now, can be made signed if needed
  });

  // Return confirmation with storage key and CDN URL
  return NextResponse.json({
    success: true,
    photoId: updatedPhoto.id,
    storageKey: updatedPhoto.storageKey,
    cdnUrl,
    metadata: {
      width: updatedPhoto.width,
      height: updatedPhoto.height,
      size: updatedPhoto.size,
      mimeType: updatedPhoto.mimeType,
    },
    exif: {
      cameraMake: updatedPhoto.exifCameraMake,
      cameraModel: updatedPhoto.exifCameraModel,
      dateTimeOriginal: updatedPhoto.exifDateTimeOriginal,
      iso: updatedPhoto.exifIso,
      focalLength: updatedPhoto.exifFocalLength,
      aperture: updatedPhoto.exifAperture,
      shutterSpeed: updatedPhoto.exifShutterSpeed,
    },
  });
};

// Export with both logging and error handling
export const POST = withRouteErrorHandling(withRouteLogging(postHandler));

/**
 * Photo validation schemas
 * 
 * Schemas for photo uploads, metadata, and updates
 */

import { z } from "zod";
import { cuidSchema } from "./common";

/**
 * MIME type validation for images (including RAW formats)
 */
export const imageMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/gif",
]);

/**
 * Extended MIME type validation for photo uploads (includes RAW formats)
 */
export const photoMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/gif",
  // RAW formats
  "image/x-canon-cr2",
  "image/x-nikon-nef",
  "image/x-sony-arw",
  "image/x-fuji-raf",
  "image/x-olympus-orf",
  "image/x-panasonic-rw2",
  "image/x-adobe-dng",
  "image/x-pentax-pef",
  "image/x-kodak-dcr",
  "image/x-kodak-k25",
  "image/x-kodak-kdc",
  "image/x-minolta-mrw",
  "image/x-sony-srf",
  "image/x-sony-sr2",
  "application/octet-stream", // Fallback for unrecognized RAW formats
]);

/**
 * Photo upload metadata schema
 */
export const photoUploadMetadataSchema = z.object({
  originalFilename: z.string().min(1).max(500),
  mimeType: imageMimeTypeSchema,
  size: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type PhotoUploadMetadataInput = z.infer<typeof photoUploadMetadataSchema>;

/**
 * EXIF metadata schema
 */
export const exifMetadataSchema = z.object({
  cameraMake: z.string().max(100).optional(),
  cameraModel: z.string().max(100).optional(),
  dateTimeOriginal: z.coerce.date().optional(),
  iso: z.number().int().positive().optional(),
  focalLength: z.number().positive().optional(),
  aperture: z.number().positive().optional(),
  shutterSpeed: z.string().max(50).optional(),
});

export type ExifMetadataInput = z.infer<typeof exifMetadataSchema>;

/**
 * Create photo schema (for database record creation)
 */
export const createPhotoSchema = z.object({
  filename: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(500),
  mimeType: imageMimeTypeSchema,
  size: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  storageKey: z.string().min(1),
  thumbnailStorageKey: z.string().optional(),
  albumId: cuidSchema,
  exifCameraMake: z.string().max(100).optional(),
  exifCameraModel: z.string().max(100).optional(),
  exifDateTimeOriginal: z.coerce.date().optional(),
  exifIso: z.number().int().positive().optional(),
  exifFocalLength: z.number().positive().optional(),
  exifAperture: z.number().positive().optional(),
  exifShutterSpeed: z.string().max(50).optional(),
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;

/**
 * Update photo schema
 */
export const updatePhotoSchema = z.object({
  filename: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
});

export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

/**
 * Photo ID parameter schema
 */
export const photoIdSchema = z.object({
  id: cuidSchema,
});

export type PhotoIdInput = z.infer<typeof photoIdSchema>;

/**
 * Photo query parameters (for listing/filtering)
 */
export const photoQuerySchema = z.object({
  albumId: cuidSchema.optional(),
  search: z.string().max(255).optional(),
  mimeType: imageMimeTypeSchema.optional(),
});

export type PhotoQueryInput = z.infer<typeof photoQuerySchema>;

/**
 * Presigned URL request schema
 * Used for requesting presigned URLs for direct photo uploads
 */
export const presignedUrlRequestSchema = z.object({
  albumId: cuidSchema,
  filename: z.string().min(1).max(500),
  contentType: photoMimeTypeSchema,
  fileSize: z.number().int().positive().max(100 * 1024 * 1024), // Max 100MB
});

export type PresignedUrlRequestInput = z.infer<typeof presignedUrlRequestSchema>;

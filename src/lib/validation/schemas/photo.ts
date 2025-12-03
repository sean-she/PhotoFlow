/**
 * Photo validation schemas
 * 
 * Schemas for photo uploads, metadata, and updates
 */

import { z } from "zod";
import { cuidSchema } from "./common";

/**
 * MIME type validation for images
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


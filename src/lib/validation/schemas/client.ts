/**
 * Client validation schemas
 * 
 * Schemas for client invitations, access tokens, and photo selections
 */

import { z } from "zod";
import { cuid2Schema, emailSchema } from "./common";

/**
 * Create album client schema
 */
export const createAlbumClientSchema = z.object({
  clientName: z.string().min(1, "Client name is required").max(255),
  clientEmail: emailSchema,
  expiresAt: z.coerce.date().optional(),
});

export type CreateAlbumClientInput = z.infer<typeof createAlbumClientSchema>;

/**
 * Update album client schema
 */
export const updateAlbumClientSchema = z.object({
  clientName: z.string().min(1).max(255).optional(),
  clientEmail: emailSchema.optional(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export type UpdateAlbumClientInput = z.infer<typeof updateAlbumClientSchema>;

/**
 * Client access token validation schema
 */
export const accessTokenSchema = z.string().min(32, "Invalid access token format");

/**
 * Client access token parameter schema
 */
export const accessTokenParamSchema = z.object({
  token: accessTokenSchema,
});

export type AccessTokenInput = z.infer<typeof accessTokenParamSchema>;

/**
 * Create photo selection schema
 */
export const createPhotoSelectionSchema = z.object({
  photoId: cuid2Schema,
  notes: z.string().max(1000).optional(),
});

export type CreatePhotoSelectionInput = z.infer<typeof createPhotoSelectionSchema>;

/**
 * Update photo selection schema
 */
export const updatePhotoSelectionSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdatePhotoSelectionInput = z.infer<typeof updatePhotoSelectionSchema>;

/**
 * Batch photo selection schema
 */
export const batchPhotoSelectionSchema = z.object({
  photoIds: z.array(cuid2Schema).min(1, "At least one photo ID is required"),
  notes: z.string().max(1000).optional(),
});

export type BatchPhotoSelectionInput = z.infer<typeof batchPhotoSelectionSchema>;

/**
 * Client ID parameter schema
 */
export const clientIdSchema = z.object({
  clientId: cuid2Schema,
});

export type ClientIdInput = z.infer<typeof clientIdSchema>;


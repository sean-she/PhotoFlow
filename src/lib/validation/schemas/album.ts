/**
 * Album validation schemas
 * 
 * Schemas for album creation, updates, and configuration
 */

import { z } from "zod";
import { cuid2Schema } from "./common";

/**
 * Album status enum (matches Prisma schema)
 */
export const albumStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "CLOSED",
  "ARCHIVED",
]);

/**
 * Create album schema
 */
export const createAlbumSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional(),
  status: albumStatusSchema.default("DRAFT"),
});

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

/**
 * Update album schema
 */
export const updateAlbumSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: albumStatusSchema.optional(),
});

export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;

/**
 * Album ID parameter schema
 */
export const albumIdSchema = z.object({
  id: cuid2Schema,
});

export type AlbumIdInput = z.infer<typeof albumIdSchema>;

/**
 * Album query parameters (for listing/filtering)
 */
export const albumQuerySchema = z.object({
  status: albumStatusSchema.optional(),
  photographerId: cuid2Schema.optional(),
  search: z.string().max(255).optional(),
});

export type AlbumQueryInput = z.infer<typeof albumQuerySchema>;


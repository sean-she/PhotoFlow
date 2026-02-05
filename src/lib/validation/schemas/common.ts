/**
 * Common validation schemas
 * 
 * Shared schemas used across multiple modules (IDs, pagination, etc.)
 */

import { z } from "zod";

/**
 * CUID2 validation schema
 * Validates CUID2 format (used by Prisma)
 */
export const cuid2Schema = z.string().cuid2();

/**
 * Email validation schema
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Sort order enum
 */
export const sortOrderSchema = z.enum(["asc", "desc"]).default("asc");

/**
 * Date range filter
 */
export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to;
    }
    return true;
  },
  {
    message: "Start date must be before or equal to end date",
  }
);

export type DateRangeInput = z.infer<typeof dateRangeSchema>;


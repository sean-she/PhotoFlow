/**
 * Validation module exports
 * 
 * This module provides Zod-based validation utilities for the application.
 * All validation schemas and utilities are exported from here.
 */

// Re-export Zod for convenience
export { z } from "zod";
export type { ZodError, ZodSchema, ZodTypeAny } from "zod";

// Common schemas
export * from "./schemas/common";
export type {
  PaginationInput,
  DateRangeInput,
} from "./schemas/common";

// User schemas
export * from "./schemas/user";
export type {
  RegisterUserInput,
  LoginUserInput,
  UpdateUserProfileInput,
  ChangePasswordInput,
} from "./schemas/user";

// Album schemas
export * from "./schemas/album";
export type {
  CreateAlbumInput,
  UpdateAlbumInput,
  AlbumIdInput,
  AlbumQueryInput,
} from "./schemas/album";

// Photo schemas
export * from "./schemas/photo";
export type {
  PhotoUploadMetadataInput,
  ExifMetadataInput,
  CreatePhotoInput,
  UpdatePhotoInput,
  PhotoIdInput,
  PhotoQueryInput,
  PresignedUrlRequestInput,
} from "./schemas/photo";

// Client schemas
export * from "./schemas/client";
export type {
  CreateAlbumClientInput,
  UpdateAlbumClientInput,
  AccessTokenInput,
  CreatePhotoSelectionInput,
  UpdatePhotoSelectionInput,
  BatchPhotoSelectionInput,
  ClientIdInput,
} from "./schemas/client";

// Validation utilities
export * from "./utils";
export {
  ValidationError,
  formatZodError,
  validate,
  safeValidate,
  createValidationPipeline,
  validateQuery,
  validateBody,
  validateParams,
  withCustomMessages,
} from "./utils";


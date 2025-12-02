/**
 * Storage module exports
 * 
 * This module provides access to Cloudflare R2 storage functionality.
 * All storage operations should go through the abstraction layer.
 */

// Configuration
export * from "./r2-config";
export { getR2Config, createR2Client, getR2Client, resetR2Client } from "./r2-config";
export type { R2Config } from "./r2-config";

// Upload utilities
export * from "./upload";
export {
  uploadFile,
  uploadFiles,
  UploadError,
} from "./upload";
export type {
  UploadOptions,
  UploadResult,
  BatchUploadItem,
  BatchUploadResult,
} from "./upload";

// Download utilities
export * from "./download";
export {
  downloadFile,
  downloadFileAsBuffer,
  downloadFileWithProgress,
  getFileMetadata,
  DownloadError,
} from "./download";
export type {
  DownloadOptions,
  DownloadResult,
  DownloadBufferResult,
  ProgressCallback,
} from "./download";

// Path generation and organization
export * from "./paths";
export {
  generatePhotoPath,
  generateThumbnailPath,
  generateOriginalPath,
  generateAlbumPath,
  generateUserPath,
  generateDateBasedPath,
  parsePhotoPath,
  sanitizePathSegment,
  getFileExtension,
  FileType,
} from "./paths";
export type {
  PathOptions,
  ParsedPath,
} from "./paths";

// Organization utilities
export * from "./organization";
export {
  listAlbumFiles,
  findFilesByPhotoId,
  getAlbumFileCount,
  getPhotoFileTypes,
  fileExists,
} from "./organization";
export type {
  FileIndexEntry,
  ListAlbumFilesOptions,
} from "./organization";

// Migration utilities
export * from "./migration";
export {
  migrateFiles,
  reorganizeFiles,
} from "./migration";
export type {
  MigrationOptions,
  MigrationResult,
  ReorganizeOptions,
} from "./migration";


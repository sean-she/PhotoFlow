/**
 * Storage module exports
 * 
 * This module provides access to Cloudflare R2 storage functionality.
 * All storage operations should go through the abstraction layer.
 * 
 * The storage provider abstraction layer allows switching between different
 * storage providers (R2, S3, Azure, etc.) without changing application code.
 */

// Storage Provider Abstraction Layer
export * from "./provider";
export {
  StorageProviderError,
} from "./provider";
export type {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadOptions,
  StorageDownloadResult,
  StorageDownloadBufferResult,
  StorageFileMetadata,
  StorageListOptions,
  StorageListResult,
  StorageListWithMetadataOptions,
  StorageListWithMetadataResult,
  StorageFileEntry,
  StorageProgressCallback,
  StorageBatchUploadItem,
  StorageBatchUploadResult,
} from "./provider";

// Provider implementations
export { R2StorageProvider } from "./providers/r2-provider";
export { MockStorageProvider } from "./providers/mock-provider";

// Provider factory
export {
  createStorageProvider,
  getDefaultStorageProvider,
  resetDefaultStorageProvider,
  setDefaultStorageProvider,
  getDefaultStorageProviderConfig,
} from "./provider-factory";
export type {
  StorageProviderType,
  StorageProviderConfig,
} from "./provider-factory";

// Provider migration utilities
export {
  migrateBetweenProviders,
  compareProviders,
} from "./provider-migration";
export type {
  ProviderMigrationOptions,
  ProviderMigrationResult,
} from "./provider-migration";

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

// CDN URL generation
export * from "./cdn";
export {
  generateCdnUrl,
  generateBulkCdnUrls,
  generateThumbnailUrl,
  generatePreviewUrl,
  clearUrlCache,
  cleanupUrlCache,
} from "./cdn";
export type {
  ImageTransformParams,
  CdnUrlOptions,
  BulkCdnUrlOptions,
} from "./cdn";

// Lifecycle policies
export * from "./lifecycle";
export {
  evaluateLifecyclePolicy,
  collectFileMetadata,
  executeLifecycleAction,
  scanAndEvaluateLifecycle,
  getAuditLog,
  generateStorageUsageReport,
  DEFAULT_LIFECYCLE_POLICY,
  LifecycleAction,
} from "./lifecycle";
export type {
  FileLifecycleMetadata,
  LifecyclePolicyRule,
  LifecycleRuleConditions,
  LifecycleActionParams,
  LifecycleSafeguards,
  LifecyclePolicyConfig,
  LifecycleEvaluationResult,
  LifecycleExecutionResult,
  LifecycleAuditLogEntry,
  LifecycleScanOptions,
  AuditLogFilterOptions,
  StorageUsageReportOptions,
  StorageUsageReport,
} from "./lifecycle";


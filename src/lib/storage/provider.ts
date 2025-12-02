/**
 * Storage Provider Abstraction Layer
 * 
 * This module defines a provider-agnostic interface for storage operations,
 * allowing the application to switch between different storage providers
 * (R2, S3, Azure Blob, etc.) without changing application code.
 */

import type { Readable } from "stream";

/**
 * Upload options for storage operations
 */
export interface StorageUploadOptions {
  /** Custom metadata to attach to the file */
  metadata?: Record<string, string>;
  /** Content type (MIME type) of the file */
  contentType?: string;
  /** Cache control header */
  cacheControl?: string;
  /** Whether the file should be publicly accessible */
  public?: boolean;
  /** Retry configuration */
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
  };
}

/**
 * Upload result from storage operations
 */
export interface StorageUploadResult {
  /** The key/path where the file was uploaded */
  key: string;
  /** ETag of the uploaded file (for integrity verification) */
  etag: string;
  /** File size in bytes */
  size: number;
  /** Content type */
  contentType?: string;
  /** Upload timestamp */
  uploadedAt: Date;
}

/**
 * Download options for storage operations
 */
export interface StorageDownloadOptions {
  /** Byte range to download (for partial downloads) */
  range?: { start: number; end: number };
  /** Retry configuration */
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
  };
}

/**
 * Download result with stream
 */
export interface StorageDownloadResult {
  /** The object key that was downloaded */
  key: string;
  /** Readable stream of the file content */
  body: Readable;
  /** Content type of the file */
  contentType?: string;
  /** Content length in bytes */
  contentLength?: number;
  /** ETag for integrity verification */
  etag?: string;
  /** Last modified date */
  lastModified?: Date;
  /** Metadata attached to the object */
  metadata?: Record<string, string>;
}

/**
 * Download result as buffer
 */
export interface StorageDownloadBufferResult {
  /** The object key that was downloaded */
  key: string;
  /** File content as Buffer */
  buffer: Buffer;
  /** Content type of the file */
  contentType?: string;
  /** Content length in bytes */
  contentLength?: number;
  /** ETag for integrity verification */
  etag?: string;
  /** Last modified date */
  lastModified?: Date;
  /** Metadata attached to the object */
  metadata?: Record<string, string>;
}

/**
 * File metadata
 */
export interface StorageFileMetadata {
  key: string;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

/**
 * List files options
 */
export interface StorageListOptions {
  /** Prefix to filter files by */
  prefix?: string;
  /** Maximum number of results */
  maxResults?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
}

/**
 * List files result
 */
export interface StorageListResult {
  /** Array of file keys */
  keys: string[];
  /** Continuation token for next page */
  continuationToken?: string;
  /** Whether there are more results */
  isTruncated: boolean;
}

/**
 * List files with metadata options
 */
export interface StorageListWithMetadataOptions extends StorageListOptions {
  /** Whether to include file metadata */
  includeMetadata?: boolean;
}

/**
 * File entry with metadata
 */
export interface StorageFileEntry {
  key: string;
  size?: number;
  lastModified?: Date;
  contentType?: string;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * List files with metadata result
 */
export interface StorageListWithMetadataResult {
  /** Array of file entries */
  files: StorageFileEntry[];
  /** Continuation token for next page */
  continuationToken?: string;
  /** Whether there are more results */
  isTruncated: boolean;
}

/**
 * Progress callback for operations
 */
export type StorageProgressCallback = (progress: {
  loaded: number;
  total?: number;
  percentage?: number;
}) => void;

/**
 * Batch upload item
 */
export interface StorageBatchUploadItem {
  key: string;
  body: Buffer | Uint8Array | ReadableStream | Blob;
  options?: StorageUploadOptions;
}

/**
 * Batch upload result
 */
export interface StorageBatchUploadResult {
  successful: Array<{ item: StorageBatchUploadItem; result: StorageUploadResult }>;
  failed: Array<{ item: StorageBatchUploadItem; error: Error }>;
}

/**
 * Storage provider error
 */
export class StorageProviderError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "StorageProviderError";
  }
}

/**
 * Storage Provider Interface
 * 
 * All storage providers must implement this interface to ensure
 * consistent behavior across different storage backends.
 */
export interface StorageProvider {
  /**
   * Get the name/identifier of this provider
   */
  readonly name: string;

  /**
   * Upload a file to storage
   * 
   * @param key - The object key (path) in storage
   * @param body - File content as Buffer, Uint8Array, or Readable stream
   * @param options - Upload options
   * @returns Upload result with metadata
   */
  uploadFile(
    key: string,
    body: Buffer | Uint8Array | ReadableStream | Blob,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  /**
   * Upload multiple files in batch
   * 
   * @param uploads - Array of upload parameters
   * @param defaultOptions - Shared upload options (can be overridden per file)
   * @returns Batch upload result
   */
  uploadFiles(
    uploads: StorageBatchUploadItem[],
    defaultOptions?: StorageUploadOptions
  ): Promise<StorageBatchUploadResult>;

  /**
   * Download a file from storage as a stream
   * 
   * @param key - The object key (path) in storage
   * @param options - Download options
   * @returns Download result with readable stream
   */
  downloadFile(
    key: string,
    options?: StorageDownloadOptions
  ): Promise<StorageDownloadResult>;

  /**
   * Download a file from storage as a Buffer
   * 
   * @param key - The object key (path) in storage
   * @param options - Download options
   * @returns Download result with buffer
   */
  downloadFileAsBuffer(
    key: string,
    options?: StorageDownloadOptions
  ): Promise<StorageDownloadBufferResult>;

  /**
   * Download a file with progress tracking
   * 
   * @param key - The object key (path) in storage
   * @param onProgress - Progress callback
   * @param options - Download options
   * @returns Download result with buffer
   */
  downloadFileWithProgress(
    key: string,
    onProgress: StorageProgressCallback,
    options?: StorageDownloadOptions
  ): Promise<StorageDownloadBufferResult>;

  /**
   * Get file metadata without downloading the file
   * 
   * @param key - The object key (path) in storage
   * @returns File metadata
   */
  getFileMetadata(key: string): Promise<StorageFileMetadata>;

  /**
   * Check if a file exists
   * 
   * @param key - The object key (path) in storage
   * @returns True if file exists, false otherwise
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Delete a file from storage
   * 
   * @param key - The object key (path) in storage
   * @returns True if deleted, false if not found
   */
  deleteFile(key: string): Promise<boolean>;

  /**
   * Delete multiple files in batch
   * 
   * @param keys - Array of object keys to delete
   * @returns Result with successful and failed deletions
   */
  deleteFiles(keys: string[]): Promise<{
    successful: string[];
    failed: Array<{ key: string; error: Error }>;
  }>;

  /**
   * List files in storage
   * 
   * @param options - List options
   * @returns List result with keys
   */
  listFiles(options?: StorageListOptions): Promise<StorageListResult>;

  /**
   * List files with metadata
   * 
   * @param options - List options with metadata
   * @returns List result with file entries
   */
  listFilesWithMetadata(
    options?: StorageListWithMetadataOptions
  ): Promise<StorageListWithMetadataResult>;

  /**
   * Copy a file from one key to another
   * 
   * @param sourceKey - Source object key
   * @param destinationKey - Destination object key
   * @returns True if copied successfully
   */
  copyFile(sourceKey: string, destinationKey: string): Promise<boolean>;

  /**
   * Generate a CDN URL for a file
   * 
   * Note: CDN URL generation is provider-specific, but this method
   * provides a common interface. Some providers may not support
   * all features (e.g., signed URLs, transformations).
   * 
   * @param key - The object key (path) in storage
   * @param options - CDN URL options (provider-specific)
   * @returns CDN URL string
   */
  generateCdnUrl(
    key: string,
    options?: {
      signed?: boolean;
      expiresIn?: number;
      [key: string]: any; // Allow provider-specific options
    }
  ): Promise<string>;
}


/**
 * Mock Storage Provider Implementation
 * 
 * In-memory storage provider for testing the abstraction layer.
 * Implements the StorageProvider interface without requiring actual storage.
 */

import {
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
  StorageProviderError,
} from "../provider";
import { Readable } from "stream";

/**
 * In-memory file storage entry
 */
interface MockFileEntry {
  key: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  uploadedAt: Date;
  lastModified: Date;
}

/**
 * Mock Storage Provider
 * 
 * Stores files in memory for testing purposes.
 */
export class MockStorageProvider implements StorageProvider {
  readonly name = "mock";

  private storage = new Map<string, MockFileEntry>();

  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | ReadableStream | Blob,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    try {
      // Convert body to Buffer
      let buffer: Buffer;

      if (body instanceof Buffer) {
        buffer = body;
      } else if (body instanceof Uint8Array) {
        buffer = Buffer.from(body);
      } else if (body instanceof Blob) {
        const arrayBuffer = await body.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (body instanceof ReadableStream) {
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        const reader = body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        buffer = Buffer.concat(chunks);
      } else {
        throw new StorageProviderError(
          "Unsupported body type",
          key
        );
      }

      const now = new Date();
      const entry: MockFileEntry = {
        key,
        buffer,
        contentType: options.contentType,
        metadata: options.metadata,
        uploadedAt: now,
        lastModified: now,
      };

      this.storage.set(key, entry);

      // Generate a simple ETag (MD5 hash of buffer)
      const crypto = await import("crypto");
      const etag = crypto.createHash("md5").update(buffer).digest("hex");

      return {
        key,
        etag,
        size: buffer.length,
        contentType: options.contentType,
        uploadedAt: now,
      };
    } catch (error) {
      throw new StorageProviderError(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async uploadFiles(
    uploads: StorageBatchUploadItem[],
    defaultOptions?: StorageUploadOptions
  ): Promise<StorageBatchUploadResult> {
    const results: StorageBatchUploadResult = {
      successful: [],
      failed: [],
    };

    for (const item of uploads) {
      try {
        const options = { ...defaultOptions, ...item.options };
        const result = await this.uploadFile(item.key, item.body, options);
        results.successful.push({ item, result });
      } catch (error) {
        results.failed.push({
          item,
          error:
            error instanceof StorageProviderError
              ? error
              : new StorageProviderError(
                  `Batch upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                  item.key,
                  error instanceof Error ? error : undefined
                ),
        });
      }
    }

    return results;
  }

  async downloadFile(
    key: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadResult> {
    const entry = this.storage.get(key);
    if (!entry) {
      throw new StorageProviderError("File not found", key);
    }

    // Handle range requests
    let buffer = entry.buffer;
    if (options.range) {
      const start = options.range.start;
      const end = Math.min(options.range.end, buffer.length - 1);
      buffer = buffer.slice(start, end + 1);
    }

    const stream = Readable.from(buffer);

    return {
      key,
      body: stream,
      contentType: entry.contentType,
      contentLength: buffer.length,
      etag: entry.buffer.toString("hex").substring(0, 32), // Simple etag
      lastModified: entry.lastModified,
      metadata: entry.metadata,
    };
  }

  async downloadFileAsBuffer(
    key: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadBufferResult> {
    const result = await this.downloadFile(key, options);
    const chunks: Buffer[] = [];
    for await (const chunk of result.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return {
      key: result.key,
      buffer,
      contentType: result.contentType,
      contentLength: result.contentLength ?? buffer.length,
      etag: result.etag,
      lastModified: result.lastModified,
      metadata: result.metadata,
    };
  }

  async downloadFileWithProgress(
    key: string,
    onProgress: StorageProgressCallback,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadBufferResult> {
    const result = await this.downloadFile(key, options);
    const chunks: Buffer[] = [];
    let loaded = 0;
    const total = result.contentLength;

    for await (const chunk of result.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      loaded += buffer.length;

      onProgress({
        loaded,
        total,
        percentage: total ? Math.round((loaded / total) * 100) : undefined,
      });
    }

    const buffer = Buffer.concat(chunks);

    return {
      key: result.key,
      buffer,
      contentType: result.contentType,
      contentLength: result.contentLength ?? buffer.length,
      etag: result.etag,
      lastModified: result.lastModified,
      metadata: result.metadata,
    };
  }

  async getFileMetadata(key: string): Promise<StorageFileMetadata> {
    const entry = this.storage.get(key);
    if (!entry) {
      throw new StorageProviderError("File not found", key);
    }

    return {
      key: entry.key,
      contentType: entry.contentType,
      contentLength: entry.buffer.length,
      etag: entry.buffer.toString("hex").substring(0, 32),
      lastModified: entry.lastModified,
      metadata: entry.metadata,
    };
  }

  async fileExists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async deleteFile(key: string): Promise<boolean> {
    const existed = this.storage.has(key);
    this.storage.delete(key);
    return existed;
  }

  async deleteFiles(keys: string[]): Promise<{
    successful: string[];
    failed: Array<{ key: string; error: Error }>;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ key: string; error: Error }>,
    };

    for (const key of keys) {
      try {
        await this.deleteFile(key);
        results.successful.push(key);
      } catch (error) {
        results.failed.push({
          key,
          error:
            error instanceof Error
              ? error
              : new Error("Unknown error during deletion"),
        });
      }
    }

    return results;
  }

  async listFiles(options: StorageListOptions = {}): Promise<StorageListResult> {
    const { prefix = "", maxResults = 1000, continuationToken } = options;

    const allKeys = Array.from(this.storage.keys())
      .filter((key) => key.startsWith(prefix))
      .sort();

    // Simple pagination simulation
    const startIndex = continuationToken ? parseInt(continuationToken, 10) : 0;
    const endIndex = Math.min(startIndex + maxResults, allKeys.length);
    const keys = allKeys.slice(startIndex, endIndex);
    const nextToken = endIndex < allKeys.length ? endIndex.toString() : undefined;

    return {
      keys,
      continuationToken: nextToken,
      isTruncated: nextToken !== undefined,
    };
  }

  async listFilesWithMetadata(
    options: StorageListWithMetadataOptions = {}
  ): Promise<StorageListWithMetadataResult> {
    const { prefix = "", maxResults = 1000, continuationToken } = options;

    const allEntries = Array.from(this.storage.entries())
      .filter(([key]) => key.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));

    // Simple pagination simulation
    const startIndex = continuationToken ? parseInt(continuationToken, 10) : 0;
    const endIndex = Math.min(startIndex + maxResults, allEntries.length);
    const entries = allEntries.slice(startIndex, endIndex);
    const nextToken = endIndex < allEntries.length ? endIndex.toString() : undefined;

    const files: StorageFileEntry[] = entries.map(([key, entry]) => ({
      key,
      size: entry.buffer.length,
      lastModified: entry.lastModified,
      contentType: entry.contentType,
      etag: entry.buffer.toString("hex").substring(0, 32),
      metadata: entry.metadata,
    }));

    return {
      files,
      continuationToken: nextToken,
      isTruncated: nextToken !== undefined,
    };
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    const source = this.storage.get(sourceKey);
    if (!source) {
      throw new StorageProviderError("Source file not found", sourceKey);
    }

    const now = new Date();
    this.storage.set(destinationKey, {
      ...source,
      key: destinationKey,
      lastModified: now,
    });

    return true;
  }

  async generateCdnUrl(
    key: string,
    options: {
      signed?: boolean;
      expiresIn?: number;
      [key: string]: any;
    } = {}
  ): Promise<string> {
    // Simple mock URL generation
    // Match R2 provider encoding: encode each path segment separately
    const baseUrl = "https://mock-storage.example.com";
    const encodeStorageKey = (k: string): string => {
      const segments = k.split("/");
      return segments.map((segment) => encodeURIComponent(segment)).join("/");
    };
    const encodedKey = encodeStorageKey(key);
    const url = `${baseUrl}/${encodedKey}`;

    if (options.signed) {
      // Add a mock signature
      const expires = options.expiresIn || 3600;
      const timestamp = Date.now() + expires * 1000;
      return `${url}?signature=mock&expires=${timestamp}`;
    }

    return url;
  }

  /**
   * Clear all stored files (useful for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get the number of stored files
   */
  size(): number {
    return this.storage.size;
  }
}


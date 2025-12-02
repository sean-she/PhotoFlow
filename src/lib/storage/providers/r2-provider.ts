/**
 * Cloudflare R2 Storage Provider Implementation
 * 
 * Implements the StorageProvider interface for Cloudflare R2.
 * This is a thin wrapper that uses the existing R2 storage functions.
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

// Import existing functions
import {
  uploadFile as r2UploadFile,
  uploadFiles as r2UploadFiles,
  type UploadOptions as R2UploadOptions,
  type UploadResult as R2UploadResult,
  type BatchUploadItem as R2BatchUploadItem,
  type BatchUploadResult as R2BatchUploadResult,
  UploadError,
} from "../upload";

import {
  downloadFile as r2DownloadFile,
  downloadFileAsBuffer as r2DownloadFileAsBuffer,
  downloadFileWithProgress as r2DownloadFileWithProgress,
  getFileMetadata as r2GetFileMetadata,
  type DownloadOptions as R2DownloadOptions,
  type DownloadResult as R2DownloadResult,
  type DownloadBufferResult as R2DownloadBufferResult,
  type ProgressCallback as R2ProgressCallback,
  DownloadError,
} from "../download";

import {
  fileExists as r2FileExists,
} from "../organization";

import {
  generateCdnUrl as r2GenerateCdnUrl,
  type CdnUrlOptions as R2CdnUrlOptions,
} from "../cdn";

import { getR2Client, getR2Config, type R2Config } from "../r2-config";
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 Storage Provider
 * 
 * Wraps existing R2 storage functions to implement the StorageProvider interface.
 */
export class R2StorageProvider implements StorageProvider {
  readonly name = "r2";

  private client: ReturnType<typeof getR2Client>;
  private config: R2Config;

  constructor(config?: R2Config) {
    this.config = config ?? getR2Config();
    this.client = getR2Client();
  }

  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | ReadableStream | Blob,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    try {
      // Convert StorageUploadOptions to R2 UploadOptions
      const r2Options: R2UploadOptions = {
        metadata: options.metadata,
        contentType: options.contentType,
        cacheControl: options.cacheControl,
        public: options.public,
        retry: options.retry,
      };

      const result = await r2UploadFile(key, body, r2Options);

      // Convert R2UploadResult to StorageUploadResult
      return {
        key: result.key,
        etag: result.etag,
        size: result.size,
        contentType: result.contentType,
        uploadedAt: result.uploadedAt,
      };
    } catch (error) {
      // Convert UploadError to StorageProviderError
      if (error instanceof UploadError) {
        throw new StorageProviderError(
          error.message,
          error.key,
          error.cause
        );
      }
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
    try {
      // Convert StorageBatchUploadItem[] to R2 BatchUploadItem[]
      const r2Uploads: R2BatchUploadItem[] = uploads.map((item) => ({
        key: item.key,
        body: item.body,
        options: item.options
          ? {
              metadata: item.options.metadata,
              contentType: item.options.contentType,
              cacheControl: item.options.cacheControl,
              public: item.options.public,
              retry: item.options.retry,
            }
          : undefined,
      }));

      // Convert StorageUploadOptions to R2 UploadOptions
      const r2DefaultOptions: R2UploadOptions | undefined = defaultOptions
        ? {
            metadata: defaultOptions.metadata,
            contentType: defaultOptions.contentType,
            cacheControl: defaultOptions.cacheControl,
            public: defaultOptions.public,
            retry: defaultOptions.retry,
          }
        : undefined;

      const result = await r2UploadFiles(r2Uploads, r2DefaultOptions);

      // Convert R2BatchUploadResult to StorageBatchUploadResult
      return {
        successful: result.successful.map((item) => ({
          item: {
            key: item.item.key,
            body: item.item.body,
            options: item.item.options
              ? {
                  metadata: item.item.options.metadata,
                  contentType: item.item.options.contentType,
                  cacheControl: item.item.options.cacheControl,
                  public: item.item.options.public,
                  retry: item.item.options.retry,
                }
              : undefined,
          },
          result: {
            key: item.result.key,
            etag: item.result.etag,
            size: item.result.size,
            contentType: item.result.contentType,
            uploadedAt: item.result.uploadedAt,
          },
        })),
        failed: result.failed.map((item) => ({
          item: {
            key: item.item.key,
            body: item.item.body,
            options: item.item.options
              ? {
                  metadata: item.item.options.metadata,
                  contentType: item.item.options.contentType,
                  cacheControl: item.item.options.cacheControl,
                  public: item.item.options.public,
                  retry: item.item.options.retry,
                }
              : undefined,
          },
          // item.error is always UploadError per the type definition
          error: new StorageProviderError(
            item.error.message,
            item.error.key,
            item.error.cause
          ),
        })),
      };
    } catch (error) {
      // This shouldn't happen as uploadFiles handles errors internally,
      // but just in case
      throw new StorageProviderError(
        `Batch upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "",
        error instanceof Error ? error : undefined
      );
    }
  }

  async downloadFile(
    key: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadResult> {
    try {
      // Convert StorageDownloadOptions to R2 DownloadOptions
      const r2Options: R2DownloadOptions = {
        range: options.range,
        retry: options.retry,
      };

      const result = await r2DownloadFile(key, r2Options);

      // Convert R2DownloadResult to StorageDownloadResult
      return {
        key: result.key,
        body: result.body,
        contentType: result.contentType,
        contentLength: result.contentLength,
        etag: result.etag,
        lastModified: result.lastModified,
        metadata: result.metadata,
      };
    } catch (error) {
      // Convert DownloadError to StorageProviderError
      if (error instanceof DownloadError) {
        throw new StorageProviderError(
          error.message,
          error.key,
          error.cause
        );
      }
      throw new StorageProviderError(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async downloadFileAsBuffer(
    key: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadBufferResult> {
    try {
      // Convert StorageDownloadOptions to R2 DownloadOptions
      const r2Options: R2DownloadOptions = {
        range: options.range,
        retry: options.retry,
      };

      const result = await r2DownloadFileAsBuffer(key, r2Options);

      // Convert R2DownloadBufferResult to StorageDownloadBufferResult
      return {
        key: result.key,
        buffer: result.buffer,
        contentType: result.contentType,
        contentLength: result.contentLength,
        etag: result.etag,
        lastModified: result.lastModified,
        metadata: result.metadata,
      };
    } catch (error) {
      // Convert DownloadError to StorageProviderError
      if (error instanceof DownloadError) {
        throw new StorageProviderError(
          error.message,
          error.key,
          error.cause
        );
      }
      throw new StorageProviderError(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async downloadFileWithProgress(
    key: string,
    onProgress: StorageProgressCallback,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadBufferResult> {
    try {
      // Convert StorageDownloadOptions to R2 DownloadOptions
      const r2Options: R2DownloadOptions = {
        range: options.range,
        retry: options.retry,
      };

      // Convert StorageProgressCallback to R2 ProgressCallback
      const r2ProgressCallback: R2ProgressCallback = (progress) => {
        onProgress({
          loaded: progress.loaded,
          total: progress.total,
          percentage: progress.percentage,
        });
      };

      const result = await r2DownloadFileWithProgress(
        key,
        r2ProgressCallback,
        r2Options
      );

      // Convert R2DownloadBufferResult to StorageDownloadBufferResult
      return {
        key: result.key,
        buffer: result.buffer,
        contentType: result.contentType,
        contentLength: result.contentLength,
        etag: result.etag,
        lastModified: result.lastModified,
        metadata: result.metadata,
      };
    } catch (error) {
      // Convert DownloadError to StorageProviderError
      if (error instanceof DownloadError) {
        throw new StorageProviderError(
          error.message,
          error.key,
          error.cause
        );
      }
      throw new StorageProviderError(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getFileMetadata(key: string): Promise<StorageFileMetadata> {
    try {
      const result = await r2GetFileMetadata(key);
      return {
        key: result.key,
        contentType: result.contentType,
        contentLength: result.contentLength,
        etag: result.etag,
        lastModified: result.lastModified,
        metadata: result.metadata,
      };
    } catch (error) {
      // Convert DownloadError to StorageProviderError
      if (error instanceof DownloadError) {
        throw new StorageProviderError(
          error.message,
          error.key,
          error.cause
        );
      }
      throw new StorageProviderError(
        `Failed to get metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async fileExists(key: string): Promise<boolean> {
    return await r2FileExists(key);
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      // If error is 404, file doesn't exist (consider it deleted)
      if (
        error instanceof Error &&
        (error.message.includes("NotFound") ||
          error.message.includes("NoSuchKey"))
      ) {
        return false;
      }
      throw new StorageProviderError(
        `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deleteFiles(keys: string[]): Promise<{
    successful: string[];
    failed: Array<{ key: string; error: Error }>;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ key: string; error: Error }>,
    };

    // Delete files in parallel (with reasonable concurrency limit)
    const concurrency = 10;
    const chunks: string[][] = [];

    for (let i = 0; i < keys.length; i += concurrency) {
      chunks.push(keys.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (key) => {
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
      });

      await Promise.all(promises);
    }

    return results;
  }

  async listFiles(options: StorageListOptions = {}): Promise<StorageListResult> {
    const {
      prefix = "",
      maxResults = 1000,
      continuationToken,
    } = options;

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: prefix,
      MaxKeys: maxResults,
      ContinuationToken: continuationToken,
    });

    try {
      const response = await this.client.send(command);

      const keys: string[] = [];
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            keys.push(object.Key);
          }
        }
      }

      return {
        keys,
        continuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated ?? false,
      };
    } catch (error) {
      throw new StorageProviderError(
        `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
        prefix,
        error instanceof Error ? error : undefined
      );
    }
  }

  async listFilesWithMetadata(
    options: StorageListWithMetadataOptions = {}
  ): Promise<StorageListWithMetadataResult> {
    const {
      prefix = "",
      maxResults = 1000,
      continuationToken,
      includeMetadata = true,
    } = options;

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: prefix,
      MaxKeys: maxResults,
      ContinuationToken: continuationToken,
    });

    try {
      const response = await this.client.send(command);

      const files: StorageFileEntry[] = [];
      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key) continue;

          files.push({
            key: object.Key,
            size: object.Size,
            lastModified: object.LastModified,
            etag: object.ETag?.replace(/"/g, ""),
            // Note: ListObjectsV2 doesn't return full metadata by default
            // For full metadata, we'd need to call HeadObject for each file
            // which is expensive. This is a trade-off for performance.
          });
        }
      }

      return {
        files,
        continuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated ?? false,
      };
    } catch (error) {
      throw new StorageProviderError(
        `Failed to list files with metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        prefix,
        error instanceof Error ? error : undefined
      );
    }
  }

  async copyFile(
    sourceKey: string,
    destinationKey: string
  ): Promise<boolean> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucketName,
        CopySource: `${this.config.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      throw new StorageProviderError(
        `Failed to copy file: ${error instanceof Error ? error.message : "Unknown error"}`,
        sourceKey,
        error instanceof Error ? error : undefined
      );
    }
  }

  async generateCdnUrl(
    key: string,
    options: {
      signed?: boolean;
      expiresIn?: number;
      [key: string]: any;
    } = {}
  ): Promise<string> {
    try {
      // Convert provider options to R2 CdnUrlOptions
      const r2Options: R2CdnUrlOptions = {
        key,
        signed: options.signed,
        expiresIn: options.expiresIn,
        // Pass through any additional options (like transform, queryParams)
        ...(options.transform && { transform: options.transform }),
        ...(options.queryParams && { queryParams: options.queryParams }),
      };

      return await r2GenerateCdnUrl(r2Options);
    } catch (error) {
      throw new StorageProviderError(
        `Failed to generate CDN URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        key,
        error instanceof Error ? error : undefined
      );
    }
  }
}

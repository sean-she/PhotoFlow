import {
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getR2Client, getR2Config } from "./r2-config";
import * as crypto from "crypto";

/**
 * Upload options
 */
export interface UploadOptions {
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
 * Upload result
 */
export interface UploadResult {
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
 * Upload error with context
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Calculate MD5 hash of a buffer for integrity verification
 */
function calculateMD5(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a file to R2 with retry logic and error handling
 * 
 * @param key - The object key (path) in the bucket
 * @param body - File content as Buffer, Uint8Array, or Readable stream
 * @param options - Upload options
 * @returns Upload result with metadata
 * 
 * @example
 * ```typescript
 * const fileBuffer = await fs.readFile('photo.jpg');
 * const result = await uploadFile('photos/album1/photo.jpg', fileBuffer, {
 *   contentType: 'image/jpeg',
 *   metadata: { albumId: '123', userId: '456' }
 * });
 * ```
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream | Blob,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const client = getR2Client();
  const config = getR2Config();
  const {
    metadata = {},
    contentType,
    cacheControl,
    public: isPublic = false,
    retry = { maxAttempts: 3, delayMs: 1000 },
  } = options;

  const maxAttempts = retry.maxAttempts ?? 3;
  const delayMs = retry.delayMs ?? 1000;

  let lastError: Error | undefined;

  // Convert body to Buffer if needed for size calculation
  let bodyBuffer: Buffer | undefined;
  let bodySize = 0;

  if (body instanceof Buffer) {
    bodyBuffer = body;
    bodySize = body.length;
  } else if (body instanceof Uint8Array) {
    bodyBuffer = Buffer.from(body);
    bodySize = body.length;
  } else if (body instanceof Blob) {
    // For Blob, we'll need to read it as array buffer
    const arrayBuffer = await body.arrayBuffer();
    bodyBuffer = Buffer.from(arrayBuffer);
    bodySize = bodyBuffer.length;
  }

  // Retry loop
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Use multipart upload for large files (>5MB)
      const useMultipart = bodySize > 5 * 1024 * 1024; // 5MB threshold

      if (useMultipart && bodyBuffer) {
        // Multipart upload for large files
        const upload = new Upload({
          client,
          params: {
            Bucket: config.bucketName,
            Key: key,
            Body: bodyBuffer,
            ContentType: contentType,
            CacheControl: cacheControl,
            Metadata: metadata,
            ACL: isPublic ? "public-read" : undefined,
          },
          // Multipart upload configuration
          partSize: 10 * 1024 * 1024, // 10MB per part
          leavePartsOnError: false,
        });

        const result = await upload.done();

        return {
          key,
          etag: result.ETag?.replace(/"/g, "") ?? "",
          size: bodySize,
          contentType,
          uploadedAt: new Date(),
        };
      } else {
        // Standard upload for smaller files
        const command = new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
          Metadata: metadata,
          ACL: isPublic ? "public-read" : undefined,
        });

        const result = await client.send(command);

        // Calculate size if not already known
        if (bodySize === 0 && bodyBuffer) {
          bodySize = bodyBuffer.length;
        } else if (body instanceof ReadableStream) {
          // For streams, we can't easily determine size upfront
          // R2 will return it, but we'd need to check via HeadObject
          bodySize = 0; // Will need to be determined separately if needed
        }

        return {
          key,
          etag: result.ETag?.replace(/"/g, "") ?? "",
          size: bodySize,
          contentType,
          uploadedAt: new Date(),
        };
      }
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors (authentication, invalid request)
      if (
        error instanceof Error &&
        (error.message.includes("InvalidAccessKeyId") ||
          error.message.includes("SignatureDoesNotMatch") ||
          error.message.includes("InvalidRequest"))
      ) {
        throw new UploadError(
          `Upload failed: ${error.message}`,
          key,
          error as Error
        );
      }

      // If not the last attempt, wait and retry
      if (attempt < maxAttempts) {
        const backoffDelay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        await sleep(backoffDelay);
        continue;
      }
    }
  }

  // All retries exhausted
  throw new UploadError(
    `Upload failed after ${maxAttempts} attempts: ${lastError?.message ?? "Unknown error"}`,
    key,
    lastError
  );
}

/**
 * Upload multiple files in batch
 * 
 * @param uploads - Array of upload parameters
 * @param options - Shared upload options (can be overridden per file)
 * @returns Array of upload results
 * 
 * @example
 * ```typescript
 * const results = await uploadFiles([
 *   { key: 'photo1.jpg', body: buffer1, options: { contentType: 'image/jpeg' } },
 *   { key: 'photo2.jpg', body: buffer2, options: { contentType: 'image/jpeg' } },
 * ]);
 * ```
 */
export interface BatchUploadItem {
  key: string;
  body: Buffer | Uint8Array | ReadableStream | Blob;
  options?: UploadOptions;
}

export interface BatchUploadResult {
  successful: Array<{ item: BatchUploadItem; result: UploadResult }>;
  failed: Array<{ item: BatchUploadItem; error: UploadError }>;
}

export async function uploadFiles(
  uploads: BatchUploadItem[],
  defaultOptions?: UploadOptions
): Promise<BatchUploadResult> {
  const results: BatchUploadResult = {
    successful: [],
    failed: [],
  };

  // Upload files in parallel (with reasonable concurrency limit)
  const concurrency = 5;
  const chunks: BatchUploadItem[][] = [];

  for (let i = 0; i < uploads.length; i += concurrency) {
    chunks.push(uploads.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (item) => {
      try {
        const options = { ...defaultOptions, ...item.options };
        const result = await uploadFile(item.key, item.body, options);
        results.successful.push({ item, result });
      } catch (error) {
        const uploadError =
          error instanceof UploadError
            ? error
            : new UploadError(
                `Batch upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                item.key,
                error instanceof Error ? error : undefined
              );
        results.failed.push({ item, error: uploadError });
      }
    });

    await Promise.all(promises);
  }

  return results;
}


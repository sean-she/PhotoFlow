import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "./r2-config";
import { Readable } from "stream";

/**
 * Download options
 */
export interface DownloadOptions {
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
export interface DownloadResult {
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
 * Download result as buffer (for smaller files)
 */
export interface DownloadBufferResult {
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
 * Progress callback for download tracking
 */
export type ProgressCallback = (progress: {
  loaded: number;
  total?: number;
  percentage?: number;
}) => void;

/**
 * Download error with context
 */
export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a Readable stream to Buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Download a file from R2 as a stream
 * 
 * @param key - The object key (path) in the bucket
 * @param options - Download options
 * @returns Download result with readable stream
 * 
 * @example
 * ```typescript
 * const result = await downloadFile('photos/album1/photo.jpg');
 * result.body.pipe(fs.createWriteStream('local-copy.jpg'));
 * ```
 */
export async function downloadFile(
  key: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const client = getR2Client();
  const config = getR2Config();
  const {
    range,
    retry = { maxAttempts: 3, delayMs: 1000 },
  } = options;

  const maxAttempts = retry.maxAttempts ?? 3;
  const delayMs = retry.delayMs ?? 1000;

  let lastError: Error | undefined;

  // Retry loop
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Range: range
          ? `bytes=${range.start}-${range.end}`
          : undefined,
      });

      const result = await client.send(command);

      if (!result.Body) {
        throw new DownloadError("Empty response body", key);
      }

      // Convert the body to a Readable stream
      const stream =
        result.Body instanceof Readable
          ? result.Body
          : Readable.fromWeb(result.Body as any);

      return {
        key,
        body: stream,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag?.replace(/"/g, ""),
        lastModified: result.LastModified,
        metadata: result.Metadata,
      };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors (not found, authentication)
      if (
        error instanceof Error &&
        (error.message.includes("NoSuchKey") ||
          error.message.includes("InvalidAccessKeyId") ||
          error.message.includes("SignatureDoesNotMatch"))
      ) {
        throw new DownloadError(
          `Download failed: ${error.message}`,
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
  throw new DownloadError(
    `Download failed after ${maxAttempts} attempts: ${lastError?.message ?? "Unknown error"}`,
    key,
    lastError
  );
}

/**
 * Download a file from R2 as a Buffer
 * Useful for smaller files that can be loaded into memory
 * 
 * @param key - The object key (path) in the bucket
 * @param options - Download options
 * @returns Download result with buffer
 * 
 * @example
 * ```typescript
 * const result = await downloadFileAsBuffer('photos/album1/photo.jpg');
 * await fs.writeFile('local-copy.jpg', result.buffer);
 * ```
 */
export async function downloadFileAsBuffer(
  key: string,
  options: DownloadOptions = {}
): Promise<DownloadBufferResult> {
  const result = await downloadFile(key, options);
  const buffer = await streamToBuffer(result.body);

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

/**
 * Download a file with progress tracking
 * 
 * @param key - The object key (path) in the bucket
 * @param onProgress - Progress callback
 * @param options - Download options
 * @returns Download result with buffer
 * 
 * @example
 * ```typescript
 * const result = await downloadFileWithProgress(
 *   'photos/album1/photo.jpg',
 *   (progress) => console.log(`Downloaded ${progress.percentage}%`)
 * );
 * ```
 */
export async function downloadFileWithProgress(
  key: string,
  onProgress: ProgressCallback,
  options: DownloadOptions = {}
): Promise<DownloadBufferResult> {
  const result = await downloadFile(key, options);
  const chunks: Buffer[] = [];
  let loaded = 0;
  const total = result.contentLength;

  // Track progress as we read the stream
  for await (const chunk of result.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    loaded += buffer.length;

    // Call progress callback
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

/**
 * Get file metadata without downloading the file
 * 
 * @param key - The object key (path) in the bucket
 * @returns File metadata
 */
export async function getFileMetadata(key: string): Promise<{
  key: string;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  const client = getR2Client();
  const config = getR2Config();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    const result = await client.send(command);

    return {
      key,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag?.replace(/"/g, ""),
      lastModified: result.LastModified,
      metadata: result.Metadata,
    };
  } catch (error) {
    throw new DownloadError(
      `Failed to get metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      key,
      error instanceof Error ? error : undefined
    );
  }
}


/**
 * CDN URL Generation and Optimization
 * 
 * Provides utilities for generating optimized CDN URLs for assets stored in R2,
 * including signed URLs, image transformations, and bulk URL generation.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Config } from "./r2-config";

/**
 * Image transformation parameters
 * Supports common image transformation operations
 */
export interface ImageTransformParams {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Resize mode: 'fit' (maintain aspect ratio), 'fill' (crop to exact size), 'scale' (stretch) */
  fit?: "fit" | "fill" | "scale";
  /** Image format: 'auto' (WebP when supported), 'webp', 'jpeg', 'png', 'avif' */
  format?: "auto" | "webp" | "jpeg" | "png" | "avif";
  /** Quality (1-100) for lossy formats */
  quality?: number;
  /** Enable sharpening */
  sharpen?: boolean;
  /** Enable blur (0-250) */
  blur?: number;
  /** Rotation angle (0, 90, 180, 270) */
  rotate?: 0 | 90 | 180 | 270;
  /** Enable progressive JPEG */
  progressive?: boolean;
}

/**
 * Options for generating CDN URLs
 */
export interface CdnUrlOptions {
  /** Storage key (path) of the file */
  key: string;
  /** Whether to generate a signed URL (for protected content) */
  signed?: boolean;
  /** Expiration time in seconds for signed URLs (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Image transformation parameters */
  transform?: ImageTransformParams;
  /** Custom query parameters to append */
  queryParams?: Record<string, string | number | boolean>;
}

/**
 * Options for bulk URL generation
 */
export interface BulkCdnUrlOptions {
  /** Array of storage keys */
  keys: string[];
  /** Base options to apply to all URLs */
  baseOptions?: Omit<CdnUrlOptions, "key">;
  /** Whether to use parallel processing (default: true) */
  parallel?: boolean;
}

/**
 * URL cache entry
 */
interface UrlCacheEntry {
  url: string;
  expiresAt: number;
}

/**
 * Simple in-memory URL cache
 * In production, consider using Redis or similar for distributed caching
 */
class UrlCache {
  private cache = new Map<string, UrlCacheEntry>();
  private maxSize = 1000; // Maximum cache entries

  /**
   * Get cached URL if still valid
   */
  get(cacheKey: string): string | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.url;
  }

  /**
   * Set URL in cache
   */
  set(cacheKey: string, url: string, ttlSeconds: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      url,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global URL cache instance
const urlCache = new UrlCache();

/**
 * Generate cache key for URL caching
 */
function generateCacheKey(options: CdnUrlOptions): string {
  const parts = [
    options.key,
    options.signed ? "signed" : "public",
    options.expiresIn?.toString() || "3600",
    options.transform ? JSON.stringify(options.transform) : "",
    options.queryParams ? JSON.stringify(options.queryParams) : "",
  ];
  return parts.join("|");
}

/**
 * Build transformation query string
 * Supports Cloudflare Images API format and custom transformation services
 */
function buildTransformQuery(transform: ImageTransformParams): string {
  const params: string[] = [];

  if (transform.width) {
    params.push(`w=${transform.width}`);
  }
  if (transform.height) {
    params.push(`h=${transform.height}`);
  }
  if (transform.fit) {
    params.push(`fit=${transform.fit}`);
  }
  if (transform.format && transform.format !== "auto") {
    params.push(`f=${transform.format}`);
  }
  if (transform.quality !== undefined) {
    params.push(`q=${Math.max(1, Math.min(100, transform.quality))}`);
  }
  if (transform.sharpen) {
    params.push("sharpen=1");
  }
  if (transform.blur !== undefined) {
    params.push(`blur=${Math.max(0, Math.min(250, transform.blur))}`);
  }
  if (transform.rotate) {
    params.push(`rotate=${transform.rotate}`);
  }
  if (transform.progressive) {
    params.push("progressive=1");
  }

  return params.length > 0 ? params.join("&") : "";
}

/**
 * Build query string from custom parameters
 */
function buildQueryString(params: Record<string, string | number | boolean>): string {
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return entries.length > 0 ? entries.join("&") : "";
}

/**
 * Encode storage key for URL usage
 * Properly encodes special characters while preserving path structure
 */
function encodeStorageKey(key: string): string {
  // Split by '/' to preserve path structure
  const segments = key.split("/");
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

/**
 * Generate a public CDN URL
 */
function generatePublicUrl(key: string, transform?: ImageTransformParams, queryParams?: Record<string, string | number | boolean>): string {
  const config = getR2Config();
  
  // Use custom domain if configured, otherwise use R2 public URL format
  let baseUrl: string;
  
  if (config.publicUrl) {
    baseUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
  } else {
    // R2 public URL format: https://<bucket-name>.<account-id>.r2.cloudflarestorage.com
    baseUrl = `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;
  }

  const encodedKey = encodeStorageKey(key);
  let url = `${baseUrl}/${encodedKey}`;

  // Add transformation parameters
  const transformQuery = transform ? buildTransformQuery(transform) : "";
  const customQuery = queryParams ? buildQueryString(queryParams) : "";

  const queries: string[] = [];
  if (transformQuery) queries.push(transformQuery);
  if (customQuery) queries.push(customQuery);

  if (queries.length > 0) {
    url += `?${queries.join("&")}`;
  }

  return url;
}

/**
 * Generate a signed URL for protected content
 */
async function generateSignedUrl(
  key: string,
  expiresIn: number = 3600,
  transform?: ImageTransformParams,
  queryParams?: Record<string, string | number | boolean>
): Promise<string> {
  const client = getR2Client();
  const config = getR2Config();

  // Build command for getting the object
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  // Generate signed URL
  const signedUrl = await getSignedUrl(client, command, { expiresIn });

  // Add transformation and custom query parameters if provided
  const transformQuery = transform ? buildTransformQuery(transform) : "";
  const customQuery = queryParams ? buildQueryString(queryParams) : "";

  const queries: string[] = [];
  if (transformQuery) queries.push(transformQuery);
  if (customQuery) queries.push(customQuery);

  if (queries.length > 0) {
    // Parse the signed URL and append additional query parameters
    const url = new URL(signedUrl);
    queries.forEach((query) => {
      query.split("&").forEach((param) => {
        const [key, value] = param.split("=");
        if (key && value) {
          url.searchParams.append(key, value);
        }
      });
    });
    return url.toString();
  }

  return signedUrl;
}

/**
 * Generate a CDN URL (public or signed)
 * 
 * @param options - URL generation options
 * @returns CDN URL string
 * 
 * @example
 * ```typescript
 * // Public URL
 * const url = await generateCdnUrl({ key: "albums/123/photos/456/original.jpg" });
 * 
 * // Signed URL with expiration
 * const signedUrl = await generateCdnUrl({
 *   key: "albums/123/photos/456/original.jpg",
 *   signed: true,
 *   expiresIn: 7200 // 2 hours
 * });
 * 
 * // URL with image transformation
 * const thumbnailUrl = await generateCdnUrl({
 *   key: "albums/123/photos/456/original.jpg",
 *   transform: { width: 300, height: 300, fit: "fit", format: "webp", quality: 85 }
 * });
 * ```
 */
export async function generateCdnUrl(options: CdnUrlOptions): Promise<string> {
  const {
    key,
    signed = false,
    expiresIn = 3600,
    transform,
    queryParams,
  } = options;

  if (!key) {
    throw new Error("Storage key is required for CDN URL generation");
  }

  // Check cache for non-signed URLs (signed URLs shouldn't be cached long-term)
  if (!signed) {
    const cacheKey = generateCacheKey(options);
    const cached = urlCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let url: string;

  if (signed) {
    url = await generateSignedUrl(key, expiresIn, transform, queryParams);
  } else {
    url = generatePublicUrl(key, transform, queryParams);
    
    // Cache public URLs (cache for shorter TTL than signed URLs)
    const cacheKey = generateCacheKey(options);
    urlCache.set(cacheKey, url, 300); // Cache for 5 minutes
  }

  return url;
}

/**
 * Generate CDN URLs for multiple files in bulk
 * 
 * @param options - Bulk URL generation options
 * @returns Map of storage keys to CDN URLs
 * 
 * @example
 * ```typescript
 * const urls = await generateBulkCdnUrls({
 *   keys: [
 *     "albums/123/photos/456/original.jpg",
 *     "albums/123/photos/789/original.jpg"
 *   ],
 *   baseOptions: {
 *     transform: { width: 300, format: "webp" }
 *   }
 * });
 * ```
 */
export async function generateBulkCdnUrls(
  options: BulkCdnUrlOptions
): Promise<Map<string, string>> {
  const { keys, baseOptions = {}, parallel = true } = options;

  if (!keys || keys.length === 0) {
    return new Map();
  }

  const results = new Map<string, string>();

  if (parallel) {
    // Generate URLs in parallel
    const promises = keys.map(async (key) => {
      try {
        const url = await generateCdnUrl({ ...baseOptions, key });
        return { key, url };
      } catch (error) {
        console.error(`Failed to generate URL for key "${key}":`, error);
        return { key, url: null };
      }
    });

    const urlResults = await Promise.all(promises);
    urlResults.forEach(({ key, url }) => {
      if (url) {
        results.set(key, url);
      }
    });
  } else {
    // Generate URLs sequentially
    for (const key of keys) {
      try {
        const url = await generateCdnUrl({ ...baseOptions, key });
        results.set(key, url);
      } catch (error) {
        console.error(`Failed to generate URL for key "${key}":`, error);
      }
    }
  }

  return results;
}

/**
 * Generate CDN URL with common thumbnail transformation
 * Convenience function for generating thumbnail URLs
 * 
 * @param key - Storage key
 * @param size - Thumbnail size in pixels (default: 300)
 * @param signed - Whether to generate signed URL
 * @param expiresIn - Expiration time for signed URLs
 * @returns CDN URL for thumbnail
 */
export async function generateThumbnailUrl(
  key: string,
  size: number = 300,
  signed: boolean = false,
  expiresIn: number = 3600
): Promise<string> {
  return generateCdnUrl({
    key,
    signed,
    expiresIn,
    transform: {
      width: size,
      height: size,
      fit: "fit",
      format: "webp",
      quality: 85,
    },
  });
}

/**
 * Generate CDN URL with common preview transformation
 * Convenience function for generating preview URLs
 * 
 * @param key - Storage key
 * @param maxWidth - Maximum width in pixels (default: 1200)
 * @param signed - Whether to generate signed URL
 * @param expiresIn - Expiration time for signed URLs
 * @returns CDN URL for preview
 */
export async function generatePreviewUrl(
  key: string,
  maxWidth: number = 1200,
  signed: boolean = false,
  expiresIn: number = 3600
): Promise<string> {
  return generateCdnUrl({
    key,
    signed,
    expiresIn,
    transform: {
      width: maxWidth,
      fit: "fit",
      format: "webp",
      quality: 90,
      progressive: true,
    },
  });
}

/**
 * Clear the URL cache
 * Useful for testing or when cache needs to be invalidated
 */
export function clearUrlCache(): void {
  urlCache.clear();
}

/**
 * Clean up expired cache entries
 * Call this periodically to prevent memory leaks
 */
export function cleanupUrlCache(): void {
  urlCache.cleanup();
}


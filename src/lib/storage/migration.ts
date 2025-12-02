/**
 * File Migration Utilities
 * 
 * Utilities for reorganizing existing files in R2 storage.
 * Useful for migrating from flat structures to hierarchical organization.
 */

import { getR2Client, getR2Config } from "./r2-config";
import {
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { uploadFile } from "./upload";
import { downloadFileAsBuffer } from "./download";
import { generatePhotoPath, parsePhotoPath, type PathOptions } from "./paths";

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Source prefix to migrate from */
  sourcePrefix: string;
  /** Function to generate new path from old path */
  pathMapper: (oldKey: string) => string | null;
  /** Whether to delete source files after migration */
  deleteSource?: boolean;
  /** Batch size for processing */
  batchSize?: number;
  /** Callback for progress updates */
  onProgress?: (progress: {
    processed: number;
    total: number;
    current: string;
  }) => void;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Number of files successfully migrated */
  migrated: number;
  /** Number of files that failed to migrate */
  failed: number;
  /** List of failed file keys */
  failedKeys: string[];
  /** Total files processed */
  total: number;
}

/**
 * Migrate files from one path structure to another
 * 
 * This function:
 * 1. Lists all files matching the source prefix
 * 2. Maps each file to its new path using the pathMapper
 * 3. Copies files to new locations
 * 4. Optionally deletes source files
 * 
 * @param options - Migration options
 * @returns Migration result
 * 
 * @example
 * ```typescript
 * // Migrate from flat structure to hierarchical
 * const result = await migrateFiles({
 *   sourcePrefix: "photos/",
 *   pathMapper: (oldKey) => {
 *     // Extract photo ID from old key and generate new path
 *     const photoId = extractPhotoId(oldKey);
 *     return generatePhotoPath({ albumId: "album123", photoId, fileType: FileType.ORIGINAL });
 *   },
 *   deleteSource: false, // Keep originals for safety
 * });
 * ```
 */
export async function migrateFiles(
  options: MigrationOptions
): Promise<MigrationResult> {
  const client = getR2Client();
  const config = getR2Config();

  const {
    sourcePrefix,
    pathMapper,
    deleteSource = false,
    batchSize = 10,
    onProgress,
  } = options;

  const result: MigrationResult = {
    migrated: 0,
    failed: 0,
    failedKeys: [],
    total: 0,
  };

  // List all files with source prefix
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const listResponse = await client.send(listCommand);

    if (listResponse.Contents) {
      for (const object of listResponse.Contents) {
        if (object.Key) {
          files.push(object.Key);
        }
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  result.total = files.length;

  // Process files in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (oldKey) => {
        try {
          // Generate new path
          const newKey = pathMapper(oldKey);
          if (!newKey) {
            result.failed++;
            result.failedKeys.push(oldKey);
            return;
          }

          // Skip if source and destination are the same
          if (oldKey === newKey) {
            result.migrated++;
            return;
          }

          // Check if destination already exists
          const { fileExists } = await import("./organization");
          if (await fileExists(newKey)) {
            // Destination exists, skip or handle as needed
            console.warn(`Destination already exists: ${newKey}, skipping migration`);
            result.migrated++;
            return;
          }

          // Copy file to new location
          // For R2, we can use CopyObject if both are in the same bucket
          const copyCommand = new CopyObjectCommand({
            Bucket: config.bucketName,
            CopySource: `${config.bucketName}/${oldKey}`,
            Key: newKey,
          });

          await client.send(copyCommand);

          // Optionally delete source file
          if (deleteSource) {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: config.bucketName,
              Key: oldKey,
            });
            await client.send(deleteCommand);
          }

          result.migrated++;

          // Progress callback
          if (onProgress) {
            onProgress({
              processed: result.migrated + result.failed,
              total: result.total,
              current: oldKey,
            });
          }
        } catch (error) {
          result.failed++;
          result.failedKeys.push(oldKey);
          console.error(`Failed to migrate ${oldKey}:`, error);
        }
      })
    );
  }

  return result;
}

/**
 * Reorganize files by album and photo ID
 * 
 * Migrates files from a flat or old structure to the hierarchical structure
 * based on album and photo IDs extracted from metadata or filenames.
 * 
 * @param options - Reorganization options
 * @returns Migration result
 */
export interface ReorganizeOptions {
  /** Source prefix */
  sourcePrefix: string;
  /** Function to extract album ID from old key */
  extractAlbumId: (oldKey: string) => string | null;
  /** Function to extract photo ID from old key */
  extractPhotoId: (oldKey: string) => string | null;
  /** Function to determine file type from old key */
  extractFileType: (oldKey: string) => "original" | "thumbnail" | "preview" | "watermarked" | null;
  /** Optional user ID */
  userId?: string;
  /** Whether to include user in path */
  includeUser?: boolean;
  /** Whether to delete source files */
  deleteSource?: boolean;
  /** Progress callback */
  onProgress?: (progress: {
    processed: number;
    total: number;
    current: string;
  }) => void;
}

export async function reorganizeFiles(
  options: ReorganizeOptions
): Promise<MigrationResult> {
  const { generatePhotoPath, FileType } = await import("./paths");

  return migrateFiles({
    sourcePrefix: options.sourcePrefix,
    pathMapper: (oldKey) => {
      const albumId = options.extractAlbumId(oldKey);
      const photoId = options.extractPhotoId(oldKey);
      const fileTypeStr = options.extractFileType(oldKey);

      if (!albumId || !photoId) {
        return null; // Cannot determine new path
      }

      const fileType =
        fileTypeStr === "thumbnail"
          ? FileType.THUMBNAIL
          : fileTypeStr === "preview"
          ? FileType.PREVIEW
          : fileTypeStr === "watermarked"
          ? FileType.WATERMARKED
          : FileType.ORIGINAL;

      return generatePhotoPath({
        albumId,
        photoId,
        fileType,
        userId: options.userId,
        includeUser: options.includeUser,
        filename: oldKey, // Extract extension from old filename
      });
    },
    deleteSource: options.deleteSource,
    onProgress: options.onProgress,
  });
}


/**
 * Storage Provider Migration Utilities
 * 
 * Utilities for migrating data between different storage providers.
 * Useful for switching providers or backing up data.
 */

import type { StorageProvider } from "./provider";

/**
 * Migration options
 */
export interface ProviderMigrationOptions {
  /** Source storage provider */
  sourceProvider: StorageProvider;
  /** Destination storage provider */
  destinationProvider: StorageProvider;
  /** Prefix to filter files to migrate */
  prefix?: string;
  /** Maximum number of files to migrate (for testing) */
  maxFiles?: number;
  /** Batch size for processing */
  batchSize?: number;
  /** Whether to delete source files after successful migration */
  deleteSource?: boolean;
  /** Whether to verify files after migration */
  verifyAfterMigration?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: {
    processed: number;
    total: number;
    current: string;
    status: "copying" | "verifying" | "deleting" | "complete" | "error";
  }) => void;
}

/**
 * Migration result
 */
export interface ProviderMigrationResult {
  /** Number of files successfully migrated */
  migrated: number;
  /** Number of files that failed to migrate */
  failed: number;
  /** List of failed file keys */
  failedKeys: string[];
  /** Total files processed */
  total: number;
  /** Total bytes migrated */
  totalBytes: number;
  /** Migration duration in milliseconds */
  duration: number;
}

/**
 * Migrate files from one storage provider to another
 * 
 * This function:
 * 1. Lists all files in the source provider
 * 2. Downloads each file from source
 * 3. Uploads each file to destination
 * 4. Optionally verifies the migration
 * 5. Optionally deletes source files
 * 
 * @param options - Migration options
 * @returns Migration result
 * 
 * @example
 * ```typescript
 * const sourceProvider = createStorageProvider({ type: "r2" });
 * const destProvider = createStorageProvider({ type: "s3" });
 * 
 * const result = await migrateBetweenProviders({
 *   sourceProvider,
 *   destinationProvider: destProvider,
 *   prefix: "albums/",
 *   verifyAfterMigration: true,
 *   deleteSource: false, // Keep originals for safety
 *   onProgress: (progress) => {
 *     console.log(`Migrated ${progress.processed}/${progress.total} files`);
 *   },
 * });
 * ```
 */
export async function migrateBetweenProviders(
  options: ProviderMigrationOptions
): Promise<ProviderMigrationResult> {
  const {
    sourceProvider,
    destinationProvider,
    prefix = "",
    maxFiles,
    batchSize = 10,
    deleteSource = false,
    verifyAfterMigration = false,
    onProgress,
  } = options;

  const startTime = Date.now();
  const result: ProviderMigrationResult = {
    migrated: 0,
    failed: 0,
    failedKeys: [],
    total: 0,
    totalBytes: 0,
    duration: 0,
  };

  try {
    // Step 1: List all files in source provider
    onProgress?.({
      processed: 0,
      total: 0,
      current: "",
      status: "copying",
    });

    const allKeys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listResult = await sourceProvider.listFiles({
        prefix,
        continuationToken,
        maxResults: 1000,
      });

      for (const key of listResult.keys) {
        allKeys.push(key);
        if (maxFiles && allKeys.length >= maxFiles) {
          break;
        }
      }

      continuationToken = listResult.continuationToken;
      if (maxFiles && allKeys.length >= maxFiles) {
        break;
      }
    } while (continuationToken);

    result.total = allKeys.length;

    // Step 2: Migrate files in batches
    for (let i = 0; i < allKeys.length; i += batchSize) {
      const batch = allKeys.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (key) => {
          try {
            onProgress?.({
              processed: result.migrated + result.failed,
              total: result.total,
              current: key,
              status: "copying",
            });

            // Download from source
            const downloadResult =
              await sourceProvider.downloadFileAsBuffer(key);

            // Get metadata from source
            const metadata = await sourceProvider.getFileMetadata(key);

            // Upload to destination
            await destinationProvider.uploadFile(key, downloadResult.buffer, {
              contentType: metadata.contentType,
              metadata: metadata.metadata,
              cacheControl: metadata.metadata?.cacheControl,
            });

            // Verify if requested
            if (verifyAfterMigration) {
              onProgress?.({
                processed: result.migrated + result.failed,
                total: result.total,
                current: key,
                status: "verifying",
              });

              const destMetadata =
                await destinationProvider.getFileMetadata(key);

              // Verify size matches
              if (
                metadata.contentLength &&
                destMetadata.contentLength !== metadata.contentLength
              ) {
                throw new Error(
                  `Size mismatch: source=${metadata.contentLength}, dest=${destMetadata.contentLength}`
                );
              }

              // Verify ETag matches (if both providers support it)
              if (
                metadata.etag &&
                destMetadata.etag &&
                metadata.etag !== destMetadata.etag
              ) {
                // ETag mismatch might be okay if providers use different algorithms
                // Log warning but don't fail
                console.warn(
                  `ETag mismatch for ${key}: source=${metadata.etag}, dest=${destMetadata.etag}`
                );
              }
            }

            // Delete from source if requested
            if (deleteSource) {
              onProgress?.({
                processed: result.migrated + result.failed,
                total: result.total,
                current: key,
                status: "deleting",
              });

              await sourceProvider.deleteFile(key);
            }

            result.migrated++;
            result.totalBytes += downloadResult.contentLength ?? 0;
          } catch (error) {
            result.failed++;
            result.failedKeys.push(key);
            console.error(`Failed to migrate ${key}:`, error);
          }
        })
      );
    }

    result.duration = Date.now() - startTime;

    onProgress?.({
      processed: result.total,
      total: result.total,
      current: "",
      status: "complete",
    });

    return result;
  } catch (error) {
    result.duration = Date.now() - startTime;

    onProgress?.({
      processed: result.migrated + result.failed,
      total: result.total,
      current: "",
      status: "error",
    });

    throw error;
  }
}

/**
 * Compare files between two storage providers
 * 
 * Useful for verifying migration or checking for differences.
 * 
 * @param sourceProvider - Source storage provider
 * @param destinationProvider - Destination storage provider
 * @param prefix - Prefix to filter files
 * @returns Comparison result
 */
export async function compareProviders(
  sourceProvider: StorageProvider,
  destinationProvider: StorageProvider,
  prefix = ""
): Promise<{
  matching: string[];
  missingInDestination: string[];
  missingInSource: string[];
  sizeMismatches: Array<{ key: string; sourceSize?: number; destSize?: number }>;
  total: number;
}> {
  const result = {
    matching: [] as string[],
    missingInDestination: [] as string[],
    missingInSource: [] as string[],
    sizeMismatches: [] as Array<{
      key: string;
      sourceSize?: number;
      destSize?: number;
    }>,
    total: 0,
  };

  // List files in source
  const sourceKeys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const listResult = await sourceProvider.listFiles({
      prefix,
      continuationToken,
      maxResults: 1000,
    });

    for (const key of listResult.keys) {
      sourceKeys.add(key);
    }

    continuationToken = listResult.continuationToken;
  } while (continuationToken);

  // List files in destination
  const destKeys = new Set<string>();
  continuationToken = undefined;

  do {
    const listResult = await destinationProvider.listFiles({
      prefix,
      continuationToken,
      maxResults: 1000,
    });

    for (const key of listResult.keys) {
      destKeys.add(key);
    }

    continuationToken = listResult.continuationToken;
  } while (continuationToken);

  result.total = sourceKeys.size;

  // Compare files
  for (const key of sourceKeys) {
    if (!destKeys.has(key)) {
      result.missingInDestination.push(key);
      continue;
    }

    // Check if sizes match
    try {
      const sourceMetadata = await sourceProvider.getFileMetadata(key);
      const destMetadata = await destinationProvider.getFileMetadata(key);

      if (
        sourceMetadata.contentLength !== destMetadata.contentLength
      ) {
        result.sizeMismatches.push({
          key,
          sourceSize: sourceMetadata.contentLength,
          destSize: destMetadata.contentLength,
        });
      } else {
        result.matching.push(key);
      }
    } catch (error) {
      // If we can't get metadata, assume mismatch
      result.sizeMismatches.push({ key });
    }
  }

  // Find files in destination but not in source
  for (const key of destKeys) {
    if (!sourceKeys.has(key)) {
      result.missingInSource.push(key);
    }
  }

  return result;
}


/**
 * File Organization Utilities
 * 
 * Utilities for organizing, indexing, and managing files in the hierarchical structure.
 */

import {
  generatePhotoPath,
  generateAlbumPath,
  generateUserPath,
  parsePhotoPath,
  FileType,
  type PathOptions,
  type ParsedPath,
} from "./paths";
import { getR2Client, getR2Config } from "./r2-config";
import {
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * File index entry
 */
export interface FileIndexEntry {
  /** Storage key (path) */
  key: string;
  /** Parsed path components */
  parsed: ParsedPath;
  /** File size in bytes */
  size?: number;
  /** Last modified date */
  lastModified?: Date;
  /** Content type */
  contentType?: string;
}

/**
 * Album file listing options
 */
export interface ListAlbumFilesOptions {
  /** Album ID */
  albumId: string;
  /** Optional user ID */
  userId?: string;
  /** Whether to include user in path */
  includeUser?: boolean;
  /** File type filter */
  fileType?: FileType;
  /** Maximum number of results */
  maxResults?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
}

/**
 * List all files in an album
 * 
 * @param options - Listing options
 * @returns Array of file index entries
 */
export async function listAlbumFiles(
  options: ListAlbumFilesOptions
): Promise<{
  files: FileIndexEntry[];
  continuationToken?: string;
  isTruncated: boolean;
}> {
  const client = getR2Client();
  const config = getR2Config();

  const {
    albumId,
    userId,
    includeUser = false,
    fileType,
    maxResults = 1000,
    continuationToken,
  } = options;

  // Generate album prefix
  const albumPrefix = generateAlbumPath(albumId, userId, includeUser);

  const command: ListObjectsV2CommandInput = {
    Bucket: config.bucketName,
    Prefix: albumPrefix,
    MaxKeys: maxResults,
    ContinuationToken: continuationToken,
  };

  try {
    const response = await client.send(new ListObjectsV2Command(command));

    const files: FileIndexEntry[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (!object.Key) continue;

        // Parse the path
        const parsed = parsePhotoPath(object.Key);
        if (!parsed) continue;

        // Filter by file type if specified
        if (fileType && parsed.fileType !== fileType) {
          continue;
        }

        files.push({
          key: object.Key,
          parsed,
          size: object.Size,
          lastModified: object.LastModified,
        });
      }
    }

    return {
      files,
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated ?? false,
    };
  } catch (error) {
    throw new Error(
      `Failed to list album files: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Find files by photo ID across all albums
 * Useful for locating all variants of a photo (original, thumbnail, etc.)
 * 
 * @param photoId - Photo ID to search for
 * @param maxResults - Maximum number of results
 * @returns Array of file index entries
 */
export async function findFilesByPhotoId(
  photoId: string,
  maxResults = 100
): Promise<FileIndexEntry[]> {
  const client = getR2Client();
  const config = getR2Config();

  // Search for files containing the photo ID in the path
  // This is a simple prefix search - for better performance, consider using metadata or a database index
  const searchPrefix = `albums/`;
  
  const command: ListObjectsV2CommandInput = {
    Bucket: config.bucketName,
    Prefix: searchPrefix,
    MaxKeys: maxResults * 10, // Get more results to filter
  };

  try {
    const response = await client.send(new ListObjectsV2Command(command));
    const files: FileIndexEntry[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (!object.Key) continue;

        const parsed = parsePhotoPath(object.Key);
        if (parsed && parsed.photoId === photoId) {
          files.push({
            key: object.Key,
            parsed,
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      }
    }

    return files.slice(0, maxResults);
  } catch (error) {
    throw new Error(
      `Failed to find files by photo ID: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get file count for an album
 * 
 * @param albumId - Album ID
 * @param userId - Optional user ID
 * @param includeUser - Whether to include user in path
 * @returns Number of files in the album
 */
export async function getAlbumFileCount(
  albumId: string,
  userId?: string,
  includeUser = false
): Promise<number> {
  const result = await listAlbumFiles({
    albumId,
    userId,
    includeUser,
    maxResults: 1000,
  });

  // If truncated, we need to count all pages
  let count = result.files.length;
  let token = result.continuationToken;

  while (result.isTruncated && token) {
    const nextResult = await listAlbumFiles({
      albumId,
      userId,
      includeUser,
      maxResults: 1000,
      continuationToken: token,
    });
    count += nextResult.files.length;
    token = nextResult.continuationToken;
    if (!nextResult.isTruncated) break;
  }

  return count;
}

/**
 * Get all file types for a photo
 * 
 * @param albumId - Album ID
 * @param photoId - Photo ID
 * @param userId - Optional user ID
 * @param includeUser - Whether to include user in path
 * @returns Array of file types that exist for this photo
 */
export async function getPhotoFileTypes(
  albumId: string,
  photoId: string,
  userId?: string,
  includeUser = false
): Promise<FileType[]> {
  const files = await listAlbumFiles({
    albumId,
    userId,
    includeUser,
    maxResults: 1000,
  });

  const fileTypes = new Set<FileType>();

  for (const file of files.files) {
    if (file.parsed.photoId === photoId) {
      fileTypes.add(file.parsed.fileType);
    }
  }

  return Array.from(fileTypes);
}

/**
 * Check if a file exists
 * 
 * @param storageKey - Storage key to check
 * @returns True if file exists, false otherwise
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const client = getR2Client();
  const config = getR2Config();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
    });

    await client.send(command);
    return true;
  } catch (error) {
    // If error is 404, file doesn't exist
    if (error instanceof Error && error.message.includes("NotFound")) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}


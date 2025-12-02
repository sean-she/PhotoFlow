/**
 * Hierarchical File Organization System
 * 
 * Organizes files in R2 storage using a consistent hierarchical structure.
 * Supports organization by user, album, photo, and file type.
 */

/**
 * File type enum for different photo variants
 */
export enum FileType {
  ORIGINAL = "original",
  THUMBNAIL = "thumbnail",
  PREVIEW = "preview",
  WATERMARKED = "watermarked",
}

/**
 * Path generation options
 */
export interface PathOptions {
  /** User/Photographer ID */
  userId?: string;
  /** Album ID */
  albumId: string;
  /** Photo ID */
  photoId: string;
  /** File type (original, thumbnail, etc.) */
  fileType?: FileType;
  /** Original filename (for extension extraction) */
  filename?: string;
  /** Custom extension override */
  extension?: string;
  /** Date for date-based organization (optional) */
  date?: Date;
  /** Whether to include user in path */
  includeUser?: boolean;
}

/**
 * Sanitize a string for use in file paths
 * Handles special characters, international text, and path safety
 * 
 * @param input - String to sanitize
 * @returns Sanitized string safe for file paths
 */
export function sanitizePathSegment(input: string): string {
  if (!input) return "";
  
  // Remove or replace problematic characters
  return input
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, "-")
    // Remove or replace special characters that could cause issues
    .replace(/[<>:"|?*\x00-\x1F]/g, "")
    // Replace multiple consecutive hyphens/underscores with single hyphen
    .replace(/[-_]+/g, "-")
    // Remove leading/trailing hyphens and dots
    .replace(/^[-.]+|[-.]+$/g, "")
    // Limit length to prevent path issues
    .substring(0, 255)
    // Ensure it's not empty after sanitization
    || "file";
}

/**
 * Extract file extension from filename
 * 
 * @param filename - Filename with or without extension
 * @returns File extension (without dot) or empty string
 */
export function getFileExtension(filename: string): string {
  if (!filename) return "";
  
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Generate storage key for a photo file
 * 
 * Structure: albums/{albumId}/photos/{photoId}/{fileType}.{ext}
 * Or with user: users/{userId}/albums/{albumId}/photos/{photoId}/{fileType}.{ext}
 * 
 * @param options - Path generation options
 * @returns Storage key (path) for the file
 * 
 * @example
 * ```typescript
 * // Basic path
 * generatePhotoPath({ albumId: "abc123", photoId: "photo456", fileType: FileType.ORIGINAL, filename: "photo.jpg" })
 * // Returns: "albums/abc123/photos/photo456/original.jpg"
 * 
 * // With user
 * generatePhotoPath({ userId: "user789", albumId: "abc123", photoId: "photo456", fileType: FileType.THUMBNAIL, filename: "photo.jpg", includeUser: true })
 * // Returns: "users/user789/albums/abc123/photos/photo456/thumbnail.jpg"
 * ```
 */
export function generatePhotoPath(options: PathOptions): string {
  const {
    userId,
    albumId,
    photoId,
    fileType = FileType.ORIGINAL,
    filename,
    extension,
    includeUser = false,
  } = options;

  // Validate required fields
  if (!albumId) {
    throw new Error("albumId is required for path generation");
  }
  if (!photoId) {
    throw new Error("photoId is required for path generation");
  }

  // Sanitize IDs
  const sanitizedAlbumId = sanitizePathSegment(albumId);
  const sanitizedPhotoId = sanitizePathSegment(photoId);
  const sanitizedFileType = sanitizePathSegment(fileType);

  // Determine extension
  let fileExtension = extension;
  if (!fileExtension && filename) {
    fileExtension = getFileExtension(filename);
  }
  if (!fileExtension) {
    fileExtension = "jpg"; // Default extension
  }
  const sanitizedExtension = sanitizePathSegment(fileExtension);

  // Build path segments
  const segments: string[] = [];

  // Optional: Include user in path
  if (includeUser && userId) {
    const sanitizedUserId = sanitizePathSegment(userId);
    segments.push("users", sanitizedUserId);
  }

  // Album and photo structure
  segments.push("albums", sanitizedAlbumId);
  segments.push("photos", sanitizedPhotoId);

  // File type and extension
  const fileName = `${sanitizedFileType}.${sanitizedExtension}`;
  segments.push(fileName);

  return segments.join("/");
}

/**
 * Generate storage key for thumbnail
 * Convenience function for thumbnail paths
 */
export function generateThumbnailPath(options: Omit<PathOptions, "fileType">): string {
  return generatePhotoPath({
    ...options,
    fileType: FileType.THUMBNAIL,
  });
}

/**
 * Generate storage key for original photo
 * Convenience function for original photo paths
 */
export function generateOriginalPath(options: Omit<PathOptions, "fileType">): string {
  return generatePhotoPath({
    ...options,
    fileType: FileType.ORIGINAL,
  });
}

/**
 * Parse a storage key to extract path components
 * 
 * @param storageKey - Storage key to parse
 * @returns Parsed path components or null if invalid
 */
export interface ParsedPath {
  userId?: string;
  albumId: string;
  photoId: string;
  fileType: FileType;
  extension: string;
  fullPath: string;
}

export function parsePhotoPath(storageKey: string): ParsedPath | null {
  if (!storageKey) return null;

  const segments = storageKey.split("/").filter(Boolean);

  // Minimum structure: albums/{albumId}/photos/{photoId}/{fileType}.{ext}
  // With user: users/{userId}/albums/{albumId}/photos/{photoId}/{fileType}.{ext}
  
  let userId: string | undefined;
  let albumIndex = -1;
  let photoIndex = -1;

  // Check if path includes user
  if (segments[0] === "users" && segments.length >= 6) {
    userId = segments[1];
    albumIndex = 2;
    photoIndex = 4;
  } else if (segments[0] === "albums" && segments.length >= 4) {
    albumIndex = 0;
    photoIndex = 2;
  } else {
    return null; // Invalid structure
  }

  // Extract components
  if (segments[albumIndex] !== "albums" || segments[photoIndex] !== "photos") {
    return null; // Invalid structure
  }

  const albumId = segments[albumIndex + 1];
  const photoId = segments[photoIndex + 1];
  const fileName = segments[photoIndex + 2];

  if (!albumId || !photoId || !fileName) {
    return null; // Missing required components
  }

  // Parse filename (fileType.extension)
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return null; // No extension
  }

  const fileType = fileName.substring(0, lastDot) as FileType;
  const extension = fileName.substring(lastDot + 1);

  return {
    userId,
    albumId,
    photoId,
    fileType,
    extension,
    fullPath: storageKey,
  };
}

/**
 * Generate path with date-based organization
 * 
 * Structure: albums/{albumId}/photos/{year}/{month}/{photoId}/{fileType}.{ext}
 * 
 * @param options - Path generation options (date will be used if provided)
 * @returns Storage key with date-based organization
 */
export function generateDateBasedPath(options: PathOptions & { date: Date }): string {
  const {
    albumId,
    photoId,
    fileType = FileType.ORIGINAL,
    filename,
    extension,
    date,
    includeUser,
    userId,
  } = options;

  if (!date) {
    throw new Error("date is required for date-based path generation");
  }

  // Validate required fields
  if (!albumId) {
    throw new Error("albumId is required for path generation");
  }
  if (!photoId) {
    throw new Error("photoId is required for path generation");
  }

  // Sanitize IDs
  const sanitizedAlbumId = sanitizePathSegment(albumId);
  const sanitizedPhotoId = sanitizePathSegment(photoId);
  const sanitizedFileType = sanitizePathSegment(fileType);

  // Extract date components
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  // Determine extension
  let fileExtension = extension;
  if (!fileExtension && filename) {
    fileExtension = getFileExtension(filename);
  }
  if (!fileExtension) {
    fileExtension = "jpg";
  }
  const sanitizedExtension = sanitizePathSegment(fileExtension);

  // Build path segments
  const segments: string[] = [];

  // Optional: Include user in path
  if (includeUser && userId) {
    const sanitizedUserId = sanitizePathSegment(userId);
    segments.push("users", sanitizedUserId);
  }

  // Album, date, and photo structure
  segments.push("albums", sanitizedAlbumId);
  segments.push("photos", year, month);
  segments.push(sanitizedPhotoId);

  // File type and extension
  const fileName = `${sanitizedFileType}.${sanitizedExtension}`;
  segments.push(fileName);

  return segments.join("/");
}

/**
 * Generate album directory path
 * Useful for listing all photos in an album
 * 
 * @param albumId - Album ID
 * @param userId - Optional user ID
 * @param includeUser - Whether to include user in path
 * @returns Directory path for album
 */
export function generateAlbumPath(
  albumId: string,
  userId?: string,
  includeUser = false
): string {
  const sanitizedAlbumId = sanitizePathSegment(albumId);
  const segments: string[] = [];

  if (includeUser && userId) {
    const sanitizedUserId = sanitizePathSegment(userId);
    segments.push("users", sanitizedUserId);
  }

  segments.push("albums", sanitizedAlbumId, "photos");

  return segments.join("/");
}

/**
 * Generate user directory path
 * Useful for listing all albums for a user
 * 
 * @param userId - User ID
 * @returns Directory path for user
 */
export function generateUserPath(userId: string): string {
  const sanitizedUserId = sanitizePathSegment(userId);
  return `users/${sanitizedUserId}/albums`;
}


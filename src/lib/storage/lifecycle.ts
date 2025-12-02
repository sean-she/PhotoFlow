/**
 * Lifecycle Policies for Storage Management
 * 
 * Implements lifecycle policies for archival and deletion of files based on age,
 * usage patterns, and business rules. Includes safeguards and audit logging.
 */

import { getR2Client, getR2Config } from "./r2-config";
import { getFileMetadata } from "./download";
import {
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { FileType, parsePhotoPath } from "./paths";

/**
 * Lifecycle action types
 */
export enum LifecycleAction {
  /** No action needed */
  NONE = "none",
  /** Archive the file (move to archival storage class) */
  ARCHIVE = "archive",
  /** Delete the file permanently */
  DELETE = "delete",
  /** Keep the file as-is */
  KEEP = "keep",
}

/**
 * File metadata for lifecycle evaluation
 */
export interface FileLifecycleMetadata {
  /** Storage key (path) */
  key: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
  /** Last accessed date (if available from metadata) */
  lastAccessed?: Date;
  /** Content type */
  contentType?: string;
  /** Custom metadata from object */
  metadata?: Record<string, string>;
  /** Parsed path components */
  parsed?: {
    userId?: string;
    albumId: string;
    photoId: string;
    fileType: FileType;
    extension: string;
  };
  /** Age in days since last modified */
  ageDays: number;
  /** Age in days since last accessed (if available) */
  ageSinceAccessDays?: number;
}

/**
 * Lifecycle policy rule
 */
export interface LifecyclePolicyRule {
  /** Rule identifier */
  id: string;
  /** Rule name/description */
  name: string;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Priority (lower numbers evaluated first) */
  priority: number;
  /** Conditions that must be met for this rule to apply */
  conditions: LifecycleRuleConditions;
  /** Action to take when conditions are met */
  action: LifecycleAction;
  /** Additional action parameters */
  actionParams?: LifecycleActionParams;
  /** Safeguards to prevent accidental actions */
  safeguards?: LifecycleSafeguards;
}

/**
 * Conditions for a lifecycle rule
 */
export interface LifecycleRuleConditions {
  /** Minimum age in days (since last modified) */
  minAgeDays?: number;
  /** Maximum age in days (since last modified) */
  maxAgeDays?: number;
  /** Minimum age since last access in days */
  minAgeSinceAccessDays?: number;
  /** Maximum age since last access in days */
  maxAgeSinceAccessDays?: number;
  /** Minimum file size in bytes */
  minSizeBytes?: number;
  /** Maximum file size in bytes */
  maxSizeBytes?: number;
  /** File types to include (empty = all) */
  fileTypes?: FileType[];
  /** Content types to include (empty = all) */
  contentTypes?: string[];
  /** Path prefix patterns to match */
  pathPrefixes?: string[];
  /** Path prefix patterns to exclude */
  excludePrefixes?: string[];
  /** Metadata key-value pairs that must match */
  metadataMatch?: Record<string, string>;
  /** Metadata keys that must exist */
  metadataRequired?: string[];
  /** Metadata keys that must NOT exist */
  metadataExcluded?: string[];
  /** Custom evaluation function */
  customEvaluator?: (metadata: FileLifecycleMetadata) => boolean;
}

/**
 * Action parameters
 */
export interface LifecycleActionParams {
  /** For ARCHIVE: target storage class or path prefix */
  archiveTarget?: string;
  /** For DELETE: whether to require confirmation */
  requireConfirmation?: boolean;
  /** For DELETE: grace period in days before actual deletion */
  gracePeriodDays?: number;
}

/**
 * Safeguards to prevent accidental actions
 */
export interface LifecycleSafeguards {
  /** Never delete files matching these patterns */
  protectedPrefixes?: string[];
  /** Never delete files with these metadata keys */
  protectedMetadataKeys?: string[];
  /** Never delete files with these metadata values */
  protectedMetadataValues?: Record<string, string[]>;
  /** Maximum number of files that can be deleted in one operation */
  maxDeletionsPerRun?: number;
  /** Whether to require explicit confirmation for deletions */
  requireDeletionConfirmation?: boolean;
  /** Custom safeguard function */
  customSafeguard?: (metadata: FileLifecycleMetadata, action: LifecycleAction) => boolean;
}

/**
 * Lifecycle policy configuration
 */
export interface LifecyclePolicyConfig {
  /** List of policy rules */
  rules: LifecyclePolicyRule[];
  /** Global safeguards that apply to all rules */
  globalSafeguards?: LifecycleSafeguards;
  /** Whether to enable audit logging */
  enableAuditLog?: boolean;
  /** Audit log storage location (optional) */
  auditLogPath?: string;
}

/**
 * Lifecycle evaluation result
 */
export interface LifecycleEvaluationResult {
  /** File metadata */
  file: FileLifecycleMetadata;
  /** Matched rule (if any) */
  matchedRule?: LifecyclePolicyRule;
  /** Recommended action */
  action: LifecycleAction;
  /** Action parameters */
  actionParams?: LifecycleActionParams;
  /** Whether safeguards prevented the action */
  safeguardBlocked?: boolean;
  /** Reason for safeguard block (if applicable) */
  safeguardReason?: string;
  /** Evaluation timestamp */
  evaluatedAt: Date;
}

/**
 * Lifecycle execution result
 */
export interface LifecycleExecutionResult {
  /** Total files evaluated */
  totalEvaluated: number;
  /** Files that matched rules */
  matched: number;
  /** Files archived */
  archived: number;
  /** Files deleted */
  deleted: number;
  /** Files kept (no action) */
  kept: number;
  /** Files blocked by safeguards */
  blocked: number;
  /** Errors encountered */
  errors: Array<{ file: string; error: string }>;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Audit log entry
 */
export interface LifecycleAuditLogEntry {
  /** Timestamp */
  timestamp: Date;
  /** File key */
  fileKey: string;
  /** Action taken */
  action: LifecycleAction;
  /** Matched rule ID */
  ruleId?: string;
  /** Whether action was blocked */
  blocked?: boolean;
  /** Block reason */
  blockReason?: string;
  /** File metadata snapshot */
  fileMetadata: FileLifecycleMetadata;
  /** Execution context */
  executionId?: string;
}

/**
 * Default lifecycle policy configuration
 */
export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicyConfig = {
  rules: [
    {
      id: "delete-old-thumbnails",
      name: "Delete old thumbnails after 90 days",
      enabled: true,
      priority: 1,
      conditions: {
        minAgeDays: 90,
        fileTypes: [FileType.THUMBNAIL],
      },
      action: LifecycleAction.DELETE,
      safeguards: {
        requireDeletionConfirmation: true,
        maxDeletionsPerRun: 1000,
      },
    },
    {
      id: "archive-old-previews",
      name: "Archive old previews after 180 days",
      enabled: true,
      priority: 2,
      conditions: {
        minAgeDays: 180,
        fileTypes: [FileType.PREVIEW],
      },
      action: LifecycleAction.ARCHIVE,
      actionParams: {
        archiveTarget: "archive/previews",
      },
    },
  ],
  globalSafeguards: {
    protectedPrefixes: ["albums/important/", "albums/featured/"],
    protectedMetadataKeys: ["protected", "keep-forever"],
    maxDeletionsPerRun: 5000,
  },
  enableAuditLog: true,
};

/**
 * Evaluate a file against lifecycle policies
 * 
 * @param fileMetadata - File metadata to evaluate
 * @param policy - Lifecycle policy configuration
 * @returns Evaluation result
 */
export function evaluateLifecyclePolicy(
  fileMetadata: FileLifecycleMetadata,
  policy: LifecyclePolicyConfig
): LifecycleEvaluationResult {
  const evaluatedAt = new Date();
  
  // Check global safeguards first
  if (policy.globalSafeguards) {
    const safeguardResult = checkSafeguards(fileMetadata, LifecycleAction.DELETE, policy.globalSafeguards);
    if (safeguardResult.blocked) {
      return {
        file: fileMetadata,
        action: LifecycleAction.KEEP,
        safeguardBlocked: true,
        safeguardReason: safeguardResult.reason,
        evaluatedAt,
      };
    }
  }

  // Evaluate rules in priority order
  const enabledRules = policy.rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabledRules) {
    if (evaluateRuleConditions(fileMetadata, rule.conditions)) {
      // Check rule-specific safeguards
      if (rule.safeguards) {
        const safeguardResult = checkSafeguards(fileMetadata, rule.action, rule.safeguards);
        if (safeguardResult.blocked) {
          return {
            file: fileMetadata,
            matchedRule: rule,
            action: LifecycleAction.KEEP,
            safeguardBlocked: true,
            safeguardReason: safeguardResult.reason,
            evaluatedAt,
          };
        }
      }

      // Rule matched and passed safeguards
      return {
        file: fileMetadata,
        matchedRule: rule,
        action: rule.action,
        actionParams: rule.actionParams,
        evaluatedAt,
      };
    }
  }

  // No rules matched
  return {
    file: fileMetadata,
    action: LifecycleAction.NONE,
    evaluatedAt,
  };
}

/**
 * Evaluate rule conditions against file metadata
 */
function evaluateRuleConditions(
  metadata: FileLifecycleMetadata,
  conditions: LifecycleRuleConditions
): boolean {
  // Age checks
  if (conditions.minAgeDays !== undefined && metadata.ageDays < conditions.minAgeDays) {
    return false;
  }
  if (conditions.maxAgeDays !== undefined && metadata.ageDays > conditions.maxAgeDays) {
    return false;
  }

  // Age since access checks
  if (conditions.minAgeSinceAccessDays !== undefined) {
    if (!metadata.ageSinceAccessDays || metadata.ageSinceAccessDays < conditions.minAgeSinceAccessDays) {
      return false;
    }
  }
  if (conditions.maxAgeSinceAccessDays !== undefined) {
    if (!metadata.ageSinceAccessDays || metadata.ageSinceAccessDays > conditions.maxAgeSinceAccessDays) {
      return false;
    }
  }

  // Size checks
  if (conditions.minSizeBytes !== undefined && metadata.size < conditions.minSizeBytes) {
    return false;
  }
  if (conditions.maxSizeBytes !== undefined && metadata.size > conditions.maxSizeBytes) {
    return false;
  }

  // File type checks
  if (conditions.fileTypes && conditions.fileTypes.length > 0) {
    if (!metadata.parsed || !conditions.fileTypes.includes(metadata.parsed.fileType)) {
      return false;
    }
  }

  // Content type checks
  if (conditions.contentTypes && conditions.contentTypes.length > 0) {
    if (!metadata.contentType || !conditions.contentTypes.includes(metadata.contentType)) {
      return false;
    }
  }

  // Path prefix checks
  if (conditions.pathPrefixes && conditions.pathPrefixes.length > 0) {
    const matches = conditions.pathPrefixes.some((prefix) => metadata.key.startsWith(prefix));
    if (!matches) {
      return false;
    }
  }

  // Exclude prefix checks
  if (conditions.excludePrefixes && conditions.excludePrefixes.length > 0) {
    const excluded = conditions.excludePrefixes.some((prefix) => metadata.key.startsWith(prefix));
    if (excluded) {
      return false;
    }
  }

  // Metadata match checks
  if (conditions.metadataMatch) {
    if (!metadata.metadata) {
      return false;
    }
    for (const [key, value] of Object.entries(conditions.metadataMatch)) {
      if (metadata.metadata[key] !== value) {
        return false;
      }
    }
  }

  // Required metadata keys
  if (conditions.metadataRequired && conditions.metadataRequired.length > 0) {
    if (!metadata.metadata) {
      return false;
    }
    for (const key of conditions.metadataRequired) {
      if (!(key in metadata.metadata)) {
        return false;
      }
    }
  }

  // Excluded metadata keys
  if (conditions.metadataExcluded && conditions.metadataExcluded.length > 0) {
    if (metadata.metadata) {
      for (const key of conditions.metadataExcluded) {
        if (key in metadata.metadata) {
          return false;
        }
      }
    }
  }

  // Custom evaluator
  if (conditions.customEvaluator) {
    if (!conditions.customEvaluator(metadata)) {
      return false;
    }
  }

  return true;
}

/**
 * Check safeguards for an action
 */
function checkSafeguards(
  metadata: FileLifecycleMetadata,
  action: LifecycleAction,
  safeguards: LifecycleSafeguards
): { blocked: boolean; reason?: string } {
  // Only check safeguards for destructive actions
  if (action !== LifecycleAction.DELETE && action !== LifecycleAction.ARCHIVE) {
    return { blocked: false };
  }

  // Protected prefixes
  if (safeguards.protectedPrefixes) {
    for (const prefix of safeguards.protectedPrefixes) {
      if (metadata.key.startsWith(prefix)) {
        return {
          blocked: true,
          reason: `File matches protected prefix: ${prefix}`,
        };
      }
    }
  }

  // Protected metadata keys
  if (safeguards.protectedMetadataKeys && metadata.metadata) {
    for (const key of safeguards.protectedMetadataKeys) {
      if (key in metadata.metadata) {
        return {
          blocked: true,
          reason: `File has protected metadata key: ${key}`,
        };
      }
    }
  }

  // Protected metadata values
  if (safeguards.protectedMetadataValues && metadata.metadata) {
    for (const [key, values] of Object.entries(safeguards.protectedMetadataValues)) {
      const fileValue = metadata.metadata[key];
      if (fileValue && values.includes(fileValue)) {
        return {
          blocked: true,
          reason: `File has protected metadata value: ${key}=${fileValue}`,
        };
      }
    }
  }

  // Custom safeguard
  if (safeguards.customSafeguard) {
    if (!safeguards.customSafeguard(metadata, action)) {
      return {
        blocked: true,
        reason: "Custom safeguard blocked action",
      };
    }
  }

  return { blocked: false };
}

/**
 * Collect file metadata for lifecycle evaluation
 * 
 * @param key - Storage key
 * @returns File lifecycle metadata
 */
export async function collectFileMetadata(key: string): Promise<FileLifecycleMetadata> {
  const metadata = await getFileMetadata(key);
  const now = new Date();
  const lastModified = metadata.lastModified || now;
  const ageDays = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24));

  // Try to get last accessed from metadata
  let lastAccessed: Date | undefined;
  let ageSinceAccessDays: number | undefined;
  if (metadata.metadata?.lastAccessed) {
    lastAccessed = new Date(metadata.metadata.lastAccessed);
    ageSinceAccessDays = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Parse path
  const parsed = parsePhotoPath(key);

  return {
    key,
    size: metadata.contentLength || 0,
    lastModified,
    lastAccessed,
    contentType: metadata.contentType,
    metadata: metadata.metadata,
    parsed: parsed || undefined,
    ageDays,
    ageSinceAccessDays,
  };
}

/**
 * Execute lifecycle action on a file
 * 
 * @param evaluation - Evaluation result
 * @param executionId - Execution ID for audit logging
 * @returns Whether action was successful
 */
export async function executeLifecycleAction(
  evaluation: LifecycleEvaluationResult,
  executionId?: string
): Promise<{ success: boolean; error?: string }> {
  const { file, action, actionParams } = evaluation;

  try {
    switch (action) {
      case LifecycleAction.ARCHIVE:
        return await archiveFile(file.key, actionParams?.archiveTarget || "archive/", executionId);
      case LifecycleAction.DELETE:
        return await deleteFile(file.key, actionParams, executionId);
      case LifecycleAction.KEEP:
      case LifecycleAction.NONE:
        return { success: true };
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Archive a file (copy to archive location)
 */
async function archiveFile(
  key: string,
  archiveTarget: string,
  executionId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getR2Client();
  const config = getR2Config();

  try {
    // Generate archive key
    const archiveKey = `${archiveTarget}${key}`;

    // Copy to archive location
    const copyCommand = new CopyObjectCommand({
      Bucket: config.bucketName,
      CopySource: `${config.bucketName}/${key}`,
      Key: archiveKey,
      MetadataDirective: "COPY",
    });

    await client.send(copyCommand);

    // Log audit entry
    await logAuditEntry({
      timestamp: new Date(),
      fileKey: key,
      action: LifecycleAction.ARCHIVE,
      fileMetadata: await collectFileMetadata(key),
      executionId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a file
 */
async function deleteFile(
  key: string,
  actionParams?: LifecycleActionParams,
  executionId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getR2Client();
  const config = getR2Config();

  try {
    // Collect metadata before deletion for audit log
    const fileMetadata = await collectFileMetadata(key);

    // Delete the file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(deleteCommand);

    // Log audit entry
    await logAuditEntry({
      timestamp: new Date(),
      fileKey: key,
      action: LifecycleAction.DELETE,
      fileMetadata,
      executionId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Scan and evaluate files for lifecycle policies
 * 
 * @param options - Scan options
 * @returns Execution result
 */
export interface LifecycleScanOptions {
  /** Lifecycle policy configuration */
  policy: LifecyclePolicyConfig;
  /** Path prefix to scan */
  prefix?: string;
  /** Maximum number of files to process */
  maxFiles?: number;
  /** Whether to execute actions (false = dry run) */
  execute?: boolean;
  /** Progress callback */
  onProgress?: (processed: number, total: number, current: string) => void;
  /** Execution ID for audit logging */
  executionId?: string;
}

export async function scanAndEvaluateLifecycle(
  options: LifecycleScanOptions
): Promise<LifecycleExecutionResult> {
  const {
    policy,
    prefix = "",
    maxFiles,
    execute = false,
    onProgress,
    executionId = `exec-${Date.now()}`,
  } = options;

  const startTime = new Date();
  const client = getR2Client();
  const config = getR2Config();

  const result: LifecycleExecutionResult = {
    totalEvaluated: 0,
    matched: 0,
    archived: 0,
    deleted: 0,
    kept: 0,
    blocked: 0,
    errors: [],
    startTime,
    endTime: new Date(),
    durationMs: 0,
  };

  let continuationToken: string | undefined;
  let processedCount = 0;
  let deletionCount = 0;
  const maxDeletions = policy.globalSafeguards?.maxDeletionsPerRun || Infinity;

  try {
    do {
      const command: ListObjectsV2CommandInput = {
        Bucket: config.bucketName,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      };

      const response = await client.send(new ListObjectsV2Command(command));

      if (!response.Contents || response.Contents.length === 0) {
        break;
      }

      for (const object of response.Contents) {
        if (!object.Key) continue;

        // Check max files limit
        if (maxFiles && processedCount >= maxFiles) {
          break;
        }

        try {
          // Collect file metadata
          const fileMetadata = await collectFileMetadata(object.Key);
          result.totalEvaluated++;

          // Evaluate against policies
          const evaluation = evaluateLifecyclePolicy(fileMetadata, policy);

          if (evaluation.matchedRule) {
            result.matched++;

            if (evaluation.safeguardBlocked) {
              result.blocked++;
            } else {
              // Execute action if enabled
              if (execute) {
                // Check deletion limits
                if (evaluation.action === LifecycleAction.DELETE) {
                  if (deletionCount >= maxDeletions) {
                    result.errors.push({
                      file: object.Key,
                      error: "Deletion limit reached",
                    });
                    result.blocked++;
                    continue;
                  }
                  deletionCount++;
                }

                const actionResult = await executeLifecycleAction(evaluation, executionId);

                if (actionResult.success) {
                  switch (evaluation.action) {
                    case LifecycleAction.ARCHIVE:
                      result.archived++;
                      break;
                    case LifecycleAction.DELETE:
                      result.deleted++;
                      break;
                    case LifecycleAction.KEEP:
                    case LifecycleAction.NONE:
                      result.kept++;
                      break;
                  }
                } else {
                  result.errors.push({
                    file: object.Key,
                    error: actionResult.error || "Unknown error",
                  });
                }
              } else {
                // Dry run - just count
                switch (evaluation.action) {
                  case LifecycleAction.ARCHIVE:
                    result.archived++;
                    break;
                  case LifecycleAction.DELETE:
                    result.deleted++;
                    break;
                  case LifecycleAction.KEEP:
                  case LifecycleAction.NONE:
                    result.kept++;
                    break;
                }
              }
            }
          } else {
            result.kept++;
          }

          processedCount++;

          // Progress callback
          if (onProgress) {
            onProgress(processedCount, result.totalEvaluated, object.Key);
          }
        } catch (error) {
          result.errors.push({
            file: object.Key,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken && (!maxFiles || processedCount < maxFiles));

    result.endTime = new Date();
    result.durationMs = result.endTime.getTime() - startTime.getTime();

    return result;
  } catch (error) {
    result.endTime = new Date();
    result.durationMs = result.endTime.getTime() - startTime.getTime();
    result.errors.push({
      file: "scan",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return result;
  }
}

/**
 * In-memory audit log storage
 * In production, this should be persisted to a database or file
 */
const auditLog: LifecycleAuditLogEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 10000;

/**
 * Log an audit entry
 */
async function logAuditEntry(entry: LifecycleAuditLogEntry): Promise<void> {
  auditLog.push(entry);

  // Trim log if it gets too large
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }

  // TODO: In production, persist to database or file
  // For now, we just keep it in memory
}

/**
 * Get audit log entries
 * 
 * @param options - Filter options
 * @returns Audit log entries
 */
export interface AuditLogFilterOptions {
  /** Filter by file key prefix */
  fileKeyPrefix?: string;
  /** Filter by action */
  action?: LifecycleAction;
  /** Filter by execution ID */
  executionId?: string;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Maximum number of entries */
  limit?: number;
}

export function getAuditLog(options: AuditLogFilterOptions = {}): LifecycleAuditLogEntry[] {
  let filtered = [...auditLog];

  if (options.fileKeyPrefix) {
    filtered = filtered.filter((entry) => entry.fileKey.startsWith(options.fileKeyPrefix!));
  }

  if (options.action) {
    filtered = filtered.filter((entry) => entry.action === options.action);
  }

  if (options.executionId) {
    filtered = filtered.filter((entry) => entry.executionId === options.executionId);
  }

  if (options.startDate) {
    filtered = filtered.filter((entry) => entry.timestamp >= options.startDate!);
  }

  if (options.endDate) {
    filtered = filtered.filter((entry) => entry.timestamp <= options.endDate!);
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Generate storage usage report
 * 
 * @param options - Report options
 * @returns Storage usage statistics
 */
export interface StorageUsageReportOptions {
  /** Path prefix to analyze */
  prefix?: string;
  /** Group by file type */
  groupByFileType?: boolean;
  /** Group by album */
  groupByAlbum?: boolean;
}

export interface StorageUsageReport {
  /** Total files */
  totalFiles: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Total size in human-readable format */
  totalSizeFormatted: string;
  /** Breakdown by file type */
  byFileType?: Record<string, { count: number; sizeBytes: number }>;
  /** Breakdown by album */
  byAlbum?: Record<string, { count: number; sizeBytes: number }>;
  /** Average file size */
  averageFileSize: number;
  /** Oldest file date */
  oldestFile?: Date;
  /** Newest file date */
  newestFile?: Date;
  /** Generated at */
  generatedAt: Date;
}

export async function generateStorageUsageReport(
  options: StorageUsageReportOptions = {}
): Promise<StorageUsageReport> {
  const { prefix = "", groupByFileType = false, groupByAlbum = false } = options;
  const client = getR2Client();
  const config = getR2Config();

  let totalFiles = 0;
  let totalSizeBytes = 0;
  const byFileType: Record<string, { count: number; sizeBytes: number }> = {};
  const byAlbum: Record<string, { count: number; sizeBytes: number }> = {};
  let oldestFile: Date | undefined;
  let newestFile: Date | undefined;

  let continuationToken: string | undefined;

  try {
    do {
      const command: ListObjectsV2CommandInput = {
        Bucket: config.bucketName,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      };

      const response = await client.send(new ListObjectsV2Command(command));

      if (!response.Contents || response.Contents.length === 0) {
        break;
      }

      for (const object of response.Contents) {
        if (!object.Key) continue;

        totalFiles++;
        const size = object.Size || 0;
        totalSizeBytes += size;

        const lastModified = object.LastModified;
        if (lastModified) {
          if (!oldestFile || lastModified < oldestFile) {
            oldestFile = lastModified;
          }
          if (!newestFile || lastModified > newestFile) {
            newestFile = lastModified;
          }
        }

        // Group by file type
        if (groupByFileType) {
          const parsed = parsePhotoPath(object.Key);
          if (parsed) {
            const fileType = parsed.fileType;
            if (!byFileType[fileType]) {
              byFileType[fileType] = { count: 0, sizeBytes: 0 };
            }
            byFileType[fileType].count++;
            byFileType[fileType].sizeBytes += size;
          }
        }

        // Group by album
        if (groupByAlbum) {
          const parsed = parsePhotoPath(object.Key);
          if (parsed) {
            const albumId = parsed.albumId;
            if (!byAlbum[albumId]) {
              byAlbum[albumId] = { count: 0, sizeBytes: 0 };
            }
            byAlbum[albumId].count++;
            byAlbum[albumId].sizeBytes += size;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Format total size
    const totalSizeFormatted = formatBytes(totalSizeBytes);

    // Calculate average
    const averageFileSize = totalFiles > 0 ? totalSizeBytes / totalFiles : 0;

    return {
      totalFiles,
      totalSizeBytes,
      totalSizeFormatted,
      byFileType: groupByFileType ? byFileType : undefined,
      byAlbum: groupByAlbum ? byAlbum : undefined,
      averageFileSize,
      oldestFile,
      newestFile,
      generatedAt: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Failed to generate storage usage report: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}


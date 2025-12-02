# Cloudflare R2 Storage Configuration

This module provides configuration and client setup for Cloudflare R2 storage.

## Environment Variables

Add these to your `.env` file:

```env
R2_ACCOUNT_ID="your-account-id-here"
R2_ACCESS_KEY_ID="your-access-key-id-here"
R2_SECRET_ACCESS_KEY="your-secret-access-key-here"
R2_BUCKET_NAME="your-bucket-name-here"
R2_PUBLIC_URL="https://your-custom-domain.com" # Optional
```

## Getting R2 Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 → Manage R2 API Tokens
3. Create a new API token with appropriate permissions
4. Copy the Access Key ID and Secret Access Key
5. Your Account ID can be found in the dashboard URL or account settings

## Usage

```typescript
import { getR2Client, getR2Config } from "@/lib/storage";

// Get the configured R2 client (singleton)
const s3Client = getR2Client();

// Get configuration
const config = getR2Config();
```

## Storage Provider Abstraction Layer

The storage module includes a provider-agnostic abstraction layer that allows you to switch between different storage providers (R2, S3, Azure Blob, etc.) without changing your application code.

### Basic Usage

```typescript
import {
  getDefaultStorageProvider,
  createStorageProvider,
} from "@/lib/storage";

// Get the default provider (uses environment variables)
const provider = getDefaultStorageProvider();

// Upload a file
const result = await provider.uploadFile("path/to/file.jpg", fileBuffer, {
  contentType: "image/jpeg",
  metadata: { albumId: "123" },
});

// Download a file
const downloadResult = await provider.downloadFileAsBuffer("path/to/file.jpg");

// Check if file exists
const exists = await provider.fileExists("path/to/file.jpg");

// Delete a file
await provider.deleteFile("path/to/file.jpg");
```

### Creating Custom Provider Instances

```typescript
import { createStorageProvider, R2StorageProvider } from "@/lib/storage";
import type { R2Config } from "@/lib/storage";

// Create provider with default configuration (from environment)
const provider1 = createStorageProvider();

// Create provider with custom R2 configuration
const customR2Config: R2Config = {
  accountId: "custom-account-id",
  accessKeyId: "custom-key",
  secretAccessKey: "custom-secret",
  bucketName: "custom-bucket",
  publicUrl: "https://custom-domain.com",
};

const provider2 = createStorageProvider({
  type: "r2",
  config: { r2: customR2Config },
});

// Or create R2 provider directly
const provider3 = new R2StorageProvider(customR2Config);
```

### Provider Interface

All storage providers implement the `StorageProvider` interface, which includes:

- **Upload operations**: `uploadFile()`, `uploadFiles()`
- **Download operations**: `downloadFile()`, `downloadFileAsBuffer()`, `downloadFileWithProgress()`
- **File management**: `getFileMetadata()`, `fileExists()`, `deleteFile()`, `deleteFiles()`
- **Listing**: `listFiles()`, `listFilesWithMetadata()`
- **Copy operations**: `copyFile()`
- **CDN URLs**: `generateCdnUrl()`

### Migrating Between Providers

The abstraction layer includes utilities for migrating data between different storage providers:

```typescript
import {
  migrateBetweenProviders,
  createStorageProvider,
  compareProviders,
} from "@/lib/storage";

// Create source and destination providers
const sourceProvider = createStorageProvider({ type: "r2" });
const destProvider = createStorageProvider({ type: "s3" }); // Future: when S3 provider is implemented

// Migrate files
const result = await migrateBetweenProviders({
  sourceProvider,
  destinationProvider: destProvider,
  prefix: "albums/",
  verifyAfterMigration: true,
  deleteSource: false, // Keep originals for safety
  onProgress: (progress) => {
    console.log(
      `Migrated ${progress.processed}/${progress.total}: ${progress.current}`
    );
  },
});

console.log(`Migration complete: ${result.migrated} files migrated`);
console.log(`Total bytes: ${result.totalBytes}`);
console.log(`Duration: ${result.duration}ms`);
```

### Comparing Providers

Compare files between two providers to verify migration or check for differences:

```typescript
const comparison = await compareProviders(
  sourceProvider,
  destProvider,
  "albums/"
);

console.log(`Matching files: ${comparison.matching.length}`);
console.log(`Missing in destination: ${comparison.missingInDestination.length}`);
console.log(`Size mismatches: ${comparison.sizeMismatches.length}`);
```

### Implementing New Providers

To add support for a new storage provider (e.g., AWS S3, Azure Blob Storage), implement the `StorageProvider` interface:

```typescript
import type { StorageProvider } from "@/lib/storage";

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  async uploadFile(key: string, body: Buffer, options?: StorageUploadOptions) {
    // Implementation
  }

  // ... implement all required methods
}
```

Then register it in the factory (`provider-factory.ts`):

```typescript
case "s3":
  return new S3StorageProvider(providerConfig.config?.s3);
```

### Benefits of the Abstraction Layer

1. **Flexibility**: Switch storage providers without changing application code
2. **Testing**: Easily mock storage providers for unit tests
3. **Multi-provider support**: Use different providers for different environments
4. **Migration**: Built-in utilities for migrating data between providers
5. **Future-proofing**: Add new providers without refactoring existing code

## CDN URL Generation

The storage module includes utilities for generating optimized CDN URLs for assets stored in R2.

### Basic Usage

```typescript
import { generateCdnUrl, generateThumbnailUrl, generatePreviewUrl } from "@/lib/storage";

// Generate a public URL
const publicUrl = await generateCdnUrl({
  key: "albums/123/photos/456/original.jpg",
  signed: false,
});

// Generate a signed URL (for protected content)
const signedUrl = await generateCdnUrl({
  key: "albums/123/photos/456/original.jpg",
  signed: true,
  expiresIn: 3600, // 1 hour
});

// Generate thumbnail URL (convenience function)
const thumbnailUrl = await generateThumbnailUrl(
  "albums/123/photos/456/original.jpg",
  300, // size in pixels
  false // not signed
);

// Generate preview URL (convenience function)
const previewUrl = await generatePreviewUrl(
  "albums/123/photos/456/original.jpg",
  1200, // max width
  false // not signed
);
```

### Image Transformations

```typescript
// URL with image transformation parameters
const transformedUrl = await generateCdnUrl({
  key: "albums/123/photos/456/original.jpg",
  transform: {
    width: 300,
    height: 300,
    fit: "fit", // maintain aspect ratio
    format: "webp",
    quality: 85,
    sharpen: true,
  },
});
```

### Bulk URL Generation

```typescript
import { generateBulkCdnUrls } from "@/lib/storage";

const urls = await generateBulkCdnUrls({
  keys: [
    "albums/123/photos/456/original.jpg",
    "albums/123/photos/789/original.jpg",
  ],
  baseOptions: {
    transform: { width: 300, format: "webp" },
  },
  parallel: true, // generate URLs in parallel
});
```

### URL Caching

Public URLs are automatically cached for 5 minutes to improve performance. You can manually clear the cache:

```typescript
import { clearUrlCache, cleanupUrlCache } from "@/lib/storage";

// Clear all cached URLs
clearUrlCache();

// Remove only expired entries
cleanupUrlCache();
```

### Image Transformation Parameters

- `width` / `height`: Dimensions in pixels
- `fit`: Resize mode - `"fit"` (maintain aspect ratio), `"fill"` (crop to exact size), `"scale"` (stretch)
- `format`: Output format - `"auto"`, `"webp"`, `"jpeg"`, `"png"`, `"avif"`
- `quality`: Compression quality (1-100) for lossy formats
- `sharpen`: Enable sharpening (boolean)
- `blur`: Blur amount (0-250)
- `rotate`: Rotation angle (0, 90, 180, 270)
- `progressive`: Enable progressive JPEG (boolean)

**Note**: Image transformations require a transformation service (e.g., Cloudflare Images, Cloudflare Workers, or a custom image processing service). The URL generation utilities format the transformation parameters as query strings that can be consumed by such services.

## Lifecycle Policies

The storage module includes a comprehensive lifecycle policy system for managing file archival and deletion based on age, usage patterns, and business rules.

### Basic Usage

```typescript
import {
  evaluateLifecyclePolicy,
  collectFileMetadata,
  scanAndEvaluateLifecycle,
  DEFAULT_LIFECYCLE_POLICY,
} from "@/lib/storage";

// Collect file metadata
const metadata = await collectFileMetadata("albums/123/photos/456/original.jpg");

// Evaluate against default policy
const result = evaluateLifecyclePolicy(metadata, DEFAULT_LIFECYCLE_POLICY);

if (result.action === LifecycleAction.DELETE) {
  console.log("File should be deleted");
}
```

### Custom Policy Configuration

```typescript
import { LifecyclePolicyConfig, LifecycleAction, FileType } from "@/lib/storage";

const customPolicy: LifecyclePolicyConfig = {
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
        maxDeletionsPerRun: 1000,
        requireDeletionConfirmation: true,
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
```

### Scanning and Executing Policies

```typescript
// Dry run (evaluate but don't execute)
const dryRunResult = await scanAndEvaluateLifecycle({
  policy: customPolicy,
  prefix: "albums/",
  execute: false,
  maxFiles: 1000,
  onProgress: (processed, total, current) => {
    console.log(`Processed ${processed}/${total}: ${current}`);
  },
});

// Execute actions
const executionResult = await scanAndEvaluateLifecycle({
  policy: customPolicy,
  prefix: "albums/",
  execute: true,
  executionId: "daily-cleanup-2024-01-01",
});
```

### Policy Conditions

Lifecycle rules support various conditions:

- **Age-based**: `minAgeDays`, `maxAgeDays`, `minAgeSinceAccessDays`, `maxAgeSinceAccessDays`
- **Size-based**: `minSizeBytes`, `maxSizeBytes`
- **Type-based**: `fileTypes`, `contentTypes`
- **Path-based**: `pathPrefixes`, `excludePrefixes`
- **Metadata-based**: `metadataMatch`, `metadataRequired`, `metadataExcluded`
- **Custom**: `customEvaluator` function

### Safeguards

Safeguards prevent accidental deletion of important files:

- **Protected prefixes**: Never delete files matching certain path patterns
- **Protected metadata**: Never delete files with specific metadata keys or values
- **Deletion limits**: Maximum number of deletions per run
- **Confirmation required**: Require explicit confirmation before deletion
- **Custom safeguards**: Custom evaluation function

### Storage Usage Reports

```typescript
import { generateStorageUsageReport } from "@/lib/storage";

const report = await generateStorageUsageReport({
  prefix: "albums/",
  groupByFileType: true,
  groupByAlbum: true,
});

console.log(`Total files: ${report.totalFiles}`);
console.log(`Total size: ${report.totalSizeFormatted}`);
console.log(`By file type:`, report.byFileType);
```

### Audit Logging

```typescript
import { getAuditLog } from "@/lib/storage";

// Get recent audit log entries
const entries = getAuditLog({
  action: LifecycleAction.DELETE,
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  limit: 100,
});

for (const entry of entries) {
  console.log(`${entry.timestamp}: ${entry.action} on ${entry.fileKey}`);
}
```

### Scheduled Jobs

For production use, set up scheduled jobs (e.g., using cron or a task scheduler) to run lifecycle scans:

```typescript
// Example: Daily cleanup job
async function dailyCleanupJob() {
  const result = await scanAndEvaluateLifecycle({
    policy: customPolicy,
    execute: true,
    executionId: `daily-cleanup-${new Date().toISOString().split('T')[0]}`,
  });
  
  console.log(`Cleanup completed: ${result.deleted} deleted, ${result.archived} archived`);
}
```

## Development vs Production

- **Development**: Use a test bucket and credentials
- **Production**: Use production bucket with appropriate access controls
- Consider using different buckets for different environments


# Test Scripts

## Prerequisites

1. Ensure your `.env` file has all required R2 credentials:
   ```env
   R2_ACCOUNT_ID="your-account-id"
   R2_ACCESS_KEY_ID="your-access-key-id"
   R2_SECRET_ACCESS_KEY="your-secret-access-key"
   R2_BUCKET_NAME="your-bucket-name"
   R2_PUBLIC_URL="https://your-custom-domain.com" # Optional
   ```

2. Make sure your R2 bucket exists and is accessible with the provided credentials.

---

## R2 Storage Integration Test

Test script for verifying R2 storage upload/download functionality.

### Running the Test

```bash
npm run test:r2
```

Or directly with tsx:

```bash
tsx scripts/test-r2-storage.ts
```

### What It Tests

1. **Configuration Check** - Verifies R2 credentials are loaded correctly
2. **Upload Small File** - Tests basic file upload functionality
3. **Get Metadata** - Tests retrieving file metadata without downloading
4. **Download File** - Tests downloading a file as a buffer
5. **Upload Large File** - Tests multipart upload for files >5MB
6. **Upload with Metadata** - Tests custom metadata attachment and retrieval

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- A summary at the end showing total passed/failed

---

## R2 Organization & Path Generation Test

Test script for verifying hierarchical file organization, path generation, and file management utilities.

### Running the Test

```bash
npm run test:r2-org
```

Or directly with tsx:

```bash
tsx scripts/test-r2-organization.ts
```

### What It Tests

**Unit Tests (Path Generation):**
1. **Basic Path Generation** - Standard photo path structure
2. **Path with User** - User-scoped path generation
3. **Convenience Functions** - Thumbnail and original path helpers
4. **Path Sanitization** - Special characters, Unicode, and edge cases
5. **File Extension Extraction** - Various filename formats
6. **Path Parsing** - Reverse parsing of storage keys to extract components
7. **Date-Based Path** - Date-organized path structure
8. **Directory Paths** - Album and user directory path generation

**Integration Test:**
9. **File Organization** - Upload a file and verify it can be listed/found using organization utilities

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- A summary at the end showing total passed/failed

### Test Details

- **Unit tests** run first (fast, no R2 API calls)
- **Integration test** uploads a real file to R2 and verifies organization utilities work
- Tests path generation, sanitization, parsing, and file organization features

---

## R2 CDN URL Generation Test

Test script for verifying CDN URL generation, including public URLs, signed URLs, image transformations, and bulk generation.

### Running the Test

```bash
npm run test:r2-cdn
```

Or directly with tsx:

```bash
tsx scripts/test-r2-cdn.ts
```

### What It Tests

1. **Configuration Check** - Verifies R2 configuration is loaded correctly
2. **Public URL Generation** - Tests generating public CDN URLs
3. **Signed URL Generation** - Tests generating signed URLs with expiration
4. **Image Transformations** - Tests URL generation with image transformation parameters
5. **Thumbnail URL Generation** - Tests convenience function for thumbnail URLs
6. **Preview URL Generation** - Tests convenience function for preview URLs
7. **URL Caching** - Tests URL caching performance
8. **Bulk URL Generation** - Tests generating multiple URLs at once
9. **Custom Query Parameters** - Tests adding custom query parameters to URLs
10. **Signed URL with Transformations** - Tests signed URLs with image transformations
11. **Various Transformations** - Tests different transformation options
12. **CDN URL Integration - HTTP Request** - Tests actual HTTP requests to verify URLs work
13. **Bulk URL Generation Performance** - Tests performance at scale (100, 500, 1000 URLs)

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- ⚠️ for warnings (e.g., if HTTP requests fail due to access restrictions)
- Performance metrics for bulk generation tests
- A summary at the end showing total passed/failed

### Test Details

- Tests CDN URL generation with various options
- Tests URL caching to improve performance
- **Integration test** makes actual HTTP requests to verify URLs are accessible
- **Performance test** measures bulk URL generation at different scales
- Tests image transformation parameter formatting
- Tests signed URL generation with expiration times
- All tests require R2 credentials configured

### Notes

- The HTTP integration test requires the file to be publicly accessible
- Performance tests clear the cache before each measurement for accuracy
- Some tests may be skipped if R2 credentials or public access is not configured

---

## R2 Lifecycle Policies Test

Test script for verifying lifecycle policy evaluation, file scanning, and storage management features.

### Running the Test

```bash
npm run test:r2-lifecycle
```

Or directly with tsx:

```bash
tsx scripts/test-r2-lifecycle.ts
```

### What It Tests

1. **Configuration Check** - Verifies default lifecycle policy is loaded correctly
2. **Collect File Metadata** - Tests collecting file metadata for lifecycle evaluation
3. **Policy Evaluation - Match** - Tests policy evaluation when rules match
4. **Policy Evaluation - No Match** - Tests policy evaluation when no rules match
5. **Safeguards - Protected Prefix** - Tests safeguards preventing deletion of protected files
6. **Safeguards - Protected Metadata** - Tests safeguards based on file metadata
7. **Scan and Evaluate (Dry Run)** - Tests scanning storage and evaluating policies without executing actions
8. **Storage Usage Report** - Tests generating storage usage statistics
9. **Audit Log** - Tests retrieving audit log entries
10. **Complex Policy** - Tests policy evaluation with multiple conditions

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- A summary at the end showing total passed/failed

### Test Details

- Tests lifecycle policy evaluation engine
- Tests safeguards to prevent accidental deletions
- Tests storage scanning and policy application (dry-run mode)
- Tests storage usage reporting with grouping options
- Tests audit logging functionality
- All tests run in dry-run mode (no files are actually deleted or archived)

---

## Storage Provider Abstraction Layer Test

Unit tests for the storage provider abstraction layer, testing the interface, type conversions, error handling, factory pattern, and basic operations using a mock provider.

### Running the Test

```bash
npm run test:provider
```

Or directly with tsx:

```bash
tsx scripts/test-provider-abstraction.ts
```

### What It Tests

**Unit Tests (No R2 API calls required):**

1. **Provider Interface Compliance** - Verifies all providers implement the required interface
2. **Factory Pattern - Create Provider** - Tests provider factory creation
3. **Factory Pattern - Default Provider** - Tests singleton pattern and provider switching
4. **Configuration Handling** - Tests environment-based and custom configurations
5. **Mock Provider - Upload** - Tests file upload through provider interface
6. **Mock Provider - Download** - Tests file download through provider interface
7. **Mock Provider - Metadata** - Tests metadata retrieval
8. **Mock Provider - File Exists** - Tests file existence checks
9. **Mock Provider - Batch Upload** - Tests batch upload operations
10. **Mock Provider - List Files** - Tests file listing with and without metadata
11. **Mock Provider - Delete** - Tests file deletion
12. **Mock Provider - Copy** - Tests file copying
13. **Mock Provider - CDN URL** - Tests CDN URL generation
14. **Error Handling** - Tests StorageProviderError handling
15. **Progress Callback** - Tests progress tracking during downloads

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- A summary at the end showing total passed/failed

### Test Details

- **No R2 credentials required** - Uses in-memory mock provider
- Tests the abstraction layer interface compliance
- Tests type conversions between provider types and R2-specific types
- Tests error handling and error type conversions
- Tests factory pattern for provider creation and management
- Tests all storage operations through the provider interface
- Validates that the abstraction layer works correctly

---

## R2 Provider Integration Test

Integration tests for the R2 storage provider implementation through the StorageProvider abstraction layer interface, verifying all operations work correctly with real R2 storage.

### Running the Test

```bash
npm run test:r2-provider
```

Or directly with tsx:

```bash
tsx scripts/test-r2-provider-integration.ts
```

### What It Tests

**Integration Tests (Requires R2 API calls):**

1. **Configuration Check** - Verifies R2 configuration is loaded correctly
2. **R2 Provider Creation** - Tests creating R2 provider through factory
3. **R2 Provider - Upload** - Tests file upload through provider interface
4. **R2 Provider - Download** - Tests file download through provider interface
5. **R2 Provider - Metadata** - Tests metadata retrieval
6. **R2 Provider - File Exists** - Tests file existence checks
7. **R2 Provider - Batch Upload** - Tests batch upload operations
8. **R2 Provider - List Files** - Tests file listing with and without metadata
9. **R2 Provider - Delete** - Tests file deletion
10. **R2 Provider - Copy** - Tests file copying
11. **R2 Provider - CDN URL** - Tests CDN URL generation
12. **R2 Provider - Error Handling** - Tests StorageProviderError handling
13. **R2 Provider - Progress Callback** - Tests progress tracking during downloads
14. **R2 Provider - Default Provider** - Tests default provider integration

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- ⚠️ for warnings (e.g., if metadata preservation varies)
- A summary at the end showing total passed/failed

### Test Details

- **R2 credentials required** - Tests real R2 storage operations
- Tests the R2 provider implementation through the abstraction layer
- Verifies all StorageProvider interface methods work correctly with R2
- Tests error handling and type conversions
- Tests default provider integration
- Automatically cleans up test files after completion
- Validates that the R2 provider correctly implements the StorageProvider interface

### Notes

- This test complements `test-provider-abstraction.ts` which tests the interface with mock provider
- This test verifies the R2 provider implementation works correctly through the abstraction layer
- All test files are automatically cleaned up after tests complete
- Tests require R2 credentials configured in `.env` file

---

## Storage Provider Migration Utilities Test

Test script for migrating files between different storage providers, verifying file integrity, and comparing providers.

### Running the Test

```bash
npm run test:provider-migration
```

Or directly with tsx:

```bash
tsx scripts/test-provider-migration.ts
```

### What It Tests

1. **Basic Migration** - Migrate files from one mock provider to another
2. **Migration with Verification** - Verify file content and metadata after migration
3. **Migration with Progress** - Test progress callback during migration
4. **Migration with Delete Source** - Test deleting source files after migration
5. **Migration with Max Files** - Test limiting the number of files migrated
6. **Migration Error Handling** - Test error handling during failed migrations
7. **Compare Providers - Matching** - Compare providers with identical files
8. **Compare Providers - Missing** - Compare providers with missing files
9. **Compare Providers - Size Mismatch** - Detect size mismatches between providers

### Expected Output

The script will output:
- ✅ for passed tests
- ❌ for failed tests
- A summary at the end showing total passed/failed

### Test Details

- **No R2 credentials required** - Uses in-memory mock providers
- Tests migration utilities for moving data between providers
- Tests file integrity verification after migration
- Tests progress tracking and error handling
- Tests provider comparison utilities

---

## Storage Provider Performance Comparison Test

Performance benchmarks comparing direct R2 function calls vs provider interface calls to ensure the abstraction layer doesn't add significant overhead.

### Running the Test

```bash
npm run test:provider-performance
```

Or directly with tsx:

```bash
tsx scripts/test-provider-performance.ts
```

### What It Tests

1. **Upload Performance - Small File** - Compare upload performance for 1KB files
2. **Upload Performance - Large File** - Compare upload performance for 1MB files
3. **Download Performance** - Compare download performance
4. **Metadata Performance** - Compare metadata retrieval performance
5. **Batch Upload Performance** - Compare batch upload performance
6. **Mock Provider Performance** - Baseline performance using in-memory provider
7. **Memory Usage** - Measure memory usage of mock provider

### Expected Output

The script will output:
- ✅ for passed tests
- ⚠️ for warnings (high overhead detected)
- Performance metrics (average times, overhead percentages)
- A summary at the end

### Test Details

- **R2 credentials recommended** - For accurate comparison with real storage
- Tests will skip R2-dependent tests if credentials are missing
- Measures execution time differences between direct calls and provider interface
- Calculates overhead percentage (should be minimal for thin wrapper)
- Tests memory usage patterns
- Uses multiple iterations for statistical accuracy

### Performance Expectations

- **Overhead should be < 10%** for most operations (thin wrapper)
- **Overhead may be higher** for very small files due to function call overhead
- **Memory usage** should be reasonable for in-memory operations

---

## Troubleshooting

### Common Issues

- **Configuration errors**: Check your `.env` file has all required variables
- **Authentication errors**: Verify your R2 credentials are correct and have "Object Read & Write" permissions
- **Bucket errors**: Ensure the bucket name exists and your credentials have access
- **Network errors**: Check your internet connection and R2 service status
- **Path errors**: Verify path generation is working correctly (run unit tests first)

### Required R2 Permissions

For these tests to work, your R2 API token needs:
- **Object Read** - For downloading, listing, and checking file existence
- **Object Write** - For uploading files

Admin permissions are **not required** for these tests.


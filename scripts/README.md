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


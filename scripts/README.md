# Test Scripts

## R2 Storage Integration Test

Test script for verifying R2 storage upload/download functionality.

### Prerequisites

1. Ensure your `.env` file has all required R2 credentials:
   ```env
   R2_ACCOUNT_ID="your-account-id"
   R2_ACCESS_KEY_ID="your-access-key-id"
   R2_SECRET_ACCESS_KEY="your-secret-access-key"
   R2_BUCKET_NAME="your-bucket-name"
   R2_PUBLIC_URL="https://your-custom-domain.com" # Optional
   ```

2. Make sure your R2 bucket exists and is accessible with the provided credentials.

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

### Troubleshooting

- **Configuration errors**: Check your `.env` file has all required variables
- **Authentication errors**: Verify your R2 credentials are correct
- **Bucket errors**: Ensure the bucket name exists and your credentials have access
- **Network errors**: Check your internet connection and R2 service status


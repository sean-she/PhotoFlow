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

## Development vs Production

- **Development**: Use a test bucket and credentials
- **Production**: Use production bucket with appropriate access controls
- Consider using different buckets for different environments


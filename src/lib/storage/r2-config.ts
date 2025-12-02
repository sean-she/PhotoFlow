import { S3Client } from "@aws-sdk/client-s3";

/**
 * R2 Configuration
 * 
 * Cloudflare R2 is S3-compatible, so we use the AWS S3 SDK.
 * Configure R2 credentials via environment variables.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string; // Optional: Custom domain or R2 public URL
}

/**
 * Get R2 configuration from environment variables
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID environment variable is required");
  }
  if (!accessKeyId) {
    throw new Error("R2_ACCESS_KEY_ID environment variable is required");
  }
  if (!secretAccessKey) {
    throw new Error("R2_SECRET_ACCESS_KEY environment variable is required");
  }
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME environment variable is required");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  };
}

/**
 * Create and configure S3 client for Cloudflare R2
 * 
 * R2 uses the S3 API but requires a custom endpoint.
 * The endpoint format is: https://<account-id>.r2.cloudflarestorage.com
 */
export function createR2Client(config?: R2Config): S3Client {
  const r2Config = config ?? getR2Config();
  
  const endpoint = `https://${r2Config.accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto", // R2 uses "auto" as the region
    endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
    // Force path-style addressing (required for R2)
    forcePathStyle: true,
  });
}

/**
 * Get a singleton R2 client instance
 * Reuses the same client across the application for better performance
 */
let r2ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    r2ClientInstance = createR2Client();
  }
  return r2ClientInstance;
}

/**
 * Reset the R2 client instance (useful for testing or reconfiguration)
 */
export function resetR2Client(): void {
  r2ClientInstance = null;
}


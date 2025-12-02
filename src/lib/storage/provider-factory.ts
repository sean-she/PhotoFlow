/**
 * Storage Provider Factory
 * 
 * Factory for creating storage provider instances based on configuration.
 * Supports multiple providers and allows switching between them.
 */

import type { StorageProvider } from "./provider";
import { R2StorageProvider } from "./providers/r2-provider";
import type { R2Config } from "./r2-config";
import { getR2Config } from "./r2-config";

/**
 * Supported storage provider types
 */
export type StorageProviderType = "r2" | "s3" | "azure" | "gcs";

/**
 * Storage provider configuration
 */
export interface StorageProviderConfig {
  /** Provider type */
  type: StorageProviderType;
  /** Provider-specific configuration */
  config?: {
    r2?: R2Config;
    // Future: s3?: S3Config;
    // Future: azure?: AzureConfig;
    // Future: gcs?: GCSConfig;
  };
}

/**
 * Default storage provider configuration
 * Uses environment variables to determine the provider
 */
export function getDefaultStorageProviderConfig(): StorageProviderConfig {
  // Check for R2 environment variables
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ) {
    return {
      type: "r2",
      config: {
        r2: getR2Config(),
      },
    };
  }

  // Default to R2 if no other provider is configured
  // This maintains backward compatibility
  return {
    type: "r2",
    config: {
      r2: getR2Config(),
    },
  };
}

/**
 * Create a storage provider instance based on configuration
 * 
 * @param config - Provider configuration (defaults to environment-based config)
 * @returns Storage provider instance
 * 
 * @example
 * ```typescript
 * // Use default provider (from environment)
 * const provider = createStorageProvider();
 * 
 * // Use specific R2 configuration
 * const provider = createStorageProvider({
 *   type: "r2",
 *   config: { r2: customR2Config }
 * });
 * ```
 */
export function createStorageProvider(
  config?: StorageProviderConfig
): StorageProvider {
  const providerConfig = config ?? getDefaultStorageProviderConfig();

  switch (providerConfig.type) {
    case "r2": {
      const r2Config = providerConfig.config?.r2;
      return new R2StorageProvider(r2Config);
    }

    // Future providers can be added here
    // case "s3":
    //   return new S3StorageProvider(providerConfig.config?.s3);
    // case "azure":
    //   return new AzureStorageProvider(providerConfig.config?.azure);
    // case "gcs":
    //   return new GCSStorageProvider(providerConfig.config?.gcs);

    default:
      throw new Error(
        `Unsupported storage provider type: ${providerConfig.type}`
      );
  }
}

/**
 * Get the default storage provider instance
 * Uses singleton pattern to reuse the same provider instance
 */
let defaultProviderInstance: StorageProvider | null = null;

export function getDefaultStorageProvider(): StorageProvider {
  if (!defaultProviderInstance) {
    defaultProviderInstance = createStorageProvider();
  }
  return defaultProviderInstance;
}

/**
 * Reset the default storage provider instance
 * Useful for testing or reconfiguration
 */
export function resetDefaultStorageProvider(): void {
  defaultProviderInstance = null;
}

/**
 * Set a custom default storage provider
 * Useful for testing with mock providers
 */
export function setDefaultStorageProvider(provider: StorageProvider): void {
  defaultProviderInstance = provider;
}


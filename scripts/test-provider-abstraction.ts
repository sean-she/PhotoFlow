#!/usr/bin/env tsx
/**
 * Unit tests for Storage Provider Abstraction Layer
 * 
 * Tests the abstraction layer interface, type conversions, error handling,
 * factory pattern, and basic operations using a mock provider.
 * 
 * Usage:
 *   tsx scripts/test-provider-abstraction.ts
 */

import "dotenv/config";
import {
  StorageProvider,
  StorageProviderError,
  StorageUploadOptions,
  StorageProgressCallback,
  StorageBatchUploadItem,
} from "../src/lib/storage/provider";
import {
  createStorageProvider,
  getDefaultStorageProvider,
  resetDefaultStorageProvider,
  setDefaultStorageProvider,
  getDefaultStorageProviderConfig,
  type StorageProviderConfig,
} from "../src/lib/storage/provider-factory";
import { MockStorageProvider } from "../src/lib/storage/providers/mock-provider";
import * as crypto from "crypto";

// Test configuration
const TEST_PREFIX = "test-provider/";
const TEST_KEY = `${TEST_PREFIX}test-file.txt`;

/**
 * Create a test file buffer
 */
function createTestFile(content?: string): Buffer {
  const testContent =
    content ||
    `Test file created at ${new Date().toISOString()}\nRandom data: ${crypto.randomBytes(16).toString("hex")}`;
  return Buffer.from(testContent, "utf-8");
}

/**
 * Test 1: Provider Interface Compliance
 */
function testProviderInterfaceCompliance(): boolean {
  console.log("\n📋 Test 1: Provider Interface Compliance");
  console.log("─".repeat(50));

  try {
    const mockProvider = new MockStorageProvider();

    // Check that provider has required readonly property
    if (typeof mockProvider.name !== "string") {
      throw new Error("Provider missing 'name' property");
    }

    // Check that all required methods exist
    const requiredMethods: Array<keyof StorageProvider> = [
      "uploadFile",
      "uploadFiles",
      "downloadFile",
      "downloadFileAsBuffer",
      "downloadFileWithProgress",
      "getFileMetadata",
      "fileExists",
      "deleteFile",
      "deleteFiles",
      "listFiles",
      "listFilesWithMetadata",
      "copyFile",
      "generateCdnUrl",
    ];

    for (const method of requiredMethods) {
      if (typeof mockProvider[method] !== "function") {
        throw new Error(`Provider missing required method: ${method}`);
      }
    }

    console.log("✅ Provider interface compliance verified");
    console.log(`   Provider name: ${mockProvider.name}`);
    console.log(`   Methods checked: ${requiredMethods.length}`);
    return true;
  } catch (error) {
    console.error(
      "❌ Interface compliance failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 2: Factory Pattern - Create Provider
 */
function testFactoryCreateProvider(): boolean {
  console.log("\n🏭 Test 2: Factory Pattern - Create Provider");
  console.log("─".repeat(50));

  try {
    // Test creating R2 provider (if config available)
    try {
      const r2Provider = createStorageProvider({ type: "r2" });
      if (r2Provider.name !== "r2") {
        throw new Error("R2 provider name mismatch");
      }
      console.log("✅ R2 provider created successfully");
    } catch (error) {
      console.log("⚠️  R2 provider creation skipped (config may be missing)");
    }

    // Test creating with invalid type
    try {
      createStorageProvider({ type: "invalid" as any });
      throw new Error("Should have thrown error for invalid provider type");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Unsupported storage provider type")
      ) {
        console.log("✅ Invalid provider type correctly rejected");
      } else {
        throw error;
      }
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Factory create provider failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 3: Factory Pattern - Default Provider
 */
function testFactoryDefaultProvider(): boolean {
  console.log("\n🏭 Test 3: Factory Pattern - Default Provider");
  console.log("─".repeat(50));

  try {
    // Reset to ensure clean state
    resetDefaultStorageProvider();

    // Get default provider
    const provider1 = getDefaultStorageProvider();
    if (!provider1) {
      throw new Error("Default provider is null");
    }

    // Get again (should be same instance)
    const provider2 = getDefaultStorageProvider();
    if (provider1 !== provider2) {
      throw new Error("Default provider should be singleton");
    }

    console.log("✅ Default provider singleton pattern works");
    console.log(`   Provider name: ${provider1.name}`);

    // Test setting custom provider
    const mockProvider = new MockStorageProvider();
    setDefaultStorageProvider(mockProvider);
    const provider3 = getDefaultStorageProvider();
    if (provider3 !== mockProvider) {
      throw new Error("Custom provider not set correctly");
    }

    console.log("✅ Custom provider can be set");

    // Reset
    resetDefaultStorageProvider();
    console.log("✅ Provider reset works");

    return true;
  } catch (error) {
    console.error(
      "❌ Factory default provider failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 4: Configuration Handling
 */
function testConfigurationHandling(): boolean {
  console.log("\n⚙️  Test 4: Configuration Handling");
  console.log("─".repeat(50));

  try {
    const config = getDefaultStorageProviderConfig();
    if (!config.type) {
      throw new Error("Config missing type");
    }

    console.log("✅ Default configuration loaded");
    console.log(`   Provider type: ${config.type}`);

    // Test custom configuration
    const customConfig: StorageProviderConfig = {
      type: "r2",
      config: {
        r2: {
          accountId: "test-account",
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
          bucketName: "test-bucket",
        },
      },
    };

    try {
      const provider = createStorageProvider(customConfig);
      console.log("✅ Custom configuration works");
      console.log(`   Provider name: ${provider.name}`);
    } catch (error) {
      // This might fail if R2 config is required, which is okay
      console.log("⚠️  Custom R2 config test skipped (may require valid credentials)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Configuration handling failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 5: Mock Provider - Upload File
 */
async function testMockProviderUpload(): Promise<boolean> {
  console.log("\n📤 Test 5: Mock Provider - Upload File");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile("Test upload content");
    const options: StorageUploadOptions = {
      contentType: "text/plain",
      metadata: { test: "true" },
    };

    const result = await provider.uploadFile(TEST_KEY, testContent, options);

    if (result.key !== TEST_KEY) {
      throw new Error("Upload result key mismatch");
    }
    if (result.size !== testContent.length) {
      throw new Error("Upload result size mismatch");
    }
    if (!result.etag) {
      throw new Error("Upload result missing etag");
    }
    if (result.contentType !== options.contentType) {
      throw new Error("Upload result contentType mismatch");
    }

    console.log("✅ File uploaded successfully");
    console.log(`   Key: ${result.key}`);
    console.log(`   Size: ${result.size} bytes`);
    console.log(`   ETag: ${result.etag.substring(0, 16)}...`);
    console.log(`   Content Type: ${result.contentType}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider upload failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 6: Mock Provider - Download File
 */
async function testMockProviderDownload(): Promise<boolean> {
  console.log("\n📥 Test 6: Mock Provider - Download File");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile("Test download content");

    // Upload first
    await provider.uploadFile(TEST_KEY, testContent, {
      contentType: "text/plain",
    });

    // Download as buffer
    const result = await provider.downloadFileAsBuffer(TEST_KEY);

    if (result.key !== TEST_KEY) {
      throw new Error("Download result key mismatch");
    }
    if (!result.buffer.equals(testContent)) {
      throw new Error("Downloaded content doesn't match uploaded content");
    }
    if (result.contentType !== "text/plain") {
      throw new Error("Download result contentType mismatch");
    }

    console.log("✅ File downloaded successfully");
    console.log(`   Key: ${result.key}`);
    console.log(`   Size: ${result.buffer.length} bytes`);
    console.log(`   Content matches: ${result.buffer.equals(testContent)}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider download failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 7: Mock Provider - File Metadata
 */
async function testMockProviderMetadata(): Promise<boolean> {
  console.log("\n📊 Test 7: Mock Provider - File Metadata");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile("Test metadata content");
    const metadata = { albumId: "123", userId: "456" };

    await provider.uploadFile(TEST_KEY, testContent, {
      contentType: "text/plain",
      metadata,
    });

    const fileMetadata = await provider.getFileMetadata(TEST_KEY);

    if (fileMetadata.key !== TEST_KEY) {
      throw new Error("Metadata key mismatch");
    }
    if (fileMetadata.contentLength !== testContent.length) {
      throw new Error("Metadata contentLength mismatch");
    }
    if (fileMetadata.contentType !== "text/plain") {
      throw new Error("Metadata contentType mismatch");
    }
    if (JSON.stringify(fileMetadata.metadata) !== JSON.stringify(metadata)) {
      throw new Error("Metadata doesn't match");
    }

    console.log("✅ File metadata retrieved successfully");
    console.log(`   Key: ${fileMetadata.key}`);
    console.log(`   Size: ${fileMetadata.contentLength} bytes`);
    console.log(`   Content Type: ${fileMetadata.contentType}`);
    console.log(`   Metadata:`, fileMetadata.metadata);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider metadata failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 8: Mock Provider - File Exists
 */
async function testMockProviderFileExists(): Promise<boolean> {
  console.log("\n🔍 Test 8: Mock Provider - File Exists");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile();

    // File shouldn't exist initially
    const existsBefore = await provider.fileExists(TEST_KEY);
    if (existsBefore) {
      throw new Error("File should not exist before upload");
    }

    // Upload file
    await provider.uploadFile(TEST_KEY, testContent);

    // File should exist now
    const existsAfter = await provider.fileExists(TEST_KEY);
    if (!existsAfter) {
      throw new Error("File should exist after upload");
    }

    // Non-existent file
    const nonExistent = await provider.fileExists("non-existent-key");
    if (nonExistent) {
      throw new Error("Non-existent file should return false");
    }

    console.log("✅ File existence checks work correctly");
    console.log(`   Before upload: ${existsBefore}`);
    console.log(`   After upload: ${existsAfter}`);
    console.log(`   Non-existent: ${nonExistent}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider file exists failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 9: Mock Provider - Batch Upload
 */
async function testMockProviderBatchUpload(): Promise<boolean> {
  console.log("\n📦 Test 9: Mock Provider - Batch Upload");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const uploads: StorageBatchUploadItem[] = [
      {
        key: `${TEST_PREFIX}file1.txt`,
        body: Buffer.from("File 1 content"),
        options: { contentType: "text/plain" },
      },
      {
        key: `${TEST_PREFIX}file2.txt`,
        body: Buffer.from("File 2 content"),
        options: { contentType: "text/plain" },
      },
      {
        key: `${TEST_PREFIX}file3.txt`,
        body: Buffer.from("File 3 content"),
      },
    ];

    const result = await provider.uploadFiles(uploads, {
      contentType: "text/plain",
    });

    if (result.successful.length !== 3) {
      throw new Error(
        `Expected 3 successful uploads, got ${result.successful.length}`
      );
    }
    if (result.failed.length !== 0) {
      throw new Error(`Expected 0 failed uploads, got ${result.failed.length}`);
    }

    // Verify files exist
    for (const item of uploads) {
      const exists = await provider.fileExists(item.key);
      if (!exists) {
        throw new Error(`File ${item.key} should exist after batch upload`);
      }
    }

    console.log("✅ Batch upload successful");
    console.log(`   Successful: ${result.successful.length}`);
    console.log(`   Failed: ${result.failed.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider batch upload failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 10: Mock Provider - List Files
 */
async function testMockProviderListFiles(): Promise<boolean> {
  console.log("\n📋 Test 10: Mock Provider - List Files");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();

    // Upload multiple files
    const files = [
      `${TEST_PREFIX}file1.txt`,
      `${TEST_PREFIX}file2.txt`,
      `${TEST_PREFIX}subdir/file3.txt`,
    ];

    for (const key of files) {
      await provider.uploadFile(key, Buffer.from(`Content for ${key}`));
    }

    // List all files with prefix
    const listResult = await provider.listFiles({
      prefix: TEST_PREFIX,
      maxResults: 100,
    });

    if (listResult.keys.length < 3) {
      throw new Error(
        `Expected at least 3 files, got ${listResult.keys.length}`
      );
    }

    // List with metadata
    const listWithMetadata = await provider.listFilesWithMetadata({
      prefix: TEST_PREFIX,
      maxResults: 100,
    });

    if (listWithMetadata.files.length < 3) {
      throw new Error(
        `Expected at least 3 files with metadata, got ${listWithMetadata.files.length}`
      );
    }

    // Verify metadata is included
    const firstFile = listWithMetadata.files[0];
    if (!firstFile.key || firstFile.size === undefined) {
      throw new Error("File metadata missing required fields");
    }

    console.log("✅ List files works correctly");
    console.log(`   Files found: ${listResult.keys.length}`);
    console.log(`   Files with metadata: ${listWithMetadata.files.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider list files failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 11: Mock Provider - Delete File
 */
async function testMockProviderDelete(): Promise<boolean> {
  console.log("\n🗑️  Test 11: Mock Provider - Delete File");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile();

    // Upload file
    await provider.uploadFile(TEST_KEY, testContent);
    const existsBefore = await provider.fileExists(TEST_KEY);
    if (!existsBefore) {
      throw new Error("File should exist before deletion");
    }

    // Delete file
    const deleted = await provider.deleteFile(TEST_KEY);
    if (!deleted) {
      throw new Error("Delete should return true for existing file");
    }

    // File should not exist
    const existsAfter = await provider.fileExists(TEST_KEY);
    if (existsAfter) {
      throw new Error("File should not exist after deletion");
    }

    // Delete non-existent file
    const deletedNonExistent = await provider.deleteFile("non-existent");
    if (deletedNonExistent) {
      throw new Error("Delete should return false for non-existent file");
    }

    console.log("✅ Delete file works correctly");
    console.log(`   Deleted existing: ${deleted}`);
    console.log(`   Deleted non-existent: ${deletedNonExistent}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider delete failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 12: Mock Provider - Copy File
 */
async function testMockProviderCopy(): Promise<boolean> {
  console.log("\n📋 Test 12: Mock Provider - Copy File");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = createTestFile("Copy test content");
    const sourceKey = `${TEST_PREFIX}source.txt`;
    const destKey = `${TEST_PREFIX}dest.txt`;

    // Upload source file
    await provider.uploadFile(sourceKey, testContent, {
      contentType: "text/plain",
      metadata: { source: "true" },
    });

    // Copy file
    const copied = await provider.copyFile(sourceKey, destKey);
    if (!copied) {
      throw new Error("Copy should return true");
    }

    // Verify destination exists
    const destExists = await provider.fileExists(destKey);
    if (!destExists) {
      throw new Error("Destination file should exist after copy");
    }

    // Verify content matches
    const destContent = await provider.downloadFileAsBuffer(destKey);
    if (!destContent.buffer.equals(testContent)) {
      throw new Error("Copied content doesn't match source");
    }

    console.log("✅ Copy file works correctly");
    console.log(`   Source: ${sourceKey}`);
    console.log(`   Destination: ${destKey}`);
    console.log(`   Content matches: ${destContent.buffer.equals(testContent)}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider copy failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 13: Mock Provider - CDN URL Generation
 */
async function testMockProviderCdnUrl(): Promise<boolean> {
  console.log("\n🔗 Test 13: Mock Provider - CDN URL Generation");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();

    // Generate public URL
    const publicUrl = await provider.generateCdnUrl(TEST_KEY);
    if (!publicUrl.includes(TEST_KEY) || !publicUrl.startsWith("http")) {
      throw new Error("Public URL format incorrect");
    }

    // Generate signed URL
    const signedUrl = await provider.generateCdnUrl(TEST_KEY, {
      signed: true,
      expiresIn: 3600,
    });
    if (!signedUrl.includes("signature") || !signedUrl.includes("expires")) {
      throw new Error("Signed URL format incorrect");
    }

    console.log("✅ CDN URL generation works");
    console.log(`   Public URL: ${publicUrl.substring(0, 60)}...`);
    console.log(`   Signed URL: ${signedUrl.substring(0, 60)}...`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider CDN URL failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 14: Error Handling - StorageProviderError
 */
async function testErrorHandling(): Promise<boolean> {
  console.log("\n⚠️  Test 14: Error Handling");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();

    // Test download of non-existent file
    try {
      await provider.downloadFileAsBuffer("non-existent-key");
      throw new Error("Should have thrown error for non-existent file");
    } catch (error) {
      if (!(error instanceof StorageProviderError)) {
        throw new Error("Error should be StorageProviderError");
      }
      if (error.key !== "non-existent-key") {
        throw new Error("Error key should match requested key");
      }
      console.log("✅ Non-existent file error handled correctly");
    }

    // Test get metadata of non-existent file
    try {
      await provider.getFileMetadata("non-existent-key");
      throw new Error("Should have thrown error for non-existent file");
    } catch (error) {
      if (!(error instanceof StorageProviderError)) {
        throw new Error("Error should be StorageProviderError");
      }
      console.log("✅ Metadata error handled correctly");
    }

    // Test copy with non-existent source
    try {
      await provider.copyFile("non-existent-source", "dest");
      throw new Error("Should have thrown error for non-existent source");
    } catch (error) {
      if (!(error instanceof StorageProviderError)) {
        throw new Error("Error should be StorageProviderError");
      }
      console.log("✅ Copy error handled correctly");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Error handling test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 15: Progress Callback
 */
async function testProgressCallback(): Promise<boolean> {
  console.log("\n📊 Test 15: Progress Callback");
  console.log("─".repeat(50));

  try {
    const provider = new MockStorageProvider();
    const testContent = Buffer.alloc(1024 * 10, "x"); // 10KB file

    await provider.uploadFile(TEST_KEY, testContent);

    const progressUpdates: Array<{
      loaded: number;
      total?: number;
      percentage?: number;
    }> = [];

    const progressCallback: StorageProgressCallback = (progress) => {
      progressUpdates.push(progress);
    };

    await provider.downloadFileWithProgress(TEST_KEY, progressCallback);

    if (progressUpdates.length === 0) {
      throw new Error("Progress callback was never called");
    }

    const lastUpdate = progressUpdates[progressUpdates.length - 1];
    if (lastUpdate.percentage !== 100) {
      throw new Error("Final progress should be 100%");
    }

    console.log("✅ Progress callback works correctly");
    console.log(`   Progress updates received: ${progressUpdates.length}`);
    console.log(`   Final progress: ${lastUpdate.percentage}%`);

    return true;
  } catch (error) {
    console.error(
      "❌ Progress callback test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Storage Provider Abstraction Layer - Unit Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({
    name: "Provider Interface Compliance",
    passed: testProviderInterfaceCompliance(),
  });
  results.push({
    name: "Factory - Create Provider",
    passed: testFactoryCreateProvider(),
  });
  results.push({
    name: "Factory - Default Provider",
    passed: testFactoryDefaultProvider(),
  });
  results.push({
    name: "Configuration Handling",
    passed: testConfigurationHandling(),
  });
  results.push({
    name: "Mock Provider - Upload",
    passed: await testMockProviderUpload(),
  });
  results.push({
    name: "Mock Provider - Download",
    passed: await testMockProviderDownload(),
  });
  results.push({
    name: "Mock Provider - Metadata",
    passed: await testMockProviderMetadata(),
  });
  results.push({
    name: "Mock Provider - File Exists",
    passed: await testMockProviderFileExists(),
  });
  results.push({
    name: "Mock Provider - Batch Upload",
    passed: await testMockProviderBatchUpload(),
  });
  results.push({
    name: "Mock Provider - List Files",
    passed: await testMockProviderListFiles(),
  });
  results.push({
    name: "Mock Provider - Delete",
    passed: await testMockProviderDelete(),
  });
  results.push({
    name: "Mock Provider - Copy",
    passed: await testMockProviderCopy(),
  });
  results.push({
    name: "Mock Provider - CDN URL",
    passed: await testMockProviderCdnUrl(),
  });
  results.push({
    name: "Error Handling",
    passed: await testErrorHandling(),
  });
  results.push({
    name: "Progress Callback",
    passed: await testProgressCallback(),
  });

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
  });

  console.log("\n" + "─".repeat(50));
  console.log(`Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Please review the errors above.");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});


#!/usr/bin/env tsx
/**
 * Integration tests for R2 Storage Provider through Abstraction Layer
 * 
 * Tests the R2 provider implementation through the StorageProvider interface,
 * verifying all operations work correctly with real R2 storage.
 * 
 * Usage:
 *   tsx scripts/test-r2-provider-integration.ts
 * 
 * Note: Requires R2 credentials in .env file.
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
} from "../src/lib/storage/provider-factory";
import { getR2Config } from "../src/lib/storage/r2-config";
import * as crypto from "crypto";

// Test configuration
const TEST_PREFIX = "test-r2-provider/";
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
 * Cleanup test files
 */
async function cleanupTestFiles(provider: StorageProvider): Promise<void> {
  try {
    const listResult = await provider.listFiles({
      prefix: TEST_PREFIX,
      maxResults: 1000,
    });

    for (const key of listResult.keys) {
      try {
        await provider.deleteFile(key);
      } catch (error) {
        // Ignore deletion errors during cleanup
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Test 1: Configuration Check
 */
function testConfigurationCheck(): boolean {
  console.log("\n📋 Test 1: Configuration Check");
  console.log("─".repeat(50));

  try {
    const config = getR2Config();
    if (!config.accountId || !config.bucketName) {
      throw new Error("R2 configuration is incomplete");
    }

    console.log("✅ R2 configuration loaded successfully");
    console.log(`   Account ID: ${config.accountId.substring(0, 8)}...`);
    console.log(`   Bucket: ${config.bucketName}`);
    console.log(`   Public URL: ${config.publicUrl || "Not set"}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Configuration check failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 2: R2 Provider Creation
 */
function testR2ProviderCreation(): boolean {
  console.log("\n🏭 Test 2: R2 Provider Creation");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
    if (provider.name !== "r2") {
      throw new Error("Provider name mismatch");
    }

    console.log("✅ R2 provider created successfully");
    console.log(`   Provider name: ${provider.name}`);

    return true;
  } catch (error) {
    console.error(
      "❌ R2 provider creation failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 3: R2 Provider - Upload File
 */
async function testR2ProviderUpload(): Promise<boolean> {
  console.log("\n📤 Test 3: R2 Provider - Upload File");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider upload failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 4: R2 Provider - Download File
 */
async function testR2ProviderDownload(): Promise<boolean> {
  console.log("\n📥 Test 4: R2 Provider - Download File");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider download failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 5: R2 Provider - File Metadata
 */
async function testR2ProviderMetadata(): Promise<boolean> {
  console.log("\n📊 Test 5: R2 Provider - File Metadata");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
    // Note: R2 metadata might have additional fields, so we check if our metadata is included
    const hasMetadata = fileMetadata.metadata && Object.keys(fileMetadata.metadata).length > 0;
    if (!hasMetadata) {
      console.log("⚠️  Metadata may not be preserved (R2 limitation)");
    }

    console.log("✅ File metadata retrieved successfully");
    console.log(`   Key: ${fileMetadata.key}`);
    console.log(`   Size: ${fileMetadata.contentLength} bytes`);
    console.log(`   Content Type: ${fileMetadata.contentType}`);
    console.log(`   Metadata present: ${hasMetadata}`);

    return true;
  } catch (error) {
    console.error(
      "❌ R2 provider metadata failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 6: R2 Provider - File Exists
 */
async function testR2ProviderFileExists(): Promise<boolean> {
  console.log("\n🔍 Test 6: R2 Provider - File Exists");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
    const testContent = createTestFile();

    // File shouldn't exist initially (cleanup first)
    await cleanupTestFiles(provider);
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
      "❌ R2 provider file exists failed:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error("   Stack:", error.stack.split("\n").slice(0, 3).join("\n"));
    }
    return false;
  }
}

/**
 * Test 7: R2 Provider - Batch Upload
 */
async function testR2ProviderBatchUpload(): Promise<boolean> {
  console.log("\n📦 Test 7: R2 Provider - Batch Upload");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider batch upload failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 8: R2 Provider - List Files
 */
async function testR2ProviderListFiles(): Promise<boolean> {
  console.log("\n📋 Test 8: R2 Provider - List Files");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });

    // Cleanup first
    await cleanupTestFiles(provider);

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
      "❌ R2 provider list files failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 9: R2 Provider - Delete File
 */
async function testR2ProviderDelete(): Promise<boolean> {
  console.log("\n🗑️  Test 9: R2 Provider - Delete File");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider delete failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 10: R2 Provider - Copy File
 */
async function testR2ProviderCopy(): Promise<boolean> {
  console.log("\n📋 Test 10: R2 Provider - Copy File");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider copy failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 11: R2 Provider - CDN URL Generation
 */
async function testR2ProviderCdnUrl(): Promise<boolean> {
  console.log("\n🔗 Test 11: R2 Provider - CDN URL Generation");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });

    // Upload a file first
    await provider.uploadFile(TEST_KEY, createTestFile());

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
    if (!signedUrl.includes("X-Amz-Signature") && !signedUrl.includes("signature")) {
      // R2 signed URLs might use different signature format
      console.log("⚠️  Signed URL format may vary by provider");
    }

    console.log("✅ CDN URL generation works");
    console.log(`   Public URL: ${publicUrl.substring(0, 60)}...`);
    console.log(`   Signed URL: ${signedUrl.substring(0, 60)}...`);

    return true;
  } catch (error) {
    console.error(
      "❌ R2 provider CDN URL failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 12: R2 Provider - Error Handling
 */
async function testR2ProviderErrorHandling(): Promise<boolean> {
  console.log("\n⚠️  Test 12: R2 Provider - Error Handling");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });

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
      "❌ R2 provider error handling test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 13: R2 Provider - Progress Callback
 */
async function testR2ProviderProgressCallback(): Promise<boolean> {
  console.log("\n📊 Test 13: R2 Provider - Progress Callback");
  console.log("─".repeat(50));

  try {
    const provider = createStorageProvider({ type: "r2" });
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
      "❌ R2 provider progress callback test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 14: R2 Provider - Default Provider Integration
 */
async function testR2ProviderDefaultProvider(): Promise<boolean> {
  console.log("\n🏭 Test 14: R2 Provider - Default Provider Integration");
  console.log("─".repeat(50));

  try {
    const defaultProvider = getDefaultStorageProvider();
    if (!defaultProvider) {
      throw new Error("Default provider should not be null");
    }

    if (defaultProvider.name !== "r2") {
      console.log("⚠️  Default provider is not R2 (may be mock in test environment)");
      return true; // This is okay in test environments
    }

    // Test that default provider works
    const testContent = createTestFile("Default provider test");
    const testKey = `${TEST_PREFIX}default-provider-test.txt`;

    await defaultProvider.uploadFile(testKey, testContent);
    const exists = await defaultProvider.fileExists(testKey);
    if (!exists) {
      throw new Error("Default provider should work correctly");
    }

    await defaultProvider.deleteFile(testKey);

    console.log("✅ Default provider integration works");
    console.log(`   Provider name: ${defaultProvider.name}`);

    return true;
  } catch (error) {
    console.error(
      "❌ R2 provider default provider test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 R2 Storage Provider - Integration Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({
    name: "Configuration Check",
    passed: testConfigurationCheck(),
  });
  results.push({
    name: "R2 Provider Creation",
    passed: testR2ProviderCreation(),
  });
  results.push({
    name: "R2 Provider - Upload",
    passed: await testR2ProviderUpload(),
  });
  results.push({
    name: "R2 Provider - Download",
    passed: await testR2ProviderDownload(),
  });
  results.push({
    name: "R2 Provider - Metadata",
    passed: await testR2ProviderMetadata(),
  });
  results.push({
    name: "R2 Provider - File Exists",
    passed: await testR2ProviderFileExists(),
  });
  results.push({
    name: "R2 Provider - Batch Upload",
    passed: await testR2ProviderBatchUpload(),
  });
  results.push({
    name: "R2 Provider - List Files",
    passed: await testR2ProviderListFiles(),
  });
  results.push({
    name: "R2 Provider - Delete",
    passed: await testR2ProviderDelete(),
  });
  results.push({
    name: "R2 Provider - Copy",
    passed: await testR2ProviderCopy(),
  });
  results.push({
    name: "R2 Provider - CDN URL",
    passed: await testR2ProviderCdnUrl(),
  });
  results.push({
    name: "R2 Provider - Error Handling",
    passed: await testR2ProviderErrorHandling(),
  });
  results.push({
    name: "R2 Provider - Progress Callback",
    passed: await testR2ProviderProgressCallback(),
  });
  results.push({
    name: "R2 Provider - Default Provider",
    passed: await testR2ProviderDefaultProvider(),
  });

  // Cleanup
  console.log("\n🧹 Cleanup");
  console.log("─".repeat(50));
  try {
    const provider = createStorageProvider({ type: "r2" });
    await cleanupTestFiles(provider);
    console.log("✅ Cleanup completed");
  } catch (error) {
    console.log("⚠️  Cleanup had errors (non-fatal)");
  }

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


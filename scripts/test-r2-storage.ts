#!/usr/bin/env tsx
/**
 * Manual test script for R2 storage upload/download utilities
 * 
 * Usage:
 *   tsx scripts/test-r2-storage.ts
 * 
 * Make sure your .env file has R2 credentials configured.
 */

import "dotenv/config";
import { uploadFile, downloadFileAsBuffer, getFileMetadata } from "../src/lib/storage";
import { getR2Config } from "../src/lib/storage/r2-config";
import * as crypto from "crypto";

// Test configuration
const TEST_PREFIX = "test/";
const TEST_FILE_NAME = "test-file.txt";
const TEST_KEY = `${TEST_PREFIX}${TEST_FILE_NAME}`;

/**
 * Create a test file buffer
 */
function createTestFile(content?: string): Buffer {
  const testContent = content || `Test file created at ${new Date().toISOString()}\nRandom data: ${crypto.randomBytes(16).toString("hex")}`;
  return Buffer.from(testContent, "utf-8");
}

/**
 * Test 1: Configuration check
 */
async function testConfiguration(): Promise<boolean> {
  console.log("\n📋 Test 1: Configuration Check");
  console.log("─".repeat(50));
  
  try {
    const config = getR2Config();
    console.log("✅ Configuration loaded successfully");
    console.log(`   Account ID: ${config.accountId.substring(0, 8)}...`);
    console.log(`   Bucket: ${config.bucketName}`);
    console.log(`   Public URL: ${config.publicUrl || "Not set"}`);
    return true;
  } catch (error) {
    console.error("❌ Configuration failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: Upload a small file
 */
async function testUploadSmallFile(): Promise<boolean> {
  console.log("\n📤 Test 2: Upload Small File");
  console.log("─".repeat(50));
  
  try {
    const testContent = createTestFile("Small file test content");
    const result = await uploadFile(TEST_KEY, testContent, {
      contentType: "text/plain",
      metadata: {
        test: "true",
        uploadedBy: "test-script",
      },
    });
    
    console.log("✅ Upload successful");
    console.log(`   Key: ${result.key}`);
    console.log(`   Size: ${result.size} bytes`);
    console.log(`   ETag: ${result.etag}`);
    console.log(`   Content Type: ${result.contentType}`);
    console.log(`   Uploaded At: ${result.uploadedAt.toISOString()}`);
    return true;
  } catch (error) {
    console.error("❌ Upload failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("   Stack:", error.stack);
    }
    return false;
  }
}

/**
 * Test 3: Get file metadata
 */
async function testGetMetadata(): Promise<boolean> {
  console.log("\n📊 Test 3: Get File Metadata");
  console.log("─".repeat(50));
  
  try {
    const metadata = await getFileMetadata(TEST_KEY);
    
    console.log("✅ Metadata retrieved");
    console.log(`   Key: ${metadata.key}`);
    console.log(`   Content Type: ${metadata.contentType || "Not set"}`);
    console.log(`   Size: ${metadata.contentLength || "Unknown"} bytes`);
    console.log(`   ETag: ${metadata.etag || "Not set"}`);
    console.log(`   Last Modified: ${metadata.lastModified?.toISOString() || "Unknown"}`);
    console.log(`   Metadata:`, metadata.metadata || {});
    return true;
  } catch (error) {
    console.error("❌ Get metadata failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: Download file
 */
async function testDownloadFile(): Promise<boolean> {
  console.log("\n📥 Test 4: Download File");
  console.log("─".repeat(50));
  
  try {
    const result = await downloadFileAsBuffer(TEST_KEY);
    
    console.log("✅ Download successful");
    console.log(`   Key: ${result.key}`);
    console.log(`   Size: ${result.contentLength || result.buffer.length} bytes`);
    console.log(`   Content Type: ${result.contentType || "Not set"}`);
    console.log(`   ETag: ${result.etag || "Not set"}`);
    console.log(`   Content preview: ${result.buffer.toString("utf-8").substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error("❌ Download failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: Upload a larger file (to test multipart)
 */
async function testUploadLargeFile(): Promise<boolean> {
  console.log("\n📤 Test 5: Upload Large File (Multipart)");
  console.log("─".repeat(50));
  
  try {
    // Create a file larger than 5MB to trigger multipart upload
    const largeContent = Buffer.alloc(6 * 1024 * 1024); // 6MB
    largeContent.fill("A");
    largeContent.write("Large file test content at the beginning\n", 0);
    
    const largeKey = `${TEST_PREFIX}large-file-${Date.now()}.bin`;
    const result = await uploadFile(largeKey, largeContent, {
      contentType: "application/octet-stream",
      metadata: {
        test: "large-file",
        size: largeContent.length.toString(),
      },
    });
    
    console.log("✅ Large file upload successful (multipart)");
    console.log(`   Key: ${largeKey}`);
    console.log(`   Size: ${result.size} bytes`);
    console.log(`   ETag: ${result.etag}`);
    return true;
  } catch (error) {
    console.error("❌ Large file upload failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: Upload with progress (if implemented)
 */
async function testUploadWithMetadata(): Promise<boolean> {
  console.log("\n📤 Test 6: Upload with Custom Metadata");
  console.log("─".repeat(50));
  
  try {
    const testContent = createTestFile("Metadata test");
    const metadataKey = `${TEST_PREFIX}metadata-test-${Date.now()}.txt`;
    const result = await uploadFile(metadataKey, testContent, {
      contentType: "text/plain",
      metadata: {
        albumId: "123",
        userId: "456",
        photoId: "789",
        customField: "test-value",
      },
    });
    
    console.log("✅ Upload with metadata successful");
    console.log(`   Key: ${metadataKey}`);
    
    // Verify metadata was saved
    const metadata = await getFileMetadata(metadataKey);
    console.log(`   Retrieved metadata:`, metadata.metadata);
    
    return true;
  } catch (error) {
    console.error("❌ Upload with metadata failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 R2 Storage Integration Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);
  
  const results: Array<{ name: string; passed: boolean }> = [];
  
  // Run tests in sequence
  results.push({ name: "Configuration", passed: await testConfiguration() });
  
  if (!results[0].passed) {
    console.log("\n❌ Configuration test failed. Please check your .env file.");
    process.exit(1);
  }
  
  results.push({ name: "Upload Small File", passed: await testUploadSmallFile() });
  results.push({ name: "Get Metadata", passed: await testGetMetadata() });
  results.push({ name: "Download File", passed: await testDownloadFile() });
  results.push({ name: "Upload Large File", passed: await testUploadLargeFile() });
  results.push({ name: "Upload with Metadata", passed: await testUploadWithMetadata() });
  
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


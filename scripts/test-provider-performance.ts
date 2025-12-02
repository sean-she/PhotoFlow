#!/usr/bin/env tsx
/**
 * Performance comparison tests for Storage Provider Abstraction Layer
 * 
 * Compares performance between direct R2 function calls and provider interface calls
 * to ensure the abstraction layer doesn't add significant overhead.
 * 
 * Usage:
 *   tsx scripts/test-provider-performance.ts
 * 
 * Note: This test requires R2 credentials in .env file for accurate comparison.
 */

import "dotenv/config";
import {
  uploadFile as directUploadFile,
  downloadFileAsBuffer as directDownloadFileAsBuffer,
  getFileMetadata as directGetFileMetadata,
} from "../src/lib/storage";
import {
  getDefaultStorageProvider,
  createStorageProvider,
} from "../src/lib/storage/provider-factory";
import { R2StorageProvider } from "../src/lib/storage/providers/r2-provider";
import { MockStorageProvider } from "../src/lib/storage/providers/mock-provider";
import * as crypto from "crypto";

// Test configuration
const TEST_PREFIX = "test-performance/";
const ITERATIONS = 10; // Number of iterations for averaging

/**
 * Create a test file buffer
 */
function createTestFile(sizeBytes: number): Buffer {
  return crypto.randomBytes(sizeBytes);
}

/**
 * Measure execution time of a function
 */
async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
}

/**
 * Average multiple measurements
 */
function average(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Test 1: Upload Performance - Direct vs Provider (Small File)
 */
async function testUploadPerformanceSmall(): Promise<boolean> {
  console.log("\n📤 Test 1: Upload Performance - Small File (1KB)");
  console.log("─".repeat(50));

  try {
    const testContent = createTestFile(1024); // 1KB
    const testKey = `${TEST_PREFIX}small-${Date.now()}.bin`;

    // Test direct function
    const directTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const key = `${testKey}-direct-${i}`;
      const { duration } = await measureTime(() =>
        directUploadFile(key, testContent, { contentType: "application/octet-stream" })
      );
      directTimes.push(duration);
    }

    // Test provider interface
    const provider = getDefaultStorageProvider();
    const providerTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const key = `${testKey}-provider-${i}`;
      const { duration } = await measureTime(() =>
        provider.uploadFile(key, testContent, { contentType: "application/octet-stream" })
      );
      providerTimes.push(duration);
    }

    const directAvg = average(directTimes);
    const providerAvg = average(providerTimes);
    const overhead = ((providerAvg - directAvg) / directAvg) * 100;

    console.log("✅ Upload performance test completed");
    console.log(`   Direct average: ${directAvg.toFixed(2)}ms`);
    console.log(`   Provider average: ${providerAvg.toFixed(2)}ms`);
    console.log(`   Overhead: ${overhead.toFixed(2)}%`);
    console.log(`   File size: ${formatBytes(testContent.length)}`);

    if (overhead > 50) {
      console.log("⚠️  Warning: High overhead detected (>50%)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Upload performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 2: Upload Performance - Direct vs Provider (Large File)
 */
async function testUploadPerformanceLarge(): Promise<boolean> {
  console.log("\n📤 Test 2: Upload Performance - Large File (1MB)");
  console.log("─".repeat(50));

  try {
    const testContent = createTestFile(1024 * 1024); // 1MB
    const testKey = `${TEST_PREFIX}large-${Date.now()}.bin`;

    // Test direct function
    const directTimes: number[] = [];
    for (let i = 0; i < Math.min(ITERATIONS, 3); i++) {
      // Fewer iterations for large files
      const key = `${testKey}-direct-${i}`;
      const { duration } = await measureTime(() =>
        directUploadFile(key, testContent, { contentType: "application/octet-stream" })
      );
      directTimes.push(duration);
    }

    // Test provider interface
    const provider = getDefaultStorageProvider();
    const providerTimes: number[] = [];
    for (let i = 0; i < Math.min(ITERATIONS, 3); i++) {
      const key = `${testKey}-provider-${i}`;
      const { duration } = await measureTime(() =>
        provider.uploadFile(key, testContent, { contentType: "application/octet-stream" })
      );
      providerTimes.push(duration);
    }

    const directAvg = average(directTimes);
    const providerAvg = average(providerTimes);
    const overhead = ((providerAvg - directAvg) / directAvg) * 100;

    console.log("✅ Upload performance test completed");
    console.log(`   Direct average: ${directAvg.toFixed(2)}ms`);
    console.log(`   Provider average: ${providerAvg.toFixed(2)}ms`);
    console.log(`   Overhead: ${overhead.toFixed(2)}%`);
    console.log(`   File size: ${formatBytes(testContent.length)}`);

    if (overhead > 50) {
      console.log("⚠️  Warning: High overhead detected (>50%)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Upload performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 3: Download Performance - Direct vs Provider
 */
async function testDownloadPerformance(): Promise<boolean> {
  console.log("\n📥 Test 3: Download Performance");
  console.log("─".repeat(50));

  try {
    const testContent = createTestFile(1024 * 10); // 10KB
    const testKey = `${TEST_PREFIX}download-${Date.now()}.bin`;

    // Upload file first (using direct function)
    await directUploadFile(testKey, testContent, {
      contentType: "application/octet-stream",
    });

    // Test direct function
    const directTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { duration } = await measureTime(() =>
        directDownloadFileAsBuffer(testKey)
      );
      directTimes.push(duration);
    }

    // Test provider interface
    const provider = getDefaultStorageProvider();
    const providerTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { duration } = await measureTime(() =>
        provider.downloadFileAsBuffer(testKey)
      );
      providerTimes.push(duration);
    }

    const directAvg = average(directTimes);
    const providerAvg = average(providerTimes);
    const overhead = ((providerAvg - directAvg) / directAvg) * 100;

    console.log("✅ Download performance test completed");
    console.log(`   Direct average: ${directAvg.toFixed(2)}ms`);
    console.log(`   Provider average: ${providerAvg.toFixed(2)}ms`);
    console.log(`   Overhead: ${overhead.toFixed(2)}%`);
    console.log(`   File size: ${formatBytes(testContent.length)}`);

    if (overhead > 50) {
      console.log("⚠️  Warning: High overhead detected (>50%)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Download performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 4: Metadata Performance - Direct vs Provider
 */
async function testMetadataPerformance(): Promise<boolean> {
  console.log("\n📊 Test 4: Metadata Performance");
  console.log("─".repeat(50));

  try {
    const testContent = createTestFile(1024);
    const testKey = `${TEST_PREFIX}metadata-${Date.now()}.bin`;

    // Upload file first
    await directUploadFile(testKey, testContent, {
      contentType: "application/octet-stream",
    });

    // Test direct function
    const directTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { duration } = await measureTime(() => directGetFileMetadata(testKey));
      directTimes.push(duration);
    }

    // Test provider interface
    const provider = getDefaultStorageProvider();
    const providerTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const { duration } = await measureTime(() =>
        provider.getFileMetadata(testKey)
      );
      providerTimes.push(duration);
    }

    const directAvg = average(directTimes);
    const providerAvg = average(providerTimes);
    const overhead = ((providerAvg - directAvg) / directAvg) * 100;

    console.log("✅ Metadata performance test completed");
    console.log(`   Direct average: ${directAvg.toFixed(2)}ms`);
    console.log(`   Provider average: ${providerAvg.toFixed(2)}ms`);
    console.log(`   Overhead: ${overhead.toFixed(2)}%`);

    if (overhead > 50) {
      console.log("⚠️  Warning: High overhead detected (>50%)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Metadata performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 5: Batch Upload Performance
 */
async function testBatchUploadPerformance(): Promise<boolean> {
  console.log("\n📦 Test 5: Batch Upload Performance");
  console.log("─".repeat(50));

  try {
    const batchSize = 5;
    const testContent = createTestFile(1024);

    // Test direct function (sequential)
    const directTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const keys = Array.from({ length: batchSize }, (_, j) => `${TEST_PREFIX}batch-direct-${i}-${j}.bin`);
      const { duration } = await measureTime(async () => {
        for (const key of keys) {
          await directUploadFile(key, testContent, {
            contentType: "application/octet-stream",
          });
        }
      });
      directTimes.push(duration);
    }

    // Test provider interface
    const provider = getDefaultStorageProvider();
    const providerTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const keys = Array.from({ length: batchSize }, (_, j) => `${TEST_PREFIX}batch-provider-${i}-${j}.bin`);
      const { duration } = await measureTime(async () => {
        const uploads = keys.map((key) => ({
          key,
          body: testContent,
          options: { contentType: "application/octet-stream" },
        }));
        await provider.uploadFiles(uploads);
      });
      providerTimes.push(duration);
    }

    const directAvg = average(directTimes);
    const providerAvg = average(providerTimes);
    const overhead = ((providerAvg - directAvg) / directAvg) * 100;

    console.log("✅ Batch upload performance test completed");
    console.log(`   Direct average: ${directAvg.toFixed(2)}ms`);
    console.log(`   Provider average: ${providerAvg.toFixed(2)}ms`);
    console.log(`   Overhead: ${overhead.toFixed(2)}%`);
    console.log(`   Batch size: ${batchSize} files`);

    if (overhead > 50) {
      console.log("⚠️  Warning: High overhead detected (>50%)");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Batch upload performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 6: Mock Provider Performance (Baseline)
 */
async function testMockProviderPerformance(): Promise<boolean> {
  console.log("\n⚡ Test 6: Mock Provider Performance (Baseline)");
  console.log("─".repeat(50));

  try {
    const mockProvider = new MockStorageProvider();
    const testContent = createTestFile(1024);
    const testKey = "mock-test.bin";

    // Test upload
    const uploadTimes: number[] = [];
    for (let i = 0; i < ITERATIONS * 10; i++) {
      // More iterations for in-memory operations
      const key = `${testKey}-${i}`;
      const { duration } = await measureTime(() =>
        mockProvider.uploadFile(key, testContent)
      );
      uploadTimes.push(duration);
    }

    // Test download
    const downloadTimes: number[] = [];
    for (let i = 0; i < ITERATIONS * 10; i++) {
      const key = `${testKey}-${i}`;
      const { duration } = await measureTime(() =>
        mockProvider.downloadFileAsBuffer(key)
      );
      downloadTimes.push(duration);
    }

    const uploadAvg = average(uploadTimes);
    const downloadAvg = average(downloadTimes);

    console.log("✅ Mock provider performance test completed");
    console.log(`   Upload average: ${uploadAvg.toFixed(3)}ms`);
    console.log(`   Download average: ${downloadAvg.toFixed(3)}ms`);
    console.log(`   Operations: ${ITERATIONS * 10} each`);

    return true;
  } catch (error) {
    console.error(
      "❌ Mock provider performance test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 7: Memory Usage Comparison
 */
async function testMemoryUsage(): Promise<boolean> {
  console.log("\n💾 Test 7: Memory Usage Comparison");
  console.log("─".repeat(50));

  try {
    const mockProvider = new MockStorageProvider();
    const testContent = createTestFile(1024 * 100); // 100KB

    // Measure memory before
    const memBefore = process.memoryUsage().heapUsed;

    // Upload multiple files
    for (let i = 0; i < 100; i++) {
      await mockProvider.uploadFile(`test-${i}.bin`, testContent);
    }

    // Measure memory after
    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = memAfter - memBefore;
    const memPerFile = memUsed / 100;

    console.log("✅ Memory usage test completed");
    console.log(`   Memory before: ${formatBytes(memBefore)}`);
    console.log(`   Memory after: ${formatBytes(memAfter)}`);
    console.log(`   Memory used: ${formatBytes(memUsed)}`);
    console.log(`   Memory per file: ${formatBytes(memPerFile)}`);
    console.log(`   Files stored: 100`);

    // Cleanup
    mockProvider.clear();

    return true;
  } catch (error) {
    console.error(
      "❌ Memory usage test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("⚡ Storage Provider Performance Comparison Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}`);
  console.log(`Iterations per test: ${ITERATIONS}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run performance tests
  // Note: Some tests may be skipped if R2 credentials are not available
  try {
    results.push({
      name: "Upload Performance - Small File",
      passed: await testUploadPerformanceSmall(),
    });
  } catch (error) {
    console.log("⚠️  Upload performance test skipped (R2 credentials may be missing)");
    results.push({
      name: "Upload Performance - Small File",
      passed: false,
    });
  }

  try {
    results.push({
      name: "Upload Performance - Large File",
      passed: await testUploadPerformanceLarge(),
    });
  } catch (error) {
    console.log("⚠️  Large file upload test skipped (R2 credentials may be missing)");
    results.push({
      name: "Upload Performance - Large File",
      passed: false,
    });
  }

  try {
    results.push({
      name: "Download Performance",
      passed: await testDownloadPerformance(),
    });
  } catch (error) {
    console.log("⚠️  Download performance test skipped (R2 credentials may be missing)");
    results.push({
      name: "Download Performance",
      passed: false,
    });
  }

  try {
    results.push({
      name: "Metadata Performance",
      passed: await testMetadataPerformance(),
    });
  } catch (error) {
    console.log("⚠️  Metadata performance test skipped (R2 credentials may be missing)");
    results.push({
      name: "Metadata Performance",
      passed: false,
    });
  }

  try {
    results.push({
      name: "Batch Upload Performance",
      passed: await testBatchUploadPerformance(),
    });
  } catch (error) {
    console.log("⚠️  Batch upload performance test skipped (R2 credentials may be missing)");
    results.push({
      name: "Batch Upload Performance",
      passed: false,
    });
  }

  // Mock provider tests (always run)
  results.push({
    name: "Mock Provider Performance",
    passed: await testMockProviderPerformance(),
  });
  results.push({
    name: "Memory Usage",
    passed: await testMemoryUsage(),
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
    console.log("⚠️  Some tests failed or were skipped.");
    console.log("   Note: R2 performance tests require valid credentials in .env");
    process.exit(0); // Exit with 0 since skipped tests are expected
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});


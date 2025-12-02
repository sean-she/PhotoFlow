#!/usr/bin/env tsx
/**
 * Test script for Storage Provider Migration Utilities
 * 
 * Tests migrating files between different storage providers,
 * verifying file integrity, and comparing providers.
 * 
 * Usage:
 *   tsx scripts/test-provider-migration.ts
 * 
 * Note: This test uses mock providers and does not require R2 credentials.
 */

import "dotenv/config";
import {
  migrateBetweenProviders,
  compareProviders,
  type ProviderMigrationOptions,
  type ProviderMigrationResult,
} from "../src/lib/storage/provider-migration";
import { MockStorageProvider } from "../src/lib/storage/providers/mock-provider";
import type { StorageUploadResult } from "../src/lib/storage/provider";
import * as crypto from "crypto";

// Test configuration
const TEST_PREFIX = "test-migration/";
const TEST_FILES = [
  `${TEST_PREFIX}file1.txt`,
  `${TEST_PREFIX}file2.txt`,
  `${TEST_PREFIX}subdir/file3.txt`,
  `${TEST_PREFIX}subdir/file4.txt`,
];

/**
 * Create a test file buffer
 */
function createTestFile(key: string): Buffer {
  const content = `Test file: ${key}\nCreated at: ${new Date().toISOString()}\nRandom data: ${crypto.randomBytes(16).toString("hex")}`;
  return Buffer.from(content, "utf-8");
}

/**
 * Test 1: Basic Migration - Mock to Mock
 */
async function testBasicMigration(): Promise<boolean> {
  console.log("\n📋 Test 1: Basic Migration - Mock to Mock");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload test files to source
    for (const key of TEST_FILES) {
      const content = createTestFile(key);
      await sourceProvider.uploadFile(key, content, {
        contentType: "text/plain",
        metadata: { source: "test" },
      });
    }

    // Migrate files
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: destProvider,
      prefix: TEST_PREFIX,
      verifyAfterMigration: true,
      deleteSource: false,
    });

    if (result.migrated !== TEST_FILES.length) {
      throw new Error(
        `Expected ${TEST_FILES.length} files migrated, got ${result.migrated}`
      );
    }
    if (result.failed !== 0) {
      throw new Error(`Expected 0 failed migrations, got ${result.failed}`);
    }
    if (result.totalBytes === 0) {
      throw new Error("Total bytes should be greater than 0");
    }

    // Verify files exist in destination
    for (const key of TEST_FILES) {
      const exists = await destProvider.fileExists(key);
      if (!exists) {
        throw new Error(`File ${key} not found in destination`);
      }
    }

    console.log("✅ Basic migration successful");
    console.log(`   Files migrated: ${result.migrated}`);
    console.log(`   Total bytes: ${result.totalBytes}`);
    console.log(`   Duration: ${result.duration}ms`);

    return true;
  } catch (error) {
    console.error(
      "❌ Basic migration failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 2: Migration with Verification
 */
async function testMigrationWithVerification(): Promise<boolean> {
  console.log("\n🔍 Test 2: Migration with Verification");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload test files with specific content
    const fileContents = new Map<string, Buffer>();
    for (const key of TEST_FILES) {
      const content = createTestFile(key);
      fileContents.set(key, content);
      await sourceProvider.uploadFile(key, content, {
        contentType: "text/plain",
        metadata: { test: "verification" },
      });
    }

    // Migrate with verification
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: destProvider,
      prefix: TEST_PREFIX,
      verifyAfterMigration: true,
      deleteSource: false,
    });

    // Verify content matches
    for (const key of TEST_FILES) {
      const originalContent = fileContents.get(key)!;
      const destContent = await destProvider.downloadFileAsBuffer(key);

      if (!destContent.buffer.equals(originalContent)) {
        throw new Error(`Content mismatch for ${key}`);
      }

      // Verify metadata
      const destMetadata = await destProvider.getFileMetadata(key);
      if (destMetadata.metadata?.test !== "verification") {
        throw new Error(`Metadata mismatch for ${key}`);
      }
    }

    console.log("✅ Migration with verification successful");
    console.log(`   Files verified: ${TEST_FILES.length}`);
    console.log(`   Content matches: ✅`);
    console.log(`   Metadata matches: ✅`);

    return true;
  } catch (error) {
    console.error(
      "❌ Migration with verification failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 3: Migration with Progress Callback
 */
async function testMigrationWithProgress(): Promise<boolean> {
  console.log("\n📊 Test 3: Migration with Progress Callback");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload test files
    for (const key of TEST_FILES) {
      await sourceProvider.uploadFile(key, createTestFile(key));
    }

    const progressUpdates: Array<{
      processed: number;
      total: number;
      current: string;
      status: string;
    }> = [];

    // Migrate with progress callback
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: destProvider,
      prefix: TEST_PREFIX,
      onProgress: (progress) => {
        progressUpdates.push(progress);
      },
    });

    if (progressUpdates.length === 0) {
      throw new Error("Progress callback was never called");
    }

    // Check final progress
    const finalProgress = progressUpdates[progressUpdates.length - 1];
    if (finalProgress.processed !== finalProgress.total) {
      throw new Error("Final progress should match total");
    }
    if (finalProgress.status !== "complete") {
      throw new Error("Final status should be 'complete'");
    }

    console.log("✅ Migration with progress callback successful");
    console.log(`   Progress updates received: ${progressUpdates.length}`);
    console.log(`   Final status: ${finalProgress.status}`);
    console.log(`   Final progress: ${finalProgress.processed}/${finalProgress.total}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Migration with progress failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 4: Migration with Delete Source
 */
async function testMigrationWithDeleteSource(): Promise<boolean> {
  console.log("\n🗑️  Test 4: Migration with Delete Source");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload test files
    for (const key of TEST_FILES) {
      await sourceProvider.uploadFile(key, createTestFile(key));
    }

    // Verify files exist in source
    for (const key of TEST_FILES) {
      const exists = await sourceProvider.fileExists(key);
      if (!exists) {
        throw new Error(`File ${key} should exist in source before migration`);
      }
    }

    // Migrate with delete source
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: destProvider,
      prefix: TEST_PREFIX,
      deleteSource: true,
    });

    // Verify files deleted from source
    for (const key of TEST_FILES) {
      const exists = await sourceProvider.fileExists(key);
      if (exists) {
        throw new Error(`File ${key} should be deleted from source`);
      }
    }

    // Verify files exist in destination
    for (const key of TEST_FILES) {
      const exists = await destProvider.fileExists(key);
      if (!exists) {
        throw new Error(`File ${key} should exist in destination`);
      }
    }

    console.log("✅ Migration with delete source successful");
    console.log(`   Files migrated: ${result.migrated}`);
    console.log(`   Source files deleted: ✅`);
    console.log(`   Destination files exist: ✅`);

    return true;
  } catch (error) {
    console.error(
      "❌ Migration with delete source failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 5: Migration with Max Files Limit
 */
async function testMigrationWithMaxFiles(): Promise<boolean> {
  console.log("\n🔢 Test 5: Migration with Max Files Limit");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload more files than the limit
    const allFiles = [
      ...TEST_FILES,
      `${TEST_PREFIX}file5.txt`,
      `${TEST_PREFIX}file6.txt`,
    ];

    for (const key of allFiles) {
      await sourceProvider.uploadFile(key, createTestFile(key));
    }

    // Migrate with max files limit
    const maxFiles = 3;
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: destProvider,
      prefix: TEST_PREFIX,
      maxFiles,
    });

    if (result.migrated > maxFiles) {
      throw new Error(
        `Expected at most ${maxFiles} files migrated, got ${result.migrated}`
      );
    }

    console.log("✅ Migration with max files limit successful");
    console.log(`   Max files: ${maxFiles}`);
    console.log(`   Files migrated: ${result.migrated}`);
    console.log(`   Total files available: ${allFiles.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Migration with max files failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 6: Migration Error Handling
 */
async function testMigrationErrorHandling(): Promise<boolean> {
  console.log("\n⚠️  Test 6: Migration Error Handling");
  console.log("─".repeat(50));

  try {
    const sourceProvider = new MockStorageProvider();
    const destProvider = new MockStorageProvider();

    // Upload test files
    for (const key of TEST_FILES) {
      await sourceProvider.uploadFile(key, createTestFile(key));
    }

    // Create a provider that will fail on upload (simulate error)
    class FailingProvider extends MockStorageProvider {
      async uploadFile(
        key: string,
        body: Buffer | Uint8Array | ReadableStream | Blob,
        options?: any
      ): Promise<StorageUploadResult> {
        throw new Error("Simulated upload failure");
      }
    }

    const failingProvider = new FailingProvider();

    // Attempt migration (should handle errors gracefully)
    const result = await migrateBetweenProviders({
      sourceProvider,
      destinationProvider: failingProvider,
      prefix: TEST_PREFIX,
    });

    // Should have failed files
    if (result.failed === 0) {
      throw new Error("Expected some failed migrations");
    }
    if (result.failedKeys.length === 0) {
      throw new Error("Expected failed keys to be recorded");
    }

    console.log("✅ Migration error handling works correctly");
    console.log(`   Successful: ${result.migrated}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Failed keys: ${result.failedKeys.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Migration error handling test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 7: Compare Providers - Matching Files
 */
async function testCompareProvidersMatching(): Promise<boolean> {
  console.log("\n🔍 Test 7: Compare Providers - Matching Files");
  console.log("─".repeat(50));

  try {
    const provider1 = new MockStorageProvider();
    const provider2 = new MockStorageProvider();

    // Upload same files to both providers
    for (const key of TEST_FILES) {
      const content = createTestFile(key);
      await provider1.uploadFile(key, content);
      await provider2.uploadFile(key, content);
    }

    const comparison = await compareProviders(
      provider1,
      provider2,
      TEST_PREFIX
    );

    if (comparison.matching.length !== TEST_FILES.length) {
      throw new Error(
        `Expected ${TEST_FILES.length} matching files, got ${comparison.matching.length}`
      );
    }
    if (comparison.missingInDestination.length !== 0) {
      throw new Error("Expected no missing files in destination");
    }
    if (comparison.missingInSource.length !== 0) {
      throw new Error("Expected no missing files in source");
    }
    if (comparison.sizeMismatches.length !== 0) {
      throw new Error("Expected no size mismatches");
    }

    console.log("✅ Provider comparison works correctly");
    console.log(`   Matching files: ${comparison.matching.length}`);
    console.log(`   Missing in destination: ${comparison.missingInDestination.length}`);
    console.log(`   Missing in source: ${comparison.missingInSource.length}`);
    console.log(`   Size mismatches: ${comparison.sizeMismatches.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Provider comparison test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 8: Compare Providers - Missing Files
 */
async function testCompareProvidersMissing(): Promise<boolean> {
  console.log("\n🔍 Test 8: Compare Providers - Missing Files");
  console.log("─".repeat(50));

  try {
    const provider1 = new MockStorageProvider();
    const provider2 = new MockStorageProvider();

    // Upload all files to provider1
    for (const key of TEST_FILES) {
      await provider1.uploadFile(key, createTestFile(key));
    }

    // Upload only first file to provider2 (missing files in destination)
    await provider2.uploadFile(TEST_FILES[0], createTestFile(TEST_FILES[0]));

    // Upload an extra file to provider2 that's not in provider1 (missing in source)
    const extraFile = `${TEST_PREFIX}extra-file.txt`;
    await provider2.uploadFile(extraFile, createTestFile(extraFile));

    const comparison = await compareProviders(
      provider1,
      provider2,
      TEST_PREFIX
    );

    // Should have missing files in destination (files in provider1 but not provider2)
    if (comparison.missingInDestination.length === 0) {
      throw new Error("Expected missing files in destination");
    }
    if (comparison.missingInDestination.length !== TEST_FILES.length - 1) {
      throw new Error(
        `Expected ${TEST_FILES.length - 1} missing files in destination, got ${comparison.missingInDestination.length}`
      );
    }

    // Should have missing files in source (files in provider2 but not provider1)
    if (comparison.missingInSource.length === 0) {
      throw new Error("Expected missing files in source");
    }
    if (comparison.missingInSource.length !== 1) {
      throw new Error(
        `Expected 1 missing file in source, got ${comparison.missingInSource.length}`
      );
    }
    if (comparison.missingInSource[0] !== extraFile) {
      throw new Error(
        `Expected missing file to be ${extraFile}, got ${comparison.missingInSource[0]}`
      );
    }

    // Should have 1 matching file (TEST_FILES[0])
    if (comparison.matching.length !== 1) {
      throw new Error(
        `Expected 1 matching file, got ${comparison.matching.length}`
      );
    }

    console.log("✅ Provider comparison with missing files works");
    console.log(`   Matching files: ${comparison.matching.length}`);
    console.log(`   Missing in destination: ${comparison.missingInDestination.length}`);
    console.log(`   Missing in source: ${comparison.missingInSource.length}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Provider comparison with missing files failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 9: Compare Providers - Size Mismatches
 */
async function testCompareProvidersSizeMismatch(): Promise<boolean> {
  console.log("\n📏 Test 9: Compare Providers - Size Mismatches");
  console.log("─".repeat(50));

  try {
    const provider1 = new MockStorageProvider();
    const provider2 = new MockStorageProvider();

    // Upload different sized files
    const key = TEST_FILES[0];
    await provider1.uploadFile(key, Buffer.from("Content 1"));
    await provider2.uploadFile(key, Buffer.from("Different content with more text"));

    const comparison = await compareProviders(provider1, provider2, TEST_PREFIX);

    if (comparison.sizeMismatches.length === 0) {
      throw new Error("Expected size mismatch to be detected");
    }
    if (comparison.sizeMismatches[0].key !== key) {
      throw new Error("Size mismatch key should match");
    }

    console.log("✅ Provider comparison detects size mismatches");
    console.log(`   Size mismatches: ${comparison.sizeMismatches.length}`);
    console.log(`   Mismatch key: ${comparison.sizeMismatches[0].key}`);

    return true;
  } catch (error) {
    console.error(
      "❌ Provider comparison size mismatch test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Storage Provider Migration Utilities Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({
    name: "Basic Migration",
    passed: await testBasicMigration(),
  });
  results.push({
    name: "Migration with Verification",
    passed: await testMigrationWithVerification(),
  });
  results.push({
    name: "Migration with Progress",
    passed: await testMigrationWithProgress(),
  });
  results.push({
    name: "Migration with Delete Source",
    passed: await testMigrationWithDeleteSource(),
  });
  results.push({
    name: "Migration with Max Files",
    passed: await testMigrationWithMaxFiles(),
  });
  results.push({
    name: "Migration Error Handling",
    passed: await testMigrationErrorHandling(),
  });
  results.push({
    name: "Compare Providers - Matching",
    passed: await testCompareProvidersMatching(),
  });
  results.push({
    name: "Compare Providers - Missing",
    passed: await testCompareProvidersMissing(),
  });
  results.push({
    name: "Compare Providers - Size Mismatch",
    passed: await testCompareProvidersSizeMismatch(),
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


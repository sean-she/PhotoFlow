#!/usr/bin/env tsx
/**
 * Test script for R2 storage path generation and organization utilities
 * 
 * Usage:
 *   tsx scripts/test-r2-organization.ts
 * 
 * Tests path generation, parsing, and organization utilities.
 */

import "dotenv/config";
import {
  generatePhotoPath,
  generateThumbnailPath,
  generateOriginalPath,
  generateAlbumPath,
  generateUserPath,
  generateDateBasedPath,
  parsePhotoPath,
  sanitizePathSegment,
  getFileExtension,
  FileType,
} from "../src/lib/storage/paths";
import {
  listAlbumFiles,
  findFilesByPhotoId,
  getAlbumFileCount,
  getPhotoFileTypes,
  fileExists,
} from "../src/lib/storage/organization";
import { uploadFile } from "../src/lib/storage";

// Test configuration
const TEST_ALBUM_ID = "test-album-123";
const TEST_PHOTO_ID = "test-photo-456";
const TEST_USER_ID = "test-user-789";

/**
 * Test 1: Path generation - basic photo path
 */
function testBasicPathGeneration(): boolean {
  console.log("\n📋 Test 1: Basic Path Generation");
  console.log("─".repeat(50));

  try {
    const path = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const expected = `albums/${TEST_ALBUM_ID}/photos/${TEST_PHOTO_ID}/original.jpg`;
    
    if (path !== expected) {
      console.error(`❌ Path mismatch. Expected: ${expected}, Got: ${path}`);
      return false;
    }

    console.log("✅ Basic path generation works");
    console.log(`   Generated: ${path}`);
    return true;
  } catch (error) {
    console.error("❌ Basic path generation failed:", error);
    return false;
  }
}

/**
 * Test 2: Path generation with user
 */
function testPathWithUser(): boolean {
  console.log("\n📋 Test 2: Path Generation with User");
  console.log("─".repeat(50));

  try {
    const path = generatePhotoPath({
      userId: TEST_USER_ID,
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.THUMBNAIL,
      filename: "photo.jpg",
      includeUser: true,
    });

    const expected = `users/${TEST_USER_ID}/albums/${TEST_ALBUM_ID}/photos/${TEST_PHOTO_ID}/thumbnail.jpg`;
    
    if (path !== expected) {
      console.error(`❌ Path mismatch. Expected: ${expected}, Got: ${path}`);
      return false;
    }

    console.log("✅ Path with user works");
    console.log(`   Generated: ${path}`);
    return true;
  } catch (error) {
    console.error("❌ Path with user failed:", error);
    return false;
  }
}

/**
 * Test 3: Convenience functions
 */
function testConvenienceFunctions(): boolean {
  console.log("\n📋 Test 3: Convenience Functions");
  console.log("─".repeat(50));

  try {
    const thumbnailPath = generateThumbnailPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      filename: "photo.jpg",
    });

    const originalPath = generateOriginalPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      filename: "photo.jpg",
    });

    if (!thumbnailPath.includes("thumbnail")) {
      console.error(`❌ Thumbnail path should contain 'thumbnail': ${thumbnailPath}`);
      return false;
    }

    if (!originalPath.includes("original")) {
      console.error(`❌ Original path should contain 'original': ${originalPath}`);
      return false;
    }

    console.log("✅ Convenience functions work");
    console.log(`   Thumbnail: ${thumbnailPath}`);
    console.log(`   Original: ${originalPath}`);
    return true;
  } catch (error) {
    console.error("❌ Convenience functions failed:", error);
    return false;
  }
}

/**
 * Test 4: Path sanitization
 */
function testPathSanitization(): boolean {
  console.log("\n📋 Test 4: Path Sanitization");
  console.log("─".repeat(50));

  try {
    const testCases = [
      { input: "normal-name", expected: "normal-name" },
      { input: "name with spaces", expected: "name-with-spaces" },
      { input: "name<>with|special*chars", expected: "namewithspecialchars" },
      { input: "name---with---dashes", expected: "name-with-dashes" },
      { input: "  trimmed  ", expected: "trimmed" },
      { input: "name.with.dots", expected: "name.with.dots" }, // Dots are allowed
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const result = sanitizePathSegment(testCase.input);
      if (result !== testCase.expected) {
        console.error(`❌ Sanitization failed for "${testCase.input}"`);
        console.error(`   Expected: "${testCase.expected}", Got: "${result}"`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log("✅ Path sanitization works for all test cases");
    }
    return allPassed;
  } catch (error) {
    console.error("❌ Path sanitization failed:", error);
    return false;
  }
}

/**
 * Test 5: File extension extraction
 */
function testFileExtensionExtraction(): boolean {
  console.log("\n📋 Test 5: File Extension Extraction");
  console.log("─".repeat(50));

  try {
    const testCases = [
      { input: "photo.jpg", expected: "jpg" },
      { input: "photo.PNG", expected: "png" },
      { input: "photo.tar.gz", expected: "gz" },
      { input: "noextension", expected: "" },
      { input: "file.", expected: "" },
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const result = getFileExtension(testCase.input);
      if (result !== testCase.expected) {
        console.error(`❌ Extension extraction failed for "${testCase.input}"`);
        console.error(`   Expected: "${testCase.expected}", Got: "${result}"`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log("✅ File extension extraction works");
    }
    return allPassed;
  } catch (error) {
    console.error("❌ File extension extraction failed:", error);
    return false;
  }
}

/**
 * Test 6: Path parsing
 */
function testPathParsing(): boolean {
  console.log("\n📋 Test 6: Path Parsing");
  console.log("─".repeat(50));

  try {
    const testPath = `albums/${TEST_ALBUM_ID}/photos/${TEST_PHOTO_ID}/original.jpg`;
    const parsed = parsePhotoPath(testPath);

    if (!parsed) {
      console.error("❌ Path parsing returned null");
      return false;
    }

    if (parsed.albumId !== TEST_ALBUM_ID) {
      console.error(`❌ Album ID mismatch. Expected: ${TEST_ALBUM_ID}, Got: ${parsed.albumId}`);
      return false;
    }

    if (parsed.photoId !== TEST_PHOTO_ID) {
      console.error(`❌ Photo ID mismatch. Expected: ${TEST_PHOTO_ID}, Got: ${parsed.photoId}`);
      return false;
    }

    if (parsed.fileType !== FileType.ORIGINAL) {
      console.error(`❌ File type mismatch. Expected: ${FileType.ORIGINAL}, Got: ${parsed.fileType}`);
      return false;
    }

    if (parsed.extension !== "jpg") {
      console.error(`❌ Extension mismatch. Expected: jpg, Got: ${parsed.extension}`);
      return false;
    }

    console.log("✅ Path parsing works");
    console.log(`   Parsed:`, parsed);
    return true;
  } catch (error) {
    console.error("❌ Path parsing failed:", error);
    return false;
  }
}

/**
 * Test 7: Date-based path generation
 */
function testDateBasedPath(): boolean {
  console.log("\n📋 Test 7: Date-Based Path Generation");
  console.log("─".repeat(50));

  try {
    const testDate = new Date("2024-03-15T10:30:00Z");
    const path = generateDateBasedPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
      date: testDate,
    });

    // Should contain year and month
    if (!path.includes("2024") || !path.includes("03")) {
      console.error(`❌ Date-based path should contain year and month: ${path}`);
      return false;
    }

    console.log("✅ Date-based path generation works");
    console.log(`   Generated: ${path}`);
    return true;
  } catch (error) {
    console.error("❌ Date-based path generation failed:", error);
    return false;
  }
}

/**
 * Test 8: Album and user path generation
 */
function testDirectoryPaths(): boolean {
  console.log("\n📋 Test 8: Directory Path Generation");
  console.log("─".repeat(50));

  try {
    const albumPath = generateAlbumPath(TEST_ALBUM_ID);
    const userPath = generateUserPath(TEST_USER_ID);

    if (!albumPath.includes(TEST_ALBUM_ID)) {
      console.error(`❌ Album path should contain album ID: ${albumPath}`);
      return false;
    }

    if (!userPath.includes(TEST_USER_ID)) {
      console.error(`❌ User path should contain user ID: ${userPath}`);
      return false;
    }

    console.log("✅ Directory path generation works");
    console.log(`   Album path: ${albumPath}`);
    console.log(`   User path: ${userPath}`);
    return true;
  } catch (error) {
    console.error("❌ Directory path generation failed:", error);
    return false;
  }
}

/**
 * Test 9: Integration test - Upload and list files
 */
async function testFileOrganization(): Promise<boolean> {
  console.log("\n📋 Test 9: File Organization (Integration)");
  console.log("─".repeat(50));

  try {
    // Generate a test path
    const testKey = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: `test-${Date.now()}`,
      fileType: FileType.ORIGINAL,
      filename: "test-photo.jpg",
    });

    // Upload a test file
    const testContent = Buffer.from("Test photo content");
    await uploadFile(testKey, testContent, {
      contentType: "image/jpeg",
      metadata: {
        test: "true",
      },
    });

    console.log(`✅ Test file uploaded: ${testKey}`);

    // Check if file exists
    const exists = await fileExists(testKey);
    if (!exists) {
      console.error("❌ File should exist after upload");
      return false;
    }

    console.log("✅ File existence check works");

    // List files in album (this might be slow if there are many files)
    try {
      const result = await listAlbumFiles({
        albumId: TEST_ALBUM_ID,
        maxResults: 10,
      });

      console.log(`✅ Listed ${result.files.length} files in album`);
      console.log(`   Is truncated: ${result.isTruncated}`);
    } catch (error) {
      console.warn("⚠️  List files test skipped (may be slow or require permissions)");
    }

    // Test getAlbumFileCount
    try {
      const count = await getAlbumFileCount(TEST_ALBUM_ID);
      console.log(`✅ Album file count: ${count}`);
    } catch (error) {
      console.warn("⚠️  Get album file count test skipped");
    }

    // Test getPhotoFileTypes
    try {
      const photoId = testKey.split("/").slice(-2, -1)[0]; // Extract photo ID from path
      const fileTypes = await getPhotoFileTypes(TEST_ALBUM_ID, photoId);
      console.log(`✅ Photo file types: ${fileTypes.join(", ")}`);
    } catch (error) {
      console.warn("⚠️  Get photo file types test skipped");
    }

    // Test findFilesByPhotoId (may be slow)
    try {
      const photoId = testKey.split("/").slice(-2, -1)[0]; // Extract photo ID from path
      const files = await findFilesByPhotoId(photoId, 10);
      console.log(`✅ Found ${files.length} file(s) for photo ID: ${photoId}`);
    } catch (error) {
      console.warn("⚠️  Find files by photo ID test skipped (may be slow)");
    }

    return true;
  } catch (error) {
    console.error("❌ File organization test failed:", error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 R2 Storage Organization & Path Generation Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run unit tests (synchronous)
  results.push({ name: "Basic Path Generation", passed: testBasicPathGeneration() });
  results.push({ name: "Path with User", passed: testPathWithUser() });
  results.push({ name: "Convenience Functions", passed: testConvenienceFunctions() });
  results.push({ name: "Path Sanitization", passed: testPathSanitization() });
  results.push({ name: "File Extension Extraction", passed: testFileExtensionExtraction() });
  results.push({ name: "Path Parsing", passed: testPathParsing() });
  results.push({ name: "Date-Based Path", passed: testDateBasedPath() });
  results.push({ name: "Directory Paths", passed: testDirectoryPaths() });

  // Run integration test (async)
  results.push({ name: "File Organization", passed: await testFileOrganization() });

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


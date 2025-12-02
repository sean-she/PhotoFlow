#!/usr/bin/env tsx
/**
 * Test script for CDN URL generation
 * 
 * Tests the CDN URL generation utilities including:
 * - Public URL generation
 * - Signed URL generation
 * - Image transformation parameters
 * - Bulk URL generation
 * - URL caching
 * 
 * Usage:
 *   tsx scripts/test-r2-cdn.ts
 * 
 * Make sure your .env file has R2 credentials configured.
 */

import "dotenv/config";
import {
  generateCdnUrl,
  generateBulkCdnUrls,
  generateThumbnailUrl,
  generatePreviewUrl,
  clearUrlCache,
  cleanupUrlCache,
  generatePhotoPath,
  FileType,
} from "../src/lib/storage";

// Test configuration
const TEST_ALBUM_ID = "test-album-123";
const TEST_PHOTO_ID = "test-photo-456";

/**
 * Test 1: Configuration check
 */
async function testConfiguration(): Promise<boolean> {
  console.log("\n📋 Test 1: Configuration Check");
  console.log("─".repeat(50));

  try {
    const { getR2Config } = await import("../src/lib/storage");
    const config = getR2Config();
    console.log("✅ R2 Configuration loaded:");
    console.log(`   Account ID: ${config.accountId.substring(0, 8)}...`);
    console.log(`   Bucket: ${config.bucketName}`);
    console.log(`   Public URL: ${config.publicUrl || "Not configured (will use R2 default)"}`);
    return true;
  } catch (error) {
    console.error("❌ Configuration failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: Public URL generation
 */
async function testPublicUrlGeneration(): Promise<boolean> {
  console.log("\n📋 Test 2: Public URL Generation");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const publicUrl = await generateCdnUrl({
      key: testPath,
      signed: false,
    });

    if (!publicUrl || !publicUrl.startsWith("http")) {
      console.error(`❌ Invalid URL generated: ${publicUrl}`);
      return false;
    }

    console.log("✅ Public URL generation works");
    console.log(`   Key: ${testPath}`);
    console.log(`   URL: ${publicUrl.substring(0, 80)}...`);
    return true;
  } catch (error) {
    console.error("❌ Public URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 3: Signed URL generation
 */
async function testSignedUrlGeneration(): Promise<boolean> {
  console.log("\n📋 Test 3: Signed URL Generation");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const signedUrl = await generateCdnUrl({
      key: testPath,
      signed: true,
      expiresIn: 3600, // 1 hour
    });

    if (!signedUrl || !signedUrl.startsWith("http")) {
      console.error(`❌ Invalid signed URL generated: ${signedUrl}`);
      return false;
    }

    // Signed URLs should contain query parameters (signature, expiration)
    if (!signedUrl.includes("?") && !signedUrl.includes("&")) {
      console.warn("⚠️  Signed URL may be missing signature parameters");
    }

    console.log("✅ Signed URL generation works");
    console.log(`   URL: ${signedUrl.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error("❌ Signed URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: URL with image transformations
 */
async function testImageTransformations(): Promise<boolean> {
  console.log("\n📋 Test 4: URL with Image Transformations");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const transformedUrl = await generateCdnUrl({
      key: testPath,
      signed: false,
      transform: {
        width: 300,
        height: 300,
        fit: "fit",
        format: "webp",
        quality: 85,
        sharpen: true,
      },
    });

    if (!transformedUrl || !transformedUrl.startsWith("http")) {
      console.error(`❌ Invalid transformed URL generated: ${transformedUrl}`);
      return false;
    }

    // Should contain transformation parameters
    if (!transformedUrl.includes("w=") && !transformedUrl.includes("width=")) {
      console.warn("⚠️  Transformed URL may be missing transformation parameters");
    }

    console.log("✅ Image transformation URL generation works");
    console.log(`   URL: ${transformedUrl}`);
    return true;
  } catch (error) {
    console.error("❌ Image transformation URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: Thumbnail URL convenience function
 */
async function testThumbnailUrlGeneration(): Promise<boolean> {
  console.log("\n📋 Test 5: Thumbnail URL Generation");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const thumbnailUrl = await generateThumbnailUrl(testPath, 300, false);

    if (!thumbnailUrl || !thumbnailUrl.startsWith("http")) {
      console.error(`❌ Invalid thumbnail URL generated: ${thumbnailUrl}`);
      return false;
    }

    console.log("✅ Thumbnail URL generation works");
    console.log(`   URL: ${thumbnailUrl.substring(0, 80)}...`);
    return true;
  } catch (error) {
    console.error("❌ Thumbnail URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: Preview URL convenience function
 */
async function testPreviewUrlGeneration(): Promise<boolean> {
  console.log("\n📋 Test 6: Preview URL Generation");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const previewUrl = await generatePreviewUrl(testPath, 1200, false);

    if (!previewUrl || !previewUrl.startsWith("http")) {
      console.error(`❌ Invalid preview URL generated: ${previewUrl}`);
      return false;
    }

    console.log("✅ Preview URL generation works");
    console.log(`   URL: ${previewUrl.substring(0, 80)}...`);
    return true;
  } catch (error) {
    console.error("❌ Preview URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 7: URL caching
 */
async function testUrlCaching(): Promise<boolean> {
  console.log("\n📋 Test 7: URL Caching");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    clearUrlCache();

    const start1 = Date.now();
    const cachedUrl1 = await generateCdnUrl({ key: testPath });
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const cachedUrl2 = await generateCdnUrl({ key: testPath });
    const time2 = Date.now() - start2;

    if (cachedUrl1 !== cachedUrl2) {
      console.error("❌ Cached URLs should match");
      return false;
    }

    const speedup = time1 > 0 ? Math.round((time1 / time2) * 100) / 100 : 0;
    console.log("✅ URL caching works");
    console.log(`   First generation: ${time1}ms`);
    console.log(`   Cached generation: ${time2}ms${speedup > 0 ? ` (${speedup}x faster)` : ""}`);
    console.log(`   URLs match: ✅`);
    return true;
  } catch (error) {
    console.error("❌ URL caching test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 8: Bulk URL generation
 */
async function testBulkUrlGeneration(): Promise<boolean> {
  console.log("\n📋 Test 8: Bulk URL Generation");
  console.log("─".repeat(50));

  try {
    const testPaths = [
      generatePhotoPath({
        albumId: "album-1",
        photoId: "photo-1",
        fileType: FileType.ORIGINAL,
        filename: "photo1.jpg",
      }),
      generatePhotoPath({
        albumId: "album-1",
        photoId: "photo-2",
        fileType: FileType.ORIGINAL,
        filename: "photo2.jpg",
      }),
      generatePhotoPath({
        albumId: "album-2",
        photoId: "photo-3",
        fileType: FileType.THUMBNAIL,
        filename: "photo3.jpg",
      }),
    ];

    const bulkUrls = await generateBulkCdnUrls({
      keys: testPaths,
      baseOptions: {
        transform: {
          width: 500,
          format: "webp",
          quality: 90,
        },
      },
      parallel: true,
    });

    if (bulkUrls.size !== testPaths.length) {
      console.error(`❌ Expected ${testPaths.length} URLs, got ${bulkUrls.size}`);
      return false;
    }

    console.log(`✅ Bulk URL generation works`);
    console.log(`   Generated ${bulkUrls.size} URLs`);
    bulkUrls.forEach((url, key) => {
      console.log(`   ${key.split("/").pop()}: ${url.substring(0, 60)}...`);
    });
    return true;
  } catch (error) {
    console.error("❌ Bulk URL generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 9: Custom query parameters
 */
async function testCustomQueryParameters(): Promise<boolean> {
  console.log("\n📋 Test 9: Custom Query Parameters");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const urlWithParams = await generateCdnUrl({
      key: testPath,
      queryParams: {
        version: "v2",
        cache: "true",
        timestamp: Date.now(),
      },
    });

    if (!urlWithParams || !urlWithParams.startsWith("http")) {
      console.error(`❌ Invalid URL with params generated: ${urlWithParams}`);
      return false;
    }

    // Should contain query parameters
    if (!urlWithParams.includes("?")) {
      console.warn("⚠️  URL may be missing query parameters");
    }

    console.log("✅ Custom query parameters work");
    console.log(`   URL: ${urlWithParams.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error("❌ Custom query parameters test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 10: Signed URL with transformations
 */
async function testSignedUrlWithTransformations(): Promise<boolean> {
  console.log("\n📋 Test 10: Signed URL with Transformations");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const signedTransformedUrl = await generateCdnUrl({
      key: testPath,
      signed: true,
      expiresIn: 7200, // 2 hours
      transform: {
        width: 800,
        height: 600,
        fit: "fill",
        format: "jpeg",
        quality: 95,
      },
    });

    if (!signedTransformedUrl || !signedTransformedUrl.startsWith("http")) {
      console.error(`❌ Invalid signed transformed URL generated: ${signedTransformedUrl}`);
      return false;
    }

    console.log("✅ Signed URL with transformations works");
    console.log(`   URL: ${signedTransformedUrl.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error("❌ Signed URL with transformations failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 11: Various transformation options
 */
async function testVariousTransformations(): Promise<boolean> {
  console.log("\n📋 Test 11: Various Transformation Options");
  console.log("─".repeat(50));

  try {
    const testPath = generatePhotoPath({
      albumId: TEST_ALBUM_ID,
      photoId: TEST_PHOTO_ID,
      fileType: FileType.ORIGINAL,
      filename: "photo.jpg",
    });

    const transforms = [
      { width: 100, height: 100, fit: "fill" as const },
      { width: 200, format: "png" as const },
      { blur: 10, quality: 50 },
      { rotate: 90 as const, sharpen: true },
    ];

    let allPassed = true;
    for (const transform of transforms) {
      try {
        const url = await generateCdnUrl({
          key: testPath,
          transform,
        });

        if (!url || !url.startsWith("http")) {
          console.error(`❌ Failed to generate URL for transform: ${JSON.stringify(transform)}`);
          allPassed = false;
        }
      } catch (error) {
        console.error(`❌ Error generating URL for transform ${JSON.stringify(transform)}:`, error);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log("✅ All transformation options work");
      transforms.forEach((transform) => {
        console.log(`   ${JSON.stringify(transform)}: ✅`);
      });
    }

    return allPassed;
  } catch (error) {
    console.error("❌ Various transformations test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 R2 CDN URL Generation Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({ name: "Configuration Check", passed: await testConfiguration() });
  results.push({ name: "Public URL Generation", passed: await testPublicUrlGeneration() });
  results.push({ name: "Signed URL Generation", passed: await testSignedUrlGeneration() });
  results.push({ name: "Image Transformations", passed: await testImageTransformations() });
  results.push({ name: "Thumbnail URL Generation", passed: await testThumbnailUrlGeneration() });
  results.push({ name: "Preview URL Generation", passed: await testPreviewUrlGeneration() });
  results.push({ name: "URL Caching", passed: await testUrlCaching() });
  results.push({ name: "Bulk URL Generation", passed: await testBulkUrlGeneration() });
  results.push({ name: "Custom Query Parameters", passed: await testCustomQueryParameters() });
  results.push({ name: "Signed URL with Transformations", passed: await testSignedUrlWithTransformations() });
  results.push({ name: "Various Transformations", passed: await testVariousTransformations() });

  // Cleanup
  console.log("\n🧹 Cleanup");
  console.log("─".repeat(50));
  cleanupUrlCache();
  clearUrlCache();
  console.log("✅ Cache cleared");

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

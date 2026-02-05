#!/usr/bin/env tsx
/**
 * Test script for upload confirmation endpoint
 *
 * Tests the presigned upload + confirm-upload flow used by the Lightroom plugin.
 *
 * Usage:
 *   tsx scripts/test-confirm-upload.ts
 *
 * Requirements:
 * - A running Next.js server (default: http://localhost:3000)
 * - Working R2 credentials (the test uploads to R2 via the presigned PUT URL)
 *
 * Environment variables:
 * - BASE_URL (optional): defaults to http://localhost:3000
 * - API_TOKEN (optional): if provided, will be used instead of creating a temporary photographer token
 * - ALBUM_ID (optional): if provided, will be used instead of creating a temporary album
 * - TEST_FILENAME (optional): defaults to "test-confirm-upload.jpg"
 * - CONTENT_TYPE (optional): defaults to "image/jpeg"
 * - CLEANUP (optional): "true" to attempt deleting the uploaded object from R2 (best-effort)
 */

import "dotenv/config";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "../src/lib/storage/r2-config";
import prisma from "../src/lib/prisma";
import { createApiToken } from "../src/lib/auth/api-token";

// Test configuration
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_TOKEN = process.env.API_TOKEN ?? "";
const ALBUM_ID = process.env.ALBUM_ID ?? "";
const TEST_FILENAME = process.env.TEST_FILENAME ?? "test-confirm-upload.jpg";
const CONTENT_TYPE = process.env.CONTENT_TYPE ?? "image/jpeg";
const CLEANUP = (process.env.CLEANUP ?? "false").toLowerCase() === "true";

type JsonRecord = Record<string, unknown>;

type TestAuthContext = {
  apiToken: string;
  albumId: string;
  created: {
    userId?: string;
    photographerId?: string;
    albumId?: string;
  };
};

async function ensureTestAuthContext(): Promise<TestAuthContext> {
  // If the user provided both, trust them and don't create/cleanup DB records.
  if (API_TOKEN && ALBUM_ID) {
    return {
      apiToken: API_TOKEN,
      albumId: ALBUM_ID,
      created: {},
    };
  }

  const now = Date.now();

  // Create test user + photographer + album (mirrors scripts/test-presigned-url.ts patterns)
  const user = await prisma.user.create({
    data: {
      id: `test-user-confirm-${now}`,
      email: `test-confirm-${now}@example.com`,
      emailVerified: true,
      name: "Test Confirm Photographer",
    },
  });

  const photographer = await prisma.photographer.create({
    data: {
      userId: user.id,
      name: "Test Confirm Photographer",
    },
  });

  const album = await prisma.album.create({
    data: {
      title: "Test Album - Confirm Upload",
      description: "Test album for confirm-upload endpoint",
      photographerId: photographer.id,
      status: "DRAFT",
    },
  });

  const apiToken = API_TOKEN || (await createApiToken(photographer.id));
  const albumId = ALBUM_ID || album.id;

  return {
    apiToken,
    albumId,
    created: {
      userId: user.id,
      photographerId: photographer.id,
      albumId: album.id,
    },
  };
}

async function postJson(apiToken: string, path: string, body: JsonRecord): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });
}

async function readJsonSafe(res: Response): Promise<JsonRecord> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as JsonRecord;
  } catch {
    return { raw: text };
  }
}

/**
 * Test 1: Confirm-upload before uploading the object should fail
 */
async function test1ConfirmBeforeUploadFails(): Promise<boolean> {
  console.log("\n📋 Test 1: Confirm before upload fails");
  console.log("─".repeat(50));

  try {
    const ctx = await ensureTestAuthContext();

    const presignRes = await postJson(ctx.apiToken, "/api/photos/presigned-url", {
      albumId: ctx.albumId,
      filename: TEST_FILENAME,
      contentType: CONTENT_TYPE,
      fileSize: 12,
    });

    const presignJson = await readJsonSafe(presignRes);
    if (!presignRes.ok) {
      console.error("❌ Presign request failed:", presignRes.status, presignJson);
      return false;
    }

    const photoId = String(presignJson.photoId ?? "");
    const storageKey = String(presignJson.storageKey ?? "");
    if (!photoId || !storageKey) {
      console.error("❌ Presign response missing photoId/storageKey:", presignJson);
      return false;
    }

    const confirmRes = await postJson(ctx.apiToken, "/api/photos/confirm-upload", {
      photoId,
      albumId: ctx.albumId,
      metadata: { width: 100, height: 100, size: 12 },
      exif: { cameraMake: "TestCam", cameraModel: "Model X", iso: 100 },
    });

    const confirmJson = await readJsonSafe(confirmRes);
    if (confirmRes.ok) {
      console.error("❌ Expected confirm-upload to fail, but it succeeded:", confirmJson);
      return false;
    }

    console.log("✅ Confirm-upload correctly failed before the object was uploaded");
    console.log(`   - status: ${confirmRes.status}`);
    console.log(`   - photoId: ${photoId}`);
    console.log(`   - storageKey: ${storageKey}`);
    return true;
  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: End-to-end: presign -> PUT -> confirm-upload succeeds and returns expected fields
 */
async function test2EndToEndConfirmUpload(): Promise<boolean> {
  console.log("\n📋 Test 2: End-to-end confirm-upload");
  console.log("─".repeat(50));

  let uploadedStorageKey: string | null = null;

  try {
    const ctx = await ensureTestAuthContext();
    const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);

    const presignRes = await postJson(ctx.apiToken, "/api/photos/presigned-url", {
      albumId: ctx.albumId,
      filename: TEST_FILENAME,
      contentType: CONTENT_TYPE,
      fileSize: payload.length,
    });

    const presignJson = await readJsonSafe(presignRes);
    if (!presignRes.ok) {
      console.error("❌ Presign request failed:", presignRes.status, presignJson);
      return false;
    }

    const presignedUrl = String(presignJson.presignedUrl ?? "");
    const photoId = String(presignJson.photoId ?? "");
    const storageKey = String(presignJson.storageKey ?? "");
    uploadedStorageKey = storageKey || null;

    if (!presignedUrl || !photoId || !storageKey) {
      console.error("❌ Presign response missing required fields:", presignJson);
      return false;
    }

    // Upload via presigned PUT URL (direct-to-R2)
    const putRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "content-type": CONTENT_TYPE,
      },
      body: payload,
    });

    if (!putRes.ok) {
      const putText = await putRes.text().catch(() => "");
      console.error("❌ PUT to presigned URL failed:", putRes.status, putText.substring(0, 200));
      return false;
    }

    // Confirm upload
    const confirmRes = await postJson(ctx.apiToken, "/api/photos/confirm-upload", {
      photoId,
      albumId: ctx.albumId,
      metadata: { width: 4242, height: 3141, size: payload.length },
      exif: {
        cameraMake: "TestCam",
        cameraModel: "Model X",
        dateTimeOriginal: new Date().toISOString(),
        iso: 200,
        focalLength: 50,
        aperture: 1.8,
        shutterSpeed: "1/125",
      },
    });

    const confirmJson = await readJsonSafe(confirmRes);
    if (!confirmRes.ok) {
      console.error("❌ confirm-upload failed:", confirmRes.status, confirmJson);
      return false;
    }

    const ok = Boolean(confirmJson.success);
    const returnedStorageKey = String(confirmJson.storageKey ?? "");
    const cdnUrl = String(confirmJson.cdnUrl ?? "");
    const returnedPhotoId = String(confirmJson.photoId ?? "");

    if (!ok) {
      console.error("❌ Expected success=true:", confirmJson);
      return false;
    }
    if (returnedPhotoId !== photoId) {
      console.error(`❌ photoId mismatch. Expected ${photoId}, got ${returnedPhotoId}`);
      return false;
    }
    if (returnedStorageKey !== storageKey) {
      console.error(`❌ storageKey mismatch. Expected ${storageKey}, got ${returnedStorageKey}`);
      return false;
    }
    if (!cdnUrl || !cdnUrl.includes(encodeURIComponent(storageKey.split("/").pop() ?? ""))) {
      console.error("❌ Expected cdnUrl to be present and look like a URL to the object:", cdnUrl);
      return false;
    }

    const meta = (confirmJson.metadata ?? {}) as JsonRecord;
    if (meta.width !== 4242 || meta.height !== 3141 || meta.size !== payload.length) {
      console.error("❌ Metadata not echoed as expected:", meta);
      return false;
    }

    const exif = (confirmJson.exif ?? {}) as JsonRecord;
    if (exif.cameraMake !== "TestCam" || exif.cameraModel !== "Model X" || exif.iso !== 200) {
      console.error("❌ EXIF not echoed as expected:", exif);
      return false;
    }

    console.log("✅ End-to-end confirm-upload succeeded");
    console.log(`   - photoId: ${photoId}`);
    console.log(`   - storageKey: ${storageKey}`);
    console.log(`   - cdnUrl: ${cdnUrl.substring(0, 80)}...`);
    return true;
  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : error);
    return false;
  } finally {
    if (CLEANUP && uploadedStorageKey) {
      try {
        const client = getR2Client();
        const config = getR2Config();
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: uploadedStorageKey,
          })
        );
        console.log("🧹 Cleanup");
        console.log("─".repeat(50));
        console.log(`✅ Deleted uploaded object: ${uploadedStorageKey}`);
      } catch (error) {
        console.log("🧹 Cleanup");
        console.log("─".repeat(50));
        console.error(
          "⚠️  Cleanup failed (non-fatal):",
          error instanceof Error ? error.message : error
        );
      }
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Upload Confirmation Endpoint Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  let ctx: TestAuthContext | null = null;
  try {
    ctx = await ensureTestAuthContext();
  } catch (error) {
    console.error("💥 Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const results: Array<{ name: string; passed: boolean }> = [];

  results.push({
    name: "Test 1 Confirm before upload fails",
    passed: await test1ConfirmBeforeUploadFails(),
  });
  results.push({
    name: "Test 2 End-to-end confirm-upload",
    passed: await test2EndToEndConfirmUpload(),
  });

  // Best-effort DB cleanup (only if we created DB records)
  if (ctx?.created.albumId && ctx.created.photographerId && ctx.created.userId) {
    console.log("\n🧹 Cleanup");
    console.log("─".repeat(50));
    try {
      await prisma.photo.deleteMany({ where: { albumId: ctx.created.albumId } });
      await prisma.album.delete({ where: { id: ctx.created.albumId } });
      await prisma.photographer.delete({ where: { id: ctx.created.photographerId } });
      await prisma.user.delete({ where: { id: ctx.created.userId } });
      console.log("✅ Deleted test DB records (photos, album, photographer, user)");
    } catch (error) {
      console.error(
        "⚠️  DB cleanup failed (non-fatal):",
        error instanceof Error ? error.message : error
      );
    }
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


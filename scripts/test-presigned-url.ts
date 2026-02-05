#!/usr/bin/env tsx
/**
 * Test script for Presigned URL Generation API
 *
 * Tests POST /api/photos/presigned-url:
 * - Successful presigned URL generation with API token auth
 * - Missing auth rejection
 * - Album ownership rejection
 * - Basic validation failure cases
 *
 * Usage:
 *   npm run test:presigned-url
 *
 * Requirements:
 * - A running Next.js dev server (default: http://localhost:3000)
 * - R2 env vars present (R2_*), since the route signs an R2 PutObjectCommand
 *
 * Optional env vars:
 *   TEST_BASE_URL="http://localhost:3000"
 */

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { createApiToken } from "../src/lib/auth/api-token";

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${TEST_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  return { status: res.status, json };
}

/**
 * Test 1: Successful presigned URL generation
 */
async function test1SuccessPresignedUrl(): Promise<boolean> {
  console.log("\n📋 Test 1: Successful presigned URL generation");
  console.log("─".repeat(50));

  try {
    // Create test user + photographer + album
    const now = Date.now();
    const user = await prisma.user.create({
      data: {
        id: `test-user-presigned-${now}`,
        email: `test-presigned-${now}@example.com`,
        emailVerified: true,
        name: "Test Presigned Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Presigned Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album - Presigned URL",
        description: "Test album for presigned URL endpoint",
        photographerId: photographer.id,
        status: "DRAFT",
      },
    });

    const apiToken = await createApiToken(photographer.id);

    const { status, json } = await postJson(
      "/api/photos/presigned-url",
      {
        albumId: album.id,
        filename: "test-photo.jpg",
        contentType: "image/jpeg",
        fileSize: 1024,
      },
      {
        authorization: `Bearer ${apiToken}`,
      }
    );

    assert(status === 200, `Expected 200, got ${status}. Body: ${JSON.stringify(json)}`);
    assert(typeof json?.presignedUrl === "string", "Expected presignedUrl to be a string");
    assert(json.presignedUrl.startsWith("http"), "Expected presignedUrl to look like a URL");
    assert(typeof json?.photoId === "string", "Expected photoId to be a string");
    assert(typeof json?.storageKey === "string", "Expected storageKey to be a string");
    assert(typeof json?.expiresAt === "string", "Expected expiresAt to be a string");

    console.log("✅ Presigned URL endpoint returns expected response shape");

    // Cleanup: delete photo (created by endpoint), album, photographer, user
    await prisma.photo.deleteMany({ where: { albumId: album.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    return true;
  } catch (error) {
    console.error(
      "❌ Presigned URL success test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 2: Missing Authorization header is rejected
 */
async function test2MissingAuthRejected(): Promise<boolean> {
  console.log("\n📋 Test 2: Missing auth is rejected");
  console.log("─".repeat(50));

  try {
    const { status, json } = await postJson("/api/photos/presigned-url", {
      albumId: "ckxxxxxxxxxxxxxxxxxxxxxxxxxx", // intentionally bogus
      filename: "test-photo.jpg",
      contentType: "image/jpeg",
      fileSize: 1024,
    });

    assert(status === 401, `Expected 401, got ${status}. Body: ${JSON.stringify(json)}`);
    console.log("✅ Missing auth returns 401");
    return true;
  } catch (error) {
    console.error(
      "❌ Missing auth test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Test 3: Album ownership mismatch returns 403
 */
async function test3OwnershipRejected(): Promise<boolean> {
  console.log("\n📋 Test 3: Album ownership mismatch is rejected");
  console.log("─".repeat(50));

  let user1Id: string | null = null;
  let user2Id: string | null = null;
  let photographer1Id: string | null = null;
  let photographer2Id: string | null = null;
  let albumId: string | null = null;

  try {
    const now = Date.now();

    const user1 = await prisma.user.create({
      data: {
        id: `test-user-presigned-owner-1-${now}`,
        email: `test-presigned-owner-1-${now}@example.com`,
        emailVerified: true,
        name: "Owner 1",
      },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        id: `test-user-presigned-owner-2-${now}`,
        email: `test-presigned-owner-2-${now}@example.com`,
        emailVerified: true,
        name: "Owner 2",
      },
    });
    user2Id = user2.id;

    const photographer1 = await prisma.photographer.create({
      data: { userId: user1.id, name: "Owner 1" },
    });
    photographer1Id = photographer1.id;

    const photographer2 = await prisma.photographer.create({
      data: { userId: user2.id, name: "Owner 2" },
    });
    photographer2Id = photographer2.id;

    const album = await prisma.album.create({
      data: {
        title: "Ownership Album",
        photographerId: photographer1.id,
        status: "DRAFT",
      },
    });
    albumId = album.id;

    const apiTokenForWrongUser = await createApiToken(photographer2.id);

    const { status, json } = await postJson(
      "/api/photos/presigned-url",
      {
        albumId: album.id,
        filename: "test-photo.jpg",
        contentType: "image/jpeg",
        fileSize: 1024,
      },
      { authorization: `Bearer ${apiTokenForWrongUser}` }
    );

    assert(status === 403, `Expected 403, got ${status}. Body: ${JSON.stringify(json)}`);
    console.log("✅ Ownership mismatch returns 403");

    // Cleanup
    await prisma.photo.deleteMany({ where: { albumId: album.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.deleteMany({
      where: { id: { in: [photographer1.id, photographer2.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });

    return true;
  } catch (error) {
    console.error(
      "❌ Ownership mismatch test failed:",
      error instanceof Error ? error.message : error
    );

    // Best-effort cleanup
    try {
      if (albumId) await prisma.photo.deleteMany({ where: { albumId } });
      if (albumId) await prisma.album.delete({ where: { id: albumId } });
      if (photographer1Id || photographer2Id) {
        await prisma.photographer.deleteMany({
          where: { id: { in: [photographer1Id, photographer2Id].filter(Boolean) as string[] } },
        });
      }
      if (user1Id || user2Id) {
        await prisma.user.deleteMany({
          where: { id: { in: [user1Id, user2Id].filter(Boolean) as string[] } },
        });
      }
    } catch {
      // ignore
    }

    return false;
  }
}

/**
 * Test 4: Validation error for oversized file (expects 422)
 */
async function test4OversizeRejected(): Promise<boolean> {
  console.log("\n📋 Test 4: Oversized file is rejected");
  console.log("─".repeat(50));

  try {
    // Create minimal test data for auth + album
    const now = Date.now();
    const user = await prisma.user.create({
      data: {
        id: `test-user-presigned-oversize-${now}`,
        email: `test-presigned-oversize-${now}@example.com`,
        emailVerified: true,
        name: "Oversize Tester",
      },
    });

    const photographer = await prisma.photographer.create({
      data: { userId: user.id, name: "Oversize Tester" },
    });

    const album = await prisma.album.create({
      data: {
        title: "Oversize Album",
        photographerId: photographer.id,
        status: "DRAFT",
      },
    });

    const apiToken = await createApiToken(photographer.id);

    const { status, json } = await postJson(
      "/api/photos/presigned-url",
      {
        albumId: album.id,
        filename: "big-photo.jpg",
        contentType: "image/jpeg",
        fileSize: 101 * 1024 * 1024, // 101MB (limit is 100MB)
      },
      { authorization: `Bearer ${apiToken}` }
    );

    assert(status === 422, `Expected 422, got ${status}. Body: ${JSON.stringify(json)}`);
    console.log("✅ Oversized file returns 422");

    // Cleanup
    await prisma.photo.deleteMany({ where: { albumId: album.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    return true;
  } catch (error) {
    console.error(
      "❌ Oversize test failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Presigned URL API Tests");
  console.log("=".repeat(50));
  console.log(`Base URL: ${TEST_BASE_URL}`);
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  results.push({ name: "Test 1 Success presigned URL", passed: await test1SuccessPresignedUrl() });
  results.push({ name: "Test 2 Missing auth rejected", passed: await test2MissingAuthRejected() });
  results.push({ name: "Test 3 Ownership rejected", passed: await test3OwnershipRejected() });
  results.push({ name: "Test 4 Oversize rejected", passed: await test4OversizeRejected() });

  // Cleanup (no global cleanup needed; each test handles its own data)
  console.log("\n🧹 Cleanup");
  console.log("─".repeat(50));
  console.log("✅ Cleanup completed");

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


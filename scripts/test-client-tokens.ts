#!/usr/bin/env tsx
/**
 * Test script for client access token functionality
 * 
 * Tests client token generation, validation, regeneration, and revocation
 * 
 * Usage:
 *   tsx scripts/test-client-tokens.ts
 * 
 * Tests all client token utilities including security, uniqueness, validation, and expiration handling.
 */

import "dotenv/config";
import {
  generateClientToken,
  createClientToken,
  validateClientToken,
  regenerateClientToken,
  revokeClientToken,
} from "../src/lib/auth/client-token";
import prisma from "../src/lib/prisma";

// Test configuration
const TEST_CLIENT_NAME = "Test Client";
const TEST_CLIENT_EMAIL = "test-client@example.com";

/**
 * Test 1: Token Generation - Format and Uniqueness
 */
function testTokenGeneration(): boolean {
  console.log("\n📋 Test 1: Token Generation");
  console.log("─".repeat(50));

  try {
    // Generate multiple tokens
    const tokens = new Set<string>();
    const tokenCount = 100;

    for (let i = 0; i < tokenCount; i++) {
      const token = generateClientToken();
      tokens.add(token);
    }

    // Check format (should be 64 hex characters)
    const sampleToken = generateClientToken();
    if (sampleToken.length !== 64) {
      console.error(`❌ Token length incorrect. Expected: 64, Got: ${sampleToken.length}`);
      return false;
    }

    // Check hex format
    if (!/^[0-9a-f]{64}$/.test(sampleToken)) {
      console.error(`❌ Token format incorrect. Expected hex string, Got: ${sampleToken.substring(0, 20)}...`);
      return false;
    }

    // Check uniqueness
    if (tokens.size !== tokenCount) {
      console.error(`❌ Token uniqueness failed. Generated ${tokenCount} tokens, got ${tokens.size} unique tokens`);
      return false;
    }

    console.log(`✅ Token generation works correctly`);
    console.log(`   - Format: 64 hex characters`);
    console.log(`   - Uniqueness: ${tokenCount}/${tokenCount} tokens are unique`);
    console.log(`   - Sample token: ${sampleToken.substring(0, 16)}...${sampleToken.substring(48)}`);
    return true;
  } catch (error) {
    console.error("❌ Token generation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 2: Token Creation and Storage
 */
async function testTokenCreation(): Promise<boolean> {
  console.log("\n📋 Test 2: Token Creation and Storage");
  console.log("─".repeat(50));

  try {
    // Create a test photographer and album
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album for Token Creation",
        description: "Test album",
        photographerId: photographer.id,
        status: "OPEN",
      },
    });

    // Create an AlbumClient with a placeholder token
    const client = await prisma.albumClient.create({
      data: {
        clientName: TEST_CLIENT_NAME,
        clientEmail: TEST_CLIENT_EMAIL,
        accessToken: "placeholder-token",
        albumId: album.id,
      },
    });

    // Create a new token
    const token = await createClientToken(client.id);

    // Verify token format
    if (token.length !== 64 || !/^[0-9a-f]{64}$/.test(token)) {
      console.error(`❌ Created token format incorrect: ${token.substring(0, 20)}...`);
      return false;
    }

    // Verify token was stored in database
    const updatedClient = await prisma.albumClient.findUnique({
      where: { id: client.id },
    });

    if (!updatedClient || updatedClient.accessToken !== token) {
      console.error(`❌ Token was not stored correctly in database`);
      return false;
    }

    // Cleanup
    await prisma.albumClient.delete({ where: { id: client.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`✅ Token creation and storage works correctly`);
    console.log(`   - Token created: ${token.substring(0, 16)}...${token.substring(48)}`);
    return true;
  } catch (error) {
    console.error("❌ Token creation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 3: Token Validation - Valid Token
 */
async function testTokenValidationValid(): Promise<boolean> {
  console.log("\n📋 Test 3: Token Validation - Valid Token");
  console.log("─".repeat(50));

  try {
    // Create test data
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album for Validation",
        description: "Test album",
        photographerId: photographer.id,
        status: "OPEN",
      },
    });

    const token = generateClientToken();
    const client = await prisma.albumClient.create({
      data: {
        clientName: TEST_CLIENT_NAME,
        clientEmail: TEST_CLIENT_EMAIL,
        accessToken: token,
        albumId: album.id,
      },
    });

    // Validate token
    const validation = await validateClientToken(token);

    if (!validation) {
      console.error(`❌ Valid token validation failed`);
      return false;
    }

    if (validation.client.id !== client.id) {
      console.error(`❌ Client ID mismatch`);
      return false;
    }

    if (validation.album.id !== album.id) {
      console.error(`❌ Album ID mismatch`);
      return false;
    }

    // Cleanup
    await prisma.albumClient.delete({ where: { id: client.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`✅ Valid token validation works correctly`);
    return true;
  } catch (error) {
    console.error("❌ Token validation (valid) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 4: Token Validation - Invalid Token
 */
async function testTokenValidationInvalid(): Promise<boolean> {
  console.log("\n📋 Test 4: Token Validation - Invalid Token");
  console.log("─".repeat(50));

  try {
    // Try to validate a non-existent token
    const invalidToken = generateClientToken();
    const validation = await validateClientToken(invalidToken);

    if (validation !== null) {
      console.error(`❌ Invalid token validation should return null`);
      return false;
    }

    console.log(`✅ Invalid token validation works correctly`);
    return true;
  } catch (error) {
    console.error("❌ Token validation (invalid) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 5: Token Validation - Expired Token
 */
async function testTokenValidationExpired(): Promise<boolean> {
  console.log("\n📋 Test 5: Token Validation - Expired Token");
  console.log("─".repeat(50));

  try {
    // Create test data
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album for Expired Token",
        description: "Test album",
        photographerId: photographer.id,
        status: "OPEN",
      },
    });

    const token = generateClientToken();
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

    const client = await prisma.albumClient.create({
      data: {
        clientName: TEST_CLIENT_NAME,
        clientEmail: TEST_CLIENT_EMAIL,
        accessToken: token,
        expiresAt: expiredDate,
        albumId: album.id,
      },
    });

    // Validate expired token
    const validation = await validateClientToken(token);

    if (validation !== null) {
      console.error(`❌ Expired token validation should return null`);
      return false;
    }

    // Cleanup
    await prisma.albumClient.delete({ where: { id: client.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`✅ Expired token validation works correctly`);
    return true;
  } catch (error) {
    console.error("❌ Token validation (expired) failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 6: Token Regeneration
 */
async function testTokenRegeneration(): Promise<boolean> {
  console.log("\n📋 Test 6: Token Regeneration");
  console.log("─".repeat(50));

  try {
    // Create test data
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album for Regeneration",
        description: "Test album",
        photographerId: photographer.id,
        status: "OPEN",
      },
    });

    const originalToken = generateClientToken();
    const client = await prisma.albumClient.create({
      data: {
        clientName: TEST_CLIENT_NAME,
        clientEmail: TEST_CLIENT_EMAIL,
        accessToken: originalToken,
        albumId: album.id,
      },
    });

    // Regenerate token
    const newToken = await regenerateClientToken(client.id);

    if (newToken === originalToken) {
      console.error(`❌ Regenerated token should be different from original`);
      return false;
    }

    // Verify old token is invalid
    const oldValidation = await validateClientToken(originalToken);
    if (oldValidation !== null) {
      console.error(`❌ Old token should be invalid after regeneration`);
      return false;
    }

    // Verify new token is valid
    const newValidation = await validateClientToken(newToken);
    if (!newValidation || newValidation.client.id !== client.id) {
      console.error(`❌ New token should be valid`);
      return false;
    }

    // Cleanup
    await prisma.albumClient.delete({ where: { id: client.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`✅ Token regeneration works correctly`);
    console.log(`   - Old token invalidated`);
    console.log(`   - New token is valid`);
    return true;
  } catch (error) {
    console.error("❌ Token regeneration failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Test 7: Token Revocation
 */
async function testTokenRevocation(): Promise<boolean> {
  console.log("\n📋 Test 7: Token Revocation");
  console.log("─".repeat(50));

  try {
    // Create test data
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });

    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });

    const album = await prisma.album.create({
      data: {
        title: "Test Album for Revocation",
        description: "Test album",
        photographerId: photographer.id,
        status: "OPEN",
      },
    });

    const originalToken = generateClientToken();
    const client = await prisma.albumClient.create({
      data: {
        clientName: TEST_CLIENT_NAME,
        clientEmail: TEST_CLIENT_EMAIL,
        accessToken: originalToken,
        albumId: album.id,
      },
    });

    // Revoke token (generates new one)
    const newToken = await revokeClientToken(client.id);

    // Verify old token is invalid
    const oldValidation = await validateClientToken(originalToken);
    if (oldValidation !== null) {
      console.error(`❌ Revoked token should be invalid`);
      return false;
    }

    // Verify new token is valid
    const newValidation = await validateClientToken(newToken);
    if (!newValidation || newValidation.client.id !== client.id) {
      console.error(`❌ New token after revocation should be valid`);
      return false;
    }

    // Cleanup
    await prisma.albumClient.delete({ where: { id: client.id } });
    await prisma.album.delete({ where: { id: album.id } });
    await prisma.photographer.delete({ where: { id: photographer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`✅ Token revocation works correctly`);
    console.log(`   - Old token invalidated`);
    console.log(`   - New token generated and valid`);
    return true;
  } catch (error) {
    console.error("❌ Token revocation failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🧪 Client Access Token Functionality Tests");
  console.log("=".repeat(50));
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run all tests
  results.push({ name: "Test 1: Token Generation", passed: testTokenGeneration() });
  results.push({ name: "Test 2: Token Creation and Storage", passed: await testTokenCreation() });
  results.push({ name: "Test 3: Token Validation - Valid Token", passed: await testTokenValidationValid() });
  results.push({ name: "Test 4: Token Validation - Invalid Token", passed: await testTokenValidationInvalid() });
  results.push({ name: "Test 5: Token Validation - Expired Token", passed: await testTokenValidationExpired() });
  results.push({ name: "Test 6: Token Regeneration", passed: await testTokenRegeneration() });
  results.push({ name: "Test 7: Token Revocation", passed: await testTokenRevocation() });

  // Cleanup any remaining test data
  console.log("\n🧹 Cleanup");
  console.log("─".repeat(50));
  try {
    // Clean up any test users/photographers/albums/clients that might have been left behind
    const testUsers = await prisma.user.findMany({
      where: {
        email: { contains: "test-" },
      },
      include: {
        photographer: {
          include: {
            albums: {
              include: {
                albumClients: true,
              },
            },
          },
        },
      },
    });

    for (const user of testUsers) {
      if (user.photographer) {
        for (const album of user.photographer.albums) {
          await prisma.albumClient.deleteMany({ where: { albumId: album.id } });
        }
        await prisma.album.deleteMany({ where: { photographerId: user.photographer.id } });
        await prisma.photographer.delete({ where: { id: user.photographer.id } });
      }
      await prisma.user.delete({ where: { id: user.id } });
    }
    console.log("✅ Cleanup completed");
  } catch (error) {
    console.log("⚠️  Cleanup warning:", error instanceof Error ? error.message : error);
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

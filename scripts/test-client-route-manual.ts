#!/usr/bin/env tsx
/**
 * Manual Testing Helper for Client Access Route
 * 
 * Creates test data and provides instructions for manually testing
 * the /api/client/[token] route handler.
 * 
 * Usage:
 *   tsx scripts/test-client-route-manual.ts
 * 
 * This script will:
 * 1. Create test data (User, Photographer, Album, AlbumClient with token)
 * 2. Print the token and URL to test
 * 3. Provide curl commands to test the endpoint
 */

import "dotenv/config";
import { generateClientToken } from "../src/lib/auth/client-token";
import prisma from "../src/lib/prisma";

async function createTestData() {
  console.log("🧪 Manual Testing Helper for Client Access Route");
  console.log("=".repeat(60));
  console.log();

  try {
    // Create test user
    console.log("📝 Creating test user...");
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-photographer-${Date.now()}@example.com`,
        emailVerified: true,
        name: "Test Photographer",
      },
    });
    console.log(`✅ Created user: ${user.email}`);

    // Create photographer
    console.log("📝 Creating photographer...");
    const photographer = await prisma.photographer.create({
      data: {
        userId: user.id,
        name: "Test Photographer",
      },
    });
    console.log(`✅ Created photographer: ${photographer.id}`);

    // Create album
    console.log("📝 Creating album...");
    const album = await prisma.album.create({
      data: {
        title: "Test Album for Manual Testing",
        description: "This is a test album for manually testing the client access route",
        photographerId: photographer.id,
        status: "OPEN", // Must be OPEN for clients to access
      },
    });
    console.log(`✅ Created album: ${album.title} (ID: ${album.id})`);

    // Create some test photos
    console.log("📝 Creating test photos...");
    const photos = await prisma.photo.createMany({
      data: [
        {
          filename: "test-photo-1.jpg",
          originalFilename: "test-photo-1.jpg",
          mimeType: "image/jpeg",
          size: 1024000,
          width: 1920,
          height: 1080,
          storageKey: `albums/${album.id}/review/test-photo-1.jpg`,
          albumId: album.id,
        },
        {
          filename: "test-photo-2.jpg",
          originalFilename: "test-photo-2.jpg",
          mimeType: "image/jpeg",
          size: 2048000,
          width: 1920,
          height: 1080,
          storageKey: `albums/${album.id}/review/test-photo-2.jpg`,
          albumId: album.id,
        },
        {
          filename: "test-photo-3.jpg",
          originalFilename: "test-photo-3.jpg",
          mimeType: "image/jpeg",
          size: 1536000,
          width: 1920,
          height: 1080,
          storageKey: `albums/${album.id}/review/test-photo-3.jpg`,
          albumId: album.id,
        },
      ],
    });
    console.log(`✅ Created ${photos.count} test photos`);

    // Create album client with token
    console.log("📝 Creating album client with access token...");
    const token = generateClientToken();
    const client = await prisma.albumClient.create({
      data: {
        clientName: "Test Client",
        clientEmail: "test-client@example.com",
        accessToken: token,
        albumId: album.id,
        expiresAt: null, // No expiration
      },
    });
    console.log(`✅ Created client: ${client.clientName} (ID: ${client.id})`);

    // Create a photo selection for testing
    const photo = await prisma.photo.findFirst({
      where: { albumId: album.id },
    });
    if (photo) {
      await prisma.photoSelection.create({
        data: {
          photoId: photo.id,
          clientId: client.id,
          notes: "This is a test selection",
        },
      });
      console.log(`✅ Created test photo selection`);
    }

    console.log();
    console.log("=".repeat(60));
    console.log("✅ Test Data Created Successfully!");
    console.log("=".repeat(60));
    console.log();

    // Print testing instructions
    console.log("📋 Testing Instructions:");
    console.log("─".repeat(60));
    console.log();
    console.log("1. Start your Next.js development server:");
    console.log("   npm run dev");
    console.log();
    console.log("2. Test the client access route using one of these methods:");
    console.log();
    console.log("   Option A: Using curl (in a new terminal):");
    console.log(`   curl http://localhost:3000/api/client/${token}`);
    console.log();
    console.log("   Option B: Using curl with pretty JSON:");
    console.log(`   curl http://localhost:3000/api/client/${token} | jq`);
    console.log();
    console.log("   Option C: Open in browser:");
    console.log(`   http://localhost:3000/api/client/${token}`);
    console.log();
    console.log("   Option D: Using fetch in browser console:");
    console.log(`   fetch('http://localhost:3000/api/client/${token}').then(r => r.json()).then(console.log)`);
    console.log();
    console.log("3. Expected Response:");
    console.log("   - Status: 200 OK");
    console.log("   - Body: JSON with album, client, photos, and selection data");
    console.log();
    console.log("4. Test Invalid Token:");
    console.log(`   curl http://localhost:3000/api/client/invalid-token-12345`);
    console.log("   Expected: 401 Unauthorized");
    console.log();
    console.log("5. Test Expired Token (if you want):");
    console.log("   Update the client's expiresAt to a past date in the database");
    console.log("   Then try accessing the route again");
    console.log();
    console.log("=".repeat(60));
    console.log();
    console.log("🔑 Test Token:");
    console.log(`   ${token}`);
    console.log();
    console.log("📊 Test Data Summary:");
    console.log(`   - User ID: ${user.id}`);
    console.log(`   - Photographer ID: ${photographer.id}`);
    console.log(`   - Album ID: ${album.id}`);
    console.log(`   - Album Title: ${album.title}`);
    console.log(`   - Album Status: ${album.status}`);
    console.log(`   - Client ID: ${client.id}`);
    console.log(`   - Client Name: ${client.clientName}`);
    console.log(`   - Client Email: ${client.clientEmail}`);
    console.log(`   - Photos Count: ${photos.count}`);
    console.log();
    console.log("🧹 Cleanup:");
    console.log("   To clean up test data, run:");
    console.log(`   npm run cleanup:test-data ${client.id}`);
    console.log("   (Or manually delete the test user/photographer/album/client)");
    console.log();

    return {
      token,
      clientId: client.id,
      albumId: album.id,
      photographerId: photographer.id,
      userId: user.id,
    };
  } catch (error) {
    console.error("❌ Error creating test data:", error instanceof Error ? error.message : error);
    throw error;
  }
}

// Run the script
createTestData()
  .then(() => {
    console.log("✨ Setup complete! Follow the instructions above to test the route.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });

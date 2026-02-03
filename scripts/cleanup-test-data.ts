#!/usr/bin/env tsx
/**
 * Cleanup Test Data Script
 * 
 * Cleans up test data created by test-client-route-manual.ts
 * 
 * Usage:
 *   tsx scripts/cleanup-test-data.ts [clientId]
 * 
 * If clientId is provided, it will clean up that specific client and related data.
 * Otherwise, it will clean up all test data (users/photographers/albums/clients with "test" in email/name).
 */

import "dotenv/config";
import prisma from "../src/lib/prisma";

async function cleanupTestData(clientId?: string) {
  console.log("🧹 Cleaning up test data...");
  console.log("=".repeat(60));
  console.log();

  try {
    if (clientId) {
      // Clean up specific client
      console.log(`📝 Cleaning up client: ${clientId}...`);
      
      const client = await prisma.albumClient.findUnique({
        where: { id: clientId },
        include: {
          album: {
            include: {
              photographer: {
                include: {
                  user: true,
                },
              },
              photos: true,
              albumClients: true,
            },
          },
        },
      });

      if (!client) {
        console.log(`⚠️  Client not found: ${clientId}`);
        return;
      }

      const album = client.album;
      const photographer = album.photographer;
      const user = photographer.user;

      // Delete photo selections
      await prisma.photoSelection.deleteMany({
        where: { clientId: client.id },
      });
      console.log(`✅ Deleted photo selections for client`);

      // Delete client
      await prisma.albumClient.delete({
        where: { id: client.id },
      });
      console.log(`✅ Deleted client: ${client.clientName}`);

      // Delete photos
      await prisma.photo.deleteMany({
        where: { albumId: album.id },
      });
      console.log(`✅ Deleted photos for album`);

      // Delete album
      await prisma.album.delete({
        where: { id: album.id },
      });
      console.log(`✅ Deleted album: ${album.title}`);

      // Delete photographer
      await prisma.photographer.delete({
        where: { id: photographer.id },
      });
      console.log(`✅ Deleted photographer`);

      // Delete user
      await prisma.user.delete({
        where: { id: user.id },
      });
      console.log(`✅ Deleted user: ${user.email}`);

      console.log();
      console.log("✅ Cleanup complete!");
    } else {
      // Clean up all test data
      console.log("📝 Cleaning up all test data...");

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
                  photos: true,
                },
              },
            },
          },
        },
      });

      let deletedCount = 0;

      for (const user of testUsers) {
        if (user.photographer) {
          for (const album of user.photographer.albums) {
            // Delete photo selections
            for (const client of album.albumClients) {
              await prisma.photoSelection.deleteMany({
                where: { clientId: client.id },
              });
            }

            // Delete clients
            await prisma.albumClient.deleteMany({
              where: { albumId: album.id },
            });

            // Delete photos
            await prisma.photo.deleteMany({
              where: { albumId: album.id },
            });
          }

          // Delete albums
          await prisma.album.deleteMany({
            where: { photographerId: user.photographer.id },
          });

          // Delete photographer
          await prisma.photographer.delete({
            where: { id: user.photographer.id },
          });
        }

        // Delete user
        await prisma.user.delete({
          where: { id: user.id },
        });

        deletedCount++;
      }

      console.log(`✅ Cleaned up ${deletedCount} test user(s) and related data`);
    }

    console.log();
    console.log("✨ Cleanup complete!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error instanceof Error ? error.message : error);
    throw error;
  }
}

// Get client ID from command line args
const clientId = process.argv[2];

// Run cleanup
cleanupTestData(clientId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });

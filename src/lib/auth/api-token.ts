/**
 * API Token Utilities for Lightroom Plugin Authentication
 * 
 * API tokens are separate from user web sessions.
 * They are stored in the Photographer model (not User table).
 * Used for Lightroom plugin authentication via Bearer token.
 */

import { randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import type { Photographer, User } from "@/generated/prisma/client";

/**
 * Generate a secure random API token
 * 
 * @returns Hex-encoded token string (64 characters)
 */
export function generateApiToken(): string {
  // Generate 32 random bytes (256 bits), hex-encoded = 64 characters
  return randomBytes(32).toString("hex");
}

/**
 * Hash an API token using bcrypt
 * 
 * @param token - Plain text token to hash
 * @returns Hashed token
 */
export async function hashApiToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verify an API token against a hash
 * 
 * @param token - Plain text token to verify
 * @param hash - Hashed token to compare against
 * @returns True if token matches hash
 */
export async function verifyApiToken(
  token: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

/**
 * Generate and store a new API token for a photographer
 * Replaces any existing token
 * 
 * @param photographerId - ID of the photographer
 * @returns Plain text token (store this securely, it won't be returned again)
 */
export async function createApiToken(
  photographerId: string
): Promise<string> {
  const token = generateApiToken();
  const hashedToken = await hashApiToken(token);
  
  await prisma.photographer.update({
    where: { id: photographerId },
    data: {
      apiToken: hashedToken,
      apiTokenCreatedAt: new Date(),
    },
  });
  
  return token;
}

/**
 * Validate an API token and return the associated photographer
 * 
 * @param token - Plain text token from Authorization header
 * @returns Photographer record if token is valid, null otherwise
 */
export async function validateApiToken(
  token: string
): Promise<{ photographer: Photographer; user: User } | null> {
  // Find all photographers with API tokens (we'll verify the hash)
  const photographers = await prisma.photographer.findMany({
    where: {
      apiToken: { not: null },
    },
    include: {
      user: true,
    },
  });
  
  // Check each photographer's token hash
  for (const photographer of photographers) {
    if (!photographer.apiToken) continue;
    
    const isValid = await verifyApiToken(token, photographer.apiToken);
    if (isValid) {
      return {
        photographer,
        user: photographer.user,
      };
    }
  }
  
  return null;
}

/**
 * Revoke an API token by clearing it from the database
 * 
 * @param photographerId - ID of the photographer
 */
export async function revokeApiToken(photographerId: string): Promise<void> {
  await prisma.photographer.update({
    where: { id: photographerId },
    data: {
      apiToken: null,
      apiTokenCreatedAt: null,
    },
  });
}


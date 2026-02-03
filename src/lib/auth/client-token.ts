/**
 * Client Access Token Utilities for Album Access
 * 
 * Client tokens are separate from user authentication and API tokens.
 * They are stored in the AlbumClient model (not User or Photographer).
 * Used for client gallery access via URL token.
 * 
 * Note: Unlike API tokens, client tokens are NOT hashed.
 * They are stored directly in the database and looked up by unique index.
 */

import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { AlbumClient, Album } from "@/generated/prisma/client";

/**
 * Generate a secure random client access token
 * 
 * @returns Hex-encoded token string (64 characters)
 */
export function generateClientToken(): string {
  // Generate 32 random bytes (256 bits), hex-encoded = 64 characters
  return randomBytes(32).toString("hex");
}

/**
 * Generate and store a new client access token for an AlbumClient
 * Replaces any existing token
 * 
 * @param clientId - ID of the AlbumClient
 * @param expiresAt - Optional expiration date for the token
 * @returns Plain text token (store this securely, it won't be returned again)
 */
export async function createClientToken(
  clientId: string,
  expiresAt?: Date | null
): Promise<string> {
  const token = generateClientToken();
  
  await prisma.albumClient.update({
    where: { id: clientId },
    data: {
      accessToken: token,
      expiresAt: expiresAt ?? undefined,
    },
  });
  
  return token;
}

/**
 * Regenerate a client access token (for resetting client access)
 * 
 * @param clientId - ID of the AlbumClient
 * @param expiresAt - Optional expiration date for the new token
 * @returns Plain text token (store this securely, it won't be returned again)
 */
export async function regenerateClientToken(
  clientId: string,
  expiresAt?: Date | null
): Promise<string> {
  return createClientToken(clientId, expiresAt);
}

/**
 * Validate a client access token and return the associated client and album
 * 
 * @param token - Plain text token from URL parameter
 * @returns AlbumClient and Album records if token is valid, null otherwise
 */
export async function validateClientToken(
  token: string
): Promise<{ client: AlbumClient; album: Album } | null> {
  // Look up client by token (unique index makes this fast)
  const client = await prisma.albumClient.findUnique({
    where: { accessToken: token },
    include: {
      album: true,
    },
  });
  
  if (!client) {
    return null;
  }
  
  // Check if token has expired
  if (client.expiresAt && client.expiresAt < new Date()) {
    return null;
  }
  
  return {
    client,
    album: client.album,
  };
}

/**
 * Revoke a client access token by generating a new one
 * This effectively invalidates the old token
 * 
 * @param clientId - ID of the AlbumClient
 * @param expiresAt - Optional expiration date for the new token
 * @returns New plain text token
 */
export async function revokeClientToken(
  clientId: string,
  expiresAt?: Date | null
): Promise<string> {
  // Generate a new token, which invalidates the old one
  return regenerateClientToken(clientId, expiresAt);
}

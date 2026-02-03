/**
 * Authentication Module Exports
 * 
 * Central export point for all authentication-related utilities
 * 
 * NOTE: This file exports server-only modules. For client components,
 * import directly from "./auth-client" instead.
 */

// Server-only exports (use in API routes, Server Actions, Server Components)
export { auth } from "./auth";
export * from "./guards";
export * from "./api-token";
export * from "./client-token";

// Client-safe exports (use in Client Components)
// Import directly: import { signUp, signIn } from "@/lib/auth/auth-client"
// We don't re-export here to avoid pulling server-only code into client bundles


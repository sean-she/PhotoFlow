/**
 * Better-Auth Configuration
 * 
 * Configures better-auth with Prisma adapter for authentication.
 * Better-auth manages its own `user` table for authentication.
 * Business data (photographer info, API tokens) is stored in the `Photographer` model.
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from '@/lib/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  callbacks: {
    /**
     * Automatically create a Photographer record after user sign-up
     * This links the authentication User to the business Photographer model
     */
    async afterSignUp({ user }: { user: { id: string; name: string | null; email: string } }) {
      try {
        await prisma.photographer.create({
          data: {
            userId: user.id,
            name: user.name || null,
          },
        });
        console.log(`✅ Created photographer profile for user ${user.id}`);
      } catch (error) {
        // Log error but don't fail sign-up
        // In production, you might want to throw here or use a retry mechanism
        console.error('Failed to create photographer profile:', error);
      }
    },
  },
  // CSRF protection is enabled by default
  // Secure cookies are enabled by default in production
})
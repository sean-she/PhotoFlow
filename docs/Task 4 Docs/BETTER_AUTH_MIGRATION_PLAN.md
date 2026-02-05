# Better-Auth Migration Plan

## Overview
This document outlines the plan to migrate from manual JWT/bcrypt authentication to better-auth, a modern, type-safe authentication library that works seamlessly with Next.js App Router and Prisma.

## Why Better-Auth?

- **Type-safe**: Full TypeScript support with automatic type inference
- **Framework-agnostic**: Works with Next.js App Router, API routes, and Server Actions
- **Prisma integration**: First-class support via Prisma adapter
- **Batteries included**: Handles password hashing, session management, CSRF protection, secure cookies automatically
- **Less code**: No need to manually implement JWT, bcrypt, token refresh, or session management
- **Future-proof**: Easy to add OAuth providers (Google, GitHub, etc.) later

## Current State Analysis

### ✅ Already Compatible
- **Database Schema**: User model exists with `email`, `passwordHash`, `name` fields
- **Prisma Setup**: Prisma client configured and working
- **Next.js App Router**: Already using Next.js 16 with App Router
- **Error Handling**: Comprehensive error handling utilities in place
- **Validation**: Zod validation schemas ready

### ❌ Needs Migration
1. **No authentication implementation yet** - Task 4 is still pending
2. **Current User model will be replaced** - Better-auth will create its own `user` table
3. **Need to create Photographers table** - Separate business data from authentication
4. **Albums need to reference Photographers** - Update foreign key relationships
5. **No auth routes** - Need to create better-auth route handler
6. **No auth utilities** - Need to create route protection helpers

## Migration Strategy

### Phase 1: Install and Configure Better-Auth

**Dependencies to Install:**
```bash
npm install better-auth
npm install @better-auth/prisma-adapter
```

**Files to Create:**
1. `src/lib/auth/config.ts` - better-auth configuration
2. `src/lib/auth/client.ts` - Client SDK for React components

**Configuration Steps:**
1. Configure better-auth with Prisma adapter
2. Configure email/password provider
3. Set up session management settings (30 days expiration)
4. Configure CSRF protection

**Database Changes:**
- Run better-auth CLI generate command to create auth tables
- better-auth creates: `user`, `session`, `account`, `verification` tables
- These tables are managed by better-auth and remain separate from business data

### Phase 2: Set Up API Route Handler

**File to Create:**
- `src/app/api/auth/[...all]/route.ts` - Catch-all route for all auth endpoints

**What This Handles:**
- `/api/auth/sign-in` - User login
- `/api/auth/sign-up` - User registration
- `/api/auth/sign-out` - User logout
- `/api/auth/session` - Get current session
- `/api/auth/callback` - OAuth callbacks (future)

**Implementation:**
- Single route handler exports GET and POST
- Uses better-auth's Next.js integration helper
- Automatically handles all auth operations

### Phase 3: Create Client SDK

**File to Create:**
- `src/lib/auth/client.ts` - better-auth client instance

**Usage:**
- React components: `useSession()` hook, `signIn()`, `signOut()` methods
- Server Components: `getSession()` for server-side session retrieval
- Server Actions: Use client SDK or server-side session API

### Phase 4: Implement Route Protection Utilities

**File to Create:**
- `src/lib/auth/guards.ts` - Route protection utilities

**Functions to Implement:**
- `requireAuth()` - For route handlers (validates session, returns user or throws)
- `requirePhotographer()` - For Server Actions (validates photographer role)
- `getSession()` - Optional session retrieval (for semi-public routes)

**Integration:**
- Use with existing error handling utilities
- Integrate with Next.js middleware if needed
- Support both route handlers and Server Actions

### Phase 5: Create Photographers Table and Link to Auth

**Note:** This separates authentication data (better-auth `user` table) from business data (`photographers` table).

**Files to Create/Update:**
- Update Prisma schema to add `Photographer` model
- Update `Album` model to reference `Photographer` instead of `User`
- Create migration to add `photographers` table and update relationships

**Implementation:**
- Create `Photographer` model with one-to-one relationship to better-auth `User`
- Move business data (API tokens, etc.) to `Photographer` model
- Update `Album` foreign key from `userId` to `photographerId`
- Create Photographer record after user sign-up

### Phase 6: API Token System for Lightroom Plugin

**Note:** API tokens for Lightroom plugin authentication are separate from user sessions.

**Files to Create/Update:**
- `src/lib/auth/api-token.ts` - API token generation, hashing, and validation
- API tokens stored in `Photographer.apiToken` field (not `User` table)
- `src/lib/auth/guards.ts` - Add `requireApiToken()` function for plugin routes

**Implementation:**
- Generate secure random tokens using `node:crypto`
- Hash tokens before storing in database (use bcrypt)
- Store tokens in `Photographer` model, not `User` model
- Validate tokens in middleware for plugin API routes
- Allow photographers to generate/regenerate tokens in dashboard

### Phase 7: Client Access Token (Custom Implementation)

**Note:** Client access tokens for album access remain custom - this is separate from user authentication.

**File to Update/Create:**
- `src/lib/auth/client-access.ts` - Client token generation/validation

**No Changes Needed:**
- This functionality remains the same (uses `node:crypto` for secure token generation)
- Only user authentication changes to better-auth

### Phase 8: Update Existing Code (If Any)

**Files to Check:**
- Any existing auth-related code (currently none, but check for references)
- Middleware that might reference auth
- API routes that might need auth protection

**Update Strategy:**
- Replace any manual JWT/bcrypt code with better-auth
- Update route handlers to use `requireAuth()` from guards
- Update Server Actions to use `requirePhotographer()`

## Database Schema Changes

### Architecture Decision: Separate Authentication from Business Data

**Key Principle**: Better-auth manages its own `user` table for authentication. Business data (photographer info, API tokens, albums) lives in a separate `Photographers` table.

### Better-Auth Tables (Created by CLI Generate)

Better-auth will create these tables via `npx @better-auth/cli@latest generate`:

#### **`user`** Table (Better-Auth Managed)
```prisma
model User {
  id            String   @id
  email         String   @unique
  emailVerified Boolean  @default(false)
  name          String?
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Better-auth relationships
  sessions Session[]
  accounts Account[]
  
  // Link to Photographer (one-to-one)
  photographer Photographer?
  
  @@map("user")
}
```

**Purpose**: Authentication only - email, password, basic profile
**Managed by**: Better-auth CLI and library
**Don't modify**: Let better-auth handle this table

#### **`session`** Table
Stores active user sessions for web authentication.

#### **`account`** Table
Stores OAuth account links (for future OAuth providers).

#### **`verification`** Table
Stores email verification tokens (if enabled).

### New Photographers Table (Your Business Data)

```prisma
model Photographer {
  id                String    @id @default(cuid(2))
  userId            String    @unique @map("user_id") // One-to-one with better-auth User
  name              String?   // Display name (can also use User.name)
  apiToken          String?   @map("api_token") // Hashed API token for Lightroom plugin
  apiTokenCreatedAt DateTime? @map("api_token_created_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  
  // Relationships
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  albums Album[]
  
  @@index([userId])
  @@index([apiToken])
  @@map("photographers")
}
```

**Purpose**: Business data - API tokens, photographer-specific info
**Managed by**: Your application code
**Relationship**: One-to-one with better-auth `User`

### Updated Album Model

```prisma
model Album {
  id            String      @id @default(cuid(2))
  title         String
  description   String?
  status        AlbumStatus @default(DRAFT)
  photographerId String     @map("photographer_id") // Changed from userId
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  // Relationships
  photographer Photographer @relation(fields: [photographerId], references: [id], onDelete: Cascade)
  photos       Photo[]
  albumClients AlbumClient[]

  @@index([photographerId])
  @@map("albums")
}
```

**Change**: `userId` → `photographerId` (references `Photographer`, not `User`)

### Migration Strategy

1. **Run Better-Auth CLI Generate**:
   ```bash
   npx @better-auth/cli@latest generate
   ```
   This adds `User`, `Session`, `Account`, `Verification` models to your schema.

2. **Manually Add Photographer Model**:
   Add the `Photographer` model to your Prisma schema (as shown above).

3. **Update Album Model**:
   Change `userId` to `photographerId` and update relationship.

4. **Run Prisma Migration**:
   ```bash
   npx prisma migrate dev --name separate_auth_from_photographers
   ```

5. **Update Seed Script**:
   - Create Photographer records linked to User records
   - Update Album creation to use `photographerId`

## Implementation Details

### Better-Auth Configuration Example

```typescript
// src/lib/auth/config.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/generated/prisma/client";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // ... other config
});
```

**Note**: Better-auth will use its own `user` table. No need to configure custom field mappings.

### API Route Handler Example

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth/config";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Client SDK Example

```typescript
// src/lib/auth/client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
});
```

### Route Protection Example

```typescript
// src/lib/auth/guards.ts
import { auth } from "@/lib/auth/config";
import { prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function requireAuth(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  return session.user;
}

export async function requirePhotographer(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  // Get the Photographer record linked to the User
  const photographer = await prisma.photographer.findUnique({
    where: { userId: session.user.id },
  });
  
  if (!photographer) {
    return NextResponse.json(
      { error: "Photographer profile not found" },
      { status: 404 }
    );
  }
  
  return { user: session.user, photographer };
}
```

## Testing Strategy

### Unit Tests
- Test better-auth configuration
- Test route protection utilities
- Test client SDK methods

### Integration Tests
- Test sign-in/sign-up/sign-out flows
- Test session management
- Test protected routes
- Test client access tokens (separate from user auth)

### E2E Tests
- Complete authentication flow
- Protected route access
- Session persistence
- Logout functionality

## Migration Checklist

- [ ] Install better-auth and Prisma adapter
- [ ] Create better-auth configuration file (`src/lib/auth/config.ts`)
- [ ] Run better-auth CLI generate: `npx @better-auth/cli@latest generate`
  - This adds `User`, `Session`, `Account`, `Verification` models to schema
- [ ] Manually add `Photographer` model to Prisma schema
- [ ] Update `Album` model: change `userId` → `photographerId`, update relationship
- [ ] Run Prisma migration: `npx prisma migrate dev --name separate_auth_from_photographers`
- [ ] Create API route handler (`app/api/auth/[...all]/route.ts`)
- [ ] Create client SDK (`lib/auth/client.ts`)
- [ ] Create route protection utilities (`lib/auth/guards.ts`)
  - Include `requirePhotographer()` that links User to Photographer
- [ ] Create API token utilities (`lib/auth/api-token.ts`)
  - Store tokens in `Photographer.apiToken`, not `User` table
- [ ] Update sign-up flow to create Photographer record after User creation
- [ ] Update seed script:
  - Create User records via better-auth
  - Create Photographer records linked to Users
  - Update Album creation to use `photographerId`
- [ ] Write tests for auth flows
- [ ] Write tests for API token system
- [ ] Update documentation
- [ ] Test complete authentication flow
- [ ] Test Lightroom plugin API token authentication

## Decisions Made

1. **Database Migration**: ✅ Remove `refreshToken` field from User model (better-auth manages sessions separately)

2. **Session Duration**: ✅ 30 days (better-auth default)

3. **OAuth Providers**: ✅ Add later (not in initial implementation)

4. **Email Verification**: ✅ Not required for now

5. **Password Requirements**: ✅ Use better-auth defaults (no custom requirements)

6. **Lightroom Plugin Auth**: ✅ **Recommended: Separate API Token System**
   - **Rationale**: The Lightroom plugin is a Lua script making direct HTTP requests, not a browser. It can't easily use session cookies.
   - **Solution**: Store `apiToken` in `Photographer` model (not `User`). Photographers generate/regenerate tokens in their dashboard.
   - **Implementation**: Custom middleware validates API tokens from `Authorization: Bearer <token>` headers for plugin routes.
   - **Security**: Tokens are hashed in database, can be revoked/regenerated, separate from user sessions.

9. **Database Architecture**: ✅ **Separate Authentication from Business Data**
   - **Decision**: Better-auth creates its own `user` table. Business data goes in `Photographers` table.
   - **Benefits**: Clean separation of concerns, better-auth manages auth, we manage business logic
   - **Relationship**: One-to-one between `User` (auth) and `Photographer` (business)

7. **Existing Data**: ✅ No existing data to migrate

8. **Rate Limiting**: ✅ Use better-auth defaults (no additional rate limiting needed)

## Next Steps

1. ✅ All questions answered and decisions made
2. Review and approve this migration plan
3. Begin Phase 1 implementation
4. Test each phase before moving to the next
5. Update documentation as we go

## API Token System Details

### For Lightroom Plugin Authentication

**Why Separate API Tokens?**
- Lightroom plugin is a Lua script making direct HTTP requests
- Can't use browser cookies/sessions
- Needs long-lived authentication for automated uploads
- Separate from user web sessions

**Implementation:**
1. **Token Generation**: Photographers generate tokens in dashboard
2. **Token Storage**: Hashed with bcrypt in `Photographer.apiToken` field (not `User` table)
3. **Token Usage**: Plugin sends `Authorization: Bearer <token>` header
4. **Token Validation**: Middleware validates token for plugin routes (`/api/lightroom/*`)
5. **Token Management**: Photographers can regenerate/revoke tokens
6. **Linking**: Token validation looks up Photographer by token, then gets associated User if needed

**Security:**
- Tokens are cryptographically secure (32+ bytes, hex-encoded)
- Stored as bcrypt hashes (same security as passwords)
- Can be revoked by regenerating
- Separate from user sessions (revoking token doesn't log out user)

## References

- [Better-Auth Documentation](https://www.better-auth.com/docs)
- [Better-Auth Prisma Adapter](https://www.better-auth.com/docs/adapters/prisma)
- [Better-Auth Next.js Integration](https://www.better-auth.com/docs/guides/nextjs)


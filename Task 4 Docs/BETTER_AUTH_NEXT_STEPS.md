# Better-Auth Migration: Next Steps

## ✅ What's Already Completed

1. **Better-auth installed and configured**
   - Configuration file: `src/lib/auth/auth.ts`
   - Prisma adapter configured
   - Email/password authentication enabled
   - Session management (30 days expiration)

2. **Database schema migrated**
   - Better-auth tables created (User, Session, Account, Verification)
   - Photographer model added (business data separate from auth)
   - Album model updated (references `photographerId` instead of `userId`)
   - Migration applied: `separate_auth_from_photographers`

3. **Auth API routes working**
   - Route handler: `src/app/api/auth/[...all]/route.ts`
   - Endpoints available: `/api/auth/sign-up`, `/api/auth/sign-in`, `/api/auth/sign-out`, `/api/auth/session`

4. **Client SDK ready**
   - File: `src/lib/auth/auth-client.ts`
   - Exports: `signIn`, `signUp`, `signOut`, `useSession` hooks

5. **Route protection utilities created**
   - File: `src/lib/auth/guards.ts`
   - Functions: `requireAuth()`, `requirePhotographer()`, `getSession()`, `getPhotographer()`

6. **API token utilities created**
   - File: `src/lib/auth/api-token.ts`
   - Functions for Lightroom plugin authentication (token generation, validation, revocation)

7. **Automatic Photographer creation**
   - `afterSignUp` callback added to `src/lib/auth/auth.ts`
   - Automatically creates Photographer record after user sign-up

8. **Seed script updated**
   - Creates User records (better-auth managed)
   - Creates Photographer records linked to Users
   - Creates Albums using `photographerId`

---

## 🎯 Next Steps

### Step 1: Test Authentication Flow

Test that sign-up and sign-in work correctly:

```bash
# Start your dev server
npm run dev

# In another terminal, test sign-up
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Test sign-in
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**What to verify:**
- ✅ User record created in database
- ✅ Photographer record created automatically (check via `afterSignUp` callback)
- ✅ Session cookie set in response
- ✅ Sign-in returns session data

**Check database:**
```bash
npx prisma studio
```

Look for:
- `user` table: Should have the new user
- `photographers` table: Should have a photographer linked to that user
- `account` table: Should have the password hash

---

### Step 2: Update Validation Schema

The album validation schema still references `userId`. Update it to use `photographerId`:

**File:** `src/lib/validation/schemas/album.ts`

**Change:**
```typescript
// Line 56 - Change from:
userId: cuidSchema.optional(),

// To:
photographerId: cuidSchema.optional(),
```

**Full updated schema:**
```typescript
export const albumQuerySchema = z.object({
  status: albumStatusSchema.optional(),
  photographerId: cuidSchema.optional(), // Changed from userId
  search: z.string().max(255).optional(),
});
```

---

### Step 3: Create Protected API Route Example

Create an example route that demonstrates using `requirePhotographer()`:

**File:** `src/app/api/albums/route.ts`

```typescript
import { requirePhotographer } from "@/lib/auth/guards";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAlbumSchema } from "@/lib/validation/schemas/album";
import { withRouteErrorHandling } from "@/lib/errors";
import { withRouteLogging } from "@/lib/logging";

/**
 * Create a new album
 * Requires authentication and photographer profile
 */
async function createAlbum(request: NextRequest): Promise<NextResponse> {
  // This throws AuthenticationError if not authenticated or no photographer profile
  const { photographer } = await requirePhotographer(request);
  
  // Parse and validate request body
  const body = await request.json();
  const data = createAlbumSchema.parse(body);
  
  // Create album using photographer.id (not user.id)
  const album = await prisma.album.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      photographerId: photographer.id, // Use photographer.id, not user.id
    },
  });
  
  return NextResponse.json(album, { status: 201 });
}

/**
 * Get albums for the authenticated photographer
 */
async function getAlbums(request: NextRequest): Promise<NextResponse> {
  const { photographer } = await requirePhotographer(request);
  
  const albums = await prisma.album.findMany({
    where: {
      photographerId: photographer.id, // Filter by photographer.id
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return NextResponse.json(albums);
}

// Export with error handling and logging
export const POST = withRouteErrorHandling(withRouteLogging(createAlbum));
export const GET = withRouteErrorHandling(withRouteLogging(getAlbums));
```

**Test the protected route:**
```bash
# First, sign in to get a session cookie
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Then create an album (cookies.txt contains the session)
curl -X POST http://localhost:3000/api/albums \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Album","description":"Test album"}' \
  -b cookies.txt
```

---

### Step 4: Test Seed Script

Run the seed script to verify it works with the new schema:

```bash
npm run db:seed
```

**What to verify:**
- ✅ Users created in `user` table
- ✅ Accounts created in `account` table (with password hashes)
- ✅ Photographers created in `photographers` table (linked to users)
- ✅ Albums created in `albums` table (using `photographerId`)

**Check with Prisma Studio:**
```bash
npx prisma studio
```

---

### Step 5: Update Storage Utilities (Optional)

The storage path utilities (`src/lib/storage/paths.ts`, `src/lib/storage/organization.ts`) currently use `userId` for path generation.

**Decision needed:**
- **Option A:** Keep using `userId` in paths (fine if it's just for organization)
- **Option B:** Switch to `photographerId` for consistency

**If you want to switch to `photographerId`:**

Update functions in:
- `src/lib/storage/paths.ts`
- `src/lib/storage/organization.ts`
- `src/lib/storage/lifecycle.ts`
- `src/lib/storage/migration.ts`

Change parameter names from `userId` to `photographerId` and update any logic that uses it.

**Note:** This is optional - if paths are just for organization and you're not querying by them, keeping `userId` is fine.

---

### Step 6: Update Existing Code

As you build new features or update existing code, remember:

1. **Use `requirePhotographer()` instead of manual auth checks:**
   ```typescript
   // ✅ DO THIS
   const { photographer } = await requirePhotographer(request);
   
   // ❌ DON'T DO THIS
   const user = await requireAuth(request);
   const photographer = await prisma.photographer.findUnique({...});
   ```

2. **Use `photographer.id` instead of `user.id` for business logic:**
   ```typescript
   // ✅ DO THIS
   await prisma.album.create({
     data: {
       photographerId: photographer.id,
       // ...
     },
   });
   
   // ❌ DON'T DO THIS
   await prisma.album.create({
     data: {
       photographerId: user.id, // Wrong! user.id != photographer.id
       // ...
     },
   });
   ```

3. **Use `photographerId` in database queries:**
   ```typescript
   // ✅ DO THIS
   const albums = await prisma.album.findMany({
     where: { photographerId: photographer.id },
   });
   
   // ❌ DON'T DO THIS
   const albums = await prisma.album.findMany({
     where: { userId: user.id }, // Wrong field name
   });
   ```

---

## 📋 Priority Order

1. **Test authentication** (sign-up/sign-in) - Verify everything works
2. **Update album validation schema** - Fix the `userId` → `photographerId` reference
3. **Create one protected route example** - See how to use `requirePhotographer()`
4. **Test seed script** - Verify data creation works
5. **Update existing code** - As you build features, use the new patterns

---

## 🧪 Testing Checklist

- [ ] Sign-up creates User and Photographer records
- [ ] Sign-in returns session
- [ ] Protected routes require authentication
- [ ] `requirePhotographer()` returns photographer data
- [ ] Album creation uses `photographerId` correctly
- [ ] Seed script runs without errors
- [ ] Database relationships are correct (User → Photographer → Album)

---

## 📚 Key Concepts

### Authentication vs Business Data

- **User table** (better-auth managed): Authentication only
  - Email, password (in Account table), name, image
  - Managed by better-auth library
  
- **Photographer table** (your code managed): Business data
  - API tokens, photographer-specific info
  - One-to-one relationship with User
  
- **Album table**: References Photographer, not User
  - `photographerId` field links to Photographer
  - Photographer links to User for authentication

### Using Guards

- **`requireAuth(request)`**: For routes that just need authentication
  - Returns: `User` object
  - Throws: `AuthenticationError` if not authenticated
  
- **`requirePhotographer(request)`**: For routes that need photographer data
  - Returns: `{ user: User, photographer: Photographer }`
  - Throws: `AuthenticationError` if not authenticated or no photographer profile
  
- **`getSession(request)`**: Optional session check (doesn't throw)
  - Returns: `Session | null`
  
- **`getPhotographer(request)`**: Optional photographer check (doesn't throw)
  - Returns: `{ user, photographer } | null`

---

## 🔗 Related Files

- **Auth Config:** `src/lib/auth/auth.ts`
- **Guards:** `src/lib/auth/guards.ts`
- **API Tokens:** `src/lib/auth/api-token.ts`
- **Auth Routes:** `src/app/api/auth/[...all]/route.ts`
- **Client SDK:** `src/lib/auth/auth-client.ts`
- **Schema:** `prisma/schema.prisma`
- **Migration Plan:** `BETTER_AUTH_MIGRATION_PLAN.md`
- **Schema Impact:** `SCHEMA_MIGRATION_IMPACT.md`

---

## ❓ Common Questions

**Q: Why do I need both User and Photographer?**
A: Better-auth manages the User table for authentication. We keep business data (API tokens, etc.) in Photographer to maintain clean separation.

**Q: What if a user signs up but Photographer creation fails?**
A: Currently, the `afterSignUp` callback logs the error but doesn't fail sign-up. You can modify this behavior if needed.

**Q: Can I use `user.id` for albums?**
A: No! Albums must use `photographer.id`. The User table is for auth only. Always use `photographer.id` for business logic.

**Q: How do I test protected routes?**
A: Sign in first to get a session cookie, then include that cookie in requests to protected routes.

---

## 🚀 Ready to Build!

You now have a complete authentication system with better-auth. Start building your features using the patterns shown above!


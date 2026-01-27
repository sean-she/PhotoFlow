# Database Schema Migration Impact

This document details how the better-auth migration will impact your current database schema.

## Architecture Decision: Separate Authentication from Business Data

**Key Principle**: Better-auth manages its own `user` table for authentication. Business data (photographer info, API tokens, albums) lives in a separate `Photographers` table.

This provides:
- ✅ Clean separation of concerns
- ✅ Better-auth manages auth, we manage business logic
- ✅ Easy to extend with other user types (admins, clients, etc.)
- ✅ No conflicts between better-auth CLI and our custom fields

## Current State

### Schema File Status
⚠️ **Your current Prisma schema has a `User` model that will be replaced** by better-auth's generated `User` model.

### Existing Database Tables (Before Migration)
Your database currently has these tables:

1. **`users`** - Photographer accounts (will be replaced by better-auth `user` table)
2. **`albums`** - Photo collections (will reference `photographers` instead of `users`)
3. **`photos`** - Individual images
4. **`album_clients`** - Client access to albums
5. **`photo_selections`** - Client photo selections

### Current Database User Table Structure
```sql
-- What your database currently has (before migration)
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT,
  "refresh_token" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL
);
```

**Note**: This table will be replaced by better-auth's `user` table.

## Changes Required

### 1. Better-Auth Tables (Created by CLI Generate)

Better-auth will create these tables when you run `npx @better-auth/cli@latest generate`:

#### **`user`** Table (Better-Auth Managed)
```sql
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT,
  "image" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL
);
```

**Fields:**
- `id` - User ID (primary key)
- `email` - Email address (unique, for authentication)
- `email_verified` - Email verification status
- `name` - Display name (optional)
- `image` - Profile image URL (optional)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

**Purpose**: Authentication only - managed entirely by better-auth
**Important**: Don't add custom fields here. Use `Photographers` table instead.

---

#### **`session`** Table
Stores active user sessions for web authentication.

```sql
CREATE TABLE "session" (
  "id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL,
  
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_user_id_idx" ON "session"("user_id");
```

**Fields:**
- `id` - Session ID (primary key)
- `expires_at` - When session expires (30 days default)
- `token` - Session token (unique)
- `created_at` - Session creation time
- `updated_at` - Last update time
- `ip_address` - Optional IP tracking
- `user_agent` - Optional browser tracking
- `user_id` - Foreign key to `user.id`

**Purpose**: Manages web browser sessions (replaces JWT tokens)

---

#### **`account`** Table
Stores OAuth account links (for future OAuth providers like Google).

```sql
CREATE TABLE "account" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_provider_id_account_id_key" 
  ON "account"("provider_id", "account_id");
CREATE INDEX "account_user_id_idx" ON "account"("user_id");
```

**Purpose**: Links OAuth accounts to users (not used initially, but created for future use)

---

#### **`verification`** Table
Stores email verification tokens (if email verification is enabled later).

```sql
CREATE TABLE "verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_identifier_value_key" 
  ON "verification"("identifier", "value");
```

**Purpose**: Email verification tokens (not used initially, but table created for future use)

---

### 2. New Photographers Table (Your Business Data)

```sql
CREATE TABLE "photographers" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,  -- One-to-one with better-auth user
  "name" TEXT,
  "api_token" TEXT,  -- Hashed API token for Lightroom plugin
  "api_token_created_at" TIMESTAMP(3),
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL,
  
  CONSTRAINT "photographers_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "photographers_user_id_key" ON "photographers"("user_id");
CREATE INDEX "photographers_api_token_idx" ON "photographers"("api_token");
```

**Fields:**
- `id` - Photographer ID (primary key, CUID)
- `user_id` - Foreign key to `user.id` (one-to-one relationship)
- `name` - Display name (optional, can also use `user.name`)
- `api_token` - Hashed API token for Lightroom plugin authentication
- `api_token_created_at` - Timestamp when API token was generated
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

**Purpose**: Business data separate from authentication
**Relationship**: One-to-one with better-auth `user` table

---

### 3. Updated Album Table

```sql
-- Change: userId → photographerId
ALTER TABLE "albums" 
  DROP CONSTRAINT "albums_user_id_fkey",
  DROP COLUMN "user_id",
  ADD COLUMN "photographer_id" TEXT NOT NULL;

ALTER TABLE "albums"
  ADD CONSTRAINT "albums_photographer_id_fkey"
    FOREIGN KEY ("photographer_id") REFERENCES "photographers"("id") ON DELETE CASCADE;

CREATE INDEX "albums_photographer_id_idx" ON "albums"("photographer_id");
```

**Change**: `userId` → `photographerId` (references `photographers`, not `user`)

---

## Migration Summary

### Tables Affected

| Table | Action | Details |
|-------|--------|---------|
| `user` | **CREATE** | New table created by better-auth CLI (replaces old `users` table) |
| `session` | **CREATE** | New table for better-auth sessions |
| `account` | **CREATE** | New table for OAuth accounts (future use) |
| `verification` | **CREATE** | New table for email verification (future use) |
| `photographers` | **CREATE** | New table for photographer business data |
| `albums` | **MODIFY** | Change `user_id` → `photographer_id`, update foreign key |
| `photos` | **NO CHANGE** | Unaffected |
| `album_clients` | **NO CHANGE** | Unaffected |
| `photo_selections` | **NO CHANGE** | Unaffected |

### Indexes Added

1. **`photographers.user_id`** - Unique index for one-to-one relationship
2. **`photographers.api_token`** - Index for API token lookups
3. **`albums.photographer_id`** - Index for photographer album queries
4. **`session.token`** - Unique index for session tokens
5. **`session.user_id`** - Index for user session queries
6. **`account.provider_id + account_id`** - Unique composite index
7. **`account.user_id`** - Index for user account queries
8. **`verification.identifier + value`** - Unique composite index

### Foreign Keys Added

1. **`photographers.user_id`** → `user.id` (CASCADE on delete, UNIQUE)
2. **`albums.photographer_id`** → `photographers.id` (CASCADE on delete)
3. **`session.user_id`** → `user.id` (CASCADE on delete)
4. **`account.user_id`** → `user.id` (CASCADE on delete)

## Migration SQL Preview

Here's what the migration will do:

```sql
-- Step 1: Better-auth CLI generates these (via Prisma migration)
-- CREATE TABLE "user" ...
-- CREATE TABLE "session" ...
-- CREATE TABLE "account" ...
-- CREATE TABLE "verification" ...

-- Step 2: Create Photographers table
CREATE TABLE "photographers" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "api_token" TEXT,
  "api_token_created_at" TIMESTAMP(3),
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL,
  
  CONSTRAINT "photographers_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "photographers_user_id_key" ON "photographers"("user_id");
CREATE INDEX "photographers_api_token_idx" ON "photographers"("api_token");

-- Step 3: Update Albums table
ALTER TABLE "albums" 
  DROP CONSTRAINT IF EXISTS "albums_user_id_fkey",
  DROP COLUMN IF EXISTS "user_id",
  ADD COLUMN "photographer_id" TEXT NOT NULL;

ALTER TABLE "albums"
  ADD CONSTRAINT "albums_photographer_id_fkey"
    FOREIGN KEY ("photographer_id") REFERENCES "photographers"("id") ON DELETE CASCADE;

CREATE INDEX "albums_photographer_id_idx" ON "albums"("photographer_id");

-- Step 4: Drop old users table (if it exists and is empty)
-- DROP TABLE IF EXISTS "users";
```

## Data Impact

### ✅ No Data Loss
- **Old `users` table**: Will be replaced by better-auth `user` table (no existing data to migrate)
- **All other tables**: Unaffected
- **Albums**: Foreign key updated, but data preserved (just references different table)

### ✅ Clean Separation
- Authentication data in `user` table (better-auth managed)
- Business data in `photographers` table (your code managed)
- Clear boundaries between auth and business logic

## Migration Steps

1. **Run Better-Auth CLI Generate**:
   ```bash
   npx @better-auth/cli@latest generate
   ```
   This adds `User`, `Session`, `Account`, `Verification` models to your schema.

2. **Manually Add Photographer Model**:
   Add the `Photographer` model to your Prisma schema.

3. **Update Album Model**:
   Change `userId` to `photographerId` and update relationship.

4. **Create Migration**:
   ```bash
   npx prisma migrate dev --name separate_auth_from_photographers
   ```

5. **Review Migration Files**:
   - Check `prisma/migrations/YYYYMMDDHHMMSS_separate_auth_from_photographers/migration.sql`
   - Verify all changes are correct

6. **Test Migration**:
   ```bash
   # Reset and reapply all migrations
   npx prisma migrate reset
   ```

7. **Update Seed Script**:
   - Create User records via better-auth
   - Create Photographer records linked to Users
   - Update Album creation to use `photographerId`

8. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

## Post-Migration Schema

### Better-Auth User Model
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

### New Photographer Model
```prisma
model Photographer {
  id                String    @id @default(cuid())
  userId            String    @unique @map("user_id")
  name              String?
  apiToken          String?   @map("api_token")
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

### Updated Album Model
```prisma
model Album {
  id            String      @id @default(cuid())
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

### Better-Auth Models (Generated)
```prisma
model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ... other fields
  @@map("session")
}

model Account {
  id         String   @id
  accountId  String   @map("account_id")
  providerId String   @map("provider_id")
  userId     String   @map("user_id")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ... other fields
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime @map("expires_at")
  // ... other fields
  @@map("verification")
}
```

## Rollback Plan

If you need to rollback:

1. **For Development**:
   ```bash
   npx prisma migrate reset
   ```
   This resets the database and reapplies all migrations.

2. **For Production**:
   - Restore from backup
   - Or create a new migration to:
     - Revert Album foreign key changes
     - Drop `photographers` table
     - Drop better-auth tables
     - Recreate old `users` table structure

## Testing Checklist

After migration:

- [ ] Verify `user` table exists (created by better-auth)
- [ ] Verify `photographers` table exists with correct structure
- [ ] Verify `session` table exists and has correct structure
- [ ] Verify `account` table exists (for future OAuth)
- [ ] Verify `verification` table exists (for future email verification)
- [ ] Verify `albums.photographer_id` foreign key is correct
- [ ] Test user sign-up (creates `user` record)
- [ ] Test photographer creation (creates `photographer` linked to `user`)
- [ ] Test user sign-in (creates `session`)
- [ ] Test user sign-out (removes `session`)
- [ ] Test API token generation (stores in `photographers.api_token`)
- [ ] Test API token validation (looks up by `photographers.api_token`)
- [ ] Test album creation (uses `photographer_id`)
- [ ] Verify all indexes are created
- [ ] Verify foreign keys are set up correctly
- [ ] Test cascade deletes (deleting `user` removes `photographer` and `sessions`)

## Benefits of This Architecture

1. **Separation of Concerns**: Auth data separate from business data
2. **Better-Auth Compatibility**: No conflicts with better-auth CLI
3. **Flexibility**: Easy to add other user types (admins, clients, etc.)
4. **Maintainability**: Clear boundaries between auth and business logic
5. **Scalability**: Can extend Photographer model without touching auth

## Questions?

If you have concerns about:
- **Data migration**: No existing data to migrate (fresh database)
- **Performance**: New indexes may slightly increase write time, but improve query performance
- **Storage**: 4 new tables (user, session, account, verification), minimal storage impact
- **Compatibility**: All existing code needs to be updated to use `photographerId` instead of `userId`

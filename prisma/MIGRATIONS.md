# Prisma Migration Strategy

This document outlines the migration strategy for the PhotoFlow database schema.

## Development Workflow

### Initial Setup

1. **Set up database connection:**
   ```bash
   # Create a .env file with your DATABASE_URL
   DATABASE_URL="postgresql://user:password@localhost:5432/photoflow?schema=public"
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

3. **Create initial migration:**
   ```bash
   npm run db:migrate
   ```
   This will:
   - Create the initial migration based on your schema
   - Apply the migration to your database
   - Generate the Prisma Client

4. **Seed the database (optional, for development):**
   ```bash
   npm run db:seed
   ```

### Making Schema Changes

1. **Modify `prisma/schema.prisma`** with your changes

2. **Format and validate the schema:**
   ```bash
   npx prisma format
   ```

3. **Create a new migration:**
   ```bash
   npm run db:migrate
   ```
   Prisma will prompt you to name the migration (e.g., "add_user_avatar_field")

4. **Review the migration files** in `prisma/migrations/` to ensure they're correct

5. **Test the migration:**
   ```bash
   # Reset database and reapply all migrations
   npx prisma migrate reset
   ```

## Production Deployment

### Migration Strategy

1. **Never run `prisma migrate dev` in production** - this is for development only

2. **Use `prisma migrate deploy` in production:**
   ```bash
   npx prisma migrate deploy
   ```
   This command:
   - Applies pending migrations
   - Does NOT create new migrations
   - Is safe to run in CI/CD pipelines
   - Does not prompt for migration names

3. **Migration workflow:**
   - Develop and test migrations locally
   - Commit migration files to version control
   - Deploy migrations as part of your deployment process
   - Run `prisma migrate deploy` in production

### Pre-deployment Checklist

- [ ] All migrations have been tested locally
- [ ] Migration files are committed to version control
- [ ] Database backup has been created (for production)
- [ ] Migration rollback plan is documented
- [ ] Prisma Client has been regenerated (`npm run db:generate`)
- [ ] Application code is compatible with new schema

### Rollback Strategy

If a migration fails or causes issues:

1. **For development:**
   ```bash
   npx prisma migrate reset
   ```
   This will reset the database and reapply all migrations from scratch.

2. **For production:**
   - Restore from backup
   - Fix the migration file
   - Test locally
   - Redeploy with corrected migration

## Seed Data

### Development Seed

The seed script (`prisma/seed.ts`) creates:
- 2 photographer users (password: "password123")
- 5 albums with various statuses (DRAFT, OPEN, CLOSED, ARCHIVED)
- Sample photos with EXIF metadata
- Album clients with access tokens
- Photo selections

**Never run seed in production!**

### Running Seed

```bash
npm run db:seed
```

Or directly:
```bash
npx tsx prisma/seed.ts
```

## Database Management

### Viewing Data

Use Prisma Studio to view and edit data:
```bash
npm run db:studio
```

### Schema Validation

Always validate your schema before committing:
```bash
npx prisma format
npx prisma validate
```

## Best Practices

1. **Always format schema** before committing: `npx prisma format`
2. **Test migrations locally** before deploying
3. **Keep migrations small** - one logical change per migration
4. **Never edit existing migrations** - create new ones instead
5. **Use descriptive migration names** when prompted
6. **Commit migration files** to version control
7. **Document breaking changes** in migration files
8. **Backup production database** before migrations

## Troubleshooting

### Migration conflicts
If you have migration conflicts:
1. Review the conflicting migrations
2. Resolve conflicts manually if needed
3. Test the resolved migration locally
4. Commit the resolved migration

### Schema drift
If your database schema doesn't match your Prisma schema:
1. Use `prisma db pull` to introspect the database
2. Compare with your schema
3. Create a migration to align them

### Client generation issues
If Prisma Client is out of sync:
```bash
npm run db:generate
```


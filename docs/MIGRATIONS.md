# Database Migrations Guide

This guide explains how to create, manage, and run database migrations for the Motiv-Buy project.

## Table of Contents

- [Overview](#overview)
- [Local Development](#local-development)
- [Production Deployments](#production-deployments)
- [Migration Commands](#migration-commands)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Database migrations are managed using MikroORM and a dedicated migration CLI application. Migrations are **manually controlled** in all environments to ensure safety and review.

### Migration Architecture

- **Migration App**: Standalone application (`apps/migration`)
- **Manual Execution**: All migrations run via manual workflows or commands
- **Separate Container**: Migration runs in its own Docker container
- **Automated Backups**: Production migrations automatically backup the database

---

## Local Development

### Running Migrations Locally

```bash
# Check migration status
pnpm run migration:status

# Run pending migrations
pnpm run migration:run

# Rollback last migration
pnpm run migration:revert

# Create a new migration
pnpm run migration:create <migration-name>

# Fresh database (⚠️ DROPS ALL TABLES!)
pnpm run migration:fresh
```

### Creating a New Migration

1. **Create the migration file**:
   ```bash
   pnpm run migration:create AddUserEmailVerification
   ```

2. **Edit the migration** in `libs/database/src/migrations/`:
   ```typescript
   import { Migration } from '@mikro-orm/migrations';

   export class Migration20250113000000 extends Migration {
     async up(): Promise<void> {
       this.addSql(`
         ALTER TABLE "users"
         ADD COLUMN "email_verified" BOOLEAN DEFAULT FALSE;
       `);
     }

     async down(): Promise<void> {
       this.addSql(`
         ALTER TABLE "users"
         DROP COLUMN "email_verified";
       `);
     }
   }
   ```

3. **Test locally**:
   ```bash
   # Check status
   pnpm run migration:status

   # Run migration
   pnpm run migration:run

   # Test rollback
   pnpm run migration:revert

   # Re-run migration
   pnpm run migration:run
   ```

4. **Commit the migration**:
   ```bash
   git add libs/database/src/migrations/
   git commit -m "feat(db): add email verification column to users table"
   ```

---

## Production Deployments

### Migration Workflow

Migrations are **ALWAYS** run manually using GitHub Actions workflows:

1. **Prepare**:
   - Create and test migration locally
   - Commit migration file to repository
   - Push to appropriate branch

2. **Run on Staging**:
   - Go to Actions → "Database Migration - Manual"
   - Select environment: `staging`
   - Select action: `status` (check first)
   - Type `CONFIRM` and run
   - Review output
   - Run again with action: `up`

3. **Deploy Staging Application**:
   - After migration succeeds, deploy app
   - Go to Actions → "Deploy - Staging"
   - Run deployment workflow

4. **Run on Production**:
   - Go to Actions → "Database Migration - Manual"
   - Select environment: `production`
   - Select action: `status` (check first)
   - Type `CONFIRM` and run
   - Review output
   - **Database is automatically backed up**
   - Run again with action: `up`

5. **Deploy Production Application**:
   - After migration succeeds, deploy app
   - Go to Actions → "Deploy - Production"
   - Run deployment workflow

### Manual Migration Workflow Inputs

| Input         | Options                    | Description                           |
| ------------- | -------------------------- | ------------------------------------- |
| `environment` | `staging`, `production`    | Target environment                    |
| `action`      | `status`, `up`, `down`     | Migration action to perform           |
| `confirm`     | Must type `CONFIRM`        | Safety confirmation                   |

### Migration Actions

- **`status`**: Check current migration state (safe, read-only)
- **`up`**: Run all pending migrations
- **`down`**: Rollback the last migration (⚠️ destructive)

---

## Migration Commands

### Available Commands

| Command                     | Description                              |
| --------------------------- | ---------------------------------------- |
| `pnpm run migration:status` | Show migration status                    |
| `pnpm run migration:run`    | Run pending migrations (development)     |
| `pnpm run migration:revert` | Rollback last migration                  |
| `pnpm run migration:create` | Create new migration file                |
| `pnpm run migration:fresh`  | Drop all tables and re-run migrations    |
| `pnpm run migration:prod`   | Run migrations (production build)        |

### Migration CLI (Direct Access)

The migration CLI is built on Commander.js and provides these commands:

```bash
# Using ts-node (development)
ts-node -r tsconfig-paths/register apps/migration/src/main.ts <command>

# Using built version (production)
node dist/apps/migration/main.js <command>
```

**Available commands**:
- `status` - Show migration status
- `up` - Run pending migrations
- `down` - Rollback last migration
- `fresh` - Drop all tables and re-run migrations
- `create <name>` - Create new migration

---

## Best Practices

### DO ✅

1. **Always test migrations locally first**
   - Run `up` and `down` multiple times
   - Verify data integrity
   - Check for performance issues

2. **Write reversible migrations**
   - Always implement both `up()` and `down()`
   - Test rollback scenarios
   - Handle data transformations carefully

3. **Check migration status before deploying**
   - Run `status` action first
   - Verify expected migrations are pending
   - Ensure no unexpected migrations

4. **Run migrations on staging first**
   - Test on staging environment
   - Verify application works with new schema
   - Monitor for issues

5. **Use transactions for complex migrations**
   ```typescript
   async up(): Promise<void> {
     this.addSql('BEGIN;');
     this.addSql('ALTER TABLE...');
     this.addSql('UPDATE...');
     this.addSql('COMMIT;');
   }
   ```

6. **Add indexes carefully**
   ```typescript
   // For large tables, create indexes concurrently
   this.addSql('CREATE INDEX CONCURRENTLY idx_users_email ON users(email);');
   ```

7. **Document complex migrations**
   ```typescript
   export class Migration20250113000000 extends Migration {
     /**
      * Adds email verification support
      * - Adds email_verified column
      * - Adds email_verification_token column
      * - Defaults existing users to verified=true
      */
     async up(): Promise<void> {
       // ...
     }
   }
   ```

### DON'T ❌

1. **Don't run migrations automatically**
   - Never auto-run on deployment
   - Always require manual approval
   - Review each migration before executing

2. **Don't skip testing**
   - Never run untested migrations in production
   - Always test on staging first
   - Verify rollback works

3. **Don't modify existing migrations**
   - Once run in production, never modify
   - Create a new migration instead
   - Track migration history

4. **Don't ignore failed migrations**
   - Investigate failures immediately
   - Don't force deployments with failed migrations
   - Fix or rollback before proceeding

5. **Don't drop columns with data carelessly**
   ```typescript
   // ❌ BAD - Immediate data loss
   this.addSql('ALTER TABLE users DROP COLUMN old_field;');

   // ✅ GOOD - Two-phase migration
   // Migration 1: Deprecate (mark as nullable)
   this.addSql('ALTER TABLE users ALTER COLUMN old_field DROP NOT NULL;');

   // Migration 2 (later): Remove
   this.addSql('ALTER TABLE users DROP COLUMN old_field;');
   ```

6. **Don't use blocking operations on large tables**
   ```typescript
   // ❌ BAD - Blocks table during migration
   this.addSql('ALTER TABLE large_table ADD COLUMN new_field VARCHAR(255) NOT NULL;');

   // ✅ GOOD - Three-phase approach
   // Phase 1: Add column as nullable
   this.addSql('ALTER TABLE large_table ADD COLUMN new_field VARCHAR(255);');

   // Phase 2: Populate data in batches (application code)

   // Phase 3: Make NOT NULL (separate migration)
   this.addSql('ALTER TABLE large_table ALTER COLUMN new_field SET NOT NULL;');
   ```

---

## Troubleshooting

### Migration Failed on Production

1. **Check the error logs** in GitHub Actions
2. **Review database backup**:
   ```bash
   ssh user@production-server
   ls -la /deploy/path/backups/pre-migration-*.sql
   ```
3. **Decide on action**:
   - Fix migration and re-run
   - Rollback using `down` action
   - Restore from backup (extreme cases)

### Rollback Migration

Run the manual workflow with action `down`:

1. Go to Actions → "Database Migration - Manual"
2. Select environment
3. Select action: `down`
4. Type `CONFIRM`
5. Review the rollback results

### Restore from Backup

```bash
# SSH into server
ssh user@production-server

# Navigate to backups
cd /deploy/path/backups

# List available backups
ls -lh pre-migration-*.sql

# Restore from backup
docker compose exec -T postgres psql -U $DB_USER $DB_NAME < pre-migration-YYYYMMDD-HHMMSS.sql
```

### Migration Stuck or Locked

If a migration appears stuck:

```bash
# SSH into server
ssh user@production-server

# Check running migrations
docker compose exec postgres psql -U $DB_USER $DB_NAME -c "SELECT * FROM mikro_orm_migrations;"

# Check database locks
docker compose exec postgres psql -U $DB_USER $DB_NAME -c "SELECT * FROM pg_locks;"

# If needed, manually unlock (⚠️ use with caution)
docker compose exec postgres psql -U $DB_USER $DB_NAME -c "DELETE FROM mikro_orm_migrations WHERE name = 'problematic-migration';"
```

### Schema Mismatch

If application reports schema mismatch:

1. **Check migration status**:
   ```bash
   pnpm run migration:status
   ```

2. **Compare with production**:
   - Run manual workflow with action `status`
   - Compare pending migrations

3. **Sync migrations**:
   - Pull latest code
   - Run pending migrations
   - Restart application

---

## Migration Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   MIGRATION LIFECYCLE                        │
└─────────────────────────────────────────────────────────────┘

1. Development
   └─→ Create migration locally (pnpm run migration:create)
       └─→ Test up/down (pnpm run migration:run/revert)
           └─→ Commit to repository

2. Staging
   └─→ Manual workflow: Check status
       └─→ Manual workflow: Run migration (up)
           └─→ Deploy application
               └─→ Verify functionality

3. Production
   └─→ Manual workflow: Check status
       └─→ Automatic database backup
           └─→ Manual workflow: Run migration (up)
               └─→ Verify migration status
                   └─→ Deploy application
                       └─→ Monitor and verify

4. Rollback (if needed)
   └─→ Manual workflow: Rollback (down)
       └─→ Or restore from backup
```

---

## Additional Resources

- **MikroORM Migrations**: https://mikro-orm.io/docs/migrations
- **Project Guidelines**: `/CLAUDE.md`
- **Database Configuration**: `/libs/database/src/config/mikro-orm.config.ts`
- **Migration CLI**: `/apps/migration/`

---

## Questions or Issues?

1. Check this guide first
2. Review migration logs in GitHub Actions
3. Check database backups in `/backups` directory
4. Ask team members for assistance
5. Create an issue in the repository

---

**Remember**: Database migrations are critical operations. Always test thoroughly, run on staging first, and have a rollback plan ready.

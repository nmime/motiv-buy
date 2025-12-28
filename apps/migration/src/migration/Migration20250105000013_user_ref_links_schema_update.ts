import { Migration } from '@mikro-orm/migrations';

/**
 * Update user_ref_links table to match entity schema
 * Adds missing columns for referral tracking system
 */
export class Migration20250105000013UserRefLinksSchemaUpdate extends Migration {
  async up(): Promise<void> {
    // Add missing columns to user_ref_links table
    this.addSql(`
      ALTER TABLE user_ref_links
        ADD COLUMN IF NOT EXISTS type varchar(50) NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS source_type varchar(50),
        ADD COLUMN IF NOT EXISTS source_id uuid,
        ADD COLUMN IF NOT EXISTS ref_code_unique_key varchar(100),
        ADD COLUMN IF NOT EXISTS default_unique_key varchar(100),
        ADD COLUMN IF NOT EXISTS ref_percent_level_1 decimal(5,2) NOT NULL DEFAULT 10.00,
        ADD COLUMN IF NOT EXISTS ref_percent_level_2 decimal(5,2) NOT NULL DEFAULT 1.00,
        ADD COLUMN IF NOT EXISTS ref_percent_level_3 decimal(5,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
    `);

    // Update ref_code_unique_key and default_unique_key for existing rows
    this.addSql(`
      UPDATE user_ref_links
      SET ref_code_unique_key = ref_code,
          default_unique_key = user_id::text
      WHERE ref_code_unique_key IS NULL;
    `);

    // Make columns NOT NULL after setting values
    this.addSql(`
      ALTER TABLE user_ref_links
        ALTER COLUMN ref_code_unique_key SET NOT NULL,
        ALTER COLUMN default_unique_key SET NOT NULL;
    `);

    // Extend ref_code column length
    this.addSql(`
      ALTER TABLE user_ref_links
        ALTER COLUMN ref_code TYPE varchar(50);
    `);

    // Create unique constraints (using DO block for idempotency)
    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq__user_ref_links__ref_code_ref_code_unique_key'
        ) THEN
          ALTER TABLE user_ref_links
            ADD CONSTRAINT uq__user_ref_links__ref_code_ref_code_unique_key
              UNIQUE (ref_code, ref_code_unique_key);
        END IF;
      END $$;
    `);

    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq__user_ref_links__default_default_unique_key'
        ) THEN
          ALTER TABLE user_ref_links
            ADD CONSTRAINT uq__user_ref_links__default_default_unique_key
              UNIQUE (is_default, default_unique_key);
        END IF;
      END $$;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Remove constraints
    this.addSql(`
      ALTER TABLE user_ref_links
        DROP CONSTRAINT IF EXISTS uq__user_ref_links__ref_code_ref_code_unique_key,
        DROP CONSTRAINT IF EXISTS uq__user_ref_links__default_default_unique_key;
    `);

    // Remove added columns
    this.addSql(`
      ALTER TABLE user_ref_links
        DROP COLUMN IF EXISTS type,
        DROP COLUMN IF EXISTS source_type,
        DROP COLUMN IF EXISTS source_id,
        DROP COLUMN IF EXISTS ref_code_unique_key,
        DROP COLUMN IF EXISTS default_unique_key,
        DROP COLUMN IF EXISTS ref_percent_level_1,
        DROP COLUMN IF EXISTS ref_percent_level_2,
        DROP COLUMN IF EXISTS ref_percent_level_3,
        DROP COLUMN IF EXISTS is_default,
        DROP COLUMN IF EXISTS is_custom,
        DROP COLUMN IF EXISTS is_deleted;
    `);

    await Promise.resolve();
  }
}

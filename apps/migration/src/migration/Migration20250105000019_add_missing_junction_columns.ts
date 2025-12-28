import { Migration } from '@mikro-orm/migrations';

/**
 * Add missing columns to traffic_source_categories_junction:
 * - sort_order
 * - category_specific_config
 * - updated_at
 */
export class Migration20250105000019AddMissingJunctionColumns extends Migration {
  override async up(): Promise<void> {
    // Add missing columns
    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      ADD COLUMN IF NOT EXISTS category_specific_config jsonb;
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE traffic_source_categories_junction DROP COLUMN IF EXISTS sort_order;`);
    this.addSql(`ALTER TABLE traffic_source_categories_junction DROP COLUMN IF EXISTS category_specific_config;`);
    this.addSql(`ALTER TABLE traffic_source_categories_junction DROP COLUMN IF EXISTS updated_at;`);
  }
}

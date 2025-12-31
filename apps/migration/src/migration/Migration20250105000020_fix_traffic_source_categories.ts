import { Migration } from '@mikro-orm/migrations';

/**
 * Fix traffic_source_categories table to match entity:
 * - Add category_type column
 * - Add color column
 * - Add icon column
 * - Change name from varchar to jsonb for localization
 */
export class Migration20250105000020FixTrafficSourceCategories extends Migration {
  override async up(): Promise<void> {
    // Add missing columns
    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD COLUMN IF NOT EXISTS category_type varchar(50);
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD COLUMN IF NOT EXISTS color varchar(7);
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD COLUMN IF NOT EXISTS icon varchar(50);
    `);

    // Convert name from varchar to jsonb for localization
    // First, rename old column
    this.addSql(`
      ALTER TABLE traffic_source_categories
      RENAME COLUMN name TO name_old;
    `);

    // Create new jsonb column
    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD COLUMN name jsonb;
    `);

    // Migrate existing data - convert varchar name to JSON with en key
    this.addSql(`
      UPDATE traffic_source_categories
      SET name = jsonb_build_object('en', name_old),
          category_type = slug
      WHERE name IS NULL;
    `);

    // Drop old column
    this.addSql(`
      ALTER TABLE traffic_source_categories
      DROP COLUMN name_old;
    `);

    // Add index on category_type
    this.addSql(`
      CREATE INDEX IF NOT EXISTS IF NOT EXISTS ix__traffic_source_categories__category_type
      ON traffic_source_categories (category_type);
    `);

    // Drop old unique constraint on name (was varchar)
    this.addSql(`
      ALTER TABLE traffic_source_categories
      DROP CONSTRAINT IF EXISTS traffic_source_categories_name_key;
    `);
  }

  override async down(): Promise<void> {
    // Drop new index
    this.addSql(`DROP INDEX IF EXISTS ix__traffic_source_categories__category_type;`);

    // Convert name back to varchar
    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD COLUMN name_old varchar(100);
    `);

    this.addSql(`
      UPDATE traffic_source_categories
      SET name_old = name->>'en';
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories
      DROP COLUMN name;
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories
      RENAME COLUMN name_old TO name;
    `);

    // Add back unique constraint
    this.addSql(`
      ALTER TABLE traffic_source_categories
      ADD CONSTRAINT traffic_source_categories_name_key UNIQUE (name);
    `);

    // Drop added columns
    this.addSql(`ALTER TABLE traffic_source_categories DROP COLUMN IF EXISTS category_type;`);
    this.addSql(`ALTER TABLE traffic_source_categories DROP COLUMN IF EXISTS color;`);
    this.addSql(`ALTER TABLE traffic_source_categories DROP COLUMN IF EXISTS icon;`);
  }
}

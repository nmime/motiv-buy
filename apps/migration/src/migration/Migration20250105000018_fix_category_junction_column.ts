import { Migration } from '@mikro-orm/migrations';

/**
 * Fix traffic_source_categories_junction column name
 * The entity expects 'category_id' but the original migration created 'traffic_source_category_id'
 */
export class Migration20250105000018FixCategoryJunctionColumn extends Migration {
  override async up(): Promise<void> {
    // Rename the column to match entity expectation
    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      RENAME COLUMN traffic_source_category_id TO category_id;
    `);

    // Update the foreign key constraint
    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      DROP CONSTRAINT IF EXISTS fk__traffic_source_categories__traffic_source_category_id;
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      ADD CONSTRAINT fk__traffic_source_categories__category_id
      FOREIGN KEY (category_id) REFERENCES traffic_source_categories(id) ON DELETE CASCADE;
    `);

    // Update indexes (drop old ones, create new ones with correct column name)
    this.addSql(`DROP INDEX IF EXISTS ix__traffic_source_categories__category_id;`);
    this.addSql(`DROP INDEX IF EXISTS uq__traffic_source_categories__source_category;`);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS ix__traffic_source_categories_junction__category_id
      ON traffic_source_categories_junction (category_id);
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq__traffic_source_categories_junction__source_category
      ON traffic_source_categories_junction (traffic_source_id, category_id);
    `);
  }

  override async down(): Promise<void> {
    // Revert indexes
    this.addSql(`DROP INDEX IF EXISTS ix__traffic_source_categories_junction__category_id;`);
    this.addSql(`DROP INDEX IF EXISTS uq__traffic_source_categories_junction__source_category;`);

    // Restore old indexes
    this.addSql(`
      CREATE INDEX ix__traffic_source_categories__category_id
      ON traffic_source_categories_junction (category_id);
    `);

    this.addSql(`
      CREATE UNIQUE INDEX uq__traffic_source_categories__source_category
      ON traffic_source_categories_junction (traffic_source_id, category_id);
    `);

    // Revert foreign key
    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      DROP CONSTRAINT IF EXISTS fk__traffic_source_categories__category_id;
    `);

    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      ADD CONSTRAINT fk__traffic_source_categories__traffic_source_category_id
      FOREIGN KEY (category_id) REFERENCES traffic_source_categories(id) ON DELETE CASCADE;
    `);

    // Rename column back
    this.addSql(`
      ALTER TABLE traffic_source_categories_junction
      RENAME COLUMN category_id TO traffic_source_category_id;
    `);
  }
}

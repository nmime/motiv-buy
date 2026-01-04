import { Migration } from '@mikro-orm/migrations';

/**
 * Drop old direct source/target columns from traffic_orders table
 * These relationships are now handled via junction tables:
 * - traffic_order_sources (Order ↔ Source M:M)
 * - traffic_order_targets (Order ↔ Target M:M)
 *
 * Migration order matters - this runs AFTER Migration20250105000016
 * which creates the junction tables.
 */
export class Migration20250105000017DropTrafficOrderDirectRelations extends Migration {
  async up(): Promise<void> {
    // Drop foreign key constraints first
    this.addSql(`
      ALTER TABLE traffic_orders
        DROP CONSTRAINT IF EXISTS fk__traffic_orders__traffic_source_id;
    `);

    this.addSql(`
      ALTER TABLE traffic_orders
        DROP CONSTRAINT IF EXISTS fk__traffic_orders__traffic_target_id;
    `);

    // Drop indexes
    this.addSql(`
      DROP INDEX IF EXISTS ix__traffic_orders__traffic_source_id;
    `);

    this.addSql(`
      DROP INDEX IF EXISTS ix__traffic_orders__traffic_target_id;
    `);

    // Drop columns
    this.addSql(`
      ALTER TABLE traffic_orders
        DROP COLUMN IF EXISTS traffic_source_id;
    `);

    this.addSql(`
      ALTER TABLE traffic_orders
        DROP COLUMN IF EXISTS traffic_target_id;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Re-add columns (nullable to avoid breaking existing data)
    this.addSql(`
      ALTER TABLE traffic_orders
        ADD COLUMN traffic_source_id UUID,
        ADD COLUMN traffic_target_id UUID;
    `);

    // Re-add foreign key constraints
    this.addSql(`
      ALTER TABLE traffic_orders
        ADD CONSTRAINT fk__traffic_orders__traffic_source_id
          FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE traffic_orders
        ADD CONSTRAINT fk__traffic_orders__traffic_target_id
          FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE;
    `);

    // Re-add indexes
    this.addSql(`
      CREATE INDEX IF NOT EXISTS ix__traffic_orders__traffic_source_id ON traffic_orders (traffic_source_id);
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS ix__traffic_orders__traffic_target_id ON traffic_orders (traffic_target_id);
    `);

    await Promise.resolve();
  }
}

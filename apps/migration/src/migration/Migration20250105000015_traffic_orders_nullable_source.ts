import { Migration } from '@mikro-orm/migrations';

/**
 * Make traffic_source_id nullable in traffic_orders table
 * Traffic source will be assigned later during order processing/matching
 */
export class Migration20250105000015TrafficOrdersNullableSource extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE traffic_orders
        ALTER COLUMN traffic_source_id DROP NOT NULL;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE traffic_orders
        ALTER COLUMN traffic_source_id SET NOT NULL;
    `);

    await Promise.resolve();
  }
}

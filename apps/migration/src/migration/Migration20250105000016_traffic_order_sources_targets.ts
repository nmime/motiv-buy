import { Migration } from '@mikro-orm/migrations';

/**
 * Create junction tables for M:M relationships:
 * - traffic_order_sources: TrafficOrder ↔ TrafficSource
 * - traffic_order_targets: TrafficOrder ↔ TrafficTarget
 *
 * These tables allow orders to have multiple sources and multiple targets
 * with budget/count allocation per source/target.
 */
export class Migration20250105000016TrafficOrderSourcesTargets extends Migration {
  async up(): Promise<void> {
    // Create traffic_order_sources junction table
    this.addSql(`
      CREATE TABLE traffic_order_sources (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        traffic_order_id UUID NOT NULL REFERENCES traffic_orders(id) ON DELETE CASCADE,
        traffic_source_id UUID NOT NULL REFERENCES traffic_sources(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        allocated_count INTEGER NOT NULL,
        completed_count INTEGER NOT NULL DEFAULT 0,
        allocated_budget DECIMAL(15,4) NOT NULL,
        spent_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
        price_per_action DECIMAL(10,4),
        priority INTEGER NOT NULL DEFAULT 100,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq__traffic_order_sources__order_source UNIQUE (traffic_order_id, traffic_source_id)
      );
    `);

    // Create indexes for traffic_order_sources
    this.addSql(`
      CREATE INDEX ix__traffic_order_sources__order_id ON traffic_order_sources(traffic_order_id);
      CREATE INDEX ix__traffic_order_sources__source_id ON traffic_order_sources(traffic_source_id);
      CREATE INDEX ix__traffic_order_sources__status ON traffic_order_sources(status);
    `);

    // Create traffic_order_targets junction table
    this.addSql(`
      CREATE TABLE traffic_order_targets (
        id UUID PRIMARY KEY DEFAULT uuidv7(),
        traffic_order_id UUID NOT NULL REFERENCES traffic_orders(id) ON DELETE CASCADE,
        traffic_target_id UUID NOT NULL REFERENCES traffic_targets(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        allocated_count INTEGER NOT NULL,
        completed_count INTEGER NOT NULL DEFAULT 0,
        allocated_budget DECIMAL(15,4) NOT NULL,
        spent_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
        price_per_action DECIMAL(10,4),
        priority INTEGER NOT NULL DEFAULT 100,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        target_url TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq__traffic_order_targets__order_target UNIQUE (traffic_order_id, traffic_target_id)
      );
    `);

    // Create indexes for traffic_order_targets
    this.addSql(`
      CREATE INDEX ix__traffic_order_targets__order_id ON traffic_order_targets(traffic_order_id);
      CREATE INDEX ix__traffic_order_targets__target_id ON traffic_order_targets(traffic_target_id);
      CREATE INDEX ix__traffic_order_targets__status ON traffic_order_targets(status);
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS traffic_order_targets;');
    this.addSql('DROP TABLE IF EXISTS traffic_order_sources;');

    await Promise.resolve();
  }
}

import { Migration } from '@mikro-orm/migrations';

/**
 * Migration to add payment provider routing tables
 * Adds support for dynamic provider selection, routing rules, and multi-network support
 */
export class Migration20250105000000_add_payment_routing_tables extends Migration {
  async up(): Promise<void> {
    // 1. Create payment_provider_configs table
    this.addSql(`
      CREATE TABLE payment_provider_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL UNIQUE,
        provider_type VARCHAR(30) NOT NULL DEFAULT 'CRYPTO_NATIVE',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        priority INTEGER NOT NULL DEFAULT 100,
        reliability_score INTEGER NOT NULL DEFAULT 95,
        supports_deposits BOOLEAN NOT NULL DEFAULT true,
        supports_withdrawals BOOLEAN NOT NULL DEFAULT true,
        supports_telegram_integration BOOLEAN NOT NULL DEFAULT false,
        supports_network_routing BOOLEAN NOT NULL DEFAULT false,
        auto_routing_enabled BOOLEAN NOT NULL DEFAULT true,
        maintenance_mode BOOLEAN NOT NULL DEFAULT false,
        max_concurrent_requests INTEGER,
        rate_limit_per_minute INTEGER,
        features JSONB,
        config JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    this.addSql(`
      CREATE INDEX idx_payment_provider_configs_provider ON payment_provider_configs(provider);
      CREATE INDEX idx_payment_provider_configs_enabled ON payment_provider_configs(is_enabled);
      CREATE INDEX idx_payment_provider_configs_status ON payment_provider_configs(status);
      CREATE INDEX idx_payment_provider_configs_priority ON payment_provider_configs(priority);
    `);

    // 2. Create provider_currency_support table
    this.addSql(`
      CREATE TABLE provider_currency_support (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES payment_provider_configs(id) ON DELETE CASCADE,
        currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
        network VARCHAR(30) NOT NULL DEFAULT 'NATIVE',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        is_preferred BOOLEAN NOT NULL DEFAULT false,
        routing_priority INTEGER NOT NULL DEFAULT 100,
        supports_deposits BOOLEAN NOT NULL DEFAULT true,
        supports_withdrawals BOOLEAN NOT NULL DEFAULT true,
        min_deposit_amount DECIMAL(20,8),
        max_deposit_amount DECIMAL(20,8),
        min_withdrawal_amount DECIMAL(20,8),
        max_withdrawal_amount DECIMAL(20,8),
        deposit_fee_percentage DECIMAL(10,4),
        deposit_fee_fixed DECIMAL(20,8),
        withdrawal_fee_percentage DECIMAL(10,4),
        withdrawal_fee_fixed DECIMAL(20,8),
        network_fee_estimate DECIMAL(20,8),
        avg_confirmation_time_seconds INTEGER,
        reliability_score INTEGER NOT NULL DEFAULT 95,
        config JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider_id, currency_id, network)
      );
    `);

    this.addSql(`
      CREATE INDEX idx_provider_currency_support_provider ON provider_currency_support(provider_id);
      CREATE INDEX idx_provider_currency_support_currency ON provider_currency_support(currency_id);
      CREATE INDEX idx_provider_currency_support_network ON provider_currency_support(network);
      CREATE INDEX idx_provider_currency_support_enabled ON provider_currency_support(is_enabled);
      CREATE INDEX idx_provider_currency_support_preferred ON provider_currency_support(is_preferred);
      CREATE INDEX idx_provider_currency_support_priority ON provider_currency_support(routing_priority);
    `);

    // 3. Create provider_routing_rules table
    this.addSql(`
      CREATE TABLE provider_routing_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        rule_type VARCHAR(30) NOT NULL,
        provider_id UUID REFERENCES payment_provider_configs(id) ON DELETE SET NULL,
        currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER NOT NULL DEFAULT 100,
        weight INTEGER NOT NULL DEFAULT 1,
        allowed_countries VARCHAR(2)[],
        blocked_countries VARCHAR(2)[],
        allowed_platforms VARCHAR(50)[],
        min_amount_usd DECIMAL(20,8),
        max_amount_usd DECIMAL(20,8),
        verified_users_only BOOLEAN NOT NULL DEFAULT false,
        vip_users_only BOOLEAN NOT NULL DEFAULT false,
        active_days_of_week INTEGER[],
        active_hours_start TIME,
        active_hours_end TIME,
        active_from TIMESTAMPTZ,
        active_until TIMESTAMPTZ,
        fallback_rule_id UUID REFERENCES provider_routing_rules(id) ON DELETE SET NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        config JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    this.addSql(`
      CREATE INDEX idx_provider_routing_rules_rule_type ON provider_routing_rules(rule_type);
      CREATE INDEX idx_provider_routing_rules_provider ON provider_routing_rules(provider_id);
      CREATE INDEX idx_provider_routing_rules_currency ON provider_routing_rules(currency_id);
      CREATE INDEX idx_provider_routing_rules_enabled ON provider_routing_rules(is_enabled);
      CREATE INDEX idx_provider_routing_rules_priority ON provider_routing_rules(priority);
      CREATE INDEX idx_provider_routing_rules_active_from ON provider_routing_rules(active_from);
      CREATE INDEX idx_provider_routing_rules_active_until ON provider_routing_rules(active_until);
    `);

    this.addSql(`
      COMMENT ON TABLE payment_provider_configs IS 'Payment provider configuration and metadata';
      COMMENT ON TABLE provider_currency_support IS 'Provider-currency support matrix with network routing';
      COMMENT ON TABLE provider_routing_rules IS 'Dynamic routing rules for intelligent provider selection';

      COMMENT ON COLUMN provider_currency_support.network IS 'Blockchain network for the currency (e.g., TRC20, ERC20, BSC)';
      COMMENT ON COLUMN provider_currency_support.is_preferred IS 'Preferred network for this provider-currency pair';
      COMMENT ON COLUMN provider_routing_rules.weight IS 'Weight for load balancing (higher = more traffic)';
      COMMENT ON COLUMN provider_routing_rules.active_days_of_week IS 'Days of week (0=Sunday, 6=Saturday) when rule is active';
    `);
  }

  async down(): Promise<void> {
    // Drop tables in reverse order due to foreign key constraints
    this.addSql('DROP TABLE IF EXISTS provider_routing_rules CASCADE;');
    this.addSql('DROP TABLE IF EXISTS provider_currency_support CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_provider_configs CASCADE;');
  }
}

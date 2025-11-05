import { Migration } from '@mikro-orm/migrations';

/**
 * Payment System Migration
 *
 * Creates comprehensive payment processing system:
 * - currencies: Supported fiat and cryptocurrencies
 * - currency_rates_history: Historical exchange rates
 * - payment_transactions: Payment records
 * - payment_provider_configs: Payment provider configuration
 * - provider_currency_support: Provider-currency-network matrix
 * - provider_routing_rules: Dynamic routing rules
 *
 * This migration also adds currency_id foreign key to user_balances table.
 */
export class Migration20250105000004PaymentSystem extends Migration {
  async up(): Promise<void> {
    // ========================================
    // PART 1: CURRENCY TABLES
    // ========================================

    // 1. Create currencies table
    this.addSql(`
      CREATE TABLE currencies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        code varchar(10) NOT NULL UNIQUE,
        name varchar(50) NOT NULL,
        symbol varchar(10),
        type varchar(10) NOT NULL CHECK (type IN ('FIAT', 'CRYPTO')),
        rate_to_usd decimal(20, 8) NOT NULL DEFAULT '1.0',
        is_active boolean NOT NULL DEFAULT true,
        decimal_places integer NOT NULL DEFAULT 2,
        rate_updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE UNIQUE INDEX ix__currencies__code ON currencies (code);');
    this.addSql('CREATE INDEX ix__currencies__type ON currencies (type);');
    this.addSql('CREATE INDEX ix__currencies__is_active ON currencies (is_active);');

    this.addSql(`
      COMMENT ON TABLE currencies IS
      'Currency definitions with USD-based exchange rates';
    `);

    // 2. Create currency_rates_history table
    this.addSql(`
      CREATE TABLE currency_rates_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        currency_id uuid NOT NULL,
        provider varchar(30) NOT NULL CHECK (provider IN (
          'COINGECKO',
          'BINANCE',
          'CRYPTOCOMPARE',
          'COINCAP',
          'KRAKEN',
          'EXCHANGERATE_API',
          'FRANKFURTER',
          'FREECURRENCY_API',
          'CENTRAL_BANK',
          'MANUAL'
        )),
        rate_to_usd decimal(20, 8) NOT NULL,
        reliability_score integer NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__currency_rates_history__currency_id ON currency_rates_history (currency_id);');
    this.addSql('CREATE INDEX ix__currency_rates_history__provider ON currency_rates_history (provider);');
    this.addSql('CREATE INDEX ix__currency_rates_history__created_at ON currency_rates_history (created_at);');
    this.addSql(`
      CREATE INDEX ix__currency_rates_history__currency_provider
        ON currency_rates_history (currency_id, provider);
    `);

    this.addSql(`
      ALTER TABLE currency_rates_history
        ADD CONSTRAINT fk__currency_rates_history__currency
        FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      COMMENT ON TABLE currency_rates_history IS
      'Historical exchange rates from multiple providers for weighted averaging';
    `);

    // ========================================
    // PART 2: PAYMENT TRANSACTIONS TABLE
    // ========================================

    // 3. Create payment_transactions table
    this.addSql(`
      CREATE TABLE payment_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id varchar(255) NOT NULL,
        type varchar(20) NOT NULL,
        provider varchar(20) NOT NULL,
        provider_transaction_id varchar(255),
        amount decimal(20,8) NOT NULL,
        currency varchar(10) NOT NULL,
        status varchar(20) NOT NULL,
        pay_url text,
        description text,
        fee decimal(20,8),
        metadata jsonb DEFAULT '{}'::jsonb,
        paid_at timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Add check constraints
    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__type_values
        CHECK (type IN ('TOP_UP', 'WITHDRAW'));
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__provider_values
        CHECK (provider IN ('CRYPTO_BOT', 'HELEKET', 'YOOKASSA'));
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__currency_values
        CHECK (currency IN ('USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC', 'RUB', 'USD', 'EUR', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL'));
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__status_values
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'));
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__amount_positive
        CHECK (amount > 0);
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__fee_non_negative
        CHECK (fee IS NULL OR fee >= 0);
    `);

    // Create indexes
    this.addSql('CREATE INDEX idx__payment_transactions__user_id ON payment_transactions (user_id);');
    this.addSql('CREATE INDEX idx__payment_transactions__status ON payment_transactions (status);');
    this.addSql(`
      CREATE UNIQUE INDEX idx__payment_transactions__provider_transaction_id
        ON payment_transactions (provider_transaction_id)
        WHERE provider_transaction_id IS NOT NULL;
    `);
    this.addSql('CREATE INDEX idx__payment_transactions__created_at ON payment_transactions (created_at DESC);');
    this.addSql('CREATE INDEX idx__payment_transactions__user_status ON payment_transactions (user_id, status);');

    this.addSql(`
      CREATE TRIGGER update_payment_transactions_updated_at
        BEFORE UPDATE ON payment_transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ========================================
    // PART 3: PAYMENT PROVIDER SYSTEM
    // ========================================

    // 4. Create payment_provider_configs table
    this.addSql(`
      CREATE TABLE payment_provider_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        provider varchar(50) NOT NULL UNIQUE,
        provider_type varchar(30) NOT NULL DEFAULT 'CRYPTO_NATIVE',
        is_enabled boolean NOT NULL DEFAULT true,
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        priority integer NOT NULL DEFAULT 100,
        reliability_score integer NOT NULL DEFAULT 95,
        supports_deposits boolean NOT NULL DEFAULT true,
        supports_withdrawals boolean NOT NULL DEFAULT true,
        supports_telegram_integration boolean NOT NULL DEFAULT false,
        supports_network_routing boolean NOT NULL DEFAULT false,
        auto_routing_enabled boolean NOT NULL DEFAULT true,
        maintenance_mode boolean NOT NULL DEFAULT false,
        max_concurrent_requests integer,
        rate_limit_per_minute integer,
        features jsonb,
        config jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX idx_payment_provider_configs_provider ON payment_provider_configs(provider);');
    this.addSql('CREATE INDEX idx_payment_provider_configs_enabled ON payment_provider_configs(is_enabled);');
    this.addSql('CREATE INDEX idx_payment_provider_configs_status ON payment_provider_configs(status);');
    this.addSql('CREATE INDEX idx_payment_provider_configs_priority ON payment_provider_configs(priority);');

    this.addSql(`
      CREATE TRIGGER update_payment_provider_configs_updated_at
        BEFORE UPDATE ON payment_provider_configs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    this.addSql(`
      COMMENT ON TABLE payment_provider_configs IS
      'Payment provider configuration and metadata';
    `);

    // 5. Create provider_currency_support table
    this.addSql(`
      CREATE TABLE provider_currency_support (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        provider_id uuid NOT NULL,
        currency_id uuid NOT NULL,
        network varchar(30) NOT NULL DEFAULT 'NATIVE',
        is_enabled boolean NOT NULL DEFAULT true,
        is_preferred boolean NOT NULL DEFAULT false,
        routing_priority integer NOT NULL DEFAULT 100,
        supports_deposits boolean NOT NULL DEFAULT true,
        supports_withdrawals boolean NOT NULL DEFAULT true,
        min_deposit_amount decimal(20,8),
        max_deposit_amount decimal(20,8),
        min_withdrawal_amount decimal(20,8),
        max_withdrawal_amount decimal(20,8),
        deposit_fee_percentage decimal(10,4),
        deposit_fee_fixed decimal(20,8),
        withdrawal_fee_percentage decimal(10,4),
        withdrawal_fee_fixed decimal(20,8),
        network_fee_estimate decimal(20,8),
        avg_confirmation_time_seconds integer,
        reliability_score integer NOT NULL DEFAULT 95,
        config jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(provider_id, currency_id, network)
      );
    `);

    this.addSql('CREATE INDEX idx_provider_currency_support_provider ON provider_currency_support(provider_id);');
    this.addSql('CREATE INDEX idx_provider_currency_support_currency ON provider_currency_support(currency_id);');
    this.addSql('CREATE INDEX idx_provider_currency_support_network ON provider_currency_support(network);');
    this.addSql('CREATE INDEX idx_provider_currency_support_enabled ON provider_currency_support(is_enabled);');
    this.addSql('CREATE INDEX idx_provider_currency_support_preferred ON provider_currency_support(is_preferred);');
    this.addSql('CREATE INDEX idx_provider_currency_support_priority ON provider_currency_support(routing_priority);');

    this.addSql(`
      ALTER TABLE provider_currency_support
        ADD CONSTRAINT fk__provider_currency_support__provider
        FOREIGN KEY (provider_id) REFERENCES payment_provider_configs(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE provider_currency_support
        ADD CONSTRAINT fk__provider_currency_support__currency
        FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      CREATE TRIGGER update_provider_currency_support_updated_at
        BEFORE UPDATE ON provider_currency_support
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    this.addSql(`
      COMMENT ON TABLE provider_currency_support IS
      'Provider-currency support matrix with network routing';
    `);

    this.addSql(`
      COMMENT ON COLUMN provider_currency_support.network IS
      'Blockchain network for the currency (e.g., TRC20, ERC20, BSC)';
    `);

    this.addSql(`
      COMMENT ON COLUMN provider_currency_support.is_preferred IS
      'Preferred network for this provider-currency pair';
    `);

    // 6. Create provider_routing_rules table
    this.addSql(`
      CREATE TABLE provider_routing_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name varchar(255) NOT NULL,
        description text,
        rule_type varchar(30) NOT NULL,
        provider_id uuid,
        currency_id uuid,
        is_enabled boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 100,
        weight integer NOT NULL DEFAULT 1,
        allowed_countries varchar(2)[],
        blocked_countries varchar(2)[],
        allowed_platforms varchar(50)[],
        min_amount_usd decimal(20,8),
        max_amount_usd decimal(20,8),
        verified_users_only boolean NOT NULL DEFAULT false,
        vip_users_only boolean NOT NULL DEFAULT false,
        active_days_of_week integer[],
        active_hours_start time,
        active_hours_end time,
        active_from timestamptz,
        active_until timestamptz,
        fallback_rule_id uuid,
        usage_count integer NOT NULL DEFAULT 0,
        success_count integer NOT NULL DEFAULT 0,
        failure_count integer NOT NULL DEFAULT 0,
        last_used_at timestamptz,
        config jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX idx_provider_routing_rules_rule_type ON provider_routing_rules(rule_type);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_provider ON provider_routing_rules(provider_id);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_currency ON provider_routing_rules(currency_id);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_enabled ON provider_routing_rules(is_enabled);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_priority ON provider_routing_rules(priority);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_active_from ON provider_routing_rules(active_from);');
    this.addSql('CREATE INDEX idx_provider_routing_rules_active_until ON provider_routing_rules(active_until);');

    this.addSql(`
      ALTER TABLE provider_routing_rules
        ADD CONSTRAINT fk__provider_routing_rules__provider
        FOREIGN KEY (provider_id) REFERENCES payment_provider_configs(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE provider_routing_rules
        ADD CONSTRAINT fk__provider_routing_rules__currency
        FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE provider_routing_rules
        ADD CONSTRAINT fk__provider_routing_rules__fallback_rule
        FOREIGN KEY (fallback_rule_id) REFERENCES provider_routing_rules(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      CREATE TRIGGER update_provider_routing_rules_updated_at
        BEFORE UPDATE ON provider_routing_rules
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    this.addSql(`
      COMMENT ON TABLE provider_routing_rules IS
      'Dynamic routing rules for intelligent provider selection';
    `);

    this.addSql(`
      COMMENT ON COLUMN provider_routing_rules.weight IS
      'Weight for load balancing (higher = more traffic)';
    `);

    this.addSql(`
      COMMENT ON COLUMN provider_routing_rules.active_days_of_week IS
      'Days of week (0=Sunday, 6=Saturday) when rule is active';
    `);

    // ========================================
    // PART 4: UPDATE USER_BALANCES WITH CURRENCY_ID
    // ========================================

    // 7. Add currency_id to user_balances (will be populated by data migration)
    this.addSql(`
      ALTER TABLE user_balances
        ADD COLUMN currency_id uuid;
    `);

    this.addSql('CREATE INDEX ix__user_balances__currency_id ON user_balances (currency_id);');

    this.addSql(`
      COMMENT ON COLUMN user_balances.currency IS
      'DEPRECATED: Use currency_id instead. Kept for backwards compatibility.';
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop triggers
    this.addSql('DROP TRIGGER IF EXISTS update_provider_routing_rules_updated_at ON provider_routing_rules;');
    this.addSql('DROP TRIGGER IF EXISTS update_provider_currency_support_updated_at ON provider_currency_support;');
    this.addSql('DROP TRIGGER IF EXISTS update_payment_provider_configs_updated_at ON payment_provider_configs;');
    this.addSql('DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;');

    // Remove currency_id from user_balances
    this.addSql('DROP INDEX IF EXISTS ix__user_balances__currency_id;');
    this.addSql('ALTER TABLE user_balances DROP COLUMN IF EXISTS currency_id;');

    // Drop tables in reverse order
    this.addSql('DROP TABLE IF EXISTS provider_routing_rules CASCADE;');
    this.addSql('DROP TABLE IF EXISTS provider_currency_support CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_provider_configs CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_transactions CASCADE;');
    this.addSql('DROP TABLE IF EXISTS currency_rates_history CASCADE;');
    this.addSql('DROP TABLE IF EXISTS currencies CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}

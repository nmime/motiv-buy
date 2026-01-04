import { Migration } from '@mikro-orm/migrations';

/**
 * Payment System Migration
 *
 * Creates comprehensive payment processing system with all constraints, indexes, and foreign keys:
 * - currencies: Supported fiat and cryptocurrencies
 * - currency_rates_history: Historical exchange rates
 * - payment_transactions: Payment records
 * - payment_providers: Payment provider configuration
 * - provider_currencies: Provider-currency-network matrix
 * - provider_routings: Dynamic routing rules
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
      CREATE TABLE IF NOT EXISTS currencies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        code varchar(10) NOT NULL UNIQUE,
        name varchar(50) NOT NULL,
        symbol varchar(10),
        type varchar(10) NOT NULL,
        rate_to_usd decimal(20, 8) NOT NULL DEFAULT '1.0',
        is_active boolean NOT NULL DEFAULT true,
        decimal_places integer NOT NULL DEFAULT 2,
        rate_updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS ix__currencies__code ON currencies (code);');
    this.addSql('CREATE INDEX IF NOT EXISTS ix__currencies__type ON currencies (type);');
    this.addSql('CREATE INDEX IF NOT EXISTS ix__currencies__is_active ON currencies (is_active);');

    // 2. Create currency_rates_history table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS currency_rates_history (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        currency_id uuid NOT NULL,
        provider varchar(30) NOT NULL,
        rate_to_usd decimal(20, 8) NOT NULL,
        reliability_score integer NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__currency_rates_history__currency
          FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE
      );
    `);

    this.addSql(
      'CREATE INDEX IF NOT EXISTS ix__currency_rates_history__currency_id ON currency_rates_history (currency_id);',
    );

    this.addSql(
      'CREATE INDEX IF NOT EXISTS ix__currency_rates_history__provider ON currency_rates_history (provider);',
    );

    this.addSql(
      'CREATE INDEX IF NOT EXISTS ix__currency_rates_history__created_at ON currency_rates_history (created_at);',
    );

    this.addSql(`
      CREATE INDEX IF NOT EXISTS ix__currency_rates_history__currency_provider
        ON currency_rates_history (currency_id, provider);
    `);

    // ========================================
    // PART 2: PAYMENT TRANSACTIONS TABLE
    // ========================================

    // 3. Create payment_transactions table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id varchar(255) NOT NULL,
        type varchar(20) NOT NULL,
        provider varchar(20) NOT NULL,
        provider_transaction_id varchar(255),
        amount decimal(20,8) NOT NULL CHECK (amount > 0),
        currency varchar(10) NOT NULL,
        status varchar(20) NOT NULL,
        pay_url text,
        description text,
        fee decimal(20,8) CHECK (fee IS NULL OR fee >= 0),
        metadata jsonb DEFAULT '{}'::jsonb,
        paid_at timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx__payment_transactions__user_id ON payment_transactions (user_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx__payment_transactions__status ON payment_transactions (status);');
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx__payment_transactions__provider_transaction_id
        ON payment_transactions (provider_transaction_id)
        WHERE provider_transaction_id IS NOT NULL;
    `);

    this.addSql(
      'CREATE INDEX IF NOT EXISTS idx__payment_transactions__created_at ON payment_transactions (created_at DESC);',
    );

    this.addSql(
      'CREATE INDEX IF NOT EXISTS idx__payment_transactions__user_status ON payment_transactions (user_id, status);',
    );

    this.addSql(`
      CREATE TRIGGER update_payment_transactions_updated_at
        BEFORE UPDATE ON payment_transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ========================================
    // PART 3: PAYMENT PROVIDER SYSTEM
    // ========================================

    // 4. Create payment_providers table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS payment_providers (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
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

    this.addSql('CREATE INDEX IF NOT EXISTS idx_payment_providers_provider ON payment_providers(provider);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_payment_providers_enabled ON payment_providers(is_enabled);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_payment_providers_status ON payment_providers(status);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_payment_providers_priority ON payment_providers(priority);');

    this.addSql(`
      CREATE TRIGGER update_payment_providers_updated_at
        BEFORE UPDATE ON payment_providers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 5. Create provider_currencies table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS provider_currencies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
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
        UNIQUE(provider_id, currency_id, network),
        CONSTRAINT fk__provider_currencies__provider
          FOREIGN KEY (provider_id) REFERENCES payment_providers(id) ON DELETE CASCADE,
        CONSTRAINT fk__provider_currencies__currency
          FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_currencies_provider ON provider_currencies(provider_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_currencies_currency ON provider_currencies(currency_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_currencies_network ON provider_currencies(network);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_currencies_enabled ON provider_currencies(is_enabled);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_currencies_preferred ON provider_currencies(is_preferred);');
    this.addSql(
      'CREATE INDEX IF NOT EXISTS idx_provider_currencies_priority ON provider_currencies(routing_priority);',
    );

    this.addSql(`
      CREATE TRIGGER update_provider_currencies_updated_at
        BEFORE UPDATE ON provider_currencies
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 6. Create provider_routings table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS provider_routings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__provider_routings__provider
          FOREIGN KEY (provider_id) REFERENCES payment_providers(id) ON DELETE SET NULL,
        CONSTRAINT fk__provider_routings__currency
          FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE SET NULL,
        CONSTRAINT fk__provider_routings__fallback_rule
          FOREIGN KEY (fallback_rule_id) REFERENCES provider_routings(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_rule_type ON provider_routings(rule_type);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_provider ON provider_routings(provider_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_currency ON provider_routings(currency_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_enabled ON provider_routings(is_enabled);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_priority ON provider_routings(priority);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_active_from ON provider_routings(active_from);');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_provider_routings_active_until ON provider_routings(active_until);');

    this.addSql(`
      CREATE TRIGGER update_provider_routings_updated_at
        BEFORE UPDATE ON provider_routings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ========================================
    // PART 4: UPDATE USER_BALANCES WITH CURRENCY_ID
    // ========================================

    // 7. Add currency_id to user_balances (will be populated by data migration)
    this.addSql(`
      ALTER TABLE user_balances
        ADD COLUMN currency_id uuid;
    `);

    this.addSql('CREATE INDEX IF NOT EXISTS ix__user_balances__currency_id ON user_balances (currency_id);');

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Remove currency_id from user_balances
    this.addSql('ALTER TABLE user_balances DROP COLUMN IF EXISTS currency_id CASCADE;');

    // Drop tables in reverse order (CASCADE handles all dependencies)
    this.addSql('DROP TABLE IF EXISTS provider_routings CASCADE;');
    this.addSql('DROP TABLE IF EXISTS provider_currencies CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_providers CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_transactions CASCADE;');
    this.addSql('DROP TABLE IF EXISTS currency_rates_history CASCADE;');
    this.addSql('DROP TABLE IF EXISTS currencies CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}

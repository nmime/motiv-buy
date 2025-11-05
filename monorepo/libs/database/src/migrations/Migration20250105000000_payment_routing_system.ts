import { Migration } from '@mikro-orm/migrations';

/**
 * Comprehensive payment routing system migration
 * Creates tables and seeds initial data for dynamic provider routing
 */
export class Migration20250105000000_payment_routing_system extends Migration {
  async up(): Promise<void> {
    // ========================================
    // PART 1: CREATE TABLES
    // ========================================

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

    // ========================================
    // PART 2: SEED PROVIDER CONFIGURATIONS
    // ========================================

    this.addSql(`
      INSERT INTO payment_provider_configs (
        provider, provider_type, is_enabled, status, priority, reliability_score,
        supports_deposits, supports_withdrawals, supports_telegram_integration,
        supports_network_routing, auto_routing_enabled, maintenance_mode,
        max_concurrent_requests, rate_limit_per_minute, features, config
      ) VALUES
      -- CryptoBot: Primary provider, Telegram integration, highest priority
      (
        'CRYPTO_BOT', 'CRYPTO_NATIVE', true, 'ACTIVE', 10, 98,
        true, true, true, false, true, false, 100, 60,
        '{"webhooks": true, "polling": true, "invoiceExpiration": true, "transferTracking": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/crypto-bot", "signatureVerification": "hmac-sha256"}'::jsonb
      ),
      -- Heleket: Multi-network support, lowest fees via Tron
      (
        'HELEKET', 'CRYPTO_NATIVE', true, 'ACTIVE', 20, 95,
        true, true, false, true, true, false, 50, 30,
        '{"webhooks": true, "polling": true, "networkSelection": true, "lowFees": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/heleket", "signatureVerification": "hmac-sha256", "preferredNetwork": "tron"}'::jsonb
      ),
      -- YooKassa: Fiat gateway for Russian market
      (
        'YOOKASSA', 'FIAT_GATEWAY', true, 'ACTIVE', 30, 97,
        true, true, false, false, true, false, 50, 30,
        '{"webhooks": true, "polling": true, "fiatToRub": true, "bankCards": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/yookassa", "signatureVerification": "ip-whitelist", "allowedIps": ["185.71.76.0/27", "185.71.77.0/27"]}'::jsonb
      );
    `);

    // ========================================
    // PART 3: SEED CURRENCY SUPPORT
    // ========================================

    this.addSql(`
      -- CryptoBot: Supports all crypto currencies with default networks
      INSERT INTO provider_currency_support (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        CASE c.code
          WHEN 'USDT' THEN 'ETHEREUM'  -- CryptoBot prefers ERC-20
          WHEN 'TON' THEN 'TON'
          WHEN 'BTC' THEN 'BITCOIN'
          WHEN 'ETH' THEN 'ETHEREUM'
          WHEN 'BNB' THEN 'BSC'
          WHEN 'TRX' THEN 'TRON'
          WHEN 'USDC' THEN 'ETHEREUM'
          WHEN 'LTC' THEN 'LITECOIN'
          WHEN 'DOGE' THEN 'DOGECOIN'
          WHEN 'DAI' THEN 'ETHEREUM'
          WHEN 'DASH' THEN 'DASH'
          WHEN 'BCH' THEN 'BITCOIN_CASH'
          WHEN 'SOL' THEN 'SOLANA'
        END,
        true, true, 10,
        true, true, 1.0, 1.0,
        CASE c.code
          WHEN 'USDT' THEN 15.0  -- ERC-20 fees
          WHEN 'ETH' THEN 10.0
          ELSE NULL
        END,
        95
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'CRYPTO_BOT'
        AND c.code IN ('USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL');
    `);

    this.addSql(`
      -- CryptoBot: Also support USDT on Tron (secondary option)
      INSERT INTO provider_currency_support (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        'TRON',
        true, false, 20,  -- Not preferred, lower priority
        true, true, 1.0, 1.0,
        3.0,  -- TRC-20 fees on CryptoBot
        95
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'CRYPTO_BOT'
        AND c.code = 'USDT';
    `);

    this.addSql(`
      -- Heleket: USDT on multiple networks (TRC-20 preferred for lowest fees)
      INSERT INTO provider_currency_support (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        network_type,
        true,
        CASE network_type WHEN 'TRON' THEN true ELSE false END,  -- TRC-20 preferred
        CASE network_type
          WHEN 'TRON' THEN 5       -- Highest priority (lowest fees)
          WHEN 'BSC' THEN 10
          WHEN 'ETHEREUM' THEN 15  -- Lowest priority (highest fees)
        END,
        true, true, 1.0, 1.0,
        CASE network_type
          WHEN 'TRON' THEN 1.0      -- ~$1 fee
          WHEN 'BSC' THEN 0.5       -- ~$0.50 fee
          WHEN 'ETHEREUM' THEN 15.0 -- ~$15 fee
        END,
        95
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      CROSS JOIN (VALUES ('TRON'), ('BSC'), ('ETHEREUM')) AS networks(network_type)
      WHERE ppc.provider = 'HELEKET'
        AND c.code = 'USDT';
    `);

    this.addSql(`
      -- YooKassa: RUB only
      INSERT INTO provider_currency_support (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        'NATIVE',
        true, true, 10,
        true, true, 100.0, 100.0,  -- Min 100 RUB
        95
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'YOOKASSA'
        AND c.code = 'RUB';
    `);

    // ========================================
    // PART 4: SEED ROUTING RULES
    // ========================================

    this.addSql(`
      -- Rule 1: Telegram users always use CryptoBot (highest priority)
      INSERT INTO provider_routing_rules (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight, allowed_platforms
      )
      SELECT
        'Telegram Users to CryptoBot',
        'Route Telegram users to CryptoBot for seamless integration',
        'REGION_BASED',
        ppc.id,
        NULL,  -- Applies to all currencies
        true, 5, 1, ARRAY['telegram']
      FROM payment_provider_configs ppc
      WHERE ppc.provider = 'CRYPTO_BOT';
    `);

    this.addSql(`
      -- Rule 2: USDT cost optimization - Heleket TRC-20 (50-70% fee savings)
      INSERT INTO provider_routing_rules (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight
      )
      SELECT
        'USDT Cost Optimization',
        'Route USDT to Heleket for lowest network fees (TRC-20: ~$1 vs ERC-20: ~$15)',
        'COST_OPTIMIZATION',
        ppc.id,
        c.id,
        true, 10, 1
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'HELEKET'
        AND c.code = 'USDT';
    `);

    this.addSql(`
      -- Rule 3: Russian users to YooKassa for RUB
      INSERT INTO provider_routing_rules (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight, allowed_countries
      )
      SELECT
        'Russian Users to YooKassa',
        'Route Russian users to YooKassa for RUB payments with bank cards',
        'REGION_BASED',
        ppc.id,
        c.id,
        true, 15, 1, ARRAY['RU', 'BY', 'KZ']
      FROM payment_provider_configs ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'YOOKASSA'
        AND c.code = 'RUB';
    `);

    this.addSql(`
      -- Rule 4: Default fallback - CryptoBot for all other cases
      INSERT INTO provider_routing_rules (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight
      )
      SELECT
        'Default Provider',
        'Default fallback to CryptoBot for all other cases',
        'DEFAULT',
        ppc.id,
        NULL,  -- Applies to all currencies
        true, 1000, 1  -- Lowest priority (highest number)
      FROM payment_provider_configs ppc
      WHERE ppc.provider = 'CRYPTO_BOT';
    `);
  }

  async down(): Promise<void> {
    // Drop tables in reverse order due to foreign key constraints
    this.addSql('DROP TABLE IF EXISTS provider_routing_rules CASCADE;');
    this.addSql('DROP TABLE IF EXISTS provider_currency_support CASCADE;');
    this.addSql('DROP TABLE IF EXISTS payment_provider_configs CASCADE;');
  }
}

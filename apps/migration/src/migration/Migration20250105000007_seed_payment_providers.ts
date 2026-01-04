import { Migration } from '@mikro-orm/migrations';

/**
 * Seed Payment Providers Data Migration
 *
 * Seeds initial payment provider configurations:
 * - CryptoBot: Telegram-integrated crypto payments (primary provider)
 * - Heleket: Multi-network crypto with low fees via Tron
 * - YooKassa: Fiat gateway for Russian market
 *
 * Also seeds:
 * - Provider currency support configurations
 * - Routing rules for intelligent provider selection
 */
export class Migration20250105000007SeedPaymentProviders extends Migration {
  async up(): Promise<void> {
    // ========================================
    // PART 1: SEED PROVIDER CONFIGURATIONS
    // ========================================

    this.addSql(`
      INSERT INTO payment_providers (
        provider, provider_type, is_enabled, status, priority, reliability_score,
        supports_deposits, supports_withdrawals, supports_telegram_integration,
        supports_network_routing, auto_routing_enabled, maintenance_mode,
        max_concurrent_requests, rate_limit_per_minute, features, config
      ) VALUES
      -- CryptoBot: Primary provider, Telegram integration, highest priority
      (
        'crypto_bot', 'crypto_native', true, 'active', 10, 98,
        true, true, true, false, true, false, 100, 60,
        '{"webhooks": true, "polling": true, "invoiceExpiration": true, "transferTracking": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/crypto-bot", "signatureVerification": "hmac-sha256"}'::jsonb
      ),
      -- Heleket: Multi-network support, lowest fees via Tron
      (
        'heleket', 'crypto_native', true, 'active', 20, 95,
        true, true, false, true, true, false, 50, 30,
        '{"webhooks": true, "polling": true, "networkSelection": true, "lowFees": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/heleket", "signatureVerification": "hmac-sha256", "preferredNetwork": "tron"}'::jsonb
      ),
      -- YooKassa: Fiat gateway for Russian market
      (
        'yookassa', 'fiat_gateway', true, 'active', 30, 97,
        true, true, false, false, true, false, 50, 30,
        '{"webhooks": true, "polling": true, "fiatToRub": true, "bankCards": true}'::jsonb,
        '{"webhookUrl": "/api/payment/webhook/yookassa", "signatureVerification": "ip-whitelist", "allowedIps": ["185.71.76.0/27", "185.71.77.0/27"]}'::jsonb
      )
      ON CONFLICT (provider) DO NOTHING;
    `);

    // ========================================
    // PART 2: SEED CURRENCY SUPPORT
    // ========================================

    // CryptoBot: Supports all major crypto currencies with default networks
    this.addSql(`
      INSERT INTO provider_currencies (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        CASE c.code
          WHEN 'USDT' THEN 'ethereum'  -- CryptoBot prefers ERC-20
          WHEN 'TON' THEN 'ton'
          WHEN 'BTC' THEN 'bitcoin'
          WHEN 'ETH' THEN 'ethereum'
          WHEN 'BNB' THEN 'bsc'
          WHEN 'TRX' THEN 'tron'
          WHEN 'USDC' THEN 'ethereum'
          WHEN 'LTC' THEN 'litecoin'
          WHEN 'DOGE' THEN 'dogecoin'
          WHEN 'DAI' THEN 'ethereum'
          WHEN 'DASH' THEN 'dash'
          WHEN 'BCH' THEN 'bitcoin_cash'
          WHEN 'SOL' THEN 'solana'
        END,
        true, true, 10,
        true, true, 1.0, 1.0,
        CASE c.code
          WHEN 'USDT' THEN 15.0  -- ERC-20 fees
          WHEN 'ETH' THEN 10.0
          ELSE NULL
        END,
        95
      FROM payment_providers ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'crypto_bot'
        AND c.code IN ('USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL')
      ON CONFLICT (provider_id, currency_id, network) DO NOTHING;
    `);

    // CryptoBot: Also support USDT on Tron (secondary option)
    this.addSql(`
      INSERT INTO provider_currencies (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        'tron',
        true, false, 20,  -- Not preferred, lower priority
        true, true, 1.0, 1.0,
        3.0,  -- TRC-20 fees on CryptoBot
        95
      FROM payment_providers ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'crypto_bot'
        AND c.code = 'USDT'
      ON CONFLICT (provider_id, currency_id, network) DO NOTHING;
    `);

    // Heleket: USDT on multiple networks (TRC-20 preferred for lowest fees)
    this.addSql(`
      INSERT INTO provider_currencies (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        network_fee_estimate, reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        network_type,
        true,
        CASE network_type WHEN 'tron' THEN true ELSE false END,  -- TRC-20 preferred
        CASE network_type
          WHEN 'tron' THEN 5       -- Highest priority (lowest fees)
          WHEN 'bsc' THEN 10
          WHEN 'ethereum' THEN 15  -- Lowest priority (highest fees)
        END,
        true, true, 1.0, 1.0,
        CASE network_type
          WHEN 'tron' THEN 1.0      -- ~$1 fee
          WHEN 'bsc' THEN 0.5       -- ~$0.50 fee
          WHEN 'ethereum' THEN 15.0 -- ~$15 fee
        END,
        95
      FROM payment_providers ppc
      CROSS JOIN currencies c
      CROSS JOIN (VALUES ('tron'), ('bsc'), ('ethereum')) AS networks(network_type)
      WHERE ppc.provider = 'heleket'
        AND c.code = 'USDT'
      ON CONFLICT (provider_id, currency_id, network) DO NOTHING;
    `);

    // YooKassa: RUB only
    this.addSql(`
      INSERT INTO provider_currencies (
        provider_id, currency_id, network, is_enabled, is_preferred, routing_priority,
        supports_deposits, supports_withdrawals, min_deposit_amount, min_withdrawal_amount,
        reliability_score
      )
      SELECT
        ppc.id,
        c.id,
        'native',
        true, true, 10,
        true, true, 100.0, 100.0,  -- Min 100 RUB
        95
      FROM payment_providers ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'yookassa'
        AND c.code = 'RUB'
      ON CONFLICT (provider_id, currency_id, network) DO NOTHING;
    `);

    // ========================================
    // PART 3: SEED ROUTING RULES
    // ========================================

    // Rule 1: Telegram users always use CryptoBot (highest priority)
    this.addSql(`
      INSERT INTO provider_routings (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight, allowed_platforms
      )
      SELECT
        'Telegram Users to CryptoBot',
        'Route Telegram users to CryptoBot for seamless integration',
        'region_based',
        ppc.id,
        NULL,  -- Applies to all currencies
        true, 5, 1, ARRAY['telegram']
      FROM payment_providers ppc
      WHERE ppc.provider = 'crypto_bot';
    `);

    // Rule 2: USDT cost optimization - Heleket TRC-20 (50-70% fee savings)
    this.addSql(`
      INSERT INTO provider_routings (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight
      )
      SELECT
        'USDT Cost Optimization',
        'Route USDT to Heleket for lowest network fees (TRC-20: ~$1 vs ERC-20: ~$15)',
        'cost_optimization',
        ppc.id,
        c.id,
        true, 10, 1
      FROM payment_providers ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'heleket'
        AND c.code = 'USDT';
    `);

    // Rule 3: Russian users to YooKassa for RUB
    this.addSql(`
      INSERT INTO provider_routings (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight, allowed_countries
      )
      SELECT
        'Russian Users to YooKassa',
        'Route Russian users to YooKassa for RUB payments with bank cards',
        'region_based',
        ppc.id,
        c.id,
        true, 15, 1, ARRAY['RU', 'BY', 'KZ']
      FROM payment_providers ppc
      CROSS JOIN currencies c
      WHERE ppc.provider = 'yookassa'
        AND c.code = 'RUB';
    `);

    // Rule 4: Default fallback - CryptoBot for all other cases
    this.addSql(`
      INSERT INTO provider_routings (
        name, description, rule_type, provider_id, currency_id, is_enabled,
        priority, weight
      )
      SELECT
        'Default Provider',
        'Default fallback to CryptoBot for all other cases',
        'default',
        ppc.id,
        NULL,  -- Applies to all currencies
        true, 1000, 1  -- Lowest priority (highest number)
      FROM payment_providers ppc
      WHERE ppc.provider = 'crypto_bot';
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Delete seeded routing rules
    this.addSql(`
      DELETE FROM provider_routings
      WHERE name IN (
        'Telegram Users to CryptoBot',
        'USDT Cost Optimization',
        'Russian Users to YooKassa',
        'Default Provider'
      );
    `);

    // Delete seeded currency support
    this.addSql(`
      DELETE FROM provider_currencies
      WHERE provider_id IN (
        SELECT id FROM payment_providers
        WHERE provider IN ('crypto_bot', 'heleket', 'yookassa')
      );
    `);

    // Delete seeded provider configurations
    this.addSql(`
      DELETE FROM payment_providers
      WHERE provider IN ('crypto_bot', 'heleket', 'yookassa');
    `);

    // Ensure async compliance
    await Promise.resolve();
  }
}

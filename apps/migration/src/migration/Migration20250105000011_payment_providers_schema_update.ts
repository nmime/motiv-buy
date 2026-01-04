import { Migration } from '@mikro-orm/migrations';

/**
 * Payment Providers Schema Update
 *
 * Adds missing columns to payment_providers table to match the PaymentProviderEntity.
 * This migration brings the database schema in sync with the entity definition.
 */
export class Migration20250105000011PaymentProvidersSchemaUpdate extends Migration {
  async up(): Promise<void> {
    // Add missing columns to payment_providers table
    this.addSql(`
      ALTER TABLE payment_providers
        ADD COLUMN IF NOT EXISTS display_name varchar(100),
        ADD COLUMN IF NOT EXISTS supports_balance_check boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS update_strategy varchar(20) NOT NULL DEFAULT 'hybrid',
        ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS webhook_verification_method varchar(20),
        ADD COLUMN IF NOT EXISTS polling_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS polling_interval_ms integer NOT NULL DEFAULT 30000,
        ADD COLUMN IF NOT EXISTS api_url varchar(255),
        ADD COLUMN IF NOT EXISTS api_timeout_ms integer NOT NULL DEFAULT 10000,
        ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS base_fee_percentage decimal(10, 4) NOT NULL DEFAULT '0.0000',
        ADD COLUMN IF NOT EXISTS fixed_fee_usd decimal(20, 8) NOT NULL DEFAULT '0.00000000',
        ADD COLUMN IF NOT EXISTS supports_fiat_conversion boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS supports_bank_cards boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS min_deposit_usd decimal(20, 8),
        ADD COLUMN IF NOT EXISTS max_deposit_usd decimal(20, 8),
        ADD COLUMN IF NOT EXISTS min_withdrawal_usd decimal(20, 8),
        ADD COLUMN IF NOT EXISTS max_withdrawal_usd decimal(20, 8),
        ADD COLUMN IF NOT EXISTS metadata jsonb;
    `);

    // Set display_name for existing providers based on provider column
    this.addSql(`
      UPDATE payment_providers
      SET display_name = CASE
        WHEN provider = 'crypto_bot' THEN 'CryptoBot'
        WHEN provider = 'heleket' THEN 'Heleket'
        WHEN provider = 'payonboard' THEN 'PayOnboard'
        ELSE INITCAP(REPLACE(provider, '_', ' '))
      END
      WHERE display_name IS NULL;
    `);

    // Make display_name NOT NULL after populating
    this.addSql(`
      ALTER TABLE payment_providers
        ALTER COLUMN display_name SET NOT NULL;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE payment_providers
        DROP COLUMN IF EXISTS display_name,
        DROP COLUMN IF EXISTS supports_balance_check,
        DROP COLUMN IF EXISTS update_strategy,
        DROP COLUMN IF EXISTS webhook_enabled,
        DROP COLUMN IF EXISTS webhook_verification_method,
        DROP COLUMN IF EXISTS polling_enabled,
        DROP COLUMN IF EXISTS polling_interval_ms,
        DROP COLUMN IF EXISTS api_url,
        DROP COLUMN IF EXISTS api_timeout_ms,
        DROP COLUMN IF EXISTS max_retries,
        DROP COLUMN IF EXISTS base_fee_percentage,
        DROP COLUMN IF EXISTS fixed_fee_usd,
        DROP COLUMN IF EXISTS supports_fiat_conversion,
        DROP COLUMN IF EXISTS supports_bank_cards,
        DROP COLUMN IF EXISTS min_deposit_usd,
        DROP COLUMN IF EXISTS max_deposit_usd,
        DROP COLUMN IF EXISTS min_withdrawal_usd,
        DROP COLUMN IF EXISTS max_withdrawal_usd,
        DROP COLUMN IF EXISTS metadata;
    `);

    await Promise.resolve();
  }
}

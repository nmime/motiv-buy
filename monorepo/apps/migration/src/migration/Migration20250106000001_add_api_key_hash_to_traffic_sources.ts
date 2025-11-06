import { Migration } from '@mikro-orm/migrations';

/**
 * Add API Key Hash to Traffic Sources
 *
 * Adds secure API key hashing to traffic_sources table:
 * - api_key_hash: Bcrypt-hashed API key for secure authentication
 * - Index on api_key_hash for fast lookups
 *
 * Security: API keys are hashed using bcrypt (10 rounds)
 * Never stores plain text API keys in database
 */
export class Migration20250106000001AddApiKeyHashToTrafficSources extends Migration {
  async up(): Promise<void> {
    // Add api_key_hash column to traffic_sources
    this.addSql(`
      ALTER TABLE traffic_sources
      ADD COLUMN api_key_hash text;
    `);

    // Create index for fast API key lookup
    this.addSql(`
      CREATE INDEX ix__traffic_sources__api_key_hash
      ON traffic_sources (api_key_hash);
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_sources.api_key_hash IS
      'Bcrypt-hashed API key for secure authentication. Never stores plain text.';
    `);
  }

  async down(): Promise<void> {
    // Drop index first
    this.addSql('DROP INDEX IF EXISTS ix__traffic_sources__api_key_hash;');

    // Drop column
    this.addSql(`
      ALTER TABLE traffic_sources
      DROP COLUMN IF EXISTS api_key_hash;
    `);
  }
}

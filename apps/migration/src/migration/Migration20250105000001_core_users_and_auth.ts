import { Migration } from '@mikro-orm/migrations';

/**
 * Core Users and Authentication Migration
 *
 * Creates foundational user tables with all constraints, indexes, and foreign keys:
 * - users: Main user accounts with Telegram integration
 * - user_settings: User preferences and configuration
 * - user_last_auth: Authentication tracking
 * - user_ref_links: Referral link system
 * - user_source_visits: Traffic source tracking
 */
export class Migration20250105000001CoreUsersAndAuth extends Migration {
  async up(): Promise<void> {
    // 1. Create update timestamp trigger function (needed by all tables)
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // 2. Create users table
    this.addSql(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        telegram_id bigint UNIQUE NOT NULL,
        username varchar(32),
        first_name varchar(64) NOT NULL,
        last_name varchar(64),
        status varchar(20) NOT NULL DEFAULT 'active',
        role varchar(20) NOT NULL DEFAULT 'user',
        language_code varchar(10),
        referred_by uuid,
        referral_count integer NOT NULL DEFAULT 0,
        ref_link_level_1 uuid,
        ref_link_level_2 uuid,
        ref_link_level_3 uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_active_at timestamptz
      );
    `);

    // Create indexes for users table
    this.addSql('CREATE INDEX ix__users__telegram_id ON users (telegram_id);');
    this.addSql('CREATE INDEX ix__users__username ON users (username);');
    this.addSql('CREATE INDEX ix__users__referred_by ON users (referred_by);');
    this.addSql('CREATE INDEX ix__users__status ON users (status);');
    this.addSql('CREATE INDEX ix__users__created_at ON users (created_at);');

    // Add self-referencing foreign keys to users (must be added after table creation)
    this.addSql(`
      ALTER TABLE users
        ADD CONSTRAINT fk__users__referred_by FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk__users__ref_link_level_1 FOREIGN KEY (ref_link_level_1) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk__users__ref_link_level_2 FOREIGN KEY (ref_link_level_2) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk__users__ref_link_level_3 FOREIGN KEY (ref_link_level_3) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Create trigger for users
    this.addSql(`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 3. Create user_settings table with foreign key
    this.addSql(`
      CREATE TABLE user_settings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid UNIQUE NOT NULL,
        notifications_enabled boolean NOT NULL DEFAULT true,
        language varchar(10) NOT NULL DEFAULT 'en',
        timezone varchar(32) NOT NULL DEFAULT 'UTC',
        theme varchar(10) NOT NULL DEFAULT 'light',
        privacy_level varchar(20) NOT NULL DEFAULT 'normal',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_settings__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__user_settings__user_id ON user_settings (user_id);');

    this.addSql(`
      CREATE TRIGGER update_user_settings_updated_at
        BEFORE UPDATE ON user_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 4. Create user_last_auth table with foreign key
    this.addSql(`
      CREATE TABLE user_last_auth (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid UNIQUE NOT NULL,
        ip_address inet,
        user_agent text,
        session_token varchar(255),
        last_login_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_last_auth__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__user_last_auth__user_id ON user_last_auth (user_id);');
    this.addSql('CREATE INDEX ix__user_last_auth__last_login_at ON user_last_auth (last_login_at);');

    this.addSql(`
      CREATE TRIGGER update_user_last_auth_updated_at
        BEFORE UPDATE ON user_last_auth
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 5. Create user_ref_links table with foreign key
    this.addSql(`
      CREATE TABLE user_ref_links (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL,
        ref_code varchar(32) UNIQUE NOT NULL,
        clicks integer NOT NULL DEFAULT 0,
        conversions integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_ref_links__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__user_ref_links__user_id ON user_ref_links (user_id);');
    this.addSql('CREATE INDEX ix__user_ref_links__ref_code ON user_ref_links (ref_code);');
    this.addSql('CREATE INDEX ix__user_ref_links__is_active ON user_ref_links (is_active);');

    this.addSql(`
      CREATE TRIGGER update_user_ref_links_updated_at
        BEFORE UPDATE ON user_ref_links
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 6. Create user_source_visits table with foreign key
    this.addSql(`
      CREATE TABLE user_source_visits (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL,
        link_user_id uuid,
        platform_type varchar(20) NOT NULL,
        platform_data json,
        params text,
        utm_source varchar(255),
        utm_medium varchar(255),
        utm_campaign varchar(255),
        utm_content varchar(255),
        link_type varchar(255),
        link_code varchar(255),
        language varchar(10),
        telegram_language varchar(10),
        continent varchar(64),
        country varchar(64),
        city varchar(128),
        ip inet,
        is_signup boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_source_visits__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_source_visits__link_user_id FOREIGN KEY (link_user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__user_source_visits__user_id ON user_source_visits (user_id);');
    this.addSql('CREATE INDEX ix__user_source_visits__created_at ON user_source_visits (created_at);');
    this.addSql('CREATE INDEX ix__user_source_visits__utm_source ON user_source_visits (utm_source);');
    this.addSql('CREATE INDEX ix__user_source_visits__utm_medium ON user_source_visits (utm_medium);');
    this.addSql('CREATE INDEX ix__user_source_visits__utm_campaign ON user_source_visits (utm_campaign);');
    this.addSql('CREATE INDEX ix__user_source_visits__platform_type ON user_source_visits (platform_type);');

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop tables in reverse order (CASCADE will drop constraints and triggers)
    this.addSql('DROP TABLE IF EXISTS user_source_visits CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_ref_links CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_last_auth CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_settings CASCADE;');
    this.addSql('DROP TABLE IF EXISTS users CASCADE;');

    // Drop function
    this.addSql('DROP FUNCTION IF EXISTS update_updated_at_column();');

    // Ensure async compliance
    await Promise.resolve();
  }
}

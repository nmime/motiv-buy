import { Migration } from '@mikro-orm/migrations';

/**
 * Core Users and Authentication Migration
 *
 * Creates foundational user tables:
 * - users: Main user accounts with Telegram integration
 * - user_settings: User preferences and configuration
 * - user_last_auth: Authentication tracking
 * - user_ref_links: Referral link system
 * - user_source_visits: Traffic source tracking
 */
export class Migration20250105000001CoreUsersAndAuth extends Migration {
  async up(): Promise<void> {
    // 1. Create users table
    this.addSql(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
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

    // 2. Create user_settings table
    this.addSql(`
      CREATE TABLE user_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid UNIQUE NOT NULL,
        notifications_enabled boolean NOT NULL DEFAULT true,
        language varchar(10) NOT NULL DEFAULT 'en',
        timezone varchar(32) NOT NULL DEFAULT 'UTC',
        theme varchar(10) NOT NULL DEFAULT 'light',
        privacy_level varchar(20) NOT NULL DEFAULT 'normal',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_settings__user_id ON user_settings (user_id);');

    // 3. Create user_last_auth table
    this.addSql(`
      CREATE TABLE user_last_auth (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid UNIQUE NOT NULL,
        ip_address inet,
        user_agent text,
        session_token varchar(255),
        last_login_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_last_auth__user_id ON user_last_auth (user_id);');
    this.addSql('CREATE INDEX ix__user_last_auth__last_login_at ON user_last_auth (last_login_at);');

    // 4. Create user_ref_links table
    this.addSql(`
      CREATE TABLE user_ref_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        ref_code varchar(32) UNIQUE NOT NULL,
        clicks integer NOT NULL DEFAULT 0,
        conversions integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_ref_links__user_id ON user_ref_links (user_id);');
    this.addSql('CREATE INDEX ix__user_ref_links__ref_code ON user_ref_links (ref_code);');
    this.addSql('CREATE INDEX ix__user_ref_links__is_active ON user_ref_links (is_active);');

    // 5. Create user_source_visits table
    this.addSql(`
      CREATE TABLE user_source_visits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        source varchar(100) NOT NULL,
        medium varchar(50),
        campaign varchar(100),
        content varchar(255),
        term varchar(100),
        referrer text,
        ip_address inet,
        user_agent text,
        visited_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_source_visits__user_id ON user_source_visits (user_id);');
    this.addSql('CREATE INDEX ix__user_source_visits__source ON user_source_visits (source);');
    this.addSql('CREATE INDEX ix__user_source_visits__visited_at ON user_source_visits (visited_at);');

    // 6. Add foreign key constraints
    this.addSql(`
      ALTER TABLE users
        ADD CONSTRAINT fk__users__referred_by
        FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE users
        ADD CONSTRAINT fk__users__ref_link_level_1
        FOREIGN KEY (ref_link_level_1) REFERENCES users(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE users
        ADD CONSTRAINT fk__users__ref_link_level_2
        FOREIGN KEY (ref_link_level_2) REFERENCES users(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE users
        ADD CONSTRAINT fk__users__ref_link_level_3
        FOREIGN KEY (ref_link_level_3) REFERENCES users(id) ON DELETE SET NULL;
    `);

    this.addSql(`
      ALTER TABLE user_settings
        ADD CONSTRAINT fk__user_settings__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE user_last_auth
        ADD CONSTRAINT fk__user_last_auth__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE user_ref_links
        ADD CONSTRAINT fk__user_ref_links__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE user_source_visits
        ADD CONSTRAINT fk__user_source_visits__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    // 7. Create update timestamp trigger function
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // 8. Apply update triggers to tables with updated_at column
    const tablesWithUpdatedAt = [
      'users',
      'user_settings',
      'user_last_auth',
      'user_ref_links',
    ];

    for (const table of tablesWithUpdatedAt) {
      this.addSql(`
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop triggers first
    const tablesWithUpdatedAt = [
      'users',
      'user_settings',
      'user_last_auth',
      'user_ref_links',
    ];

    for (const table of tablesWithUpdatedAt) {
      this.addSql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
    }

    this.addSql('DROP FUNCTION IF EXISTS update_updated_at_column();');

    // Drop tables in reverse order (due to foreign key constraints)
    this.addSql('DROP TABLE IF EXISTS user_source_visits CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_ref_links CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_last_auth CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_settings CASCADE;');
    this.addSql('DROP TABLE IF EXISTS users CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}

import { Migration } from '@mikro-orm/migrations';

/**
 * Complete startup migration for Motiv-Buy database schema
 * 
 * Creates all tables and relationships from scratch with proper TrafficTarget naming
 * This is designed as a startup migration for fresh database installations
 */
export class Migration20250908000600_startup_complete_schema extends Migration {

  async up(): Promise<void> {
    // Enable UUID v7 generation function
    this.addSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create uuid v7 generation function
    this.addSql(`
      CREATE OR REPLACE FUNCTION gen_random_uuid_v7() RETURNS uuid
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN encode(
          decode(
            lpad(to_hex(floor(extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0') ||
            encode(gen_random_bytes(10), 'hex'),
            'hex'
          ),
          'base64'
        )::uuid;
      END;
      $$;
    `);

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

    // 2. Create user_balances table
    this.addSql(`
      CREATE TABLE user_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        balance decimal(15,4) NOT NULL DEFAULT 0,
        reserved decimal(15,4) NOT NULL DEFAULT 0,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_balances__user_id ON user_balances (user_id);');
    this.addSql('CREATE INDEX ix__user_balances__currency ON user_balances (currency);');

    // 3. Create user_balance_history table
    this.addSql(`
      CREATE TABLE user_balance_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        amount decimal(15,4) NOT NULL,
        previous_balance decimal(15,4) NOT NULL,
        new_balance decimal(15,4) NOT NULL,
        transaction_type varchar(20) NOT NULL,
        description text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_balance_history__user_id ON user_balance_history (user_id);');
    this.addSql('CREATE INDEX ix__user_balance_history__transaction_type ON user_balance_history (transaction_type);');
    this.addSql('CREATE INDEX ix__user_balance_history__created_at ON user_balance_history (created_at);');

    // 4. Create user_settings table
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

    // 5. Create user_last_auth table
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

    // 6. Create user_ref_links table
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

    // 7. Create user_source_visits table
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

    // 8. Create traffic_sources table
    this.addSql(`
      CREATE TABLE traffic_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name varchar(255) NOT NULL,
        description text,
        type varchar(20) NOT NULL,
        bot_token text,
        bot_username varchar(32),
        telegram_id bigint,
        is_active boolean NOT NULL DEFAULT true,
        config jsonb,
        managed_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_sources__telegram_id ON traffic_sources (telegram_id);');
    this.addSql('CREATE INDEX ix__traffic_sources__type ON traffic_sources (type);');
    this.addSql('CREATE INDEX ix__traffic_sources__is_active ON traffic_sources (is_active);');
    this.addSql('CREATE INDEX ix__traffic_sources__bot_username ON traffic_sources (bot_username);');

    // 9. Create traffic_source_categories table
    this.addSql(`
      CREATE TABLE traffic_source_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name varchar(100) UNIQUE NOT NULL,
        slug varchar(100) UNIQUE NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_source_categories__name ON traffic_source_categories (name);');
    this.addSql('CREATE INDEX ix__traffic_source_categories__slug ON traffic_source_categories (slug);');
    this.addSql('CREATE INDEX ix__traffic_source_categories__is_active ON traffic_source_categories (is_active);');
    this.addSql('CREATE INDEX ix__traffic_source_categories__sort_order ON traffic_source_categories (sort_order);');

    // 10. Create traffic_targets table (formerly traffic_buyers)
    this.addSql(`
      CREATE TABLE traffic_targets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name varchar(255) NOT NULL,
        description text,
        type varchar(20) NOT NULL,
        telegram_id bigint,
        username varchar(32),
        invite_link text,
        is_active boolean NOT NULL DEFAULT true,
        requires_approval boolean NOT NULL DEFAULT false,
        price_per_member decimal(10,2),
        min_members integer,
        max_members integer,
        config jsonb,
        managed_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_targets__telegram_id ON traffic_targets (telegram_id);');
    this.addSql('CREATE INDEX ix__traffic_targets__type ON traffic_targets (type);');
    this.addSql('CREATE INDEX ix__traffic_targets__is_active ON traffic_targets (is_active);');

    // 11. Create traffic_users table
    this.addSql(`
      CREATE TABLE traffic_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        telegram_id bigint UNIQUE NOT NULL,
        username varchar(32),
        first_name varchar(64),
        last_name varchar(64),
        phone_number varchar(20),
        email varchar(255),
        is_verified boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        last_seen_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_users__telegram_id ON traffic_users (telegram_id);');
    this.addSql('CREATE INDEX ix__traffic_users__username ON traffic_users (username);');
    this.addSql('CREATE INDEX ix__traffic_users__is_verified ON traffic_users (is_verified);');
    this.addSql('CREATE INDEX ix__traffic_users__is_active ON traffic_users (is_active);');
    this.addSql('CREATE INDEX ix__traffic_users__last_seen_at ON traffic_users (last_seen_at);');

    // 12. Create traffic_orders table
    this.addSql(`
      CREATE TABLE traffic_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        order_id varchar(64) UNIQUE NOT NULL,
        type varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        target_count integer NOT NULL,
        current_count integer NOT NULL DEFAULT 0,
        price_per_action decimal(10,4) NOT NULL,
        total_budget decimal(15,4) NOT NULL,
        spent_amount decimal(15,4) NOT NULL DEFAULT 0,
        description text,
        target_url text,
        requirements jsonb,
        start_date timestamptz,
        end_date timestamptz,
        completed_at timestamptz,
        creator_id uuid NOT NULL,
        traffic_source_id uuid NOT NULL,
        traffic_target_id uuid NOT NULL,
        assigned_traffic_user_id uuid,
        created_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_orders__order_id ON traffic_orders (order_id);');
    this.addSql('CREATE INDEX ix__traffic_orders__status ON traffic_orders (status);');
    this.addSql('CREATE INDEX ix__traffic_orders__type ON traffic_orders (type);');
    this.addSql('CREATE INDEX ix__traffic_orders__created_at ON traffic_orders (created_at);');
    this.addSql('CREATE INDEX ix__traffic_orders__creator_id ON traffic_orders (creator_id);');
    this.addSql('CREATE INDEX ix__traffic_orders__traffic_source_id ON traffic_orders (traffic_source_id);');
    this.addSql('CREATE INDEX ix__traffic_orders__traffic_target_id ON traffic_orders (traffic_target_id);');
    this.addSql('CREATE INDEX ix__traffic_orders__assigned_traffic_user_id ON traffic_orders (assigned_traffic_user_id);');
    this.addSql('CREATE INDEX ix__traffic_orders__created_by ON traffic_orders (created_by_id);');

    // 13. Create traffic_actions table
    this.addSql(`
      CREATE TABLE traffic_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_order_id uuid NOT NULL,
        action_type varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        performed_by_id uuid,
        performed_at timestamptz,
        data jsonb,
        error_message text,
        retry_count integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_actions__traffic_order_id ON traffic_actions (traffic_order_id);');
    this.addSql('CREATE INDEX ix__traffic_actions__action_type ON traffic_actions (action_type);');
    this.addSql('CREATE INDEX ix__traffic_actions__status ON traffic_actions (status);');
    this.addSql('CREATE INDEX ix__traffic_actions__performed_by_id ON traffic_actions (performed_by_id);');
    this.addSql('CREATE INDEX ix__traffic_actions__performed_at ON traffic_actions (performed_at);');
    this.addSql('CREATE INDEX ix__traffic_actions__created_at ON traffic_actions (created_at);');

    // 14. Create junction tables

    // traffic_source_categories junction table
    this.addSql(`
      CREATE TABLE traffic_source_categories_junction (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_source_id uuid NOT NULL,
        traffic_source_category_id uuid NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_source_categories__source_id ON traffic_source_categories_junction (traffic_source_id);');
    this.addSql('CREATE INDEX ix__traffic_source_categories__category_id ON traffic_source_categories_junction (traffic_source_category_id);');
    this.addSql('CREATE INDEX ix__traffic_source_categories__is_primary ON traffic_source_categories_junction (is_primary);');
    this.addSql('CREATE UNIQUE INDEX uq__traffic_source_categories__source_category ON traffic_source_categories_junction (traffic_source_id, traffic_source_category_id);');

    // traffic_target_sources junction table
    this.addSql(`
      CREATE TABLE traffic_target_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_target_id uuid NOT NULL,
        traffic_source_id uuid NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        contract_terms jsonb,
        price_per_action decimal(10,4),
        minimum_order integer,
        maximum_order integer,
        agreement_start_date timestamptz,
        agreement_end_date timestamptz,
        last_order_date timestamptz,
        total_orders_completed integer NOT NULL DEFAULT 0,
        total_amount_spent decimal(15,4) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_target_sources__target_id ON traffic_target_sources (traffic_target_id);');
    this.addSql('CREATE INDEX ix__traffic_target_sources__source_id ON traffic_target_sources (traffic_source_id);');
    this.addSql('CREATE INDEX ix__traffic_target_sources__is_active ON traffic_target_sources (is_active);');
    this.addSql('CREATE UNIQUE INDEX uq__traffic_target_sources__target_source ON traffic_target_sources (traffic_target_id, traffic_source_id);');

    // traffic_target_users junction table
    this.addSql(`
      CREATE TABLE traffic_target_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_target_id uuid NOT NULL,
        traffic_user_id uuid NOT NULL,
        can_view boolean NOT NULL DEFAULT true,
        can_contact boolean NOT NULL DEFAULT false,
        is_blocked boolean NOT NULL DEFAULT false,
        first_interaction_date timestamptz,
        last_interaction_date timestamptz,
        total_interactions integer NOT NULL DEFAULT 0,
        total_orders_shared integer NOT NULL DEFAULT 0,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_target_users__target_id ON traffic_target_users (traffic_target_id);');
    this.addSql('CREATE INDEX ix__traffic_target_users__user_id ON traffic_target_users (traffic_user_id);');
    this.addSql('CREATE INDEX ix__traffic_target_users__is_blocked ON traffic_target_users (is_blocked);');
    this.addSql('CREATE UNIQUE INDEX uq__traffic_target_users__target_user ON traffic_target_users (traffic_target_id, traffic_user_id);');

    // user_traffic_targets junction table
    this.addSql(`
      CREATE TABLE user_traffic_targets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        traffic_target_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        permissions jsonb,
        assigned_at timestamptz,
        assigned_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_targets__user_id ON user_traffic_targets (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__target_id ON user_traffic_targets (traffic_target_id);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__role ON user_traffic_targets (role);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__is_active ON user_traffic_targets (is_active);');
    this.addSql('CREATE UNIQUE INDEX uq__user_traffic_targets__user_target ON user_traffic_targets (user_id, traffic_target_id);');

    // user_traffic_sources junction table
    this.addSql(`
      CREATE TABLE user_traffic_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        traffic_source_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        permissions jsonb,
        assigned_at timestamptz,
        assigned_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_sources__user_id ON user_traffic_sources (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__source_id ON user_traffic_sources (traffic_source_id);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__role ON user_traffic_sources (role);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__is_active ON user_traffic_sources (is_active);');
    this.addSql('CREATE UNIQUE INDEX uq__user_traffic_sources__user_source ON user_traffic_sources (user_id, traffic_source_id);');

    // user_traffic_orders junction table
    this.addSql(`
      CREATE TABLE user_traffic_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        traffic_order_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        assigned_at timestamptz,
        assigned_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_orders__user_id ON user_traffic_orders (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__order_id ON user_traffic_orders (traffic_order_id);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__role ON user_traffic_orders (role);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__is_active ON user_traffic_orders (is_active);');
    this.addSql('CREATE UNIQUE INDEX uq__user_traffic_orders__user_order ON user_traffic_orders (user_id, traffic_order_id);');

    // traffic_actions_users junction table
    this.addSql(`
      CREATE TABLE traffic_actions_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_action_id uuid NOT NULL,
        traffic_user_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        performed_at timestamptz,
        result_data jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_actions_users__action_id ON traffic_actions_users (traffic_action_id);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__user_id ON traffic_actions_users (traffic_user_id);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__role ON traffic_actions_users (role);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__performed_at ON traffic_actions_users (performed_at);');
    this.addSql('CREATE UNIQUE INDEX uq__traffic_actions_users__action_user ON traffic_actions_users (traffic_action_id, traffic_user_id);');

    // 15. Add foreign key constraints

    // Users table foreign keys
    this.addSql('ALTER TABLE users ADD CONSTRAINT fk__users__referred_by FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;');
    this.addSql('ALTER TABLE users ADD CONSTRAINT fk__users__ref_link_level_1 FOREIGN KEY (ref_link_level_1) REFERENCES users(id) ON DELETE SET NULL;');
    this.addSql('ALTER TABLE users ADD CONSTRAINT fk__users__ref_link_level_2 FOREIGN KEY (ref_link_level_2) REFERENCES users(id) ON DELETE SET NULL;');
    this.addSql('ALTER TABLE users ADD CONSTRAINT fk__users__ref_link_level_3 FOREIGN KEY (ref_link_level_3) REFERENCES users(id) ON DELETE SET NULL;');

    // User balance foreign keys
    this.addSql('ALTER TABLE user_balances ADD CONSTRAINT fk__user_balances__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // User balance history foreign keys
    this.addSql('ALTER TABLE user_balance_history ADD CONSTRAINT fk__user_balance_history__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // User settings foreign keys
    this.addSql('ALTER TABLE user_settings ADD CONSTRAINT fk__user_settings__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // User last auth foreign keys
    this.addSql('ALTER TABLE user_last_auth ADD CONSTRAINT fk__user_last_auth__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // User ref links foreign keys
    this.addSql('ALTER TABLE user_ref_links ADD CONSTRAINT fk__user_ref_links__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // User source visits foreign keys
    this.addSql('ALTER TABLE user_source_visits ADD CONSTRAINT fk__user_source_visits__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');

    // Traffic sources foreign keys
    this.addSql('ALTER TABLE traffic_sources ADD CONSTRAINT fk__traffic_sources__managed_by_id FOREIGN KEY (managed_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    // Traffic targets foreign keys
    this.addSql('ALTER TABLE traffic_targets ADD CONSTRAINT fk__traffic_targets__managed_by_id FOREIGN KEY (managed_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    // Traffic orders foreign keys
    this.addSql('ALTER TABLE traffic_orders ADD CONSTRAINT fk__traffic_orders__creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_orders ADD CONSTRAINT fk__traffic_orders__traffic_source_id FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_orders ADD CONSTRAINT fk__traffic_orders__traffic_target_id FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_orders ADD CONSTRAINT fk__traffic_orders__assigned_traffic_user_id FOREIGN KEY (assigned_traffic_user_id) REFERENCES traffic_users(id) ON DELETE SET NULL;');
    this.addSql('ALTER TABLE traffic_orders ADD CONSTRAINT fk__traffic_orders__created_by_id FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    // Traffic actions foreign keys
    this.addSql('ALTER TABLE traffic_actions ADD CONSTRAINT fk__traffic_actions__traffic_order_id FOREIGN KEY (traffic_order_id) REFERENCES traffic_orders(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_actions ADD CONSTRAINT fk__traffic_actions__performed_by_id FOREIGN KEY (performed_by_id) REFERENCES traffic_users(id) ON DELETE SET NULL;');

    // Junction table foreign keys
    this.addSql('ALTER TABLE traffic_source_categories_junction ADD CONSTRAINT fk__traffic_source_categories__traffic_source_id FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_source_categories_junction ADD CONSTRAINT fk__traffic_source_categories__traffic_source_category_id FOREIGN KEY (traffic_source_category_id) REFERENCES traffic_source_categories(id) ON DELETE CASCADE;');

    this.addSql('ALTER TABLE traffic_target_sources ADD CONSTRAINT fk__traffic_target_sources__traffic_target_id FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_target_sources ADD CONSTRAINT fk__traffic_target_sources__traffic_source_id FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE;');

    this.addSql('ALTER TABLE traffic_target_users ADD CONSTRAINT fk__traffic_target_users__traffic_target_id FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_target_users ADD CONSTRAINT fk__traffic_target_users__traffic_user_id FOREIGN KEY (traffic_user_id) REFERENCES traffic_users(id) ON DELETE CASCADE;');

    this.addSql('ALTER TABLE user_traffic_targets ADD CONSTRAINT fk__user_traffic_targets__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_targets ADD CONSTRAINT fk__user_traffic_targets__traffic_target_id FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_targets ADD CONSTRAINT fk__user_traffic_targets__assigned_by_id FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    this.addSql('ALTER TABLE user_traffic_sources ADD CONSTRAINT fk__user_traffic_sources__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_sources ADD CONSTRAINT fk__user_traffic_sources__traffic_source_id FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_sources ADD CONSTRAINT fk__user_traffic_sources__assigned_by_id FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    this.addSql('ALTER TABLE user_traffic_orders ADD CONSTRAINT fk__user_traffic_orders__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_orders ADD CONSTRAINT fk__user_traffic_orders__traffic_order_id FOREIGN KEY (traffic_order_id) REFERENCES traffic_orders(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE user_traffic_orders ADD CONSTRAINT fk__user_traffic_orders__assigned_by_id FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL;');

    this.addSql('ALTER TABLE traffic_actions_users ADD CONSTRAINT fk__traffic_actions_users__traffic_action_id FOREIGN KEY (traffic_action_id) REFERENCES traffic_actions(id) ON DELETE CASCADE;');
    this.addSql('ALTER TABLE traffic_actions_users ADD CONSTRAINT fk__traffic_actions_users__traffic_user_id FOREIGN KEY (traffic_user_id) REFERENCES traffic_users(id) ON DELETE CASCADE;');

    // Add update timestamp triggers
    this.addSql(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply update triggers to all tables with updated_at column
    const tablesWithUpdatedAt = [
      'users', 'user_balances', 'user_settings', 'user_last_auth', 'user_ref_links',
      'traffic_sources', 'traffic_source_categories', 'traffic_targets', 'traffic_users',
      'traffic_orders', 'traffic_actions', 'traffic_target_sources', 'traffic_target_users',
      'user_traffic_targets', 'user_traffic_sources', 'user_traffic_orders'
    ];

    for (const table of tablesWithUpdatedAt) {
      this.addSql(`CREATE TRIGGER update_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`);
    }
  }

  async down(): Promise<void> {
    // Drop triggers first
    const tablesWithUpdatedAt = [
      'users', 'user_balances', 'user_settings', 'user_last_auth', 'user_ref_links',
      'traffic_sources', 'traffic_source_categories', 'traffic_targets', 'traffic_users',
      'traffic_orders', 'traffic_actions', 'traffic_target_sources', 'traffic_target_users',
      'user_traffic_targets', 'user_traffic_sources', 'user_traffic_orders'
    ];

    for (const table of tablesWithUpdatedAt) {
      this.addSql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
    }

    this.addSql('DROP FUNCTION IF EXISTS update_updated_at_column();');

    // Drop tables in reverse order (due to foreign key constraints)
    this.addSql('DROP TABLE IF EXISTS traffic_actions_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_orders CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_sources CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_targets CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_target_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_target_sources CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_source_categories_junction CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_actions CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_orders CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_targets CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_source_categories CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_sources CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_source_visits CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_ref_links CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_last_auth CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_settings CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_balance_history CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_balances CASCADE;');
    this.addSql('DROP TABLE IF EXISTS users CASCADE;');

    // Drop UUID function and extension
    this.addSql('DROP FUNCTION IF EXISTS gen_random_uuid_v7();');
    this.addSql('DROP EXTENSION IF EXISTS "uuid-ossp";');
  }
}
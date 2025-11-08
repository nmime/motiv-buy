import { Migration } from '@mikro-orm/migrations';

/**
 * Traffic System Migration
 *
 * Creates complete traffic management system with all constraints, indexes, and foreign keys:
 * - traffic_sources: Bot sources providing traffic
 * - traffic_source_categories: Categorization for sources
 * - traffic_targets: Channels/groups buying traffic
 * - traffic_users: Users participating in traffic system
 * - traffic_orders: Orders connecting sources to targets
 * - traffic_actions: Individual actions within orders
 * - moderation_requests: Approval workflow for sources and orders via Telegram
 * - Junction tables for many-to-many relationships
 */
export class Migration20250105000003TrafficSystem extends Migration {
  async up(): Promise<void> {
    // ========================================
    // PART 1: MAIN TABLES
    // ========================================

    // 1. Create traffic_sources table
    this.addSql(`
      CREATE TABLE traffic_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name varchar(255) NOT NULL,
        description text,
        type varchar(20) NOT NULL,
        bot_token text,
        api_key_hash text,
        api_key_prefix varchar(8),
        bot_username varchar(32),
        telegram_id bigint,
        is_active boolean NOT NULL DEFAULT true,
        config jsonb,
        managed_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_sources__managed_by_id
          FOREIGN KEY (managed_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_sources__telegram_id ON traffic_sources (telegram_id);');
    this.addSql('CREATE INDEX ix__traffic_sources__type ON traffic_sources (type);');
    this.addSql('CREATE INDEX ix__traffic_sources__is_active ON traffic_sources (is_active);');
    this.addSql('CREATE INDEX ix__traffic_sources__bot_username ON traffic_sources (bot_username);');
    this.addSql('CREATE INDEX ix__traffic_sources__api_key_prefix ON traffic_sources (api_key_prefix);');
    this.addSql(`COMMENT ON COLUMN traffic_sources.api_key_hash IS 'Bcrypt-hashed API key for secure authentication';`);
    this.addSql(`COMMENT ON COLUMN traffic_sources.api_key_prefix IS 'First 8 chars of API key for fast lookup (security + performance)';`);

    // 2. Create traffic_source_categories table
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

    // 3. Create traffic_targets table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_targets__managed_by_id
          FOREIGN KEY (managed_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_targets__telegram_id ON traffic_targets (telegram_id);');
    this.addSql('CREATE INDEX ix__traffic_targets__type ON traffic_targets (type);');
    this.addSql('CREATE INDEX ix__traffic_targets__is_active ON traffic_targets (is_active);');

    // 4. Create traffic_users table
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

    // 5. Create traffic_orders table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_orders__creator_id
          FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_orders__traffic_source_id
          FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_orders__traffic_target_id
          FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_orders__assigned_traffic_user_id
          FOREIGN KEY (assigned_traffic_user_id) REFERENCES traffic_users(id) ON DELETE SET NULL,
        CONSTRAINT fk__traffic_orders__created_by_id
          FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
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

    // 6. Create traffic_actions table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_actions__traffic_order_id
          FOREIGN KEY (traffic_order_id) REFERENCES traffic_orders(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_actions__performed_by_id
          FOREIGN KEY (performed_by_id) REFERENCES traffic_users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_actions__traffic_order_id ON traffic_actions (traffic_order_id);');
    this.addSql('CREATE INDEX ix__traffic_actions__action_type ON traffic_actions (action_type);');
    this.addSql('CREATE INDEX ix__traffic_actions__status ON traffic_actions (status);');
    this.addSql('CREATE INDEX ix__traffic_actions__performed_by_id ON traffic_actions (performed_by_id);');
    this.addSql('CREATE INDEX ix__traffic_actions__performed_at ON traffic_actions (performed_at);');
    this.addSql('CREATE INDEX ix__traffic_actions__created_at ON traffic_actions (created_at);');

    // 7. Create moderation_requests table
    this.addSql(`
      CREATE TABLE moderation_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        entity_type varchar(20) NOT NULL,
        entity_id uuid NOT NULL,
        status varchar(20) NOT NULL,
        telegram_message_id text,
        telegram_chat_id text,
        reviewed_by_id uuid,
        reviewed_at timestamptz,
        review_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__moderation_requests__reviewed_by_id
          FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__moderation_requests__status ON moderation_requests (status);');
    this.addSql('CREATE INDEX ix__moderation_requests__entity_type_id ON moderation_requests (entity_type, entity_id);');
    this.addSql(`
      CREATE INDEX ix__moderation_requests__telegram_message
        ON moderation_requests (telegram_chat_id, telegram_message_id);
    `);
    this.addSql('CREATE INDEX ix__moderation_requests__created_at ON moderation_requests (created_at);');

    this.addSql(`COMMENT ON TABLE moderation_requests IS 'Approval workflow for traffic sources and orders via Telegram channel';`);
    this.addSql(`COMMENT ON COLUMN moderation_requests.entity_type IS 'Type: traffic_source or traffic_order';`);
    this.addSql(`COMMENT ON COLUMN moderation_requests.status IS 'Status: pending, approved, or declined';`);

    // ========================================
    // PART 2: JUNCTION TABLES
    // ========================================

    // 7. Create traffic_source_categories junction table
    this.addSql(`
      CREATE TABLE traffic_source_categories_junction (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_source_id uuid NOT NULL,
        traffic_source_category_id uuid NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_source_categories__traffic_source_id
          FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_source_categories__traffic_source_category_id
          FOREIGN KEY (traffic_source_category_id) REFERENCES traffic_source_categories(id) ON DELETE CASCADE
      );
    `);

    this.addSql(`
      CREATE INDEX ix__traffic_source_categories__source_id
        ON traffic_source_categories_junction (traffic_source_id);
    `);
    this.addSql(`
      CREATE INDEX ix__traffic_source_categories__category_id
        ON traffic_source_categories_junction (traffic_source_category_id);
    `);
    this.addSql(`
      CREATE INDEX ix__traffic_source_categories__is_primary
        ON traffic_source_categories_junction (is_primary);
    `);
    this.addSql(`
      CREATE UNIQUE INDEX uq__traffic_source_categories__source_category
        ON traffic_source_categories_junction (traffic_source_id, traffic_source_category_id);
    `);

    // 8. Create traffic_target_sources junction table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_target_sources__traffic_target_id
          FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_target_sources__traffic_source_id
          FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_target_sources__target_id ON traffic_target_sources (traffic_target_id);');
    this.addSql('CREATE INDEX ix__traffic_target_sources__source_id ON traffic_target_sources (traffic_source_id);');
    this.addSql('CREATE INDEX ix__traffic_target_sources__is_active ON traffic_target_sources (is_active);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__traffic_target_sources__target_source
        ON traffic_target_sources (traffic_target_id, traffic_source_id);
    `);

    // 9. Create traffic_target_users junction table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_target_users__traffic_target_id
          FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_target_users__traffic_user_id
          FOREIGN KEY (traffic_user_id) REFERENCES traffic_users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_target_users__target_id ON traffic_target_users (traffic_target_id);');
    this.addSql('CREATE INDEX ix__traffic_target_users__user_id ON traffic_target_users (traffic_user_id);');
    this.addSql('CREATE INDEX ix__traffic_target_users__is_blocked ON traffic_target_users (is_blocked);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__traffic_target_users__target_user
        ON traffic_target_users (traffic_target_id, traffic_user_id);
    `);

    // 10. Create user_traffic_targets junction table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_traffic_targets__user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_targets__traffic_target_id
          FOREIGN KEY (traffic_target_id) REFERENCES traffic_targets(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_targets__assigned_by_id
          FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_targets__user_id ON user_traffic_targets (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__target_id ON user_traffic_targets (traffic_target_id);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__role ON user_traffic_targets (role);');
    this.addSql('CREATE INDEX ix__user_traffic_targets__is_active ON user_traffic_targets (is_active);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__user_traffic_targets__user_target
        ON user_traffic_targets (user_id, traffic_target_id);
    `);

    // 11. Create user_traffic_sources junction table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_traffic_sources__user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_sources__traffic_source_id
          FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_sources__assigned_by_id
          FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_sources__user_id ON user_traffic_sources (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__source_id ON user_traffic_sources (traffic_source_id);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__role ON user_traffic_sources (role);');
    this.addSql('CREATE INDEX ix__user_traffic_sources__is_active ON user_traffic_sources (is_active);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__user_traffic_sources__user_source
        ON user_traffic_sources (user_id, traffic_source_id);
    `);

    // 12. Create user_traffic_orders junction table
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
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_traffic_orders__user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_orders__traffic_order_id
          FOREIGN KEY (traffic_order_id) REFERENCES traffic_orders(id) ON DELETE CASCADE,
        CONSTRAINT fk__user_traffic_orders__assigned_by_id
          FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    this.addSql('CREATE INDEX ix__user_traffic_orders__user_id ON user_traffic_orders (user_id);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__order_id ON user_traffic_orders (traffic_order_id);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__role ON user_traffic_orders (role);');
    this.addSql('CREATE INDEX ix__user_traffic_orders__is_active ON user_traffic_orders (is_active);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__user_traffic_orders__user_order
        ON user_traffic_orders (user_id, traffic_order_id);
    `);

    // 13. Create traffic_actions_users junction table
    this.addSql(`
      CREATE TABLE traffic_actions_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_action_id uuid NOT NULL,
        traffic_user_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        performed_at timestamptz,
        result_data jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_actions_users__traffic_action_id
          FOREIGN KEY (traffic_action_id) REFERENCES traffic_actions(id) ON DELETE CASCADE,
        CONSTRAINT fk__traffic_actions_users__traffic_user_id
          FOREIGN KEY (traffic_user_id) REFERENCES traffic_users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_actions_users__action_id ON traffic_actions_users (traffic_action_id);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__user_id ON traffic_actions_users (traffic_user_id);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__role ON traffic_actions_users (role);');
    this.addSql('CREATE INDEX ix__traffic_actions_users__performed_at ON traffic_actions_users (performed_at);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__traffic_actions_users__action_user
        ON traffic_actions_users (traffic_action_id, traffic_user_id);
    `);

    // 14. Create traffic_order_balances table (locked funds for guaranteed payments)
    this.addSql(`
      CREATE TABLE traffic_order_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_order_id uuid NOT NULL UNIQUE,
        currency_id uuid NOT NULL,
        locked_amount decimal(20,8) NOT NULL,
        spent_amount decimal(20,8) NOT NULL DEFAULT '0',
        available_amount decimal(20,8) NOT NULL,
        refunded_amount decimal(20,8) NOT NULL DEFAULT '0',
        is_settled boolean NOT NULL DEFAULT false,
        settled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_order_balances__traffic_order_id
          FOREIGN KEY (traffic_order_id)
          REFERENCES traffic_orders(id)
          ON DELETE CASCADE,
        CONSTRAINT fk__traffic_order_balances__currency_id
          FOREIGN KEY (currency_id)
          REFERENCES currencies(id)
          ON DELETE RESTRICT,
        CONSTRAINT chk__traffic_order_balances__positive_amounts
          CHECK (
            locked_amount >= 0 AND
            spent_amount >= 0 AND
            available_amount >= 0 AND
            refunded_amount >= 0
          ),
        CONSTRAINT chk__traffic_order_balances__balance_invariant
          CHECK (
            locked_amount = spent_amount + available_amount + refunded_amount
          )
      );
    `);

    this.addSql('CREATE INDEX ix__traffic_order_balances__traffic_order_id ON traffic_order_balances (traffic_order_id);');
    this.addSql('CREATE INDEX ix__traffic_order_balances__currency_id ON traffic_order_balances (currency_id);');
    this.addSql('CREATE INDEX ix__traffic_order_balances__is_settled ON traffic_order_balances (is_settled);');

    this.addSql(`COMMENT ON TABLE traffic_order_balances IS 'Locked funds for traffic orders. Ensures guaranteed payment.';`);
    this.addSql(`COMMENT ON COLUMN traffic_order_balances.locked_amount IS 'Total budget locked for order.';`);
    this.addSql(`COMMENT ON COLUMN traffic_order_balances.spent_amount IS 'Amount paid to sellers for completed tasks.';`);
    this.addSql(`COMMENT ON COLUMN traffic_order_balances.available_amount IS 'Remaining funds available for tasks.';`);
    this.addSql(`COMMENT ON COLUMN traffic_order_balances.refunded_amount IS 'Amount refunded to buyer on cancellation.';`);

    // ========================================
    // PART 3: UPDATE TRIGGERS
    // ========================================

    const tablesWithUpdatedAt = [
      'traffic_sources',
      'traffic_source_categories',
      'traffic_targets',
      'traffic_users',
      'traffic_orders',
      'traffic_order_balances',
      'traffic_actions',
      'moderation_requests',
      'traffic_target_sources',
      'traffic_target_users',
      'user_traffic_targets',
      'user_traffic_sources',
      'user_traffic_orders',
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
    // Drop tables in reverse order with CASCADE (automatically handles triggers and constraints)
    this.addSql('DROP TABLE IF EXISTS traffic_actions_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_orders CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_sources CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_traffic_targets CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_target_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_target_sources CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_source_categories_junction CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_order_balances CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_actions CASCADE;');
    this.addSql('DROP TABLE IF EXISTS moderation_requests CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_orders CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_users CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_targets CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_source_categories CASCADE;');
    this.addSql('DROP TABLE IF EXISTS traffic_sources CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}

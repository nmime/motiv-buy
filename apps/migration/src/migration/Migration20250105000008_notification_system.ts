import { Migration } from '@mikro-orm/migrations';

/**
 * Notification System Migration
 *
 * Creates notification tables with all constraints, indexes, and foreign keys:
 * - notification_templates: Templates for various notification types
 * - notifications: Notification queue and delivery tracking
 */
export class Migration20250105000008NotificationSystem extends Migration {
  async up(): Promise<void> {
    // 1. Create notification_templates table
    this.addSql(`
      CREATE TABLE notification_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        code varchar(100) UNIQUE NOT NULL,
        name varchar(255),
        description text,
        content_type varchar(32) NOT NULL DEFAULT 'text',
        template_engine varchar(32) NOT NULL DEFAULT 'eta',
        text jsonb,
        media jsonb,
        buttons jsonb,
        poll_config jsonb,
        location_config jsonb,
        contact_config jsonb,
        venue_config jsonb,
        forward_config jsonb,
        extra_config jsonb,
        is_personal boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        default_locale varchar(10),
        variables jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Create indexes for notification_templates table
    this.addSql('CREATE INDEX ix__notification_templates__code ON notification_templates (code);');
    this.addSql('CREATE INDEX ix__notification_templates__content_type ON notification_templates (content_type);');
    this.addSql('CREATE INDEX ix__notification_templates__is_active ON notification_templates (is_active);');

    // Create trigger for notification_templates
    this.addSql(`
      CREATE TRIGGER update_notification_templates_updated_at
        BEFORE UPDATE ON notification_templates
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 2. Create notifications table
    this.addSql(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        channel varchar(32) NOT NULL,
        target_type varchar(32) NOT NULL,
        target_id varchar(255) NOT NULL,
        template_id uuid,
        template_code varchar(100),
        data jsonb,
        extra jsonb,
        status varchar(32) NOT NULL DEFAULT 'pending',
        error jsonb,
        priority integer NOT NULL DEFAULT 200,
        retry_count integer NOT NULL DEFAULT 0,
        max_retries integer NOT NULL DEFAULT 3,
        send_at timestamptz,
        send_time_from time,
        send_time_to time,
        sent_at timestamptz,
        message_id bigint,
        locale varchar(10),
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__notifications__template_id FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL
      );
    `);

    // Create indexes for notifications table
    this.addSql('CREATE INDEX ix__notifications__status ON notifications (status);');
    this.addSql('CREATE INDEX ix__notifications__channel ON notifications (channel);');
    this.addSql('CREATE INDEX ix__notifications__target_type ON notifications (target_type);');
    this.addSql('CREATE INDEX ix__notifications__target_id ON notifications (target_id);');
    this.addSql('CREATE INDEX ix__notifications__template_id ON notifications (template_id);');
    this.addSql('CREATE INDEX ix__notifications__priority_status ON notifications (priority, status);');
    this.addSql('CREATE INDEX ix__notifications__created_at ON notifications (created_at);');
    this.addSql('CREATE INDEX ix__notifications__send_at ON notifications (send_at);');
    // Composite index for queue processing (find pending notifications ordered by send_at)
    this.addSql('CREATE INDEX ix__notifications__status_send_at ON notifications (status, send_at);');
    this.addSql(
      'CREATE INDEX ix__notifications__status_target_send_time ON notifications (status, target_type, send_time_from, send_time_to);',
    );

    // Create trigger for notifications
    this.addSql(`
      CREATE TRIGGER update_notifications_updated_at
        BEFORE UPDATE ON notifications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  async down(): Promise<void> {
    // Drop tables in reverse order (CASCADE will drop constraints and triggers)
    this.addSql('DROP TABLE IF EXISTS notifications CASCADE;');
    this.addSql('DROP TABLE IF EXISTS notification_templates CASCADE;');
  }
}

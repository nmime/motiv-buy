-- Development Database Seed Data
-- This script populates the database with test data for development

-- Note: This script assumes the application has already run its migrations
-- and created the necessary tables

-- You can add sample data here once the database schema is finalized
-- Examples:

-- INSERT INTO users (telegram_id, username, first_name, is_active) VALUES
--   ('12345', 'testuser1', 'Test User 1', true),
--   ('67890', 'testuser2', 'Test User 2', true),
--   ('11111', 'devuser', 'Development User', true);

-- INSERT INTO user_balances (user_id, currency, amount) VALUES
--   (1, 'USD', 100.00),
--   (2, 'USD', 50.00),
--   (3, 'USD', 25.00);

-- For now, just log that the seed script ran
DO $$
BEGIN
    RAISE NOTICE 'Development seed data script executed';
    RAISE NOTICE 'Add your test data here once database schema is finalized';
END $$;
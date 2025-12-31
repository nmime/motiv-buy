-- Development Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions for development
CREATE
EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE
EXTENSION IF NOT EXISTS "pg_trgm";
CREATE
EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create development schemas
CREATE SCHEMA IF NOT EXISTS test;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant permissions (database name is set via POSTGRES_DB env var)
-- The grants below use current_database() to work with any DB name
GRANT USAGE ON SCHEMA public TO CURRENT_USER;
GRANT CREATE ON SCHEMA public TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;

-- Set up development-friendly settings using dynamic SQL
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET log_statement = %L', current_database(), 'all');
    EXECUTE format('ALTER DATABASE %I SET log_min_duration_statement = %s', current_database(), 0);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set database options: %', SQLERRM;
END $$;

-- Development helper functions
CREATE
OR REPLACE FUNCTION reset_sequences()
RETURNS void AS $$
DECLARE
rec RECORD;
BEGIN
FOR rec IN
SELECT schemaname, tablename, attname, adsrc
FROM pg_attrdef
         JOIN pg_attribute ON adrelid = attrelid AND adnum = attnum
         JOIN pg_class ON oid = attrelid
         JOIN pg_namespace ON relnamespace = pg_namespace.oid
WHERE adsrc ~ 'nextval'
    LOOP
        EXECUTE 'SELECT setval(''' || rec.adsrc || ''', COALESCE((SELECT MAX(' || rec.attname || ') FROM ' || rec.schemaname || '.' || rec.tablename || '), 1), false)';
END LOOP;
END;
$$
LANGUAGE plpgsql;

-- Log initialization
DO
$$
BEGIN
    RAISE
NOTICE 'Motiv-Buy Development Database initialized successfully';
    RAISE
NOTICE 'Database: %', current_database();
    RAISE
NOTICE 'Extensions installed: uuid-ossp, pg_trgm, pg_stat_statements';
    RAISE
NOTICE 'Helper function available: reset_sequences()';
END $$;

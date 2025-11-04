-- Production Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional extensions if needed
CREATE
EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE
EXTENSION IF NOT EXISTS "pg_trgm";

-- Create additional schemas if needed
-- CREATE SCHEMA IF NOT EXISTS analytics;
-- CREATE SCHEMA IF NOT EXISTS audit;

-- Set default permissions
-- GRANT USAGE ON SCHEMA public TO motiv_user;
-- GRANT CREATE ON SCHEMA public TO motiv_user;

-- Performance tuning (optional)
-- ALTER DATABASE motiv_buy_production SET shared_preload_libraries = 'pg_stat_statements';

-- Log important information
DO
$$
BEGIN
    RAISE
NOTICE 'Motiv-Buy Production Database initialized successfully';
    RAISE
NOTICE 'Database: %', current_database();
    RAISE
NOTICE 'Version: %', version();
END $$;

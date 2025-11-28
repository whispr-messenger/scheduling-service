-- Database initialization script for WhisprScheduling
-- This script sets up the database with required extensions and initial configuration

-- Enable UUID extension (required for uuid primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database comment
COMMENT ON DATABASE whispr_scheduling_dev IS 'WhisprMessenger scheduling and job orchestration service database';

-- Create a simple health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to get database statistics
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE(
    total_size TEXT,
    table_count BIGINT,
    index_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get job statistics
CREATE OR REPLACE FUNCTION get_job_stats()
RETURNS TABLE(
    total_jobs BIGINT,
    pending_jobs BIGINT,
    running_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT count(*) FROM "Job") as total_jobs,
        (SELECT count(*) FROM "Job" WHERE status = 'PENDING') as pending_jobs,
        (SELECT count(*) FROM "Job" WHERE status = 'RUNNING') as running_jobs,
        (SELECT count(*) FROM "Job" WHERE status = 'COMPLETED') as completed_jobs,
        (SELECT count(*) FROM "Job" WHERE status = 'FAILED') as failed_jobs;
END;
$$ LANGUAGE plpgsql;

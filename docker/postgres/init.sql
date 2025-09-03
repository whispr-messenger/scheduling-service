-- PostgreSQL initialization script for scheduling-service

-- Create the main database if it doesn't exist
-- (Note: This is usually handled by the POSTGRES_DB environment variable)

-- Set up proper permissions
GRANT ALL PRIVILEGES ON DATABASE scheduling_service TO scheduler;

-- Enable required extensions
\c scheduling_service;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set up proper schema permissions
GRANT USAGE ON SCHEMA public TO scheduler;
GRANT CREATE ON SCHEMA public TO scheduler;

-- Log the initialization
SELECT 'Scheduling Service database initialized successfully' AS status;
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  Job,
  Schedule,
  Execution,
  JobCategory,
  ExecutionLog,
  RecurringJob,
  JobDependency,
} from '../modules/scheduler/entities';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'scheduling_service',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'whispr_scheduling',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  logging: process.env.NODE_ENV === 'development',
  synchronize: false, // Always use migrations in production
  retryAttempts: 3,
  retryDelay: 5000,
}));

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // Use PostgreSQL for all environments including tests
  // This ensures tests run against the same database as production
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || process.env.DB_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || process.env.DB_NAME || 'whispr_scheduling',
    entities: [Job, Schedule, Execution, JobCategory, ExecutionLog, RecurringJob, JobDependency],
    synchronize: !isProduction, // Auto-sync schema in dev and test
    dropSchema: isTest, // Drop schema before each test run
    logging: !isProduction && !isTest ? ['error', 'warn', 'migration'] : false,
    migrations: ['dist/database/migrations/*.js'],
    migrationsRun: false, // Don't run migrations automatically in tests
    ssl: process.env.DATABASE_SSL === 'true' || (isProduction ? { rejectUnauthorized: false } : false),
    extra: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Smaller pool for tests
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
    },
    retryAttempts: isTest ? 5 : 3, // More retries in test environment
    retryDelay: 3000,
  };
};

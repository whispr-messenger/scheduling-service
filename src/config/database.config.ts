import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Job } from '../scheduler/entities/job.entity';
import { Schedule } from '../scheduler/entities/schedule.entity';
import { JobExecution } from '../scheduler/entities/job-execution.entity';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
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

  if (isTest) {
    return {
      type: 'sqlite',
      database: ':memory:',
      entities: [Job, Schedule, JobExecution],
      synchronize: true,
      dropSchema: true,
      logging: false,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'whispr_scheduling',
    entities: [Job, Schedule, JobExecution],
    synchronize: !isProduction,
    logging: !isProduction ? ['error', 'warn', 'migration'] : false,
    migrations: ['dist/database/migrations/*.js'],
    migrationsRun: true,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    extra: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
    retryAttempts: 3,
    retryDelay: 3000,
  };
};
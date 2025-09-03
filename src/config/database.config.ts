import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/scheduling_service',
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10) || 10,
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT, 10) || 60000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
}));
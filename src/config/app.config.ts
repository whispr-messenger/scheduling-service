import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',
  metricsEnabled: process.env.METRICS_ENABLED === 'true',
  metricsPort: parseInt(process.env.METRICS_PORT, 10) || 9090,
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 5000,
}));
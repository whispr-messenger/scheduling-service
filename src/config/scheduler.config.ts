import { registerAs } from '@nestjs/config';

export default registerAs('scheduler', () => ({
  timezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '100', 10),
  defaultTimeout: parseInt(process.env.DEFAULT_JOB_TIMEOUT || '300000', 10), // 5 minutes
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
  retryDelay: parseInt(process.env.RETRY_DELAY || '60000', 10), // 1 minute
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableAuditLogs: process.env.ENABLE_AUDIT_LOGS !== 'false',
}));

import { registerAs } from '@nestjs/config';

export default registerAs('scheduler', () => ({
  timezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 100,
  defaultTimeout: parseInt(process.env.DEFAULT_JOB_TIMEOUT, 10) || 300000, // 5 minutes
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000, // 30 seconds
  retryDelay: parseInt(process.env.RETRY_DELAY, 10) || 60000, // 1 minute
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableAuditLogs: process.env.ENABLE_AUDIT_LOGS !== 'false',
}));
import { registerAs } from '@nestjs/config';

export default registerAs('scheduler', () => ({
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
  maxConcurrentJobs: parseInt(process.env.SCHEDULER_MAX_CONCURRENT_JOBS, 10) || 10,
  defaultJobTimeout: parseInt(process.env.SCHEDULER_DEFAULT_TIMEOUT, 10) || 300000, // 5 minutes
  defaultMaxRetries: parseInt(process.env.SCHEDULER_DEFAULT_MAX_RETRIES, 10) || 3,
  jobCleanupInterval: parseInt(process.env.SCHEDULER_CLEANUP_INTERVAL, 10) || 3600000, // 1 hour
  executionHistoryRetention: parseInt(process.env.EXECUTION_HISTORY_RETENTION, 10) || 2592000000, // 30 days
  queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 10,
  enableMetrics: process.env.METRICS_ENABLED === 'true',
}));
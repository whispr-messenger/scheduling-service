/**
 * Job status enumeration
 */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  RETRY = 'retry',
}

/**
 * Job type enumeration
 */
export enum JobType {
  MESSAGE_DELIVERY = 'message_delivery',
  NOTIFICATION = 'notification',
  CLEANUP = 'cleanup',
  MAINTENANCE = 'maintenance',
  REPORT = 'report',
  ANALYTICS = 'analytics',
  BACKUP = 'backup',
  SYNC = 'sync',
}

/**
 * Job execution status enumeration
 */
export enum ExecutionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

/**
 * Job priority enumeration
 */
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15,
}

/**
 * Schedule status enumeration
 */
export enum ScheduleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  PAUSED = 'paused',
}

/**
 * Queue names enumeration
 */
export enum QueueName {
  SCHEDULER = 'scheduler',
  PRIORITY = 'priority',
  DELAYED = 'delayed',
  MAINTENANCE = 'maintenance',
}

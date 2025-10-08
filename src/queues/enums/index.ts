/**
 * Job priority levels for queue processing
 */
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15,
}

/**
 * Available queue names
 */
export enum QueueName {
  SCHEDULER = 'scheduler',
  PRIORITY = 'priority',
  DELAYED = 'delayed',
  MAINTENANCE = 'maintenance',
}

/**
 * Queue processing strategies
 */
export enum ProcessingStrategy {
  FIFO = 'fifo', // First In, First Out
  LIFO = 'lifo', // Last In, First Out
  PRIORITY = 'priority', // Priority-based processing
  DELAYED = 'delayed', // Time-based delayed processing
}

/**
 * Queue states
 */
export enum QueueState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  DRAINING = 'draining',
}

/**
 * Job processing states in queue
 */
export enum JobQueueState {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
  STUCK = 'stuck',
}

/**
 * Backoff strategies for retries
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job as BullJob } from 'bull';
import { JobPriority, QueueName } from './enums';

export interface QueueJobData {
  id: string;
  type: string;
  payload: Record<string, any>;
  [key: string]: any;
}

export interface QueueOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  backoff?: {
    type: string;
    delay: number;
  };
  [key: string]: any;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('scheduler')
    private readonly schedulerQueue: Queue,
    @InjectQueue('priority')
    private readonly priorityQueue: Queue,
    @InjectQueue('delayed')
    private readonly delayedQueue: Queue,
  ) {}

  /**
   * Add a job to the appropriate queue
   */
  async addJob(data: QueueJobData, options: QueueOptions = {}): Promise<BullJob> {
    const queue = this.selectQueue(options);
    const queueName = this.getQueueName(queue);

    const jobOptions: any = {
      jobId: data.id,
      removeOnComplete: options.removeOnComplete || 10,
      removeOnFail: options.removeOnFail || 5,
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    };

    this.logger.log(`Adding job ${data.id} to ${queueName} queue`);

    try {
      const job = await queue.add(data.type, data, jobOptions);
      this.logger.log(`Job ${data.id} added successfully to ${queueName}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job ${data.id} to ${queueName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a job by ID from any queue
   */
  async getJob(jobId: string): Promise<BullJob | null> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];

    for (const queue of queues) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          return job;
        }
      } catch (error) {
        this.logger.warn(`Error getting job ${jobId} from queue: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Remove a job from all queues
   */
  async removeJob(jobId: string): Promise<void> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];

    await Promise.all(
      queues.map(async (queue) => {
        try {
          await queue.removeJobs(jobId);
        } catch (error) {
          this.logger.warn(`Error removing job ${jobId} from queue: ${error.message}`);
        }
      }),
    );

    this.logger.log(`Job ${jobId} removed from all queues`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Record<string, any>> {
    const [schedulerCounts, priorityCounts, delayedCounts] = await Promise.all([
      this.schedulerQueue.getJobCounts(),
      this.priorityQueue.getJobCounts(),
      this.delayedQueue.getJobCounts(),
    ]);

    const totalCounts = {
      waiting: schedulerCounts.waiting + priorityCounts.waiting + delayedCounts.waiting,
      active: schedulerCounts.active + priorityCounts.active + delayedCounts.active,
      completed: schedulerCounts.completed + priorityCounts.completed + delayedCounts.completed,
      failed: schedulerCounts.failed + priorityCounts.failed + delayedCounts.failed,
      delayed: schedulerCounts.delayed + priorityCounts.delayed + delayedCounts.delayed,
      paused: (schedulerCounts as any).paused + (priorityCounts as any).paused + (delayedCounts as any).paused,
    };

    return {
      scheduler: schedulerCounts,
      priority: priorityCounts,
      delayed: delayedCounts,
      total: totalCounts,
    };
  }

  /**
   * Pause a specific queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume a specific queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean old jobs from queues
   */
  async cleanQueue(status: 'completed' | 'failed', olderThan: number): Promise<void> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];

    await Promise.all(
      queues.map(async (queue) => {
        try {
          await queue.clean(olderThan, status);
        } catch (error) {
          this.logger.warn(`Error cleaning ${status} jobs: ${error.message}`);
        }
      }),
    );

    this.logger.log(`Cleaned ${status} jobs older than ${olderThan}ms from all queues`);
  }

  /**
   * Get jobs by state from all queues
   */
  async getJobsByState(
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    limit: number = 50,
    offset: number = 0,
  ): Promise<BullJob[]> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];
    const allJobs: BullJob[] = [];

    for (const queue of queues) {
      try {
        const jobs = await queue.getJobs([state], offset, limit);
        allJobs.push(...jobs);
      } catch (error) {
        this.logger.warn(`Error getting ${state} jobs: ${error.message}`);
      }
    }

    return allJobs.slice(0, limit);
  }

  /**
   * Get failed jobs with error details
   */
  async getFailedJobs(limit: number = 50): Promise<any[]> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];
    const failedJobs: any[] = [];

    for (const queue of queues) {
      try {
        const jobs = await queue.getJobs(['failed'], 0, limit);
        const jobsWithErrors = jobs.map((job) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          attemptsMade: job.attemptsMade,
          queue: this.getQueueName(queue),
        }));
        failedJobs.push(...jobsWithErrors);
      } catch (error) {
        this.logger.warn(`Error getting failed jobs: ${error.message}`);
      }
    }

    return failedJobs.slice(0, limit);
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(limit: number = 10): Promise<number> {
    const queues = [this.schedulerQueue, this.priorityQueue, this.delayedQueue];
    let retriedCount = 0;

    for (const queue of queues) {
      try {
        const failedJobs = await queue.getJobs(['failed'], 0, limit);
        for (const job of failedJobs) {
          await job.retry();
          retriedCount++;
        }
      } catch (error) {
        this.logger.warn(`Error retrying failed jobs: ${error.message}`);
      }
    }

    this.logger.log(`Retried ${retriedCount} failed jobs`);
    return retriedCount;
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<Record<string, any>> {
    const stats = await this.getQueueStats();
    const health = {
      scheduler: {
        healthy: stats.scheduler.failed < stats.scheduler.completed * 0.1, // Less than 10% failure rate
        stats: stats.scheduler,
      },
      priority: {
        healthy: stats.priority.failed < stats.priority.completed * 0.1,
        stats: stats.priority,
      },
      delayed: {
        healthy: stats.delayed.failed < stats.delayed.completed * 0.1,
        stats: stats.delayed,
      },
      overall: {
        healthy: stats.total.failed < stats.total.completed * 0.1,
        stats: stats.total,
      },
    };

    return health;
  }

  // Private helper methods

  private selectQueue(options: QueueOptions): Queue {
    // Select queue based on priority or delay
    if (options.priority && options.priority >= JobPriority.HIGH) {
      return this.priorityQueue;
    }

    if (options.delay && options.delay > 0) {
      return this.delayedQueue;
    }

    return this.schedulerQueue;
  }

  private getQueueByName(queueName: QueueName): Queue {
    switch (queueName) {
      case QueueName.SCHEDULER:
        return this.schedulerQueue;
      case QueueName.PRIORITY:
        return this.priorityQueue;
      case QueueName.DELAYED:
        return this.delayedQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  private getQueueName(queue: Queue): string {
    if (queue === this.schedulerQueue) return 'scheduler';
    if (queue === this.priorityQueue) return 'priority';
    if (queue === this.delayedQueue) return 'delayed';
    return 'unknown';
  }
}
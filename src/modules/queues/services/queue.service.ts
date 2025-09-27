import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions, RepeatOptions } from 'bull';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('high-priority') private highPriorityQueue: Queue,
    @InjectQueue('medium-priority') private mediumPriorityQueue: Queue,
    @InjectQueue('low-priority') private lowPriorityQueue: Queue,
    private configService: ConfigService,
  ) {}

  async addJob(
    queueName: string,
    jobType: string,
    data: any,
    options?: JobOptions,
  ): Promise<Job> {
    const queue = this.getQueue(queueName);

    const jobOptions: JobOptions = {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    };

    this.logger.log('Adding job to queue', {
      queueName,
      jobType,
      jobId: options?.jobId,
      delay: options?.delay,
    });

    const job = await queue.add(jobType, data, jobOptions);

    this.logger.log('Job added successfully', {
      queueName,
      jobType,
      jobId: job.id,
      bullJobId: job.id,
    });

    return job;
  }

  async addRepeatableJob(
    queueName: string,
    jobType: string,
    data: any,
    repeatOptions: RepeatOptions & { jobId?: string },
  ): Promise<Job> {
    const queue = this.getQueue(queueName);

    const jobOptions: JobOptions = {
      removeOnComplete: 50,
      removeOnFail: 100,
      repeat: repeatOptions,
      jobId: repeatOptions.jobId, // For tracking repeatable jobs
    };

    this.logger.log('Adding repeatable job to queue', {
      queueName,
      jobType,
      repeatOptions,
    });

    const job = await queue.add(jobType, data, jobOptions);

    this.logger.log('Repeatable job added successfully', {
      queueName,
      jobType,
      jobId: job.id,
      repeatOptions,
    });

    return job;
  }

  async removeJob(jobId: string): Promise<void> {
    const queues = [this.highPriorityQueue, this.mediumPriorityQueue, this.lowPriorityQueue];

    for (const queue of queues) {
      try {
        // Try to find and remove the job from each queue
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.log('Job removed from queue', {
            queueName: queue.name,
            jobId,
          });
          return;
        }

        // Also try to remove repeatable jobs
        const repeatableJobs = await queue.getRepeatableJobs();
        const repeatableJob = repeatableJobs.find(j => j.id === jobId);
        if (repeatableJob) {
          await queue.removeRepeatable(repeatableJob.cron, repeatableJob.endDate);
          this.logger.log('Repeatable job removed from queue', {
            queueName: queue.name,
            jobId,
          });
          return;
        }
      } catch (error) {
        this.logger.warn('Failed to remove job from queue', {
          queueName: queue.name,
          jobId,
          error: error.message,
        });
      }
    }

    this.logger.warn('Job not found in any queue', { jobId });
  }

  async getJobStatus(queueName: string, jobId: string): Promise<any> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress(),
      delay: job.delay,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  async getQueueStats(queueName: string): Promise<any> {
    const queue = this.getQueue(queueName);

    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    ] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.getPaused(),
    ]);

    return {
      queueName,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: paused.length,
      },
      jobs: {
        waiting: waiting.slice(0, 10), // Return first 10 for preview
        active: active.slice(0, 10),
        failed: failed.slice(0, 10),
      },
    };
  }

  async getAllQueueStats(): Promise<any[]> {
    const queueNames = ['high-priority', 'medium-priority', 'low-priority'];
    const stats = await Promise.all(
      queueNames.map(name => this.getQueueStats(name))
    );

    return stats;
  }

  async cleanQueue(queueName: string, grace: number = 5000): Promise<void> {
    const queue = this.getQueue(queueName);

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');

    this.logger.log('Queue cleaned', { queueName, grace });
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();

    this.logger.log('Queue paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();

    this.logger.log('Queue resumed', { queueName });
  }

  async retryFailedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed();

    let retriedCount = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        this.logger.warn('Failed to retry job', {
          jobId: job.id,
          error: error.message,
        });
      }
    }

    this.logger.log('Failed jobs retried', {
      queueName,
      totalFailed: failedJobs.length,
      retriedCount,
    });

    return retriedCount;
  }

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case 'high-priority':
        return this.highPriorityQueue;
      case 'medium-priority':
        return this.mediumPriorityQueue;
      case 'low-priority':
        return this.lowPriorityQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}
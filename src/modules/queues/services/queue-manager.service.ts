import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { JobData, QueuePriority, JobResult } from '../interfaces/job.interface';
import { PrismaService } from '../../../common/prisma.service';
import { ExecutionStatus } from '../../../common/enums';
import { IQueueManager } from '../../scheduler/interfaces/queue-manager.interface';

@Injectable()
export class QueueManagerService implements OnModuleInit, OnModuleDestroy, IQueueManager {
  private readonly logger = new Logger(QueueManagerService.name);
  private readonly queues = new Map<string, Queue>();

  constructor(
    @InjectQueue('high-priority') private readonly highPriorityQueue: Queue,
    @InjectQueue('medium-priority') private readonly mediumPriorityQueue: Queue,
    @InjectQueue('low-priority') private readonly lowPriorityQueue: Queue,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Enregistrer les queues
    this.queues.set(QueuePriority.HIGH, this.highPriorityQueue);
    this.queues.set(QueuePriority.MEDIUM, this.mediumPriorityQueue);
    this.queues.set(QueuePriority.LOW, this.lowPriorityQueue);
  }

  async onModuleInit() {
    this.logger.log('Initializing Queue Manager...');
    
    // Configurer les événements pour chaque queue
    for (const [queueName, queue] of this.queues) {
      await this.setupQueueEvents(queueName, queue);
    }

    // Nettoyer les jobs en cours au démarrage
    await this.cleanupStuckJobs();
    
    this.logger.log('Queue Manager initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Queue Manager...');
    
    // Fermer toutes les queues
    for (const [queueName, queue] of this.queues) {
      try {
        await queue.close();
        this.logger.log(`Closed queue: ${queueName}`);
      } catch (error) {
        this.logger.error(`Error closing queue ${queueName}:`, error);
      }
    }
  }

  async addJob(jobData: JobData, delay?: number, priority?: number): Promise<Job> {
    const queueName = this.getQueueByPriority(jobData.priority);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue not found for priority: ${jobData.priority}`);
    }

    try {
      // Créer l'enregistrement d'exécution en base
      const execution = await this.prisma.execution.create({
        data: {
          id: jobData.executionId,
          jobId: jobData.id,
          status: ExecutionStatus.PENDING,
          attemptNumber: 1,
          correlationId: jobData.correlationId,
          createdAt: new Date(),
          startedAt: new Date(),
        },
      });

      const jobOptions = {
        delay: delay || 0,
        priority: priority || this.getPriorityValue(jobData.priority),
        attempts: jobData.maxRetries,
        timeout: jobData.timeoutSeconds * 1000,
        removeOnComplete: 100,
        removeOnFail: 50,
        backoff: {
          type: 'exponential' as const,
          delay: 2000,
        },
      };

      const job = await queue.add(
        this.getJobType(jobData.targetService, jobData.targetMethod),
        jobData,
        jobOptions,
      );

      this.logger.log(
        `Added job ${jobData.id} to queue ${queueName} with Bull job ID ${job.id}`,
      );

      return job;
    } catch (error) {
      this.logger.error(`Failed to add job ${jobData.id} to queue:`, error);
      
      // Marquer l'exécution comme échouée
      await this.prisma.execution.update({
        where: { id: jobData.executionId },
        data: {
          status: ExecutionStatus.FAILED,
          failedAt: new Date(),
          errorData: JSON.stringify({ error: error.message }),
        },
      });

      throw error;
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        return job;
      }
    }
    return null;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.logger.log(`Paused queue: ${queueName}`);
    } else {
      throw new Error(`Queue not found: ${queueName}`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Resumed queue: ${queueName}`);
    } else {
      throw new Error(`Queue not found: ${queueName}`);
    }
  }

  async getQueueStats(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      name: queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      isPaused: await queue.isPaused(),
    };
  }

  async getAllQueueStats() {
    const stats = [];
    for (const [queueName] of this.queues) {
      const queueStats = await this.getQueueStats(queueName);
      stats.push(queueStats);
    }
    return stats;
  }

  async retryFailedJobs(queueName: string, jobId?: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    if (jobId) {
      // Retry un job spécifique
      const job = await queue.getJob(jobId);
      if (job && job.isFailed()) {
        await job.retry();
        this.logger.log(`Retried failed job ${jobId} in queue ${queueName}`);
        return 1;
      }
      return 0;
    } else {
      // Retry tous les jobs échoués
      const failedJobs = await queue.getFailed();
      let retriedCount = 0;

      for (const job of failedJobs) {
        try {
          await job.retry();
          retriedCount++;
        } catch (error) {
          this.logger.warn(`Failed to retry job ${job.id}:`, error);
        }
      }

      this.logger.log(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
      return retriedCount;
    }
  }

  async cleanFailedJobs(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const failedJobs = await queue.getFailed();
    let cleanedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.remove();
        cleanedCount++;
      } catch (error) {
        this.logger.warn(`Failed to clean job ${job.id}:`, error);
      }
    }

    this.logger.log(`Cleaned ${cleanedCount} failed jobs from queue ${queueName}`);
    return cleanedCount;
  }

  private getQueueByPriority(priority: string): string {
    switch (priority.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return QueuePriority.HIGH;
      case 'MEDIUM':
        return QueuePriority.MEDIUM;
      case 'LOW':
      default:
        return QueuePriority.LOW;
    }
  }

  private getPriorityValue(priority: string): number {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return 10;
      case 'HIGH':
        return 5;
      case 'MEDIUM':
        return 1;
      case 'LOW':
      default:
        return 0;
    }
  }

  private getJobType(targetService: string, targetMethod: string): string {
    return `${targetService}.${targetMethod}`;
  }

  private async setupQueueEvents(queueName: string, queue: Queue): Promise<void> {
    // Job started
    queue.on('active', async (job: Job) => {
      this.logger.debug(`Job ${job.id} started in queue ${queueName}`);
      
      const jobData = job.data as JobData;
      await this.updateExecutionStatus(jobData.executionId, ExecutionStatus.RUNNING, {
        workerId: `worker-${process.pid}-${Date.now()}`,
        attemptNumber: job.attemptsMade + 1,
      });
    });

    // Job completed
    queue.on('completed', async (job: Job, result: JobResult) => {
      this.logger.log(`Job ${job.id} completed in queue ${queueName}`);
      
      const jobData = job.data as JobData;
      await this.updateExecutionStatus(jobData.executionId, ExecutionStatus.COMPLETED, {
        resultData: result,
        completedAt: new Date(),
        durationMs: result.duration,
      });
    });

    // Job failed
    queue.on('failed', async (job: Job, error: Error) => {
      this.logger.error(`Job ${job.id} failed in queue ${queueName}:`, error);
      
      const jobData = job.data as JobData;
      await this.updateExecutionStatus(jobData.executionId, ExecutionStatus.FAILED, {
        errorData: { error: error.message, stack: error.stack },
        failedAt: new Date(),
        attemptNumber: job.attemptsMade,
      });
    });

    // Job stalled
    queue.on('stalled', async (job: Job) => {
      this.logger.warn(`Job ${job.id} stalled in queue ${queueName}`);
      
      const jobData = job.data as JobData;
      await this.updateExecutionStatus(jobData.executionId, ExecutionStatus.FAILED, {
        errorData: { error: 'Job stalled', reason: 'Worker timeout or crash' },
        failedAt: new Date(),
      });
    });

    // Queue error
    queue.on('error', (error: Error) => {
      this.logger.error(`Queue ${queueName} error:`, error);
    });
  }

  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    data: any = {},
  ): Promise<void> {
    try {
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status,
          ...data,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update execution status for ${executionId}:`, error);
    }
  }

  private async cleanupStuckJobs(): Promise<void> {
    this.logger.log('Cleaning up stuck jobs...');

    try {
      // Marquer les exécutions "RUNNING" comme échouées au démarrage
      const result = await this.prisma.execution.updateMany({
        where: {
          status: ExecutionStatus.RUNNING,
        },
        data: {
          status: ExecutionStatus.FAILED,
          failedAt: new Date(),
          errorData: JSON.stringify({
            error: 'Service restart',
            reason: 'Job was running when service restarted',
          }),
        },
      });

      if (result.count > 0) {
        this.logger.log(`Marked ${result.count} stuck jobs as failed`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stuck jobs:', error);
    }
  }
}
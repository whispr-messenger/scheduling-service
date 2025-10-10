import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
import { Job, Schedule, Execution, JobCategory, ExecutionStatus } from '@/modules/scheduler/entities';
import { QueueService } from '@/modules/queues/services/queue.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface SystemMetrics {
  timestamp: Date;
  jobs: {
    total: number;
    active: number;
    completed24h: number;
    failed24h: number;
    pending: number;
  };
  executions: {
    total: number;
    successful24h: number;
    failed24h: number;
    averageDuration: number;
    successRate: number;
  };
  queues: {
    highPriority: QueueMetrics;
    mediumPriority: QueueMetrics;
    lowPriority: QueueMetrics;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private startTime = Date.now();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(JobCategory)
    private readonly jobCategoryRepository: Repository<JobCategory>,
    private readonly queueService: QueueService,
  ) {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    this.logger.log('Collecting system metrics');

    try {
      const [jobMetrics, executionMetrics, queueMetrics] = await Promise.all([
        this.getJobMetrics(),
        this.getExecutionMetrics(),
        this.getQueueMetrics(),
      ]);

      const systemMetrics = this.getSystemRuntimeMetrics();

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        jobs: jobMetrics,
        executions: executionMetrics,
        queues: queueMetrics,
        system: systemMetrics,
      };

      this.logger.log('System metrics collected successfully', {
        totalJobs: metrics.jobs.total,
        successRate: metrics.executions.successRate,
        uptime: metrics.system.uptime,
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
      throw error;
    }
  }

  async getJobMetrics() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalJobs, activeJobs, completed24h, failed24h, pendingJobs] = await Promise.all([
      this.jobRepository.count({ where: { deletedAt: IsNull() } }),
      this.jobRepository.count({ where: { isActive: true, deletedAt: IsNull() } }),
      this.executionRepository.count({
        where: {
          status: ExecutionStatus.COMPLETED,
          startedAt: MoreThanOrEqual(oneDayAgo),
        },
      }),
      this.executionRepository.count({
        where: {
          status: ExecutionStatus.FAILED,
          startedAt: MoreThanOrEqual(oneDayAgo),
        },
      }),
      this.scheduleRepository.count({ where: { isActive: true } }),
    ]);

    return {
      total: totalJobs,
      active: activeJobs,
      completed24h,
      failed24h,
      pending: pendingJobs,
    };
  }

  async getExecutionMetrics() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalExecutions, successful24h, failed24h] = await Promise.all([
      this.executionRepository.count(),
      this.executionRepository.count({
        where: {
          status: ExecutionStatus.COMPLETED,
          startedAt: MoreThanOrEqual(oneDayAgo),
        },
      }),
      this.executionRepository.count({
        where: {
          status: ExecutionStatus.FAILED,
          startedAt: MoreThanOrEqual(oneDayAgo),
        },
      }),
    ]);

    // Calculate average duration using query builder
    const avgResult = await this.executionRepository
      .createQueryBuilder('execution')
      .select('AVG(execution.durationMs)', 'avg')
      .where('execution.status = :status', { status: 'COMPLETED' })
      .andWhere('execution.durationMs IS NOT NULL')
      .andWhere('execution.startedAt >= :startedAt', { startedAt: oneDayAgo })
      .getRawOne();

    const total24h = successful24h + failed24h;
    const successRate = total24h > 0 ? (successful24h / total24h) * 100 : 100;

    return {
      total: totalExecutions,
      successful24h,
      failed24h,
      averageDuration: avgResult?.avg ? parseFloat(avgResult.avg) : 0,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  async getQueueMetrics() {
    const queueStats = await this.queueService.getAllQueueStats();

    const metrics = {
      highPriority: this.mapQueueStats(queueStats.find((q) => q.queueName === 'high-priority')),
      mediumPriority: this.mapQueueStats(queueStats.find((q) => q.queueName === 'medium-priority')),
      lowPriority: this.mapQueueStats(queueStats.find((q) => q.queueName === 'low-priority')),
    };

    return metrics;
  }

  private mapQueueStats(queueStat: any): QueueMetrics {
    if (!queueStat) {
      return {
        name: 'unknown',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    }

    return {
      name: queueStat.queueName,
      waiting: queueStat.counts.waiting,
      active: queueStat.counts.active,
      completed: queueStat.counts.completed,
      failed: queueStat.counts.failed,
      delayed: queueStat.counts.delayed,
      paused: queueStat.counts.paused,
    };
  }

  private getSystemRuntimeMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      uptime: Math.round(uptime / 1000), // seconds
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: 0, // Simplified - would need additional library for real CPU usage
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectAndLogMetrics() {
    try {
      const metrics = await this.getSystemMetrics();

      this.logger.log('Periodic metrics collection', {
        timestamp: metrics.timestamp,
        totalJobs: metrics.jobs.total,
        activeJobs: metrics.jobs.active,
        successRate: metrics.executions.successRate,
        queueBacklog: {
          high: metrics.queues.highPriority.waiting,
          medium: metrics.queues.mediumPriority.waiting,
          low: metrics.queues.lowPriority.waiting,
        },
        memoryUsage: `${metrics.system.memoryUsage}MB`,
        uptime: `${Math.round(metrics.system.uptime / 3600)}h`,
      });

      // Here you could store metrics in a time-series database
      // or send to monitoring service like Prometheus
    } catch (error) {
      this.logger.error('Failed to collect periodic metrics', error);
    }
  }

  async getJobCategoryMetrics() {
    const categories = await this.jobCategoryRepository.find({
      select: ['id', 'name'],
    });

    const categoryMetrics = await Promise.all(
      categories.map(async (category) => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Count total jobs in category
        const totalJobs = await this.jobRepository.count({
          where: {
            categoryId: category.id,
            deletedAt: IsNull(),
          },
        });

        // Count executions in last 24h
        const executions24h = await this.executionRepository
          .createQueryBuilder('execution')
          .innerJoin('execution.job', 'job')
          .where('job.categoryId = :categoryId', { categoryId: category.id })
          .andWhere('execution.startedAt >= :startedAt', { startedAt: oneDayAgo })
          .getCount();

        // Count successful executions in last 24h
        const successfulExecutions24h = await this.executionRepository
          .createQueryBuilder('execution')
          .innerJoin('execution.job', 'job')
          .where('job.categoryId = :categoryId', { categoryId: category.id })
          .andWhere('execution.status = :status', { status: 'COMPLETED' })
          .andWhere('execution.startedAt >= :startedAt', { startedAt: oneDayAgo })
          .getCount();

        const successRate =
          executions24h > 0 ? (successfulExecutions24h / executions24h) * 100 : 100;

        return {
          id: category.id,
          name: category.name,
          totalJobs,
          executions24h,
          successfulExecutions24h,
          successRate: Math.round(successRate * 100) / 100,
        };
      }),
    );

    return categoryMetrics;
  }
}

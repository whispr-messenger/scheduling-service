import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/database/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    this.logger.log('Collecting system metrics');

    try {
      const [
        jobMetrics,
        executionMetrics,
        queueMetrics,
        systemMetrics,
      ] = await Promise.all([
        this.getJobMetrics(),
        this.getExecutionMetrics(),
        this.getQueueMetrics(),
        this.getSystemMetrics(),
      ]);

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
    const [
      totalJobs,
      activeJobs,
      completed24h,
      failed24h,
      pendingJobs,
    ] = await Promise.all([
      this.prisma.job.count({ where: { deletedAt: null } }),
      this.prisma.job.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.execution.count({
        where: {
          status: 'COMPLETED',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.execution.count({
        where: {
          status: 'FAILED',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.schedule.count({ where: { isActive: true } }),
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

    const [
      totalExecutions,
      successful24h,
      failed24h,
      avgDuration,
    ] = await Promise.all([
      this.prisma.execution.count(),
      this.prisma.execution.count({
        where: {
          status: 'COMPLETED',
          startedAt: { gte: oneDayAgo },
        },
      }),
      this.prisma.execution.count({
        where: {
          status: 'FAILED',
          startedAt: { gte: oneDayAgo },
        },
      }),
      this.prisma.execution.aggregate({
        where: {
          status: 'COMPLETED',
          durationMs: { not: null },
          startedAt: { gte: oneDayAgo },
        },
        _avg: { durationMs: true },
      }),
    ]);

    const total24h = successful24h + failed24h;
    const successRate = total24h > 0 ? (successful24h / total24h) * 100 : 100;

    return {
      total: totalExecutions,
      successful24h,
      failed24h,
      averageDuration: avgDuration._avg.durationMs || 0,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  async getQueueMetrics() {
    const queueStats = await this.queueService.getAllQueueStats();

    const metrics = {
      highPriority: this.mapQueueStats(queueStats.find(q => q.queueName === 'high-priority')),
      mediumPriority: this.mapQueueStats(queueStats.find(q => q.queueName === 'medium-priority')),
      lowPriority: this.mapQueueStats(queueStats.find(q => q.queueName === 'low-priority')),
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

  private getSystemMetrics() {
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
    const categories = await this.prisma.jobCategory.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            jobs: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    const categoryMetrics = await Promise.all(
      categories.map(async (category) => {
        const executions24h = await this.prisma.execution.count({
          where: {
            job: {
              categoryId: category.id,
            },
            startedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        });

        const successfulExecutions24h = await this.prisma.execution.count({
          where: {
            job: {
              categoryId: category.id,
            },
            status: 'COMPLETED',
            startedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        });

        const successRate = executions24h > 0 ? (successfulExecutions24h / executions24h) * 100 : 100;

        return {
          id: category.id,
          name: category.name,
          totalJobs: category._count.jobs,
          executions24h,
          successfulExecutions24h,
          successRate: Math.round(successRate * 100) / 100,
        };
      })
    );

    return categoryMetrics;
  }
}
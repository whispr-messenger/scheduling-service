import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, Interval, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../../common/prisma.service';
import { Inject } from '@nestjs/common';
import { IQueueManager } from '../interfaces/queue-manager.interface';
import { ScheduleService } from './schedule.service';
import { JobData } from '../../queues/interfaces/job.interface';
import { ExecutionStatus, ScheduleType } from '../../../common/enums';
import { v4 as uuidv4 } from 'uuid';
import * as moment from 'moment-timezone';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly activeCronJobs = new Map<string, CronJob>();

  constructor(
    private readonly prisma: PrismaService,
    // @Inject('QUEUE_MANAGER') private readonly queueManager: IQueueManager, // Désactivé temporairement
    private readonly scheduleService: ScheduleService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Scheduler Service...');
    
    // Charger toutes les planifications actives au démarrage
    await this.loadActiveSchedules();
    
    this.logger.log('Scheduler Service initialized successfully');
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'check-scheduled-jobs',
    timeZone: 'UTC',
  })
  async checkScheduledJobs() {
    this.logger.debug('Checking for jobs to execute...');

    try {
      // Récupérer toutes les planifications actives
      const activeSchedules = await this.scheduleService.findActiveSchedules();
      
      for (const schedule of activeSchedules) {
        await this.processSchedule(schedule);
      }
    } catch (error) {
      this.logger.error('Error checking scheduled jobs:', error);
    }
  }

  @Interval('cleanup-expired-schedules', 10 * 60 * 1000) // Toutes les 10 minutes
  async cleanupExpiredSchedules() {
    this.logger.debug('Cleaning up expired schedules...');
    
    try {
      const cleanedCount = await this.scheduleService.cleanupExpiredSchedules();
      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired schedules`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired schedules:', error);
    }
  }

  @Cron('0 2 * * *', { // Tous les jours à 2h du matin
    name: 'daily-maintenance',
    timeZone: 'UTC',
  })
  async dailyMaintenance() {
    this.logger.log('Running daily maintenance...');

    try {
      // Nettoyer les exécutions anciennes (plus de 30 jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedExecutions = await this.prisma.execution.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
          status: {
            in: [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED],
          },
        },
      });

      this.logger.log(`Deleted ${deletedExecutions.count} old execution records`);

      // Nettoyer les logs d'exécution anciens
      const deletedLogs = await this.prisma.executionLog.deleteMany({
        where: {
          loggedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Deleted ${deletedLogs.count} old execution log records`);

      // Statistiques de santé
      await this.logHealthStatistics();

    } catch (error) {
      this.logger.error('Error during daily maintenance:', error);
    }
  }

  async createDynamicSchedule(scheduleId: string): Promise<void> {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          job: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!schedule || !schedule.isActive || !schedule.job.isActive) {
        this.logger.warn(`Schedule ${scheduleId} is not active or job is not active`);
        return;
      }

      if (schedule.scheduleType === ScheduleType.CRON && schedule.cronExpression) {
        // Créer un job cron dynamique
        const cronJob = new CronJob(
          schedule.cronExpression,
          async () => {
            await this.executeScheduledJob(schedule.id, schedule.job.id);
          },
          null,
          false,
          schedule.timezone,
        );

        // Enregistrer le job
        this.schedulerRegistry.addCronJob(`schedule-${scheduleId}`, cronJob as any);
        this.activeCronJobs.set(scheduleId, cronJob);
        
        // Démarrer le job
        cronJob.start();

        this.logger.log(`Created dynamic cron job for schedule ${scheduleId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create dynamic schedule ${scheduleId}:`, error);
    }
  }

  async removeDynamicSchedule(scheduleId: string): Promise<void> {
    try {
      const jobName = `schedule-${scheduleId}`;
      
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.activeCronJobs.delete(scheduleId);
        this.logger.log(`Removed dynamic schedule ${scheduleId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove dynamic schedule ${scheduleId}:`, error);
    }
  }

  async executeJobImmediately(jobId: string, correlationId?: string): Promise<string> {
    this.logger.log(`Executing job ${jobId} immediately`);

    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          category: true,
        },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (!job.isActive || job.deletedAt) {
        throw new Error(`Job ${jobId} is not active`);
      }

      const executionId = uuidv4();
      const jobData: JobData = {
        id: job.id,
        name: job.name,
        categoryId: job.categoryId,
        targetService: job.targetService,
        targetMethod: job.targetMethod,
        payload: typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload,
        priority: job.priority as any,
        maxRetries: job.maxRetries,
        timeoutSeconds: job.timeoutSeconds,
        correlationId: correlationId || uuidv4(),
        createdBy: job.createdBy,
        executionId,
      };

      // Ajouter à la queue appropriée
      // await this.queueManager.addJob(jobData); // Désactivé temporairement

      this.logger.log(`Job ${jobId} queued for immediate execution with execution ID ${executionId}`);
      return executionId;
    } catch (error) {
      this.logger.error(`Failed to execute job ${jobId} immediately:`, error);
      throw error;
    }
  }

  async getSchedulerStatistics() {
    try {
      const [activeSchedules, pendingExecutions, runningExecutions] = await Promise.all([
        this.prisma.schedule.count({
          where: { isActive: true },
        }),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.PENDING },
        }),
        this.prisma.execution.count({
          where: { status: ExecutionStatus.RUNNING },
        }),
      ]);

      // const queueStats = await this.queueManager.getAllQueueStats(); // Désactivé temporairement
    const queueStats = { totalJobs: 0, activeJobs: 0, waitingJobs: 0, completedJobs: 0, failedJobs: 0 };

      return {
        activeSchedules,
        pendingExecutions,
        runningExecutions,
        queues: queueStats,
        activeCronJobs: this.activeCronJobs.size,
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Failed to get scheduler statistics:', error);
      throw error;
    }
  }

  private async loadActiveSchedules(): Promise<void> {
    try {
      const activeSchedules = await this.scheduleService.findActiveSchedules();

      for (const schedule of activeSchedules) {
        if (schedule.scheduleType === ScheduleType.CRON) {
          await this.createDynamicSchedule(schedule.id);
        }
      }

      this.logger.log(`Loaded ${activeSchedules.length} active schedules`);
    } catch (error) {
      this.logger.error('Failed to load active schedules:', error);
    }
  }

  private async processSchedule(schedule: any): Promise<void> {
    try {
      const now = new Date();
      let shouldExecute = false;

      switch (schedule.scheduleType) {
        case ScheduleType.ONCE:
          if (schedule.scheduledAt) {
            const scheduledTime = new Date(schedule.scheduledAt);
            shouldExecute = scheduledTime <= now && scheduledTime > new Date(now.getTime() - 60000); // Dans la dernière minute
          }
          break;

        case ScheduleType.IMMEDIATE:
          shouldExecute = true;
          break;

        case ScheduleType.INTERVAL:
          // Pour les intervalles, vérifier la dernière exécution
          const lastExecution = await this.prisma.execution.findFirst({
            where: {
              jobId: schedule.job.id,
              scheduleId: schedule.id,
              status: {
                in: [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED],
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (!lastExecution) {
            shouldExecute = true;
          } else {
            const nextExecutionTime = new Date(lastExecution.createdAt.getTime() + (schedule.intervalSeconds * 1000));
            shouldExecute = nextExecutionTime <= now;
          }
          break;

        case ScheduleType.CRON:
          // Les tâches CRON sont gérées par les jobs dynamiques
          // Ne pas les traiter ici pour éviter la duplication
          shouldExecute = false;
          break;
      }

      if (shouldExecute) {
        await this.executeScheduledJob(schedule.id, schedule.job.id);
      }
    } catch (error) {
      this.logger.error(`Error processing schedule ${schedule.id}:`, error);
    }
  }

  private async executeScheduledJob(scheduleId: string, jobId: string): Promise<void> {
    try {
      // Vérifier s'il y a déjà une exécution en cours pour cette planification
      const runningExecution = await this.prisma.execution.findFirst({
        where: {
          jobId,
          scheduleId,
          status: ExecutionStatus.RUNNING,
        },
      });

      if (runningExecution) {
        this.logger.debug(`Job ${jobId} is already running, skipping execution`);
        return;
      }

      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: {
          category: true,
        },
      });

      if (!job || !job.isActive || job.deletedAt) {
        this.logger.warn(`Job ${jobId} is not active, skipping execution`);
        return;
      }

      const executionId = uuidv4();
      const jobData: JobData = {
        id: job.id,
        name: job.name,
        categoryId: job.categoryId,
        targetService: job.targetService,
        targetMethod: job.targetMethod,
        payload: typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload,
        priority: job.priority as any,
        maxRetries: job.maxRetries,
        timeoutSeconds: job.timeoutSeconds,
        correlationId: `schedule-${scheduleId}-${Date.now()}`,
        createdBy: job.createdBy,
        executionId,
      };

      // Ajouter à la queue appropriée
      // await this.queueManager.addJob(jobData); // Désactivé temporairement

      this.logger.log(`Scheduled job ${jobId} queued for execution from schedule ${scheduleId}`);

    } catch (error) {
      this.logger.error(`Failed to execute scheduled job ${jobId}:`, error);
    }
  }

  private async logHealthStatistics(): Promise<void> {
    try {
      const stats = await this.getSchedulerStatistics();
      this.logger.log('Daily health statistics:', stats);
    } catch (error) {
      this.logger.error('Failed to log health statistics:', error);
    }
  }
}
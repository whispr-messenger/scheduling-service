import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/database/prisma.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { ScheduleJobDto } from '../dto/schedule-job.dto';
import { JobResponseDto, ScheduleResponseDto, ExecutionResponseDto } from '../dto/job-response.dto';
import { Job, Schedule, Execution, Priority, ScheduleType, ExecutionStatus } from '@prisma/client';
import { CronUtil } from '@/common/utils/cron.util';
import { TimezoneUtil } from '@/common/utils/timezone.util';
import { RetryUtil } from '@/common/utils/retry.util';
import { QueueService } from '@/modules/queues/services/queue.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async createJob(createJobDto: CreateJobDto): Promise<JobResponseDto> {
    this.logger.log('Creating new job', { name: createJobDto.name });

    try {
      // Validate category exists
      const category = await this.prisma.jobCategory.findUnique({
        where: { id: createJobDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Job category with ID ${createJobDto.categoryId} not found`);
      }

      // Apply defaults from category if not provided
      const jobData = {
        ...createJobDto,
        priority: createJobDto.priority || category.defaultPriority,
        maxRetries: createJobDto.maxRetries ?? category.defaultMaxRetries,
        timeoutSeconds: createJobDto.timeoutSeconds ?? category.defaultTimeout,
      };

      const job = await this.prisma.job.create({
        data: jobData,
        include: {
          category: true,
        },
      });

      this.logger.log('Job created successfully', { jobId: job.id, name: job.name });

      return this.mapJobToResponse(job);
    } catch (error) {
      this.logger.error('Failed to create job', { error: error.message, dto: createJobDto });
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create job');
    }
  }

  async scheduleJob(scheduleJobDto: ScheduleJobDto): Promise<ScheduleResponseDto> {
    this.logger.log('Scheduling job', { jobId: scheduleJobDto.jobId });

    try {
      // Validate custom DTO
      const validationErrors = scheduleJobDto.validate();
      if (validationErrors.length > 0) {
        throw new BadRequestException(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Validate job exists
      const job = await this.prisma.job.findUnique({
        where: { id: scheduleJobDto.jobId },
        include: { category: true },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${scheduleJobDto.jobId} not found`);
      }

      if (!job.isActive) {
        throw new BadRequestException('Cannot schedule inactive job');
      }

      // Create schedule
      const schedule = await this.prisma.schedule.create({
        data: {
          jobId: scheduleJobDto.jobId,
          scheduleType: scheduleJobDto.scheduleType,
          cronExpression: scheduleJobDto.cronExpression,
          intervalSeconds: scheduleJobDto.intervalSeconds,
          scheduledAt: scheduleJobDto.scheduledAt ? new Date(scheduleJobDto.scheduledAt) : null,
          timezone: scheduleJobDto.timezone || 'UTC',
          startsAt: scheduleJobDto.startsAt ? new Date(scheduleJobDto.startsAt) : null,
          endsAt: scheduleJobDto.endsAt ? new Date(scheduleJobDto.endsAt) : null,
        },
      });

      // Add to queue based on schedule type
      await this.addToQueue(job, schedule);

      this.logger.log('Job scheduled successfully', {
        scheduleId: schedule.id,
        jobId: job.id,
        scheduleType: schedule.scheduleType,
      });

      return this.mapScheduleToResponse(schedule);
    } catch (error) {
      this.logger.error('Failed to schedule job', { error: error.message, dto: scheduleJobDto });
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to schedule job');
    }
  }

  async executeJob(jobId: string, scheduleId?: string, correlationId?: string): Promise<ExecutionResponseDto> {
    const executionId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Starting job execution', {
      executionId,
      jobId,
      scheduleId,
      correlationId
    });

    // Create execution record
    const execution = await this.prisma.execution.create({
      data: {
        id: executionId,
        jobId,
        scheduleId,
        status: ExecutionStatus.RUNNING,
        correlationId: correlationId || uuidv4(),
        startedAt: new Date(),
      },
    });

    try {
      // Get job details
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { category: true },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      // Execute job with timeout
      const result = await this.executeWithTimeout(job, execution.timeoutSeconds * 1000);

      // Update execution with success
      const duration = Date.now() - startTime;
      const updatedExecution = await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          resultData: result,
          durationMs: duration,
        },
      });

      this.logger.log('Job execution completed successfully', {
        executionId,
        jobId,
        duration
      });

      return this.mapExecutionToResponse(updatedExecution);
    } catch (error) {
      // Update execution with failure
      const duration = Date.now() - startTime;
      const updatedExecution = await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: ExecutionStatus.FAILED,
          failedAt: new Date(),
          errorData: {
            error: error.message,
            stack: error.stack,
          },
          durationMs: duration,
        },
      });

      this.logger.error('Job execution failed', {
        executionId,
        jobId,
        error: error.message,
        duration,
      });

      return this.mapExecutionToResponse(updatedExecution);
    }
  }

  async getJob(jobId: string): Promise<JobResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { category: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return this.mapJobToResponse(job);
  }

  async getJobExecutions(jobId: string, limit = 50, offset = 0): Promise<ExecutionResponseDto[]> {
    const executions = await this.prisma.execution.findMany({
      where: { jobId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return executions.map(execution => this.mapExecutionToResponse(execution));
  }

  async getSchedules(jobId?: string): Promise<ScheduleResponseDto[]> {
    const schedules = await this.prisma.schedule.findMany({
      where: jobId ? { jobId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return schedules.map(schedule => this.mapScheduleToResponse(schedule));
  }

  async cancelSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { isActive: false },
    });

    // Remove from queue
    await this.queueService.removeJob(scheduleId);

    this.logger.log('Schedule cancelled', { scheduleId });
  }

  private async addToQueue(job: Job, schedule: Schedule): Promise<void> {
    const queueName = this.getQueueName(job.priority);

    switch (schedule.scheduleType) {
      case ScheduleType.IMMEDIATE:
        await this.queueService.addJob(queueName, 'execute-job', {
          jobId: job.id,
          scheduleId: schedule.id,
        });
        break;

      case ScheduleType.ONCE:
        if (schedule.scheduledAt) {
          const delay = schedule.scheduledAt.getTime() - Date.now();
          await this.queueService.addJob(queueName, 'execute-job', {
            jobId: job.id,
            scheduleId: schedule.id,
          }, {
            delay: Math.max(0, delay),
            jobId: schedule.id,
          });
        }
        break;

      case ScheduleType.CRON:
        await this.queueService.addRepeatableJob(queueName, 'execute-job', {
          jobId: job.id,
          scheduleId: schedule.id,
        }, {
          cron: schedule.cronExpression!,
          tz: schedule.timezone,
          jobId: schedule.id,
        });
        break;

      case ScheduleType.INTERVAL:
        await this.queueService.addRepeatableJob(queueName, 'execute-job', {
          jobId: job.id,
          scheduleId: schedule.id,
        }, {
          every: schedule.intervalSeconds! * 1000,
          jobId: schedule.id,
        });
        break;
    }
  }

  private async executeWithTimeout(job: Job, timeoutMs: number): Promise<any> {
    // This would normally call the target service via gRPC
    // For now, we'll simulate execution
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Job execution timeout'));
      }, timeoutMs);

      // Simulate async work
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          service: job.targetService,
          method: job.targetMethod,
          payload: job.payload,
          executedAt: new Date().toISOString(),
        });
      }, Math.random() * 1000); // Random execution time up to 1 second
    });
  }

  private getQueueName(priority: Priority): string {
    switch (priority) {
      case Priority.CRITICAL:
      case Priority.HIGH:
        return 'high-priority';
      case Priority.MEDIUM:
        return 'medium-priority';
      case Priority.LOW:
        return 'low-priority';
      default:
        return 'medium-priority';
    }
  }

  private mapJobToResponse(job: Job & { category?: any }): JobResponseDto {
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      categoryId: job.categoryId,
      targetService: job.targetService,
      targetMethod: job.targetMethod,
      payload: job.payload as Record<string, any>,
      priority: job.priority,
      maxRetries: job.maxRetries,
      timeoutSeconds: job.timeoutSeconds,
      isActive: job.isActive,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      deletedAt: job.deletedAt,
    };
  }

  private mapScheduleToResponse(schedule: Schedule): ScheduleResponseDto {
    return {
      id: schedule.id,
      jobId: schedule.jobId,
      scheduleType: schedule.scheduleType,
      cronExpression: schedule.cronExpression,
      intervalSeconds: schedule.intervalSeconds,
      scheduledAt: schedule.scheduledAt,
      timezone: schedule.timezone,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  private mapExecutionToResponse(execution: Execution): ExecutionResponseDto {
    return {
      id: execution.id,
      jobId: execution.jobId,
      scheduleId: execution.scheduleId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      attemptNumber: execution.attemptNumber,
      resultData: execution.resultData as Record<string, any>,
      errorData: execution.errorData as Record<string, any>,
      durationMs: execution.durationMs,
      workerId: execution.workerId,
      correlationId: execution.correlationId,
      createdAt: execution.createdAt,
    };
  }
}
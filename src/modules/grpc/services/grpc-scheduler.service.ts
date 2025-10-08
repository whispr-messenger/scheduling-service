import { Injectable, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { SchedulerService } from '@/modules/scheduler/services/scheduler.service';
import { CustomHealthService } from '@/modules/monitoring/services/health.service';
import { MetricsService } from '@/modules/monitoring/services/metrics.service';
import {
  CreateJobRequest,
  GetJobRequest,
  ScheduleJobRequest,
  ExecuteJobRequest,
  CancelScheduleRequest,
  JobResponse,
  ScheduleResponse,
  ExecutionResponse,
  HealthResponse,
  MetricsResponse,
  Priority as GrpcPriority,
  ScheduleType as GrpcScheduleType,
  ExecutionStatus as GrpcExecutionStatus,
} from '../interfaces/scheduler.interface';
import { CreateJobDto } from '@/modules/scheduler/dto/create-job.dto';
import { ScheduleJobDto } from '@/modules/scheduler/dto/schedule-job.dto';
import { Priority, ScheduleType, ExecutionStatus } from '@prisma/client';

@GrpcService('SchedulerService')
@Injectable()
export class GrpcSchedulerService {
  private readonly logger = new Logger(GrpcSchedulerService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly healthService: CustomHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @GrpcMethod('SchedulerService', 'CreateJob')
  async createJob(request: CreateJobRequest): Promise<JobResponse> {
    this.logger.log('gRPC CreateJob called', { name: request.name });

    const createJobDto: CreateJobDto = {
      name: request.name,
      description: request.description,
      categoryId: request.categoryId,
      targetService: request.targetService,
      targetMethod: request.targetMethod,
      payload: JSON.parse(request.payload || '{}'),
      priority: this.mapGrpcToPrismaPriority(request.priority),
      maxRetries: request.maxRetries,
      timeoutSeconds: request.timeoutSeconds,
      createdBy: request.createdBy,
    };

    const job = await this.schedulerService.createJob(createJobDto);
    return this.mapJobToGrpcResponse(job);
  }

  @GrpcMethod('SchedulerService', 'GetJob')
  async getJob(request: GetJobRequest): Promise<JobResponse> {
    this.logger.log('gRPC GetJob called', { jobId: request.jobId });

    const job = await this.schedulerService.getJob(request.jobId);
    return this.mapJobToGrpcResponse(job);
  }

  @GrpcMethod('SchedulerService', 'ScheduleJob')
  async scheduleJob(request: ScheduleJobRequest): Promise<ScheduleResponse> {
    this.logger.log('gRPC ScheduleJob called', { jobId: request.jobId });

    const scheduleJobDto = new ScheduleJobDto();
    scheduleJobDto.jobId = request.jobId;
    scheduleJobDto.scheduleType = this.mapGrpcToPrismaScheduleType(request.scheduleType);
    scheduleJobDto.cronExpression = request.cronExpression;
    scheduleJobDto.intervalSeconds = request.intervalSeconds;
    scheduleJobDto.scheduledAt = request.scheduledAt?.toISOString();
    scheduleJobDto.timezone = request.timezone;
    scheduleJobDto.startsAt = request.startsAt?.toISOString();
    scheduleJobDto.endsAt = request.endsAt?.toISOString();

    // Validate the DTO
    const validationErrors = scheduleJobDto.validate();
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const schedule = await this.schedulerService.scheduleJob(scheduleJobDto);
    return this.mapScheduleToGrpcResponse(schedule);
  }

  @GrpcMethod('SchedulerService', 'ExecuteJob')
  async executeJob(request: ExecuteJobRequest): Promise<ExecutionResponse> {
    this.logger.log('gRPC ExecuteJob called', { jobId: request.jobId });

    const execution = await this.schedulerService.executeJob(
      request.jobId,
      request.scheduleId,
      request.correlationId,
    );

    return this.mapExecutionToGrpcResponse(execution);
  }

  @GrpcMethod('SchedulerService', 'CancelSchedule')
  async cancelSchedule(request: CancelScheduleRequest): Promise<void> {
    this.logger.log('gRPC CancelSchedule called', { scheduleId: request.scheduleId });

    await this.schedulerService.cancelSchedule(request.scheduleId);
  }

  @GrpcMethod('SchedulerService', 'HealthCheck')
  async healthCheck(): Promise<HealthResponse> {
    this.logger.log('gRPC HealthCheck called');

    try {
      const healthResult = await this.healthService.check();

      return {
        status: healthResult.status,
        message: healthResult.status === 'ok' ? 'Service is healthy' : 'Service has issues',
        timestamp: new Date(),
        details: this.flattenHealthDetails(healthResult),
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date(),
        details: { error: error.message },
      };
    }
  }

  @GrpcMethod('SchedulerService', 'GetMetrics')
  async getMetrics(): Promise<MetricsResponse> {
    this.logger.log('gRPC GetMetrics called');

    const metrics = await this.metricsService.getSystemMetrics();

    return {
      timestamp: metrics.timestamp,
      jobs: {
        total: metrics.jobs.total,
        active: metrics.jobs.active,
        completed24h: metrics.jobs.completed24h,
        failed24h: metrics.jobs.failed24h,
        pending: metrics.jobs.pending,
      },
      executions: {
        total: metrics.executions.total,
        successful24h: metrics.executions.successful24h,
        failed24h: metrics.executions.failed24h,
        averageDuration: metrics.executions.averageDuration,
        successRate: metrics.executions.successRate,
      },
      queues: {
        highPriority: {
          name: metrics.queues.highPriority.name,
          waiting: metrics.queues.highPriority.waiting,
          active: metrics.queues.highPriority.active,
          completed: metrics.queues.highPriority.completed,
          failed: metrics.queues.highPriority.failed,
          delayed: metrics.queues.highPriority.delayed,
          paused: metrics.queues.highPriority.paused,
        },
        mediumPriority: {
          name: metrics.queues.mediumPriority.name,
          waiting: metrics.queues.mediumPriority.waiting,
          active: metrics.queues.mediumPriority.active,
          completed: metrics.queues.mediumPriority.completed,
          failed: metrics.queues.mediumPriority.failed,
          delayed: metrics.queues.mediumPriority.delayed,
          paused: metrics.queues.mediumPriority.paused,
        },
        lowPriority: {
          name: metrics.queues.lowPriority.name,
          waiting: metrics.queues.lowPriority.waiting,
          active: metrics.queues.lowPriority.active,
          completed: metrics.queues.lowPriority.completed,
          failed: metrics.queues.lowPriority.failed,
          delayed: metrics.queues.lowPriority.delayed,
          paused: metrics.queues.lowPriority.paused,
        },
      },
      system: {
        uptime: metrics.system.uptime,
        memoryUsage: metrics.system.memoryUsage,
        cpuUsage: metrics.system.cpuUsage,
      },
    };
  }

  private mapJobToGrpcResponse(job: any): JobResponse {
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      categoryId: job.categoryId,
      targetService: job.targetService,
      targetMethod: job.targetMethod,
      payload: JSON.stringify(job.payload),
      priority: this.mapPrismaToGrpcPriority(job.priority),
      maxRetries: job.maxRetries,
      timeoutSeconds: job.timeoutSeconds,
      isActive: job.isActive,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private mapScheduleToGrpcResponse(schedule: any): ScheduleResponse {
    return {
      id: schedule.id,
      jobId: schedule.jobId,
      scheduleType: this.mapPrismaToGrpcScheduleType(schedule.scheduleType),
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

  private mapExecutionToGrpcResponse(execution: any): ExecutionResponse {
    return {
      id: execution.id,
      jobId: execution.jobId,
      scheduleId: execution.scheduleId,
      status: this.mapPrismaToGrpcExecutionStatus(execution.status),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      attemptNumber: execution.attemptNumber,
      resultData: execution.resultData ? JSON.stringify(execution.resultData) : undefined,
      errorData: execution.errorData ? JSON.stringify(execution.errorData) : undefined,
      durationMs: execution.durationMs,
      workerId: execution.workerId,
      correlationId: execution.correlationId,
      createdAt: execution.createdAt,
    };
  }

  private mapGrpcToPrismaPriority(grpcPriority?: GrpcPriority): Priority {
    switch (grpcPriority) {
      case GrpcPriority.LOW:
        return Priority.LOW;
      case GrpcPriority.MEDIUM:
        return Priority.MEDIUM;
      case GrpcPriority.HIGH:
        return Priority.HIGH;
      case GrpcPriority.CRITICAL:
        return Priority.CRITICAL;
      default:
        return Priority.MEDIUM;
    }
  }

  private mapPrismaToGrpcPriority(prismaPriority: Priority): GrpcPriority {
    switch (prismaPriority) {
      case Priority.LOW:
        return GrpcPriority.LOW;
      case Priority.MEDIUM:
        return GrpcPriority.MEDIUM;
      case Priority.HIGH:
        return GrpcPriority.HIGH;
      case Priority.CRITICAL:
        return GrpcPriority.CRITICAL;
      default:
        return GrpcPriority.MEDIUM;
    }
  }

  private mapGrpcToPrismaScheduleType(grpcScheduleType: GrpcScheduleType): ScheduleType {
    switch (grpcScheduleType) {
      case GrpcScheduleType.CRON:
        return ScheduleType.CRON;
      case GrpcScheduleType.INTERVAL:
        return ScheduleType.INTERVAL;
      case GrpcScheduleType.ONCE:
        return ScheduleType.ONCE;
      case GrpcScheduleType.IMMEDIATE:
        return ScheduleType.IMMEDIATE;
      default:
        return ScheduleType.ONCE;
    }
  }

  private mapPrismaToGrpcScheduleType(prismaScheduleType: ScheduleType): GrpcScheduleType {
    switch (prismaScheduleType) {
      case ScheduleType.CRON:
        return GrpcScheduleType.CRON;
      case ScheduleType.INTERVAL:
        return GrpcScheduleType.INTERVAL;
      case ScheduleType.ONCE:
        return GrpcScheduleType.ONCE;
      case ScheduleType.IMMEDIATE:
        return GrpcScheduleType.IMMEDIATE;
      default:
        return GrpcScheduleType.ONCE;
    }
  }

  private mapPrismaToGrpcExecutionStatus(prismaStatus: ExecutionStatus): GrpcExecutionStatus {
    switch (prismaStatus) {
      case ExecutionStatus.PENDING:
        return GrpcExecutionStatus.PENDING;
      case ExecutionStatus.RUNNING:
        return GrpcExecutionStatus.RUNNING;
      case ExecutionStatus.COMPLETED:
        return GrpcExecutionStatus.COMPLETED;
      case ExecutionStatus.FAILED:
        return GrpcExecutionStatus.FAILED;
      case ExecutionStatus.CANCELLED:
        return GrpcExecutionStatus.CANCELLED;
      case ExecutionStatus.TIMEOUT:
        return GrpcExecutionStatus.TIMEOUT;
      default:
        return GrpcExecutionStatus.PENDING;
    }
  }

  private flattenHealthDetails(healthResult: any): Record<string, string> {
    const details: Record<string, string> = {};

    if (healthResult.info) {
      Object.entries(healthResult.info).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object') {
          details[key] = JSON.stringify(value);
        } else {
          details[key] = String(value);
        }
      });
    }

    if (healthResult.error) {
      Object.entries(healthResult.error).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object') {
          details[`error_${key}`] = JSON.stringify(value);
        } else {
          details[`error_${key}`] = String(value);
        }
      });
    }

    return details;
  }
}

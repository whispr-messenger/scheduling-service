import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailJobHandler } from '../handlers/email-job.handler';
import { NotificationJobHandler } from '../handlers/notification-job.handler';
import { WebhookJobHandler } from '../handlers/webhook-job.handler';
import { ExecutionStatus } from '@prisma/client';

export interface JobData {
  id: string;
  type: string;
  payload: Record<string, any>;
  jobId?: string;
  scheduleId?: string;
  attemptNumber?: number;
}

@Processor('scheduler')
export class JobProcessor {
  private readonly logger = new Logger(JobProcessor.name);
  private readonly handlers: Map<string, any>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailHandler: EmailJobHandler,
    private readonly notificationHandler: NotificationJobHandler,
    private readonly webhookHandler: WebhookJobHandler,
  ) {
    this.handlers = new Map([
      ['email', this.emailHandler],
      ['notification', this.notificationHandler],
      ['webhook', this.webhookHandler],
      ['push_notification', this.notificationHandler],
      ['sms', this.notificationHandler],
    ]);
  }

  @Process('*')
  async handleJob(job: Job<JobData>): Promise<any> {
    const startTime = Date.now();
    const { type, payload, jobId, scheduleId, attemptNumber = 1 } = job.data;

    this.logger.log(`Processing job: ${job.id} | Type: ${type} | Attempt: ${attemptNumber}`);

    // Create execution record
    const execution = await this.createExecution(
      jobId || job.data.id,
      scheduleId,
      attemptNumber,
    );

    try {
      // Get handler for this job type
      const handler = this.handlers.get(type);

      if (!handler) {
        throw new Error(`No handler found for job type: ${type}`);
      }

      // Execute the job
      const result = await handler.execute(payload);

      // Calculate duration
      const durationMs = Date.now() - startTime;

      // Update execution as completed
      await this.completeExecution(execution.id, result, durationMs);

      this.logger.log(`Job ${job.id} completed successfully in ${durationMs}ms`);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Log the error
      await this.logExecutionError(execution.id, error);

      // Update execution as failed
      await this.failExecution(execution.id, error, durationMs);

      this.logger.error(`Job ${job.id} failed after ${durationMs}ms: ${error.message}`);

      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed with result:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`, error.stack);
  }

  // Private helper methods

  private async createExecution(
    jobId: string,
    scheduleId: string | undefined,
    attemptNumber: number,
  ) {
    return this.prisma.execution.create({
      data: {
        jobId,
        scheduleId,
        status: ExecutionStatus.RUNNING,
        attemptNumber,
        startedAt: new Date(),
        workerId: process.pid.toString(),
      },
    });
  }

  private async completeExecution(
    executionId: string,
    result: any,
    durationMs: number,
  ) {
    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.COMPLETED,
        completedAt: new Date(),
        resultData: result,
        durationMs,
      },
    });

    await this.logExecutionInfo(executionId, 'Job completed successfully', { result });
  }

  private async failExecution(
    executionId: string,
    error: Error,
    durationMs: number,
  ) {
    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.FAILED,
        failedAt: new Date(),
        errorData: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        durationMs,
      },
    });
  }

  private async logExecutionInfo(
    executionId: string,
    message: string,
    context: Record<string, any> = {},
  ) {
    await this.prisma.executionLog.create({
      data: {
        executionId,
        logLevel: 'INFO',
        message,
        context,
      },
    });
  }

  private async logExecutionError(
    executionId: string,
    error: Error,
  ) {
    await this.prisma.executionLog.create({
      data: {
        executionId,
        logLevel: 'ERROR',
        message: error.message,
        context: {
          stack: error.stack,
          name: error.name,
        },
      },
    });
  }
}

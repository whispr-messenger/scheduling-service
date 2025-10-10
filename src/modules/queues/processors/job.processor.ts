import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SchedulerService } from '@/modules/scheduler/services/scheduler.service';

@Processor('high-priority')
export class HighPriorityJobProcessor {
  private readonly logger = new Logger(HighPriorityJobProcessor.name);

  constructor(private schedulerService: SchedulerService) {}

  @Process('execute-job')
  async handleJobExecution(job: Job) {
    const { jobId, scheduleId } = job.data;

    this.logger.log('Processing high priority job', {
      jobId,
      scheduleId,
      bullJobId: job.id,
    });

    try {
      const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

      this.logger.log('High priority job completed', {
        jobId,
        executionId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('High priority job failed', {
        jobId,
        scheduleId,
        error: error.message,
      });
      throw error;
    }
  }
}

@Processor('medium-priority')
export class MediumPriorityJobProcessor {
  private readonly logger = new Logger(MediumPriorityJobProcessor.name);

  constructor(private schedulerService: SchedulerService) {}

  @Process('execute-job')
  async handleJobExecution(job: Job) {
    const { jobId, scheduleId } = job.data;

    this.logger.log('Processing medium priority job', {
      jobId,
      scheduleId,
      bullJobId: job.id,
    });

    try {
      const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

      this.logger.log('Medium priority job completed', {
        jobId,
        executionId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Medium priority job failed', {
        jobId,
        scheduleId,
        error: error.message,
      });
      throw error;
    }
  }
}

@Processor('low-priority')
export class LowPriorityJobProcessor {
  private readonly logger = new Logger(LowPriorityJobProcessor.name);

  constructor(private schedulerService: SchedulerService) {}

  @Process('execute-job')
  async handleJobExecution(job: Job) {
    const { jobId, scheduleId } = job.data;

    this.logger.log('Processing low priority job', {
      jobId,
      scheduleId,
      bullJobId: job.id,
    });

    try {
      const result = await this.schedulerService.executeJob(jobId, scheduleId, `bull-${job.id}`);

      this.logger.log('Low priority job completed', {
        jobId,
        executionId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error('Low priority job failed', {
        jobId,
        scheduleId,
        error: error.message,
      });
      throw error;
    }
  }
}

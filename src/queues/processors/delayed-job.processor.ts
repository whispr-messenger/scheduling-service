import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { JobProcessor, JobData } from './job.processor';

@Processor('delayed')
export class DelayedJobProcessor extends JobProcessor {
  protected readonly logger = new Logger(DelayedJobProcessor.name);

  @Process('*')
  async handleDelayedJob(job: Job<JobData>): Promise<any> {
    this.logger.log(`Processing DELAYED job: ${job.id}`);
    return super.handleJob(job);
  }
}

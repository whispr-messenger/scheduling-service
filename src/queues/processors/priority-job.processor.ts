import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { JobProcessor, JobData } from './job.processor';

@Processor('priority')
export class PriorityJobProcessor extends JobProcessor {
  protected readonly logger = new Logger(PriorityJobProcessor.name);

  @Process('*')
  async handlePriorityJob(job: Job<JobData>): Promise<any> {
    this.logger.log(`Processing PRIORITY job: ${job.id}`);
    return super.handleJob(job);
  }
}

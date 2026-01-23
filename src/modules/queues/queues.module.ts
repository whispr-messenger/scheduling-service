import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './services/queue.service';
import {
  HighPriorityJobProcessor,
  MediumPriorityJobProcessor,
  LowPriorityJobProcessor,
} from './processors/job.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'high-priority',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 200,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
      {
        name: 'medium-priority',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'low-priority',
        defaultJobOptions: {
          removeOnComplete: 25,
          removeOnFail: 50,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
    ),
  ],
  providers: [
    QueueService,
    HighPriorityJobProcessor,
    MediumPriorityJobProcessor,
    LowPriorityJobProcessor,
  ],
  exports: [QueueService],
})
export class QueuesModule {}

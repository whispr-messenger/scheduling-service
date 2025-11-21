import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

// Services
import { QueueService } from './queue.service';

// Processors
import { JobProcessor } from './processors/job.processor';
import { PriorityJobProcessor } from './processors/priority-job.processor';
import { DelayedJobProcessor } from './processors/delayed-job.processor';

// Handlers
import { EmailJobHandler } from './handlers/email-job.handler';
import { NotificationJobHandler } from './handlers/notification-job.handler';
import { WebhookJobHandler } from './handlers/webhook-job.handler';

// Prisma
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'scheduler',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'priority',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
      {
        name: 'delayed',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      },
    ),
    PrismaModule,
  ],
  providers: [
    QueueService,
    // Processors
    JobProcessor,
    PriorityJobProcessor,
    DelayedJobProcessor,
    // Handlers
    EmailJobHandler,
    NotificationJobHandler,
    WebhookJobHandler,
  ],
  exports: [QueueService],
})
export class QueueModule {}

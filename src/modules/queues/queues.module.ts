import { Module } from '@nestjs/common';
import { QueueManagerService } from './services/queue-manager.service';
import { BullModule } from '@nestjs/bull';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'high-priority',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'medium-priority',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      },
      {
        name: 'low-priority',
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 10,
          attempts: 1,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        },
      },
    ),
    TasksModule,
  ],
  providers: [QueueManagerService],
  exports: [QueueManagerService, BullModule],
})
export class QueuesModule {}
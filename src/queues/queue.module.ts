import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'scheduler',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
      {
        name: 'priority',
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 10,
        },
      },
      {
        name: 'delayed',
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 3,
        },
      },
    ),
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}

/* eslint-disable @typescript-eslint/no-unused-vars */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './services/queue.service';
import {
  HighPriorityJobProcessor,
  MediumPriorityJobProcessor,
  LowPriorityJobProcessor,
} from './processors/job.processor';
import { bullConfig } from '@/config/redis.config';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          keyPrefix: 'bull:whispr:',
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
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

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { Job } from './entities/job.entity';
import { Schedule } from './entities/schedule.entity';
import { JobExecution } from './entities/job-execution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Schedule, JobExecution]),
    BullModule.registerQueue({
      name: 'scheduler',
    }),
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
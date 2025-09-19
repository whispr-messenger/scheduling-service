import { Module } from '@nestjs/common';
import { JobsController } from './controllers/jobs.controller';
import { SchedulesController } from './controllers/schedules.controller';
import { JobService } from './services/job.service';
import { ScheduleService } from './services/schedule.service';
import { SchedulerService } from './services/scheduler.service';
import { RedisService } from '../../common/redis.service';
import { QueuesModule } from '../queues/queues.module';
import { QueueManagerService } from '../queues/services/queue-manager.service';

@Module({
  imports: [/* QueuesModule */], // Désactivé temporairement
  controllers: [JobsController, SchedulesController],
  providers: [
    JobService,
    ScheduleService,
    SchedulerService,
    // RedisService, // Désactivé temporairement
    // {
    //   provide: 'QUEUE_MANAGER',
    //   useClass: QueueManagerService,
    // },
  ],
  exports: [JobService, ScheduleService, SchedulerService],
})
export class SchedulerModule {}
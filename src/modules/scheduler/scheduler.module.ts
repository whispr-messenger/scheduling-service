import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchedulerController } from './controllers/scheduler.controller';
import { SchedulerService } from './services/scheduler.service';
import { DatabaseModule } from '@/modules/database/database.module';
import { QueuesModule } from '@/modules/queues/queues.module';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    QueuesModule,
    CommonModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
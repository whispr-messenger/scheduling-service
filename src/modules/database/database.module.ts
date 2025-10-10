import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Job,
  Schedule,
  Execution,
  JobCategory,
  ExecutionLog,
  RecurringJob,
  JobDependency,
} from '@/modules/scheduler/entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      Schedule,
      Execution,
      JobCategory,
      ExecutionLog,
      RecurringJob,
      JobDependency,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

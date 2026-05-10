import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SchedulerController } from './controllers/scheduler.controller';
import { SchedulerService } from './services/scheduler.service';
import { DatabaseModule } from '@/modules/database/database.module';
import { QueuesModule } from '@/modules/queues/queues.module';
import { GrpcModule } from '@/modules/grpc/grpc.module';
import { CommonModule } from '@/common/common.module';
import { InternalApiGuard } from '@/common/guards/internal-api.guard';
import { Job, Schedule, Execution, JobCategory, ExecutionLog, RecurringJob, JobDependency } from './entities';

@Module({
	imports: [
		ConfigModule,
		DatabaseModule,
		TypeOrmModule.forFeature([
			Job,
			Schedule,
			Execution,
			JobCategory,
			ExecutionLog,
			RecurringJob,
			JobDependency,
		]),
		forwardRef(() => QueuesModule),
		forwardRef(() => GrpcModule),
		CommonModule,
	],
	controllers: [SchedulerController],
	providers: [SchedulerService, InternalApiGuard],
	exports: [SchedulerService],
})
export class SchedulerModule {}

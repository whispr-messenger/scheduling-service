import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GrpcSchedulerService } from './services/grpc-scheduler.service';
import { MessagingGrpcClient } from './clients/messaging.client';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { MonitoringModule } from '@/modules/monitoring/monitoring.module';
import { QueuesModule } from '@/modules/queues/queues.module';

@Module({
	imports: [
		ConfigModule,
		// Phase 1.5: outbound messaging transport is BullMQ, so old gRPC client registration is removed
		// to avoid runtime proto loading / startup coupling to messaging.proto.
		forwardRef(() => SchedulerModule),
		forwardRef(() => MonitoringModule),
		forwardRef(() => QueuesModule),
	],
	providers: [GrpcSchedulerService, MessagingGrpcClient],
	exports: [GrpcSchedulerService, MessagingGrpcClient],
})
export class GrpcModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringController } from './controllers/monitoring.controller';
import { CustomHealthService } from './services/health.service';
import { MetricsService } from './services/metrics.service';
import { DatabaseModule } from '@/modules/database/database.module';
import { QueuesModule } from '@/modules/queues/queues.module';
import { CommonModule } from '@/common/common.module';
import { Job, Schedule, Execution, JobCategory } from '@/modules/scheduler/entities';

@Module({
	imports: [
		ConfigModule,
		TerminusModule,
		ScheduleModule.forRoot(),
		DatabaseModule,
		TypeOrmModule.forFeature([Job, Schedule, Execution, JobCategory]),
		QueuesModule,
		CommonModule,
	],
	controllers: [MonitoringController],
	providers: [CustomHealthService, MetricsService],
	exports: [CustomHealthService, MetricsService],
})
export class MonitoringModule {}

import { Module } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/modules/health/health.controller';
import { SchedulerController } from '../src/modules/scheduler/controllers/scheduler.controller';
import { SchedulerService } from '../src/modules/scheduler/services/scheduler.service';
import { NotFoundException } from '@nestjs/common';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

@Module({
	controllers: [HealthController, SchedulerController],
	providers: [
		LoggingInterceptor,
		{
			provide: DataSource,
			useValue: {
				query: async () => [{ '?column?': 1 }],
			},
		},
		{
			provide: CACHE_MANAGER,
			useValue: {
				set: async () => undefined,
				get: async () => 'ok',
			},
		},
		{
			provide: SchedulerService,
			useValue: {
				getJob: async () => {
					throw new NotFoundException('Job not found');
				},
				executeJob: async () => {
					throw new NotFoundException('Job not found');
				},
			},
		},
	],
})
export class TestAppModule {}

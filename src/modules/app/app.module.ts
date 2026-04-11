import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { CacheModule, CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard, ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { QueuesModule } from '../queues/queues.module';
import { DatabaseModule } from '../database/database.module';
import { typeOrmModuleOptionsFactory } from './typeorm';
import { cacheModuleOptionsFactory } from './cache';
import { buildRedisConnection } from './redis-connection';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../auth/auth.module';
import { CacheShutdownService } from './cache-shutdown.service';

// Environment variables
const configModuleOptions: ConfigModuleOptions = {
	isGlobal: true,
	envFilePath: '.env',
};

// Database (Postgres)
const typeOrmModuleAsyncOptions: TypeOrmModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: typeOrmModuleOptionsFactory,
	inject: [ConfigService],
};

// Caching (Redis)
const cacheModuleAsyncOptions: CacheModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: cacheModuleOptionsFactory,
	inject: [ConfigService],
	isGlobal: true,
};

// BullMQ Queue (Redis)
const bullModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: (configService: ConfigService) => ({
		connection: buildRedisConnection(configService),
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
};

// Rate limiting
// https://docs.nestjs.com/security/rate-limiting#multiple-throttler-definitions

const SHORT_THROTTLER: ThrottlerOptions = {
	name: 'short',
	ttl: 1000,
	limit: 3,
};

const MEDIUM_THROTTLER: ThrottlerOptions = {
	name: 'medium',
	ttl: 10000,
	limit: 20,
};

const LONG_THROTTLER: ThrottlerOptions = {
	name: 'long',
	ttl: 60000,
	limit: 100,
};

const throttlerModuleOptions: ThrottlerModuleOptions = [SHORT_THROTTLER, MEDIUM_THROTTLER, LONG_THROTTLER];

const throttlerGuardProvider: Provider = {
	provide: APP_GUARD,
	useClass: ThrottlerGuard,
};

@Module({
	imports: [
		ConfigModule.forRoot(configModuleOptions),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule.registerAsync(cacheModuleAsyncOptions),
		ThrottlerModule.forRoot(throttlerModuleOptions),
		BullModule.forRootAsync(bullModuleAsyncOptions),
		ScheduleModule.forRoot(),
		HealthModule,
		AuthModule,
		DatabaseModule,
		MonitoringModule,
		SchedulerModule,
		QueuesModule,
	],
	providers: [throttlerGuardProvider, CacheShutdownService],
})
export class AppModule {}

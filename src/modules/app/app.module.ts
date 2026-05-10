import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { CacheModule, CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { buildRedisOptions } from '../../config/redis.config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { QueuesModule } from '../queues/queues.module';
import { DatabaseModule } from '../database/database.module';
import { typeOrmModuleOptionsFactory } from './typeorm';
import { cacheModuleOptionsFactory } from './cache';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../auth/auth.module';
import { CacheShutdownService } from './cache-shutdown.service';
import { ScheduledMessagesModule } from '../scheduled-messages/scheduled-messages.module';

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

// BullMQ Queue (Redis — supports direct + sentinel modes)
// BullMQ requires maxRetriesPerRequest: null for workers' blocking commands
// (see https://docs.bullmq.io/guide/connections)
const bullModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: (configService: ConfigService) => ({
		connection: {
			...buildRedisOptions(configService),
			maxRetriesPerRequest: null,
			enableReadyCheck: false,
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

const throttlerGuardProvider: Provider = {
	provide: APP_GUARD,
	useClass: ThrottlerGuard,
};

@Module({
	imports: [
		ConfigModule.forRoot(configModuleOptions),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule.registerAsync(cacheModuleAsyncOptions),
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				throttlers: [SHORT_THROTTLER, MEDIUM_THROTTLER, LONG_THROTTLER],
				storage: new ThrottlerStorageRedisService(new Redis(buildRedisOptions(configService))),
			}),
		}),
		BullModule.forRootAsync(bullModuleAsyncOptions),
		ScheduleModule.forRoot(),
		HealthModule,
		AuthModule,
		DatabaseModule,
		MonitoringModule,
		SchedulerModule,
		ScheduledMessagesModule,
		QueuesModule,
	],
	providers: [throttlerGuardProvider, CacheShutdownService],
})
export class AppModule {}

import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import KeyvRedis from '@keyv/redis';

const logger = new Logger('CacheModule');

export function createRedisStore(redisUrl: string): KeyvRedis<unknown> {
	const store = new KeyvRedis(redisUrl);

	const safeUrl = redisUrl.replace(/:\/\/[^@]*@/, '://*****@');

	store.on('connect', () => {
		logger.log(`Redis connected (${safeUrl})`);
	});

	store.on('ready', () => {
		logger.log('Redis ready');
	});

	store.on('error', (error: unknown) => {
		const err = error instanceof Error ? error : undefined;
		logger.error(`Redis error: ${err?.message ?? error}`, err?.stack);
	});

	store.on('close', () => {
		logger.warn('Redis connection closed');
	});

	store.on('reconnecting', () => {
		logger.warn('Redis reconnecting...');
	});

	return store;
}

export function cacheModuleOptionsFactory(configService: ConfigService): CacheOptions {
	const redis_host = configService.get('REDIS_HOST', 'redis');
	const redis_port = configService.get('REDIS_PORT', 6379);
	const redis_password = configService.get('REDIS_PASSWORD');
	const redis_db = configService.get<number>('REDIS_DB', 0);
	const redis_url = redis_password
		? `redis://:${encodeURIComponent(redis_password)}@${redis_host}:${redis_port}/${redis_db}`
		: `redis://${redis_host}:${redis_port}/${redis_db}`;

	return {
		stores: [createRedisStore(redis_url)],
		ttl: 900,
		max: 1000,
	};
}

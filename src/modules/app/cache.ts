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

	store.on('error', (error: Error) => {
		logger.error(`Redis error: ${error?.message ?? error}`, error?.stack);
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
	const redis_url = redis_password
		? `redis://:${redis_password}@${redis_host}:${redis_port}`
		: `redis://${redis_host}:${redis_port}`;

	return {
		stores: [createRedisStore(redis_url)],
		ttl: 900,
		max: 1000,
	};
}

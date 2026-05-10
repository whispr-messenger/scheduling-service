import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis, { createSentinel } from '@keyv/redis';
import { parseSentinels } from '@/config/redis.config';

export function cacheModuleOptionsFactory(configService: ConfigService): CacheOptions {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	const username = configService.get<string>('REDIS_USERNAME');
	const password = configService.get<string>('REDIS_PASSWORD');
	const db = Number.parseInt(configService.get<string>('REDIS_DB', '0'), 10);

	if (mode === 'sentinel') {
		const sentinelsStr = configService.get<string>('REDIS_SENTINELS', '');
		const masterName = configService.get<string>('REDIS_MASTER_NAME', 'mymaster');
		const sentinelUsername = configService.get<string>('REDIS_SENTINEL_USERNAME');
		const sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');

		const sentinelRootNodes = parseSentinels(sentinelsStr);
		const sentinel = createSentinel({
			name: masterName,
			sentinelRootNodes,
			nodeClientOptions: { username, password, database: db },
			sentinelClientOptions: { username: sentinelUsername, password: sentinelPassword },
		});

		return {
			stores: [new KeyvRedis(sentinel)],
			ttl: 900,
			max: 1000,
		};
	}

	const host = configService.get<string>('REDIS_HOST', 'redis');
	const port = configService.get<string>('REDIS_PORT', '6379');
	const auth =
		username || password
			? `${encodeURIComponent(username ?? '')}:${encodeURIComponent(password ?? '')}@`
			: '';
	const redis_url = `redis://${auth}${host}:${port}/${db}`;

	return {
		stores: [new KeyvRedis(redis_url)],
		ttl: 900,
		max: 1000,
	};
}

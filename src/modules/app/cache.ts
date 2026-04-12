import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis, { createClient, createSentinel } from '@keyv/redis';
import { parseSentinels } from './redis-connection';

export function cacheModuleOptionsFactory(configService: ConfigService): CacheOptions {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	if (mode !== 'direct' && mode !== 'sentinel') {
		throw new Error(`Unsupported REDIS_MODE "${mode}": must be "direct" or "sentinel"`);
	}
	const dbStr = configService.get<string>('REDIS_DB', '0');
	const db = Number(dbStr);
	if (!Number.isInteger(db) || db < 0) {
		throw new Error(`Invalid REDIS_DB "${dbStr}": must be a non-negative integer`);
	}
	const username = configService.get<string>('REDIS_USERNAME') || undefined;
	const password = configService.get<string>('REDIS_PASSWORD') || undefined;

	let client: ReturnType<typeof createClient> | ReturnType<typeof createSentinel>;

	if (mode === 'sentinel') {
		const sentinelsStr = configService.get<string>('REDIS_SENTINELS');
		const masterName = configService.get<string>('REDIS_MASTER_NAME');
		const sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');

		if (!sentinelsStr) {
			throw new Error('REDIS_SENTINELS is required when REDIS_MODE=sentinel');
		}
		if (!masterName) {
			throw new Error('REDIS_MASTER_NAME is required when REDIS_MODE=sentinel');
		}
		if (!sentinelPassword) {
			throw new Error('REDIS_SENTINEL_PASSWORD is required when REDIS_MODE=sentinel');
		}

		client = createSentinel({
			name: masterName,
			sentinelRootNodes: parseSentinels(sentinelsStr),
			nodeClientOptions: { username, password, database: db },
			sentinelClientOptions: { password: sentinelPassword },
		});
	} else {
		const host = configService.get<string>('REDIS_HOST', 'redis');
		const portStr = configService.get<string>('REDIS_PORT', '6379');
		const port = Number(portStr);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error(`Invalid REDIS_PORT "${portStr}": must be an integer between 1 and 65535`);
		}
		client = createClient({
			socket: { host, port },
			username,
			password,
			database: db,
		});
	}

	return {
		stores: [new KeyvRedis(client)],
		ttl: 900,
		max: 1000,
	};
}

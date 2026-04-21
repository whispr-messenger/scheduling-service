import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis, { createClient, createSentinel } from '@keyv/redis';
import { parseBaseRedisEnv, parseSentinels } from './redis-connection';

export function cacheModuleOptionsFactory(configService: ConfigService): CacheOptions {
	const { mode, db, username, password } = parseBaseRedisEnv(configService);

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

		const sentinelRootNodes = parseSentinels(sentinelsStr);
		if (sentinelRootNodes.length === 0) {
			throw new Error(
				'REDIS_SENTINELS must include at least one host:port entry when REDIS_MODE=sentinel'
			);
		}

		client = createSentinel({
			name: masterName,
			sentinelRootNodes,
			nodeClientOptions: {
				database: db,
				...(username || password
					? {
							credentialsProvider: {
								type: 'async-credentials-provider' as const,
								credentials: async () => ({
									username: username ?? 'default',
									password: password ?? '',
								}),
							},
						}
					: {}),
			},
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

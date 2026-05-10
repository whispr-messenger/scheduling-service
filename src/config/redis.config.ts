import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function parseSentinels(sentinelsStr: string): Array<{ host: string; port: number }> {
	return sentinelsStr.split(',').map((s) => {
		const [host, port] = s.trim().split(':');
		return { host, port: Number.parseInt(port, 10) };
	});
}

export function buildRedisOptions(configService: ConfigService): RedisOptions {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	const db = Number.parseInt(configService.get<string>('REDIS_DB', '0'), 10);
	const username = configService.get<string>('REDIS_USERNAME');
	const password = configService.get<string>('REDIS_PASSWORD');

	if (mode === 'sentinel') {
		const sentinelsStr = configService.get<string>('REDIS_SENTINELS');
		const masterName = configService.get<string>('REDIS_MASTER_NAME');
		const sentinelUsername = configService.get<string>('REDIS_SENTINEL_USERNAME');
		const sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');

		if (!sentinelsStr) throw new Error('REDIS_SENTINELS is required when REDIS_MODE=sentinel');
		if (!masterName) throw new Error('REDIS_MASTER_NAME is required when REDIS_MODE=sentinel');

		return {
			sentinels: parseSentinels(sentinelsStr),
			name: masterName,
			db,
			username,
			password,
			sentinelUsername,
			sentinelPassword,
			enableReadyCheck: true,
			maxRetriesPerRequest: 3,
		};
	}

	return {
		host: configService.get<string>('REDIS_HOST', 'localhost'),
		port: Number.parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
		db,
		username,
		password,
		maxRetriesPerRequest: 3,
		lazyConnect: true,
	};
}
